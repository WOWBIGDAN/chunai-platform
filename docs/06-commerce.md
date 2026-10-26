# 产品、订单、物流与售后后端

更新：2026-10-24。实现基于 NestJS、TypeORM 和 MySQL，支持实物商品的完整测试交易流程。用户已确认暂不接入第三方支付、退款和快递查询。

实物交易模块已部署到测试服务 `http://47.97.46.242/api/v1`。2026-10-25 新增课程数字订单与退款、内容和专栏，见 [课程后端说明](08-content-courses.md)。

## 启动与建表

沿用现有 `.env` 和 MySQL 配置：

```powershell
npm.cmd ci
npm.cmd run migration:run
npm.cmd run build
npm.cmd start
```

新增迁移 `1792800000000-CreateCommerce` 执行 [commerce.sql](../database/commerce.sql)，增加 20 张表，保留原有认证表与用户数据。空库执行迁移会依次创建认证表和交易表；已有认证库只执行新增迁移。`synchronize=false`，不能用自动同步代替迁移。

| 表 | 用途 |
|---|---|
| `admin_accounts`、`admin_sessions`、`admin_refresh_tokens` | 独立管理员、会话、刷新令牌哈希 |
| `product_categories`、`product_images` | 产品分类与公开图片登记 |
| `products`、`product_skus`、`stock_movements` | 产品、规格与价格、实物及预占库存流水 |
| `user_addresses`、`order_quotes` | 本人地址、十分钟有效报价快照 |
| `commerce_orders`、`order_items` | 订单与商品成交快照 |
| `shipments`、`logistics_events` | 一单一包裹、实际发货数量、人工轨迹 |
| `after_sales`、`after_sale_items` | 售后单与申请数量、退款金额 |
| `payment_records`、`refunds` | 测试付款和退款台账 |
| `idempotency_records`、`commerce_audit_logs` | 持久化幂等结果与操作审计 |

数据库包含唯一索引、外键和 CHECK 约束：一个报价最多一单、一单最多一包裹、一单最多一笔合法测试付款、一个售后最多一条退款；生成列唯一索引限制一个订单最多一张活跃售后单。库存不得低于预占，退款汇总不得超过实付。订单及财务历史采用限制删除的外键，不能级联删除用户后顺带清除交易历史。

MySQL DDL 不能整体事务回滚，新表使用可重入建表语句支持中断后重跑。交易迁移的 `down()` 不执行删表；应用回滚使用旧程序版本，数据恢复使用备份。

## 管理员初始化与权限

普通注册只创建 `users`，没有公开管理员注册、升级角色或权限编辑接口。管理员由有数据库运维权限的人在终端创建。命令会隐藏输入密码；密码不放入参数、示例文件或输出日志。

```powershell
# 管理员密码要求 12–72 个字符；执行后按终端提示输入。
npm.cmd run admin -- create commerce_admin "content:write,products:write,orders:read,orders:ship,aftersales:review,payments:test,audit:read" "交易管理员"

# 只读订单账号示例
npm.cmd run admin -- create order_viewer "orders:read" "订单查看员"

# 后续调整、禁用和改密；这些操作均撤销该账号的全部管理员会话。
npm.cmd run admin -- permissions order_viewer "orders:read"
npm.cmd run admin -- disable order_viewer
npm.cmd run admin -- reset-password commerce_admin
```

编译后的命令入口为 `node dist/commerce/admin-cli.js`，参数与上面相同。服务器运行时需要加载 `/etc/chunai/api.env` 的数据库配置。例如有 root 权限的管理员在 SSH 交互终端执行：

```bash
cd /opt/chunai/current
sudo systemd-run --quiet --wait --pty --collect \
  --property=User=chunai --property=Group=chunai \
  --property=EnvironmentFile=/etc/chunai/api.env \
  --working-directory=/opt/chunai/current \
  /usr/bin/node /opt/chunai/current/dist/commerce/admin-cli.js \
  create commerce_admin 'content:write,products:write,orders:read,orders:ship,aftersales:review,payments:test,audit:read' '交易管理员'
```

