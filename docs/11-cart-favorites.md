# 购物车与内容收藏

更新：2026-10-27。所有接口以 `/api/v1` 为前缀，使用普通用户 Bearer Token；管理员令牌不能代替用户令牌。数据归属由会话决定，不接受 `userId`。成功响应继续使用统一 `data` 外壳。

## 购物车

购物车仅保存实物商品的 SKU，同一用户同一 SKU 只有一行；不同规格分别保存，最多 200 种 SKU，每行数量 1–999。课程、会员套餐仍通过原下单接口购买。

| 方法与路径 | 用途 | 参数 |
|---|---|---|
| `GET /me/cart` | 本人购物车，包含失效项 | `page`、`pageSize`，默认 1／20，最多 100 |
| `PUT /me/cart/items/{skuId}` | 加入、设置绝对数量、勾选 | `quantity`、`version`；可选 `selected` |
| `DELETE /me/cart/items/{skuId}` | 移除该 SKU | Query `version` |
| `POST /me/cart/quote` | 从明确选择的购物车条目生成报价 | `addressId`、`items:[{skuId,version}]` |

首次 PUT 使用 `version=0`，已有条目使用 GET／PUT 返回的最新版本。`quantity` 是最终数量，不是增量：原来 2 件、再传 3，结果为 3 件。新条目 `selected` 默认 true，更新省略则保留原值。相同版本及相同值不增加版本；并发编辑或重复提交旧版本返回 `409 VERSION_CONFLICT`，刷新后再决定是否修改。删除不存在的本人条目返回成功，删除存在条目则检查版本，防止覆盖另一个设备的操作。

购物车和报价均不占库存，只有创建订单成功才预占。每次读取按当前商品／分类／SKU／库存重新计算，不保存“是否可购买”的静态标记。

| availability | 条件 | 处理 |
|---|---|---|
| `AVAILABLE` | 商品上架、分类启用、SKU 启用且数量不超过可售库存 | 可以参与试算 |
| `PRODUCT_UNAVAILABLE` | 商品草稿或已下架 | 保留条目，`product=null`，不能新增或增加数量 |
| `CATEGORY_UNAVAILABLE` | 商品分类停用 | 同上 |
| `SKU_DISABLED` | 此规格停用 | 改选其他规格或移除 |
| `OUT_OF_STOCK` | 实物库存减订单预占库存为 0 | 补货或订单取消释放库存后自动恢复 |
| `STOCK_INSUFFICIENT` | 保存数量超过当前可售库存 | 提示用户减量，不自动改写数量 |

以上顺序也是多种状态同时存在时的优先级。`canPurchase` 仅在 `AVAILABLE` 时为 true；是否勾选另看 `selected`。`availableStock=onHandStock-reservedStock`，`maxQuantity=min(999,availableStock)`，后者不能单独作为商品可购买的依据。失效不自动清除勾选意图；前端应禁用其结算，后台也会拒绝。

新增条目、增加数量、从未选变已选均必须满足可购买条件；已有失效项允许减量、取消勾选和删除。下架／分类停用时不返回商品名称、封面等摘要，避免借购物车读取已隐藏的商品。重新上架、恢复分类、启用 SKU 或补货后，下次读取重新判定。

## 结算与订单的关系

1. GET 购物车，用户明确选取要结算的行。
2. POST `/me/cart/quote`，传本人 `addressId` 和 1–50 个不重复的 `{skuId,version}`；数量由服务端从购物车读取。所有条目必须属于本人、已勾选、版本一致且当前可购买，任何一行失败均不创建报价。
3. 返回与 `/order-quotes` 相同的 `OrderQuote`，使用当前价格和规格，报价有效 10 分钟，不占库存。
4. POST `/orders`，Body `{quoteId}`，携带 `Idempotency-Key`。在事务和商品／SKU 行锁内再次检查上架、SKU、分类、库存、价格和规格；库存不足返回 `STOCK_INSUFFICIENT`，价格／规格变化返回 `QUOTE_CHANGED`，停售返回 `PRODUCT_UNAVAILABLE`。
5. 创建订单、预占库存、清理本次购物车条目在同一事务内完成。只有条目 `id`、`version`、`quantity` 与试算快照一致才移除；试算后修改过数量／勾选、删除后重新加入、未参与结算的行保留。结算使用报价中已确认的数量，购物车后续编辑不改写报价。

重复创建同一报价的订单返回原订单，不再次扣库存或清理新加入的购物车条目；创建失败不清理购物车。取消／超时关闭订单释放库存，但不自动放回购物车。通过原 `/order-quotes` 直接下单不清理购物车。同一 SKU 在多位用户的购物车中不代表各自锁定库存；并发下单仍由已有事务预占机制保证不会超卖。

