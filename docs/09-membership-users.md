# 会员购买、用户资料与后台用户管理

更新：2026-10-26，接口契约版本 `1.5.0`。本模块复用已有订单、测试付款退款、客户端会话与管理员权限；会员购买不涉及真实资金流。所有路径均带 `/api/v1` 前缀。可导入 [已实现 OpenAPI](openapi-implemented.json)，完整请求见 [HTTP 示例](../examples/membership-users.http)。

## 接口与权限

| 接口 | 权限及用途 |
|---|---|
| `GET /membership-plans`、`GET /membership-plans/{id}` | 公开查询启用方案；停用方案详情返回 404 |
| `GET/POST /admin/membership-plans`、`GET/PATCH /admin/membership-plans/{id}` | `membership:write`：管理方案、启停、修改价格和时长 |
| `POST /order-quotes`、`POST /orders` | 已登录用户：购买或续购会员，`type=MEMBERSHIP` |
| `POST /admin/orders/{id}/test-payment` | `payments:test`：确认测试付款并追加权益段 |
| `GET /me/membership`、`GET /me/membership/periods` | 已登录用户：查询本人即时会员状态、分页购买历史 |
| `GET /admin/users/{id}/membership`、`GET /admin/users/{id}/membership/periods` | `membership:write`：查询指定用户的期限及权益段 |
| `PUT /admin/users/{id}/membership`、`POST /admin/users/{id}/membership/revoke` | `membership:write`：维护手工期限；有未到期付费权益时拒绝覆盖 |
| `POST /admin/orders/{id}/digital-refund` | `aftersales:review`：申请未来完整会员段全额退款 |
| `POST /admin/refunds/{id}/test-result` | `payments:test`：确认测试退款结果 |
| `PATCH /me` | 已登录用户：修改本人昵称和 OSS 头像地址 |
| `GET /admin/users`、`GET /admin/users/{id}` | `users:read`：查询脱敏用户资料及会员状态，读取写入审计 |
| `POST /admin/users/{id}/ban`、`POST /admin/users/{id}/unban` | `users:ban`：封禁或解封，要求版本与幂等键 |

管理员与普通用户使用不同 audience 的令牌，不能互换。管理员权限每次请求实时读取，写事务再次校验。新增权限须显式赋予相应管理员；`users:read` 不自动获得封禁或会员管理权限。

## 会员方案

创建方案必须传 `name`、`description`、`durationDays`、`priceCents`；可传 `benefitCodes`、`sortOrder`。方案默认停用，POST 不接收 `enabled`，创建后用最新 `version` PATCH 启用。

| 字段 | 约束 |
|---|---|
| `name` | 去除首尾空白后 1–64 字符 |
| `description` | 0–2000 字符 |
| `durationDays` | 1–3650 整数，一天固定 24 小时 |
| `priceCents` | 1–100000000 整数，人民币分 |
| `benefitCodes` | 当前只支持 `["MEMBER_CONTENT"]`，省略时取此值 |
| `sortOrder` | 0–1000000 整数，默认 0 |

方案响应另有 `id`、`enabled`、`version`、`createdAt`、`updatedAt`。列表支持 `page`、`pageSize`、`keyword`，管理列表另支持 `enabled=true/false`；按 `sortOrder` 升序、`createdAt` 降序、`id` 升序。PATCH 至少提交 `version` 和一个修改字段，旧版本返回 `409 VERSION_CONFLICT`。方案使用停用保留财务引用，无物理删除接口。

当前会员只解锁 `MEMBER` 内容，单独购买的 `PURCHASE` 课程仍须下单。AI 模块尚未实现，方案不接收 `aiDailyLimit` 或 `AI_DAILY_QUOTA`。会员没有自动扣款续费，用户再次下单完成续期。

## 购买与续期