| 身份／权限 | 能做的事 |
|---|---|
| 游客 | 查询启用产品分类和上架商品、可售 SKU |
| 普通用户 `aud=client` | 操作本人的地址、报价、订单、物流、售后、退款查询 |
| `content:write` | PRODUCT／CONTENT 分类、科普课程章节、内容素材与专栏管理 |
| `membership:write` | 会员套餐与启停、手工期限管理、购买期限查询；付费期限不能被手工覆盖 |
| `users:read` | 后台脱敏用户列表、资料详情与即时会员状态 |
| `users:ban` | 按版本封禁和解封用户；封禁同步撤销全部客户端会话 |
| `products:write` | 图片登记、产品与 SKU 维护、上下架、库存调整和流水查询 |
| `orders:read` | 查询订单和物流；订单列表不返回收货地址，详情返回履约地址并记审计 |
| `orders:ship` | 发货、揽收前改运单、录入人工物流事件 |
| `aftersales:review` | 查询、审核、验收售后、重试失败退款；敏感详情读取记审计 |
| `payments:test` | 在显式开启的测试环境确认测试付款／退款结果 |
| `audit:read` | 查询交易审计日志 |

管理员使用 `/admin/auth/login`、`/admin/auth/refresh`、`/admin/auth/logout` 和 `/admin/me`。令牌的 `aud=admin`，与客户端会话、刷新令牌完全独立。管理员访问令牌默认 15 分钟，刷新会话绝对期限为 24 小时；刷新令牌轮换，旧令牌重放撤销会话。

每次请求从数据库读取管理员是否启用以及最新权限，业务写入事务中再次校验。权限没有隐式继承，例如只有 `orders:read` 不能发货，只有售后审核权限不能模拟付款。普通用户访问别人的业务 ID 返回 404，不能靠请求体、查询参数或修改 JWT 自报管理员身份。

## 产品与图片

流程：创建分类 → 登记公开产品图片 → 创建产品草稿 → 创建 SKU → 库存入库 → 发布产品。

产品图片可通过 [统一上传](10-unified-uploads.md) 的 `PRODUCT_IMAGE` 用途申请 OSS 表单，完成校验后将返回的 `id` 用作 `coverMediaId` 或 `galleryMediaIds`，需要 `media:write` + `products:write`。`POST /admin/product-images` 继续兼容登记已有 HTTPS 图片地址；该兼容接口不抓取 URL 或校验远端字节。商品详情 HTML 只保留基础段落、列表、强调和标题标签，移除脚本、事件属性和链接。

SKU 初始库存为 0；实物库存只能通过库存调整接口和发货事务改变。单价采用人民币整数分，范围 1–100,000,000；单笔订单最高 100,000,000 分，单行数量 1–999，最多 50 行。SKU 编号全局唯一，同产品规格组合唯一，规格维度名不得重复。

发布至少需要一个启用 SKU。下架停止新的公开发现和购买，已有订单仍按成交快照履约。价格或规格变更后旧报价无法直接下单，返回 `QUOTE_CHANGED`；已创建的订单价格、名称、规格、图片和地址不随商品或地址簿修改而变化。

有库存流水、报价或订单历史的 SKU 只能停用，不能删除；产品只能删除无 SKU 的草稿。分类存在子分类或产品引用时不能删除，分类父子循环被拒绝。

## 订单、库存与幂等

```text
本人地址 → POST /order-quotes → POST /orders
PENDING_PAYMENT → 测试付款 → PENDING_SHIPMENT → 发货 → PENDING_RECEIPT → 确认收货 → COMPLETED
PENDING_PAYMENT → 用户取消／付款超时 → CANCELLED
已付款订单 → 全额退款成功 → CLOSED
```

客户端只提供 SKU、数量和本人地址。商品金额、退款金额、用户归属及状态均由后端确定。当前免运费，不支持折扣、数字商品和混合订单。

