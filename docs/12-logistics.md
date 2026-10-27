# 物流轨迹查询与管理端录单

更新：2026-10-27。已接入 [阿里云全国快递物流查询 cmapi021863](https://market.aliyun.com/detail/cmapi021863)。使用 HTTPS 和 AppCode 鉴权；AppKey、AppSecret 无需配置。本文路径均省略 `/api/v1`，完整响应外层仍为 `code/message/data/requestId/timestamp`。

## 接口与权限

| 接口 | 权限 | 行为 |
|---|---|---|
| `GET /admin/logistics/carriers` | `orders:ship` | 可选公司列表，返回 `code/name/phoneLast4Required` |
| `POST /admin/orders/{id}/shipment` | `orders:ship` | 录入公司、单号，事务发货；需 `Idempotency-Key` |
| `PATCH /admin/shipments/{id}` | `orders:ship` | 更正公司、单号或查询尾号；需版本和原因 |
| `GET /orders/{id}/logistics` | 普通用户，本人订单 | 读取轨迹，缓存到期时同步；他人订单 404 |
| `GET /admin/orders/{id}/logistics` | `orders:read` | 管理端读取订单轨迹，缓存规则相同 |
| `POST /admin/shipments/{id}/sync` | `orders:ship` | 主动查询，传 `version`；同运单至少间隔 60 秒 |
| `POST /admin/shipments/{id}/events` | `orders:ship` | 保留人工登记，需版本和 `Idempotency-Key` |

没有开放任意运单查询接口。普通用户不能录单、修改轨迹或强制刷新；仅绑定到自己订单的包裹可以触发到期补查。管理员只持有 `orders:read` 时可以读轨迹，不能发货、纠错或主动刷新。

## 管理端接入流程

1. 调用公司列表，使用返回的 `code`。当前支持 SF、YTO、ZTO、STO、YUNDA、EMS、CHINAPOST、JD、JITU、DEPPON、HTKY、ZJS、FWSY、KYEXPRESS。SF 在服务端映射为供应商的 SFEXPRESS；前端继续使用 SF。
2. 读取订单最新 `version`，确认待发货、已付款且无活跃售后。
3. 提交发货；一单一包裹，发出所有未退款数量，事务扣减实物库存并释放预占，订单转为 `PENDING_RECEIPT`。下架不影响已付款订单履约。外部物流故障不会回滚已成功的发货。

```json
{
  "carrierCode": "ZTO",
  "trackingNo": "CSDEMO123456",
  "orderVersion": 2,
  "phoneLast4": "1234"
}
```

示例单号为占位。`trackingNo` 限字母、数字和短横线，最多 64 字符；不要将手机号或冒号拼入单号。`phoneLast4` 可选，四位数字字符串，保留前导零；省略时从订单收件地址快照取尾号。顺丰、中通、丰网、跨越的查询请求会附带尾号，其他公司不发送尾号；如使用寄件人尾号，应显式录入。

4. 读取物流详情。发货后后台一分钟内开始扫描，详情页也可触发首次查询。保存返回的 `shipment.version`，后续管理操作使用最新版本。
5. 需要主动补查时提交 `POST /admin/shipments/{id}/sync`，请求体 `{"version":3}`。无需幂等键；并发时已持有查询租约的请求负责查询，其他请求返回 `SYNCING`。旧版本 409，60 秒内再次主动查询 429。前端应展示缓存并等待，不循环强刷。

揽收前且无任何轨迹时才允许更改公司/单号。揽收后允许保持原公司/单号，仅更正 `phoneLast4`；PATCH 仍需 `version` 和 `reason`。省略尾号保留旧值，传 `null` 恢复订单收件手机号尾号。纠错会废弃在途旧查询，防止旧单号轨迹写入新包裹。尾号和查询凭证不回显到接口，也不写入审计详情。

## 返回结构与状态

`data` 包含：

| 字段 | 含义 |
|---|---|
| `shipment` | 包裹；未发货为 null；含单号、公司、物流状态、发货/签收时间、最后成功同步时间、版本和发货行 |
| `events` | 最多 100 条，按发生时间倒序，字段 `time/description/location/source` |
| `syncStatus` | 查询状态，见下表 |
| `syncErrorCode` | 稳定错误代码；正常为 null |
| `lastSyncAttemptAt` | 最近一次实际外部查询开始时间 |
| `nextSyncAt` | 最早自动重查时间，调度可能延后；停止自动查询时为 null |

| syncStatus | 含义 |
|---|---|
| NOT_SHIPPED | 无包裹 |
| MANUAL | 未开启外部查询，仍可查看人工轨迹 |
| PENDING | 待首次查询或纠错后待查 |
| SYNCING | 有查询进行中；返回已有轨迹 |
| UP_TO_DATE | 最近查询成功，受缓存间隔约束，并非实时推送 |
| NO_DATA | 服务商尚无此单轨迹；可能未揽收、单号/尾号不符，等待或检查录单 |
| FAILED | 查询失败；保留原有轨迹和物流状态 |

查询失败仍以 HTTP 200 返回 `LogisticsResult`，前端需要检查 `syncStatus`。鉴权、权限、版本、冷却期和配置错误走标准非 2xx 错误响应。`shipment.lastSyncedAt` 仅在成功取得轨迹后更新，失败不冒充成功。供应商事件 `source=ALIYUN`，人工事件 `source=MANUAL`。供应商未提供结构化位置时 `location=null`；地址描述仍在 `description` 中。时间按供应商中国时区解释后转为 UTC，前端按用户时区展示。

物流状态有 `PENDING_PICKUP/IN_TRANSIT/OUT_FOR_DELIVERY/DELIVERED/EXCEPTION/RETURNED`。`RETURNED` 是退件签收，不能视为买家收货。轨迹查询不修改支付、库存、订单完成时间或售后；`DELIVERED` 仍由用户单独确认收货，售后退回仍需管理员验收，不能据快递签收自动退款或入库。本次对接的是订单出库包裹；售后独立的退货运单仍由原退货/验收流程管理。

## 同步策略与异常处理

- 默认每 30 分钟查询一次；后台每分钟扫描最多 10 笔到期包裹。详情读取也遵守同一缓存。发货接口自身不等待供应商。
- 数据库持久化 120 秒查询租约，多实例、并发请求共享；网络查询在事务外执行，避免长期锁住订单。进程中断后租约到期可恢复。
- 轨迹按包裹、发生时间和描述摘要去重。支持先有物流后补录订单；允许供应商轨迹早于平台发货时间。旧轨迹不倒退较新的人工状态；并发修改版本后丢弃旧查询结果。
- 普通故障从 5 分钟退避到最多 6 小时；鉴权、访问拒绝、IP 限制等待 6 小时。无轨迹按正常同步周期重试。不会在同一请求内反复调用计费接口。
- 已签收、退件签收、订单关闭或发货超过 30 天停止自动查询；管理员可对仍为待收货/已完成的订单主动补查。管理员主动补查仍有 60 秒冷却，可能消耗服务额度。
- 不保存供应商原始响应或原始错误文案；请求目标固定，拒绝重定向，默认 8 秒超时，响应体上限 1 MiB。

`syncErrorCode` 常见值：

| 代码 | 处理 |
|---|---|
| LOGISTICS_NO_DATA | 暂无轨迹，核对单号、公司及尾号 |
| LOGISTICS_NUMBER_INVALID | 核对单号 |
| LOGISTICS_CARRIER_INVALID / LOGISTICS_CARRIER_UNRECOGNIZED | 从公司列表重新选择 |
| LOGISTICS_PHONE_REQUIRED | 补上四位手机号尾号 |
| LOGISTICS_AUTH_FAILED | 核对服务器 AppCode |
| LOGISTICS_ACCESS_DENIED | 检查购买授权、余量或网关限制；403 不一律当作余额耗尽 |
| LOGISTICS_IP_RESTRICTED | 检查供应商 IP 限制 |
| LOGISTICS_RATE_LIMITED / LOGISTICS_TIMEOUT / LOGISTICS_PROVIDER_UNAVAILABLE | 稍后重试 |
| LOGISTICS_PROVIDER_INVALID_RESPONSE | 返回结构、单号、公司、状态或时间不符；保留旧数据，排查适配器 |

## 配置与数据迁移

真实 AppCode 仅保存在服务器 `/etc/chunai/api.env`，权限 0600；不要提交 Git、放进前端或写入文档。

```dotenv
LOGISTICS_PROVIDER=ALIYUN
LOGISTICS_APPCODE=在受保护的服务器环境文件中填写
LOGISTICS_TIMEOUT_MS=8000
LOGISTICS_SYNC_INTERVAL_SECONDS=1800
LOGISTICS_AUTO_SYNC_DAYS=30
LOGISTICS_SYNC_BATCH_SIZE=10
```

本地未配置时使用 `.env.example` 的 `LOGISTICS_PROVIDER=NONE`。配置在进程启动时生效；启用 ALIYUN 但缺少合法 AppCode 会拒绝启动。

部署前备份数据库及环境文件，再执行 `npm run migration:run:prod`（开发环境 `npm run migration:run`）。新增迁移 `LogisticsTracking1793318400000` 可在 MySQL DDL 中断后重复执行，不删除业务表：

| 表 | 变更 |
|---|---|
| shipments | 查询尾号、同步状态/错误、最近尝试/下次同步时间、租约令牌/到期时间、失败次数 |
| shipments | 扩展状态约束支持 RETURNED；新增同步扫描索引 |
| logistics_events | 可空 event_key；唯一索引 `(shipment_id,event_key)`，旧人工事件保留 |

当前仍是一单一包裹。供应商适配集中在 `src/commerce/logistics-provider.ts`，同步、缓存及订单关联集中在 `logistics.service.ts`；以后更换服务商或接入订阅回调时可继续复用包裹、轨迹及权限模型。

自动化测试使用模拟供应商和独立 MySQL 测试库，不消耗真实查询额度。覆盖状态映射、手机号格式、异常响应、权限隔离、缓存与重复轨迹、并发租约、纠错竞争、人工轨迹竞争、签收/退回不自动完成订单及迁移重入。可执行示例见 [logistics.http](../examples/logistics.http)，完整契约见 [接口文档](01-api-reference.md)。