1. 读取启用方案，普通用户 `POST /order-quotes`，请求 `{"type":"MEMBERSHIP","planId":"方案 UUID"}`。不传地址、SKU、数量或金额。
2. 使用返回的 `quoteId` 创建订单，携带独立 `Idempotency-Key`。报价 10 分钟有效，一份报价最多创建一单，同用户同方案最多一份有效待付款订单。下单重新核对方案名称、金额、时长、权益；条款改变返回 `QUOTE_CHANGED`，需要重新试算。
3. 管理员通过现有测试付款接口提交订单 `version`、唯一 `transactionNo` 和幂等键。环境必须为 development/test/staging 且 `COMMERCE_TEST_PAYMENTS=true`；生产环境禁用此通道。
4. 同一事务写入付款流水、`COMPLETED` 订单和唯一对应订单的会员权益段。订单为 `type=MEMBERSHIP`，行项目 `resourceType=MEMBERSHIP_PLAN`、`quantity=1`、`productId=null`、`skuAttributes=[]`；`address=null`、运费 0，不进入库存、物流、收货或实物售后。
5. 用户重新读取 `GET /me/membership` 和 `/me/membership/periods`。付款重复请求不会重复延长会员。

每个订单行的 `membershipSnapshot` 保存 `planId`、`name`、`durationDays`、`priceCents`、`benefitCodes`。订单创建后的方案编辑不改成交条款；方案停用会阻止尚未付款订单结算。已授予的会员段保持有效。

新权益段从 `max(当前时间, 未撤销的手工会员结束时间, 现有 ACTIVE 购买权益的最晚结束时间)` 起算，追加快照中的完整天数。并发付款按用户锁串行分配时段。同一用户可持有多个未来续费段，未来段不会提前提供权限。

`GET /me/membership` 继续返回 `active`、`expiresAt`、`benefitCodes`、`membership`：

- `active`：账号 ACTIVE，并且手工期限或 ACTIVE 付费段满足 `startsAt <= now < expiresAt`。
- `expiresAt`：未撤销手工期限和 ACTIVE 付费段的最晚结束时间，可能为未来或已经过期；无候选记录为 null。判断资格必须使用 `active`。
- `benefitCodes`：有效时为 `["MEMBER_CONTENT"]`，否则为 `[]`。
- `membership`：仅为管理员手工期限记录；用户只有购买权益时该字段为 null。

购买历史通过 `/membership/periods` 分页返回，默认 20、最大 100，按 `createdAt` 降序、`id` 升序。每段含 `id`、`userId`、`planId`、`orderId`、`snapshot`、`startsAt`、`expiresAt`、`status`、`revokedAt`、`createdAt`。`status=ACTIVE` 的历史段也可能已经到期，不能只用此字段判断访问资格。

## 退款与手工期限的关系

管理员只可为**尚未开始的完整未来会员段**发起全额退款，已开始或已过期返回 `MEMBERSHIP_REFUND_NOT_ALLOWED`。请求沿用数字订单退款接口，提交 `orderVersion`、`reason` 与幂等键，不接收客户端金额。

受理后目标段转 `REFUND_PENDING`，其他尚未开始的付费段转 `SUSPENDED`，已经开始的段继续按原期限生效。等待退款期间阻止新的会员付款结算，也不能手工覆盖期限；这可避免退款尚未完成时消费待退款或后续权益。

测试退款确认使用**退款流水的 version**。成功将目标设为 `REVOKED`，订单全额退款并关闭，其余暂停段按原顺序从当前可用期限后衔接，保留各自完整天数和成交快照。失败恢复目标和其他暂停段，同样保留完整天数；再次申请时必须仍然是未来段，沿用原退款记录。退款成功不会撤销其他订单的会员权益或独立课程购买权。

手工期限继续独立保存在 `user_memberships`。当有未到期 ACTIVE 付费段、`REFUND_PENDING` 或 `SUSPENDED` 段时，手工开通／改期／撤销返回 `MEMBERSHIP_PAID_TERM_EXISTS`。管理员应通过对应订单处理付费权益，避免修改手工到期时间覆盖用户已付费时长。