| 时点 | 实物库存 | 预占库存 |
|---|---:|---:|
| 初始库存 10 | 10 | 0 |
| 下单购买 2 件 | 10 | 2 |
| 测试付款成功 | 10 | 2 |
| 发货剩余 2 件 | 8 | 0 |
| 若在发货前取消或退款成功 | 10 | 0 |
| 已发货后退货退款成功 | 保持发货后的值 | 0 |

待付款订单 30 分钟到期。定时任务每 30 秒检查到期订单和超过退货寄回期限的申请，分别最多处理 100 条；服务重启后继续检查。详情读取也会处理目标记录的超时。列表状态最多滞后一个扫描周期，批量积压会跨多轮处理；付款和退货提交命令始终同步检查时间，不能利用扫描间隔越过期限。`NODE_ENV=test` 不启动后台定时器，测试直接调用扫描服务。

下单、取消、确认收货、库存调整、发货、售后操作和测试结算要求 `Idempotency-Key`，由 16–64 位字母、数字、下划线或短横线组成。相同操作者＋相同键＋相同路径及请求体返回原结果；更换请求内容却沿用同键返回 `409 IDEMPOTENCY_CONFLICT`。结果与业务变更在同一事务提交，失败请求不占用幂等键；当前持久保留记录，尚未启用自动清理。

修改已有业务记录需传最新 `version`，不匹配返回 `409 VERSION_CONFLICT`。事务使用行锁；库存涉及多个商品时按产品 ID、SKU ID 排序加锁。取消、付款、发货和售后都先锁定同一订单，避免重复扣减或超卖。查询订单及售后行使用一致性读，避免拼接不同事务时刻的金额和数量。

## 测试付款与退款

默认 `.env.example` 为 `COMMERCE_TEST_PAYMENTS=false`。本地或 staging 联调时显式配置：

```dotenv
NODE_ENV=development
COMMERCE_TEST_PAYMENTS=true
```

管理员需 `payments:test` 权限，调用：

```http
POST /api/v1/admin/orders/{orderId}/test-payment
Authorization: Bearer <adminAccessToken>
Idempotency-Key: <unique-key>
Content-Type: application/json

{"version":1,"transactionNo":"test_payment_001"}
```

金额直接取订单。只能确认有效的待付款订单，测试流水号不能跨订单复用。取消和付款竞争只有一方成功。这里没有真实渠道扣款，因此取消或超时后不会接受所谓迟到付款，也不伪造微信／支付宝成功回调。

售后审核通过或退货验收后创建 `PROCESSING` 退款，售后为 `REFUNDING`；此时库存和退款汇总尚不改变。测试确认：

```http
POST /api/v1/admin/refunds/{refundId}/test-result
Authorization: Bearer <adminAccessToken>
Idempotency-Key: <unique-key>
Content-Type: application/json

{"version":2,"result":"SUCCEEDED"}
```

这里的 `version` 是售后单当前版本。也可模拟 `FAILED`，随后用 `/admin/aftersales/{id}/retry-refund` 重试原退款 ID。失败期间仍冻结发货和剩余售后额度。

`NODE_ENV=production` 始终拒绝测试结算，即使开关为 true。真实支付尝试、回调验签、补查、对账和真实退款尚未接入，对应旧设计接口仍标记 planned。本版本不会发生真实扣款或转账。

## 物流与售后联动

发货只允许已付款待发货且没有活跃售后的订单，每单一个包裹，一次发出所有“购买数量－已退款数量”。发货事务同时减少实物库存和预占库存，并保存实际发货行数量。已下架产品的既有订单仍可发货。

当前快递代码：`SF`、`YTO`、`ZTO`、`STO`、`YUNDA`、`EMS`、`JD`。运单号只能包含字母、数字和短横线。揽收前且无物流事件时可纠错，必须提供原因和版本。

`POST /admin/shipments/{id}/events` 由有发货权限的管理员填写人工轨迹；事件 `source=MANUAL`，查询 `syncStatus=MANUAL`，`lastSyncedAt=null`。不将人工记录表示成快递服务同步结果。轨迹按时间倒序返回最近 100 条。揽收后不能改运单，签收后不能倒退物流状态；快递签收不会自动确认收货。