购物车 `product.unitPriceCents/subtotalCents` 为当前展示价，不是支付金额。金额以试算及最终订单为准，前端不得提交价格字段。

## 视频与图文收藏

| 方法与路径 | 用途 |
|---|---|
| `GET /me/favorites` | 本人收藏分页；可按 `kind`、`status=VALID/INVALID` 筛选 |
| `GET /me/favorites/{contentId}` | 查询本人是否收藏，返回 `favorited` 与 `favorite` |
| `PUT /me/favorites/{contentId}` | 收藏；无请求体或 `{}` |
| `DELETE /me/favorites/{contentId}` | 取消收藏，包括失效项；重复取消成功 |

支持 `SCIENCE_ARTICLE`、`SCIENCE_VIDEO`、`ARTICLE_COURSE`、`VIDEO_COURSE`，收藏对象为整条内容／整门课程，不是章节或专栏。最多 1000 条；同一用户同一内容有唯一约束。重复 PUT 不新增记录、不改变首次收藏时间，多个设备并发请求也只保留一条。

新增收藏必须是已上架且分类启用的内容，否则返回 404。已经收藏的内容下架后，收藏关系保留；GET 或重复 PUT 返回 `valid=false`、`invalidReason=CONTENT_UNAVAILABLE`、`content=null`。分类停用返回 `CATEGORY_UNAVAILABLE`；重新上架／启用后恢复。未收藏的 ID 返回 `{contentId,favorited:false,favorite:null}`，不暴露其他用户的收藏。

`valid` 表示内容当前公开可见；`access.canAccess` 表示当前用户有无对应阅读／播放资格。付费或会员课程可以先收藏：上架时 `valid=true`，未购买时 `access.reason=PURCHASE_REQUIRED`，无会员时为 `MEMBERSHIP_REQUIRED`。每次读取重查权益，会员撤销／到期或退款不会因存在收藏而获得访问权限。

收藏仅返回当前公开摘要和资格判定，不返回正文、受保护的视频地址、飞书密码或内部存储路径。阅读和播放仍使用原正文／播放授权接口。失效收藏不提供内容入口；既有独立购买权益不因收藏失效而被撤销，已购下架课程仍按现有业务规则从 `/me/courses` 访问。

## 数据库结构与升级

[增量迁移](../src/database/migrations/1793232000000-CartFavorites.ts) 新增两张表并扩展报价：

| 表／字段 | 结构与约束 |
|---|---|
| `cart_items` | `id`、`user_id`、`sku_id`、`quantity`、`selected`、`version`、`created_at`、`updated_at`；唯一 `(user_id,sku_id)`；数量 CHECK 1–999；按用户与加入时间索引 |
| `content_favorites` | `id`、`user_id`、`content_id`、`created_at`；唯一 `(user_id,content_id)`；按用户与收藏时间索引 |
| `order_quotes.cart_items` | 可空 JSON：购物车试算时的 `{id,skuId,quantity,version}[]`；旧报价／直接下单为 null，不改变原客户端报价结构 |

用户、SKU、内容关联均有外键。真正删除目标数据时级联删除相应个人关系，避免孤儿记录；下架是状态变更，不级联。收藏／购物车不作为财务历史阻止维护操作，原产品／课程已有订单和发布历史的删除保护继续生效。

迁移可以重试，不重建旧表、不修改历史订单和库存。MySQL DDL 不具有整体事务回滚能力；使用现有发布备份和增量迁移流程。

```powershell
npm.cmd run build
npm.cmd run migration:run
```

服务器发布包运行 `npm run migration:run:prod`。无需手工删表；迁移失败应修复后重试，不执行回滚删数据。完整字段见 [数据格式文档](02-data-models.md)，接口见 [OpenAPI](openapi-implemented.json)，调用示例见 [cart-favorites.http](../examples/cart-favorites.http)。

## 验证

[真实 MySQL E2E](../test/e2e/cart-favorites.e2e.spec.ts) 覆盖账号隔离、参数与数量边界、乐观锁、并发防超卖、库存变化、停售与恢复、试算后改价、精确清理、重复下单、收藏去重、下架与分类失效、会员动态权限、已购课程兼容、迁移重试和数据库约束。测试数据以 cs 命名，只清理本次创建的记录。

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e
python scripts/validate_commerce_responses.py
python scripts/build_api_docs.py
npm.cmd run build
```
