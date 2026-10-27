# 站内消息与短轮询

更新：2026-10-27。已实现本人收件箱、未读数、已读／删除、管理员定向发送，以及订单、售后和会员业务自动通知。本页路径均省略 `/api/v1`；JSON 响应仍使用 `code/message/data/requestId/timestamp` 外层结构。请求示例见 [messages.http](../examples/messages.http)，字段见 [接口文档](01-api-reference.md) 和 [OpenAPI](openapi-implemented.json)。

## 接口与权限

| 接口 | 权限 | 作用 |
|---|---|---|
| `GET /me/messages/poll?revision=0` | 普通用户，本人 | 返回版本是否变化、未读数、最大序号及建议轮询间隔 |
| `GET /me/messages` | 普通用户，本人 | 最新页、历史翻页或新增消息的游标分页 |
| `GET /me/messages/{id}` | 普通用户，本人 | 消息详情，不自动标记已读 |
| `POST /me/messages/read` | 普通用户，本人 | 批量将 1–100 个不同消息 ID 标记已读 |
| `POST /me/messages/read-all` | 普通用户，本人 | 将指定序号快照内的全部消息标记已读 |
| `DELETE /me/messages/{id}` | 普通用户，本人 | 隐藏消息，并在必要时减少未读数 |
| `POST /admin/messages` | 管理员 `messages:write` | 向 1–100 个明确指定的活跃用户发送 SYSTEM 消息，必传幂等键 |

用户接口只接受客户端令牌，用户身份来自登录信息，不能指定 `userId`。他人、已删除或不存在的消息统一返回 `404 RESOURCE_NOT_FOUND`；批量已读中只要有一条不属于本人，整批回滚。管理员令牌不能直接访问客户收件箱，`messages:write` 只授予定向发送权限。

发送接口只接受 `userIds/title/body`。`userIds` 为不同的 UUID v4，且所有接收者必须是 `ACTIVE` 用户；任一不可用则整体 404，不会部分发送。标题 1–120 字符、正文 1–2000 字符，不能全为空白。标题和正文都是纯文本，前端必须使用默认转义或 `textContent` 显示，不能当作 HTML。管理员不能指定业务资源跳转或伪造订单通知。发送成功为 HTTP 201，`data={sentCount,messageIds}`；消息 ID 不保证与输入用户列表顺序对应。

`Idempotency-Key` 必须为 16–64 位字母、数字、下划线或连字符。相同发送请求重试使用同一个键；同键不同请求返回 409。审计记录接收人数和接收者 ID，不记录消息正文。当前不提供全站广播任务、用户之间的私信或聊天功能。

## 低开销轮询

建议前台页面每 **60–70 秒**轮询一次。接口是立即返回的普通 HTTP 请求，不保持长连接。每次业务读取只按主键查询本人的一行 `user_message_states`，不扫描消息列表、不执行未读 `COUNT`，也不写入心跳或刷新会话的活跃时间；认证仍实时检查会话和账号状态。没有 Redis、消息队列或额外的轮询后台任务。

```json
{
  "changed": true,
  "revision": "18",
  "unreadCount": 3,
  "latestSequence": "15",
  "pollAfterSeconds": 60
}
```

这是 `data` 内容。首次不传 `revision` 等同于 `"0"`；新用户没有消息时返回 `changed=false`、`revision="0"`、`unreadCount=0`、`latestSequence="0"`。每次实际新增、标记已读或删除都会改变 `revision`；重复已读没有变化则不增加版本。消息序号 `sequence` 只在投递时增加，和 `revision` 含义不同。所有版本和序号都必须作为十进制字符串保存，最多 19 位，不要转换为 JavaScript `Number`；禁止负数、指数形式和前导零。

前端接入顺序：

1. 登录后立即读取一次 `poll`，保存 `revision/latestSequence` 并更新未读徽标；首次进入消息中心单独加载最新列表，即使 `changed=false` 也可以加载。
2. 当前请求结束后，用 `setTimeout` 等待 `pollAfterSeconds` 加上 0–10 秒随机延迟，再发下一次请求；同一个登录用户只保留一条轮询链，避免重叠和多个组件重复请求。
3. `changed=false` 时仅保留状态；`changed=true` 时按需刷新当前消息列表。已读或删除也会改变版本，不能只依靠 `afterSequence` 同步这些变化。
4. 页面隐藏时暂停，重新可见时立即补一次。多标签页可通过 `BroadcastChannel` 选定一个轮询标签页共享结果，减少重复请求。
5. 网络错误按 120、240、300 秒退避；成功后恢复正常间隔。429 遵循 `Retry-After`。401 停止当前轮询链，经统一刷新令牌或重新登录成功后再恢复；封禁或退出立即停止。

响应为私有且禁止缓存，不得通过公共 CDN 缓存不同用户的结果。建议只在收件箱打开或徽标变化时读取列表，无需每 60 秒重新下载全部消息。消息不会触发短信、外部 API 请求或每条物流轨迹的通知。

## 游标分页与已读