售后规则：

- 只允许本人已付款实物订单。未发货申请 `REFUND_ONLY`，发货后申请 `RETURN_REFUND`，确认收货后七天内可申请。
- 一个订单只能有一张活跃售后，可包含多行；每行数量不得超过剩余未退款数量，退款按成交单价计算。退款金额不能由用户提交。
- 活跃状态为 `PENDING_REVIEW`、`AWAITING_RETURN`、`RETURNING`、`REFUNDING`、`REFUND_FAILED`，期间阻止发货和确认收货。
- 待审核或待寄回可由本人撤销；驳回、撤销、超时关闭后解除售后冻结，原已付款库存预占仍保留给后续发货。
- 退货退款审核必须提供退货地址，批准后七天内提交退货运单；管理员验收后才进入退款，物流签收不能代替验收。
- 只有退款成功才增加订单行已退款数量、汇总退款金额；未发货退款释放对应预占，部分退款后继续履约剩余数量，全额退款关闭订单。
- 已发货退款不自动增加可售库存。退件质检后由库存权限管理员显式入库，并注明关联售后号。
- 运费字段和最后一批剩余商品退运费的规则已保留；当前报价运费为 0，不额外补贴退货运费。

售后支持文字说明与私有图片凭证。先按 [统一上传说明](10-unified-uploads.md) 上传并完成 `AFTERSALE_EVIDENCE` 图片，再在 `evidenceMediaIds` 提交最多 9 个本人 READY 素材。凭证与售后在同一事务绑定，不得跨用户或跨售后复用；详情只返回私有元数据，图片通过 60 秒 `read-grant` 查看。当前测试服务器已配置 OSS 公私 Bucket 与 ECS RAM 角色，配置和联调记录见统一上传说明；仍可省略或传 `[]` 提交文字售后。当前不产生站内通知，因为通知模块尚未实现。

## 联调与发布

导入 [已实现接口 OpenAPI](openapi-implemented.json)，或使用 [交易 HTTP 示例](../examples/commerce.http)。[完整 OpenAPI](openapi.json) 保留后续模块契约，[认证 OpenAPI](openapi-auth.json) 继续只包含原有用户认证与健康检查。

```powershell
npm.cmd run typecheck
npm.cmd test
# TEST_DB_* 必须指向独立且名称以 _test 结尾的 MySQL 数据库
npm.cmd run test:e2e
npm.cmd run build
python scripts/build_api_docs.py
python scripts/validate_commerce_responses.py
```

已通过 13 项单元测试、39 项真实 MySQL 接口测试。覆盖账号与令牌隔离、实时权限、资源归属、并发库存、幂等、价格快照、超时释放、付款／取消竞争、发货／售后竞争、退款失败与重试、部分退款、退货验收和人工物流。测试仅清理本次创建的记录，保留独立测试库及其他数据。

E2E 测试在忽略提交的 `.tmp/commerce-contract-responses.json` 保存测试业务成功响应，不保存登录令牌。`validate_commerce_responses.py` 将真实响应与文档校验；本次验证 239 份响应、37 种路由。CI 已加入该校验，避免接口返回与 OpenAPI 分离。编译后的 NestJS 启动、重复迁移、公开商品查询及隐藏密码的管理员创建命令均已通过验证。

CI 发布包包含全部迁移 SQL 和编译后的管理员 CLI。发布前备份数据库；推送 main 后现有工作流会测试、迁移和切换版本。测试交易配置 `COMMERCE_TEST_PAYMENTS=true`。当前应用普通 JSON 限制 16 KiB、产品描述 256 KiB、科普与章节正文 4 MiB，视频上传 100 MiB。Nginx 与私有视频持久目录配置见 [课程后端说明](08-content-courses.md) 和 [部署说明](05-deployment.md)。

实现使用 [NestJS Guards](https://docs.nestjs.com/guards) 分离鉴权与权限检查，并在 [TypeORM 事务](https://typeorm.io/docs/transactions/) 内统一执行业务写入和行锁。