## 用户资料与头像

先 `GET /me` 读取 `version`，再 `PATCH /me` 提交版本及 `nickname`、`avatarMediaId` 或兼容字段 `avatarUrl` 中至少一个字段。昵称去除首尾空白后 1–32 字符，禁止控制字符；两种头像字段互斥，传 null 清空、省略保持不变。响应返回最新 `UserSummary`，注册／登录／刷新返回的用户摘要也含 `version`。

新头像推荐先通过 [统一上传](10-unified-uploads.md) 的 `AVATAR` 用途完成上传，再传本人 READY 图片的 `avatarMediaId`。兼容 `avatarUrl` 必须是已存在的 `https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/<对象路径>`，允许通过 `CONTENT_IMAGE_OSS_HOST` 调整主机；拒绝临时签名地址、非 HTTPS、其他域名、账号密码、显式端口和 fragment。兼容登记不下载或检查远端对象，通过 URL 引用系统管理的头像仍校验本人归属。

资料接口不接收手机号、账号状态、权限或会员期限。版本冲突返回 `409 VERSION_CONFLICT`，前端重读资料后提交；修改资料不撤销会话，封禁／改密等安全操作仍按原规则撤销会话。

## 后台查询、封禁与解封

用户列表支持 `keyword`（昵称字面子串）、`phone`（完整 E.164 精确查询）、`status`、`hasMembership=true/false`、`createdFrom`、`createdTo`、`page`、`pageSize`。本列表的日期上下界都包含，要求 `createdFrom <= createdTo`。按 `createdAt,id` 降序；搜索中的 `%`、`_` 作为普通字符。`hasMembership` 与内容授权使用同一即时判断，封禁用户不会被标记为当前有效会员。

列表和详情只返回 `phoneMasked`，不返回完整手机号、密码哈希、会话令牌或问答内容。`AdminUser` 在用户摘要外增加 `banReason`、`bannedAt`、`lastLoginAt`、`updatedAt`。查询与状态变更均写审计，审计不记录输入的手机号或昵称搜索值。

封禁与解封请求均为 `{"version":当前用户版本,"reason":"操作说明"}`，必带 16–64 位 `Idempotency-Key`。只允许 ACTIVE → BANNED 或 BANNED → ACTIVE；状态不符返回 `USER_STATUS_CONFLICT`，DEACTIVATED 不能通过这两个接口重新启用。当前不支持 `until` 或定时解封。

封禁与全部客户端会话撤销在同一事务内完成，旧访问令牌和刷新令牌不能继续使用。解封后用户重新登录，旧会话不恢复。封禁保留订单、付款退款记录和会员时段，会员计时不暂停；后台售后退款仍可处理，重新开通会员的结算需账号有效。

## 数据库与验证

[增量迁移](../src/database/migrations/1793059200000-MembershipPurchasesUsers.ts) 新增 `membership_plans`、`membership_entitlements`，保留原来的手工 `user_memberships`，并扩展 `users` 的头像／版本／封禁信息与订单行的会员引用、方案快照。订单行分别关联 SKU、课程或会员方案，数据库约束禁止混用；会员权益的订单 ID 唯一，防止重复入账授予。

已有库通过 `npm run migration:run` 执行增量变更，不重建或清空业务表。后台方案创建和手工会员操作均写审计。备份继续覆盖 MySQL、私有视频目录及外链加密密钥。

验收覆盖资料字段白名单、头像域名、版本冲突、管理员权限隔离、用户筛选和隐私、封禁后会话失效与重新登录、方案启停、报价条款变动、支付幂等与并发续期、手工期限衔接、未来段退款成功／失败及访问资格。命令：

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e
python scripts/build_api_docs.py
python scripts/validate_commerce_responses.py
npm.cmd run build
```