| 参数 | 规则 |
|---|---|
| `limit` | 默认 20，范围 1–50；没有 `page/pageSize/total` |
| `beforeSequence` | 返回严格小于该序号的历史消息，按序号倒序 |
| `afterSequence` | 返回严格大于该序号的新消息，按序号升序；不能与 `beforeSequence` 同传 |
| `unreadOnly` | 可选 `true/false`；仅 `true` 过滤未读 |

两个游标都不传时返回最新一页。结果为 `items/hasMore/nextBeforeSequence/nextAfterSequence`。通过多取一条判断 `hasMore`，不执行全表计数。历史模式只在还有下一页时返回 `nextBeforeSequence`，否则为 null；增量模式始终返回当前读取位置 `nextAfterSequence`，空页保留请求游标。另一个方向的返回游标为 null。

`afterSequence` 只补新增消息，不返回旧消息的已读或删除变更。跨设备修改状态后应重新加载当前列表；保持 `unreadOnly` 过滤的列表也需要重新加载，不能把增量请求当作完整同步。即使某条消息已被删除，序号也不会回退或复用。

批量已读请求为 `{"ids":["消息UUID"]}`。重复读取或重复标记已读不会重复减少未读数。全部已读请求为 `{"throughSequence":"15"}`，使用用户操作时已知的 `latestSequence` 快照，只影响该序号及之前的消息。之后到达的更大序号继续未读；提交超过服务器当前最大序号的上界返回 400，不能用一个极大值代替快照。

已读和删除均返回 `data={updated,revision,unreadCount,latestSequence}`，可以立即更新本地徽标。重复已读 `updated=0`；成功删除 `updated=1`，再次删除返回 404。删除使用内部软删除标记隐藏记录，仍保留事件去重键，防止业务重放后同一消息重新出现。

## 消息与业务的关系

| 分类 | 已接入事件 | 跳转目标 |
|---|---|---|
| `ORDER` | 实物／课程／会员订单付款确认、未付款订单超时关闭、发货、快递公司或运单号更正 | `resourceType=ORDER`，订单 ID |
| `AFTERSALE` | 售后审核通过／驳回、退货期限到期、退件验收、失败退款重试、退款成功／失败 | `resourceType=AFTERSALE`，售后 ID |
| `AFTERSALE` | 数字订单退款发起／重试、退款成功／失败 | `resourceType=ORDER`，数字订单 ID |
| `MEMBERSHIP` | 管理员开通／重新开通、续期或调整期限、撤销手动会员 | `resourceType=MEMBERSHIP`，本人用户 ID |
| `SYSTEM` | 管理员向指定用户发送 | `resourceType/resourceId=null` |

消息与业务状态在**同一数据库事务**中提交或回滚，通知失败不会留下“业务尚未成功、消息却成功”的状态。每个用户的同一业务事件通过唯一 `event_key` 去重；退款重试后的新结果允许产生新消息。管理员发送同样使用事务和幂等记录。

会员付款通知归 `ORDER`；手动撤销会员的文字只表示撤销手动权益，因为用户仍可能有购买所得会员。通知只是发生当时的提示：查看当前资格必须读取 `/me/membership`，打开订单和售后仍需调用各自受保护接口。通知不会自动发放权益、完成订单或退款，也不包含手机号、地址、快递查询尾号、飞书链接和密码。

不会给历史业务补发消息；单纯更正查询手机号后四位不发消息，物流查询和每条轨迹不重复提醒。会员自然到期、会员即将到期的定时通知，以及用户主动取消等自身操作的通知尚未加入。消息没有自动过期清理任务，删除后保留内部去重记录。

## 数据表与部署

新增迁移 `InAppMessages1793491200000`，开发运行 `npm run migration:run`，部署运行 `npm run migration:run:prod`。无需增加环境变量或外部服务。

| 表 | 主要字段与约束 |
|---|---|
| `user_message_states` | `user_id` 主键；`next_sequence/revision` 为 BIGINT UNSIGNED，`unread_count` 为非负整数 |
| `user_messages` | 消息 UUID、`user_id/sequence/event_key/category/title/body/resource_type/resource_id/read_at/deleted_at/created_at` |
| 唯一约束 | `(user_id,sequence)`、`(user_id,event_key)`，分别保证顺序和业务去重 |
| 查询索引 | `(user_id,deleted_at,sequence)`、`(user_id,deleted_at,read_at,sequence)`，支持历史／增量及未读列表 |

所有写入按用户锁定状态行，再改变消息、序号、版本和未读数，避免并发读写导致计数错误。`user_messages.user_id` 外键引用状态表；状态表到用户为逻辑引用，避免业务已有订单锁时反向取得用户外键锁造成锁顺序冲突。用户只能从认证身份访问消息；管理员发送会校验实际用户。

迁移只为原来同时具备全部 11 项管理权限的管理员增加 `messages:write`，原有受限管理员保持原权限。新管理员创建时可在权限列表中显式包含此项；如需给受限管理员授予权限，通过既有管理员 CLI 的 `permissions` 操作配置完整的新权限列表，该操作是替换权限而非追加。撤销 `messages:write` 后即使管理员旧令牌未过期也不能发送。

旧设计中的 `/me/notifications`、`/admin/notification-tasks` 和 `notifications:write` 从未上线，本次契约已用上述消息接口替换；前端请直接使用新路径。
