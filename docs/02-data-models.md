# 数据格式文档

> 所有名称对应 OpenAPI `components.schemas`，可生成前端 TypeScript 类型与 NestJS DTO。

## 基础约定

| 项目 | 约定 |
|---|---|
| ID | `string`，1–64 位，不转 JS Number，不通过 ID 推断权限 |
| 金额 | `integer` 人民币分，`currency=CNY`；如 9900 = ¥99.00；不传浮点金额 |
| 时间 | ISO 8601 UTC，如 `2026-10-22T02:00:00Z`；界面显示上海时间 |
| 分页 | `page/pageSize` 从 1 开始；数据为 `items/total/page/pageSize/hasNext`；空列表为 `[]` |
| 游标 | AI 消息用 `cursor/limit`，`nextCursor=null` 表示结束 |
| 空值 | 非必填字段可省略；只有标注 nullable 的字段可为 `null`；数组无值为 `[]` |
| PATCH | 未传字段保持不变；仅允许标注 nullable 的字段显式清空；管理员修改须带 version |
| 校验 | 未声明的 Body/Query 字段拒绝；枚举区分大小写；Query 中 boolean 仅接受 `true/false` |
| 文本 | 用户消息、通知纯文本；介绍和正文 HTML 由服务端清洗，禁止脚本、事件属性及任意 iframe |
| version | 每次资源写入加 1；`WHERE id=? AND version=?` 更新，冲突返回 409 |

## 统一成功结构

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "success": true
  },
  "requestId": "req_demo_001",
  "timestamp": "2026-10-22T02:00:00Z"
}
```

所有成功 JSON API 返回 `code/message/data/requestId/timestamp`；成功 `code=OK`。创建通常 201，异步受理 202，普通查询／操作 200。删除也返回 200 和 `{success:true}`。

## 统一失败结构

```json
{
  "code": "VALIDATION_ERROR",
  "message": "请求参数不合法",
  "data": null,
  "error": {
    "details": [
      {
        "field": "items[0].quantity",
        "reason": "必须大于等于 1"
      }
    ]
  },
  "requestId": "req_demo_001",
  "timestamp": "2026-10-22T02:00:00Z"
}
```

失败时 `data=null` 且有 `error.details`；非字段错误时 details 为 []。前端用 HTTP 与 code 决策，message 只用于展示。限流同时返回 `Retry-After` 与可选 retryAfterSeconds。

## 对象索引

- [ActionResult](#actionresult)
- [FieldError](#fielderror)
- [ApiError](#apierror)
- [ErrorResponse](#errorresponse)
- [MediaSummary](#mediasummary)
- [MembershipSummary](#membershipsummary)
- [UserSummary](#usersummary)
- [AuthTokens](#authtokens)
- [SmsRequest](#smsrequest)
- [SmsChallenge](#smschallenge)
- [RegisterInput](#registerinput)
- [PasswordLoginInput](#passwordlogininput)
- [SmsLoginInput](#smslogininput)
- [RefreshInput](#refreshinput)
- [PasswordResetInput](#passwordresetinput)
- [UserPatch](#userpatch)
- [PasswordChangeInput](#passwordchangeinput)
- [Session](#session)
- [AdminPrincipal](#adminprincipal)
- [AdminLoginInput](#adminlogininput)
- [AdminAuthTokens](#adminauthtokens)
- [Category](#category)
- [CategoryCreate](#categorycreate)
- [CategoryPatch](#categorypatch)
- [ContentSummary](#contentsummary)
- [AccessDecision](#accessdecision)
- [ContentDetail](#contentdetail)
- [ArticleBody](#articlebody)
- [PlaybackGrant](#playbackgrant)
- [ChapterSummary](#chaptersummary)
- [Column](#column)
- [ColumnCreate](#columncreate)
- [ColumnPatch](#columnpatch)
- [AdminColumn](#admincolumn)
- [ColumnContentInput](#columncontentinput)
- [ContentCreate](#contentcreate)
- [ContentPatch](#contentpatch)
- [AdminContent](#admincontent)
- [VersionInput](#versioninput)
- [ScienceBodyInput](#sciencebodyinput)
- [AdminBody](#adminbody)
- [ChapterCreate](#chaptercreate)
- [ChapterPatch](#chapterpatch)
- [AdminChapter](#adminchapter)
- [SkuAttribute](#skuattribute)
- [ProductSummary](#productsummary)
- [Sku](#sku)
- [ProductDetail](#productdetail)
- [ProductCreate](#productcreate)
- [ProductPatch](#productpatch)
- [AdminProduct](#adminproduct)
- [SkuCreate](#skucreate)
- [SkuPatch](#skupatch)
- [AdminSku](#adminsku)
- [StockAdjustmentInput](#stockadjustmentinput)
- [StockAdjustment](#stockadjustment)
- [AddressSnapshot](#addresssnapshot)
- [AddressInput](#addressinput)
- [Address](#address)
- [AddressReplace](#addressreplace)
- [PurchaseLineInput](#purchaselineinput)
- [ProductPurchase](#productpurchase)
- [CoursePurchase](#coursepurchase)
- [MembershipPurchase](#membershippurchase)
- [QuoteCreate](#quotecreate)
- [OrderItem](#orderitem)
- [OrderQuote](#orderquote)
- [OrderCreate](#ordercreate)
- [OrderSummary](#ordersummary)
- [OrderActions](#orderactions)
- [OrderDetail](#orderdetail)
- [OrderCancelInput](#ordercancelinput)
- [PaymentCreate](#paymentcreate)
- [PaymentAttempt](#paymentattempt)
- [LogisticsEvent](#logisticsevent)
- [Shipment](#shipment)
- [LogisticsResult](#logisticsresult)
- [ShipmentCreate](#shipmentcreate)
- [ShipmentPatch](#shipmentpatch)
- [AfterSaleLineInput](#aftersalelineinput)
- [AfterSaleCreate](#aftersalecreate)
- [AfterSaleLine](#aftersaleline)
- [ReturnShipment](#returnshipment)
- [AfterSale](#aftersale)
- [AfterSaleReview](#aftersalereview)
- [ReturnShipmentInput](#returnshipmentinput)
- [ReturnReceiptInput](#returnreceiptinput)
- [Refund](#refund)
- [DigitalRefundInput](#digitalrefundinput)
- [MembershipPlan](#membershipplan)
- [MembershipPlanCreate](#membershipplancreate)
- [MembershipPlanPatch](#membershipplanpatch)
- [AdminMembershipPlan](#adminmembershipplan)
- [MembershipDetail](#membershipdetail)
- [CourseEntitlement](#courseentitlement)
- [AiQuota](#aiquota)
- [AiConversationInput](#aiconversationinput)
- [AiConversationPatch](#aiconversationpatch)
- [AiConversation](#aiconversation)
- [AiMessageInput](#aimessageinput)
- [AiMessage](#aimessage)
- [AiMessagePage](#aimessagepage)
- [AiGeneration](#aigeneration)
- [SseMetaEvent](#ssemetaevent)
- [SseDeltaEvent](#ssedeltaevent)
- [SseDoneEvent](#ssedoneevent)
- [SseErrorEvent](#sseerrorevent)
- [NotificationTarget](#notificationtarget)
- [Notification](#notification)
- [UnreadCount](#unreadcount)
- [ReadAllInput](#readallinput)
- [NotificationTaskInput](#notificationtaskinput)
- [NotificationTask](#notificationtask)
- [UploadCreate](#uploadcreate)
- [UploadTicket](#uploadticket)
- [MediaReadGrant](#mediareadgrant)
- [AdminUser](#adminuser)
- [UserBanInput](#userbaninput)
- [UserUnbanInput](#userunbaninput)
- [AdminOrder](#adminorder)
- [AdminOrderSummary](#adminordersummary)
- [AuditLog](#auditlog)
- [ExternalWebhookPayload](#externalwebhookpayload)
- [ArticleBodyWrite](#articlebodywrite)
- [VideoBodyWrite](#videobodywrite)
- [HealthStatus](#healthstatus)
- [LegalDocument](#legaldocument)
- [PageSession](#pagesession)
- [PageAddress](#pageaddress)
- [PageCategory](#pagecategory)
- [PageContentSummary](#pagecontentsummary)
- [PageChapterSummary](#pagechaptersummary)
- [PageColumn](#pagecolumn)
- [PageProductSummary](#pageproductsummary)
- [PageOrderSummary](#pageordersummary)
- [PageRefund](#pagerefund)
- [PageMembershipPlan](#pagemembershipplan)
- [PageCourseEntitlement](#pagecourseentitlement)
- [PageAfterSale](#pageaftersale)
- [PageAiConversation](#pageaiconversation)
- [PageNotification](#pagenotification)
- [PageAdminContent](#pageadmincontent)
- [PageAdminChapter](#pageadminchapter)
- [PageAdminColumn](#pageadmincolumn)
- [PageAdminProduct](#pageadminproduct)
- [PageAdminSku](#pageadminsku)
- [PageStockAdjustment](#pagestockadjustment)
- [PageAdminOrderSummary](#pageadminordersummary)
- [PageAdminUser](#pageadminuser)
- [PageAdminMembershipPlan](#pageadminmembershipplan)
- [PageNotificationTask](#pagenotificationtask)
- [PageAuditLog](#pageauditlog)
- [PrivateEvidenceMedia](#privateevidencemedia)
- [NotificationUsersInput](#notificationusersinput)
- [NotificationAllInput](#notificationallinput)
- [ContentCategory](#contentcategory)
- [ProductCategory](#productcategory)
- [CourseSummary](#coursesummary)

<a id="actionresult"></a>
## ActionResult

无业务对象的操作结果。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `success` | boolean | 是 | 操作是否完成。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "success": true
}
```


<a id="fielderror"></a>
## FieldError

参数校验错误。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `field` | string | 是 | 字段路径。 |  |
| `reason` | string | 是 | 原因。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "field": "items[0].quantity",
  "reason": "必须大于等于 1"
}
```


<a id="apierror"></a>
## ApiError

错误详情；不返回堆栈、数据库或密钥信息。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `details` | [FieldError[]](#fielderror) | 是 | 参数错误列表；非参数错误为 [] |  |
| `retryAfterSeconds` | integer | 否 | 可选：建议重试等待秒数。 | 最小: `0` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "details": [
    {
      "field": "items[0].quantity",
      "reason": "必须大于等于 1"
    }
  ]
}
```


<a id="errorresponse"></a>
## ErrorResponse

失败响应；HTTP 状态与业务错误码同时有意义。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `code` | string | 是 | 稳定的业务错误码。 |  |
| `message` | string | 是 | 可读提示；前端逻辑依据 code。 |  |
| `data` | object / null | 是 | 失败固定为 null。 | 枚举: `None` |
| `error` | [ApiError](#apierror) | 是 | 见关联对象。 |  |
| `requestId` | string | 是 | 请求追踪号。 |  |
| `timestamp` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "code": "VALIDATION_ERROR",
  "message": "请求参数不合法",
  "data": null,
  "error": {
    "details": [
      {
        "field": "items[0].quantity",
        "reason": "必须大于等于 1"
      }
    ]
  },
  "requestId": "req_demo_001",
  "timestamp": "2026-10-22T02:00:00Z"
}
```


<a id="mediasummary"></a>
## MediaSummary

附件或媒体元数据；不含私有源文件地址。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `kind` | string | 是 | 媒体类型。 | 枚举: `IMAGE, VIDEO` |
| `status` | string | 是 | 上传后处理完成才可引用。 | 枚举: `UPLOADING, PROCESSING, READY, FAILED` |
| `mimeType` | string | 是 | 实际检查后的 MIME。 |  |
| `sizeBytes` | integer | 是 | 字节数。 | 最小: `0` |
| `publicUrl` | string / null | 是 | 仅公开图片有 URL；私有视频或售后凭证为 null。 | 格式: `uri` |
| `durationSeconds` | integer | 否 | 仅视频返回，处理前可不返回。 | 最小: `0` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "kind": "IMAGE",
  "status": "READY",
  "mimeType": "image/jpeg",
  "sizeBytes": 102400,
  "publicUrl": "https://cdn.example.com/cover.jpg"
}
```


<a id="membershipsummary"></a>
## MembershipSummary

会员状态以服务端当前时间判定，不依赖前端缓存。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `active` | boolean | 是 | 当前是否为有效会员。 |  |
| `expiresAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `benefitCodes` | string[] | 是 | 当前权益；过期为 [] |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "active": true,
  "expiresAt": "2026-11-21T02:00:00Z",
  "benefitCodes": [
    "MEMBER_COURSES"
  ]
}
```


<a id="usersummary"></a>
## UserSummary

用户自身资料；手机号脱敏。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `nickname` | string | 是 | 昵称。 | 最短: `1`；最长: `32` |
| `avatarUrl` | string / null | 是 | HTTPS URL。 | 格式: `uri` |
| `phoneMasked` | string | 是 | 脱敏手机。 |  |
| `status` | string | 是 | 账号状态。 | 枚举: `ACTIVE, BANNED, DEACTIVATED` |
| `membership` | [MembershipSummary](#membershipsummary) | 是 | 见关联对象。 |  |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "nickname": "小雨",
  "avatarUrl": "https://cdn.example.com/cover.jpg",
  "phoneMasked": "138****0000",
  "status": "ACTIVE",
  "membership": {
    "active": true,
    "expiresAt": "2026-11-21T02:00:00Z",
    "benefitCodes": [
      "MEMBER_COURSES"
    ]
  },
  "createdAt": "2026-10-22T02:00:00Z"
}
```


<a id="authtokens"></a>
## AuthTokens

客户端会话；只在客户端鉴权响应中返回。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `accessToken` | string | 是 | JWT，aud=client；建议 15 分钟。 |  |
| `accessExpiresInSeconds` | integer | 是 | accessToken 有效秒数。 | 最小: `1` |
| `refreshToken` | string | 是 | 不透明随机令牌，每次使用轮换；建议最长 30 天。 |  |
| `refreshExpiresAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `tokenType` | string | 是 | 认证方案。 | 枚举: `Bearer` |
| `user` | [UserSummary](#usersummary) | 是 | 见关联对象。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "accessToken": "eyJ...client.access",
  "accessExpiresInSeconds": 900,
  "refreshToken": "rt_client_example",
  "refreshExpiresAt": "2026-11-21T02:00:00Z",
  "tokenType": "Bearer",
  "user": {
    "id": "id_10001",
    "nickname": "小雨",
    "avatarUrl": "https://cdn.example.com/cover.jpg",
    "phoneMasked": "138****0000",
    "status": "ACTIVE",
    "membership": {
      "active": true,
      "expiresAt": "2026-11-21T02:00:00Z",
      "benefitCodes": [
        "MEMBER_COURSES"
      ]
    },
    "createdAt": "2026-10-22T02:00:00Z"
  }
}
```


<a id="smsrequest"></a>
## SmsRequest

短信发送请求；IP、手机号、设备维度限流，避免账号枚举。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `phone` | string | 是 | E.164 手机号；默认支持 +86，其他地区由短信配置决定。 | 正则: `^\+[1-9]\d{7,14}$` |
| `purpose` | string | 是 | 验证码用途，互不通用。 | 枚举: `REGISTER, LOGIN, RESET_PASSWORD` |
| `captchaToken` | string | 是 | 由已选人机校验服务签发。 | 最短: `1`；最长: `2048` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "phone": "+8613800000000",
  "purpose": "REGISTER",
  "captchaToken": "captcha_demo"
}
```


<a id="smschallenge"></a>
## SmsChallenge

无论手机号是否注册，都返回相同形状。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `challengeId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `expiresInSeconds` | integer | 是 | 验证码有效期。 | 最小: `1` |
| `retryAfterSeconds` | integer | 是 | 再次发送间隔。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "challengeId": "id_10001",
  "expiresInSeconds": 300,
  "retryAfterSeconds": 60
}
```


<a id="registerinput"></a>
## RegisterInput

注册后直接签发客户端会话。当前不需要手机验证码，不接收 challengeId、smsCode；手机号仅作未验证的登录账号。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `phone` | string | 是 | E.164 手机号；默认支持 +86，其他地区由短信配置决定。 | 正则: `^\+[1-9]\d{7,14}$` |
| `password` | string | 是 | 密码；不记录明文。 | 最短: `10`；最长: `72` |
| `nickname` | string | 否 | 可选昵称。 | 最短: `1`；最长: `32` |
| `termsVersion` | string | 是 | 用户确认的协议版本。 | 最短: `1`；最长: `64` |
| `privacyVersion` | string | 是 | 用户确认的隐私政策版本。 | 最短: `1`；最长: `64` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "phone": "+8613800000000",
  "password": "Example#Password9",
  "termsVersion": "2026-10-01",
  "privacyVersion": "2026-10-01"
}
```


<a id="passwordlogininput"></a>
## PasswordLoginInput

密码登录；账号不存在与密码错误使用同一错误。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `phone` | string | 是 | E.164 手机号；默认支持 +86，其他地区由短信配置决定。 | 正则: `^\+[1-9]\d{7,14}$` |
| `password` | string | 是 | 原始密码。 | 最短: `1`；最长: `72` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "phone": "+8613800000000",
  "password": "Example#Password9"
}
```


<a id="smslogininput"></a>
## SmsLoginInput

只登录已注册用户；不会静默注册。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `phone` | string | 是 | E.164 手机号；默认支持 +86，其他地区由短信配置决定。 | 正则: `^\+[1-9]\d{7,14}$` |
| `challengeId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `smsCode` | string | 是 | LOGIN 验证码。 | 正则: `^\d{6}$` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "phone": "+8613800000000",
  "challengeId": "id_10001",
  "smsCode": "123456"
}
```


<a id="refreshinput"></a>
## RefreshInput

必须使用对应 audience 的最新 refreshToken；旧令牌重放撤销该会话链。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `refreshToken` | string | 是 | 当前刷新令牌。 | 最短: `16`；最长: `1024` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "refreshToken": "rt_client_example"
}
```


<a id="passwordresetinput"></a>
## PasswordResetInput

重置成功后撤销用户全部会话。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `phone` | string | 是 | E.164 手机号；默认支持 +86，其他地区由短信配置决定。 | 正则: `^\+[1-9]\d{7,14}$` |
| `challengeId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `smsCode` | string | 是 | RESET_PASSWORD 验证码。 | 正则: `^\d{6}$` |
| `newPassword` | string | 是 | 新密码。 | 最短: `10`；最长: `72` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "phone": "+8613800000000",
  "challengeId": "id_10001",
  "smsCode": "123456",
  "newPassword": "New#Password123"
}
```


<a id="userpatch"></a>
## UserPatch

修改本人资料。未传保持；avatarMediaId=null 清空头像。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `nickname` | string | 否 | 昵称。 | 最短: `1`；最长: `32` |
| `avatarMediaId` | string / null | 否 | 本人上传且用途为 AVATAR 的 READY 图片。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

对象至少包含 1 个字段（包含 version 时，至少另传一个可修改字段）。

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "nickname": "小雨"
}
```


<a id="passwordchangeinput"></a>
## PasswordChangeInput

修改后撤销全部会话，客户端重新登录。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `currentPassword` | string | 是 | 旧密码。 | 最短: `1`；最长: `72` |
| `newPassword` | string | 是 | 新密码。 | 最短: `10`；最长: `72` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "currentPassword": "Example#Password9",
  "newPassword": "New#Password123"
}
```


<a id="session"></a>
## Session

当前客户端设备会话。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `deviceLabel` | string | 是 | 服务端解析的设备信息。 |  |
| `isCurrent` | boolean | 是 | 当前会话。 |  |
| `lastActiveAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "deviceLabel": "Chrome / Windows",
  "isCurrent": true,
  "lastActiveAt": "2026-10-22T02:00:00Z",
  "createdAt": "2026-10-22T02:00:00Z"
}
```


<a id="adminprincipal"></a>
## AdminPrincipal

管理员与客户使用独立账号体系及 token audience。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `username` | string | 是 | 管理员名。 |  |
| `displayName` | string | 是 | 显示名。 |  |
| `permissions` | string[] | 是 | 服务端有效权限列表 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "username": "content_manager",
  "displayName": "内容管理员",
  "permissions": [
    "content:write"
  ]
}
```


<a id="adminlogininput"></a>
## AdminLoginInput

管理员账号由运维初始化；客户端注册不能创建管理员。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `username` | string | 是 | 管理员账号。 | 最短: `1`；最长: `64` |
| `password` | string | 是 | 密码。 | 最短: `1`；最长: `72` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "username": "admin",
  "password": "Admin#Password123"
}
```


<a id="adminauthtokens"></a>
## AdminAuthTokens

管理员会话；accessToken aud=admin。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `accessToken` | string | 是 | 管理员 JWT。 |  |
| `accessExpiresInSeconds` | integer | 是 | 有效秒数。 | 最小: `1` |
| `refreshToken` | string | 是 | 轮换刷新令牌。 |  |
| `refreshExpiresAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `tokenType` | string | 是 | 认证方案。 | 枚举: `Bearer` |
| `admin` | [AdminPrincipal](#adminprincipal) | 是 | 见关联对象。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "accessToken": "eyJ...admin.access",
  "accessExpiresInSeconds": 900,
  "refreshToken": "rt_admin_example",
  "refreshExpiresAt": "2026-10-29T02:00:00Z",
  "tokenType": "Bearer",
  "admin": {
    "id": "id_10001",
    "username": "content_manager",
    "displayName": "内容管理员",
    "permissions": [
      "content:write"
    ]
  }
}
```


<a id="category"></a>
## Category

内容或产品分类；禁止跨 scope 使用或产生父子循环。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 分类名。 | 最短: `1`；最长: `32` |
| `scope` | string | 是 | 分类作用域。 | 枚举: `CONTENT, PRODUCT` |
| `parentId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `sortOrder` | integer | 是 | 升序展示。 | 最小: `0` |
| `enabled` | boolean | 是 | 是否可用。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "健康科普",
  "scope": "CONTENT",
  "parentId": "id_10001",
  "sortOrder": 0,
  "enabled": true,
  "version": 1
}
```


<a id="categorycreate"></a>
## CategoryCreate

创建分类。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `name` | string | 是 | 名称。 | 最短: `1`；最长: `32` |
| `scope` | string | 是 | 作用域。 | 枚举: `CONTENT, PRODUCT` |
| `parentId` | string / null | 否 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `sortOrder` | integer | 否 | 排序。 | 最小: `0` |
| `enabled` | boolean | 否 | 启用。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "name": "健康科普",
  "scope": "CONTENT"
}
```


<a id="categorypatch"></a>
## CategoryPatch

scope 不可修改；有子分类或引用时不可删除。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `name` | string | 否 | 名称。 | 最短: `1`；最长: `32` |
| `parentId` | string / null | 否 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `sortOrder` | integer | 否 | 排序。 | 最小: `0` |
| `enabled` | boolean | 否 | 启用。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

对象至少包含 2 个字段（包含 version 时，至少另传一个可修改字段）。

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "name": "健康知识"
}
```


<a id="contentsummary"></a>
## ContentSummary

视频、图文及课程统一的公开摘要；无受保护正文和视频源地址。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `kind` | string | 是 | 内容类型；课程由章节组成。 | 枚举: `SCIENCE_VIDEO, SCIENCE_ARTICLE, VIDEO_COURSE, ARTICLE_COURSE` |
| `title` | string | 是 | 标题。 | 最短: `1`；最长: `120` |
| `summary` | string | 是 | 简介。 | 最长: `2000` |
| `cover` | [MediaSummary](#mediasummary) | 是 | 见关联对象。 |  |
| `category` | [ContentCategory](#contentcategory) | 是 | 见关联对象。 |  |
| `tags` | string[] | 是 | 标签 | 最多项: `10` |
| `accessPolicy` | string | 是 | 访问策略：免费／单独购买／会员或购买。 | 枚举: `FREE, PURCHASE, MEMBER_OR_PURCHASE` |
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `chapterCount` | integer | 是 | 科普为 0；课程为已发布章节数。 | 最小: `0` |
| `publishedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "kind": "SCIENCE_VIDEO",
  "title": "认识身体与健康",
  "summary": "以科学知识解答常见问题。",
  "cover": {
    "id": "id_10001",
    "kind": "IMAGE",
    "status": "READY",
    "mimeType": "image/jpeg",
    "sizeBytes": 102400,
    "publicUrl": "https://cdn.example.com/cover.jpg"
  },
  "category": {
    "id": "id_10001",
    "name": "健康科普",
    "scope": "CONTENT",
    "parentId": "id_10001",
    "sortOrder": 0,
    "enabled": true,
    "version": 1
  },
  "tags": [
    "基础知识"
  ],
  "accessPolicy": "FREE",
  "priceCents": 0,
  "currency": "CNY",
  "chapterCount": 0,
  "publishedAt": "2026-10-22T02:00:00Z"
}
```


<a id="accessdecision"></a>
## AccessDecision

当前请求者的访问判定；权益要在获取正文或播放授权时再次验证。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `canAccess` | boolean | 是 | 是否可访问完整内容。 |  |
| `reason` | string | 是 | 授权原因或阻断原因；ADMIN 仅管理端。 | 枚举: `FREE, PURCHASED, MEMBER, PREVIEW, ADMIN, LOGIN_REQUIRED, PURCHASE_REQUIRED, CONTENT_UNAVAILABLE` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "canAccess": true,
  "reason": "FREE"
}
```


<a id="contentdetail"></a>
## ContentDetail

公开详情，付费正文与视频地址通过独立接口获取。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `kind` | string | 是 | 内容类型；课程由章节组成。 | 枚举: `SCIENCE_VIDEO, SCIENCE_ARTICLE, VIDEO_COURSE, ARTICLE_COURSE` |
| `title` | string | 是 | 标题。 | 最短: `1`；最长: `120` |
| `summary` | string | 是 | 简介。 | 最长: `2000` |
| `cover` | [MediaSummary](#mediasummary) | 是 | 见关联对象。 |  |
| `category` | [ContentCategory](#contentcategory) | 是 | 见关联对象。 |  |
| `tags` | string[] | 是 | 标签 | 最多项: `10` |
| `accessPolicy` | string | 是 | 访问策略：免费／单独购买／会员或购买。 | 枚举: `FREE, PURCHASE, MEMBER_OR_PURCHASE` |
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `chapterCount` | integer | 是 | 科普为 0；课程为已发布章节数。 | 最小: `0` |
| `publishedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `descriptionHtml` | string | 是 | 经服务端清洗的介绍 HTML。 | 最长: `100000` |
| `authorName` | string | 是 | 作者／讲师显示名。 | 最长: `64` |
| `columnIds` | string[] | 是 | 所属专栏 ID |  |
| `access` | [AccessDecision](#accessdecision) | 是 | 见关联对象。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "kind": "SCIENCE_VIDEO",
  "title": "认识身体与健康",
  "summary": "以科学知识解答常见问题。",
  "cover": {
    "id": "id_10001",
    "kind": "IMAGE",
    "status": "READY",
    "mimeType": "image/jpeg",
    "sizeBytes": 102400,
    "publicUrl": "https://cdn.example.com/cover.jpg"
  },
  "category": {
    "id": "id_10001",
    "name": "健康科普",
    "scope": "CONTENT",
    "parentId": "id_10001",
    "sortOrder": 0,
    "enabled": true,
    "version": 1
  },
  "tags": [
    "基础知识"
  ],
  "accessPolicy": "FREE",
  "priceCents": 0,
  "currency": "CNY",
  "chapterCount": 0,
  "publishedAt": "2026-10-22T02:00:00Z",
  "descriptionHtml": "<p>课程介绍</p>",
  "authorName": "健康教育团队",
  "columnIds": [
    "id_10001"
  ],
  "access": {
    "canAccess": true,
    "reason": "FREE"
  }
}
```


<a id="articlebody"></a>
## ArticleBody

仅通过授权校验后返回的图文正文。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `contentId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `bodyHtml` | string | 是 | 已清洗 HTML；前端仍使用受控渲染。 | 最长: `500000` |
| `imageUrls` | string[] | 是 | 正文使用的公开图片 URL |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "contentId": "id_10001",
  "bodyHtml": "<p>科普正文示例</p>",
  "imageUrls": [
    "https://cdn.example.com/cover.jpg"
  ]
}
```


<a id="playbackgrant"></a>
## PlaybackGrant

短时播放授权；不可持久化为内容源地址。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `contentId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `chapterId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `playbackUrl` | string | 是 | HTTPS URL。 | 格式: `uri` |
| `expiresAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `durationSeconds` | integer | 是 | 可播放时长。 | 最小: `0` |
| `preview` | boolean | 是 | 是否为服务端限制的独立预览片段。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "contentId": "id_10001",
  "chapterId": "id_10001",
  "playbackUrl": "https://media.example.com/play.m3u8?token=demo",
  "expiresAt": "2026-10-22T02:05:00Z",
  "durationSeconds": 180,
  "preview": false
}
```


<a id="chaptersummary"></a>
## ChapterSummary

课程目录；锁定章节也可展示摘要。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `courseId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `title` | string | 是 | 章节标题。 | 最短: `1`；最长: `120` |
| `kind` | string | 是 | 章节类型必须匹配课程类型。 | 枚举: `VIDEO, ARTICLE` |
| `sortOrder` | integer | 是 | 课程内排序。 | 最小: `0` |
| `isPreview` | boolean | 是 | 是否免费预览。 |  |
| `durationSeconds` | integer | 是 | 视频时长；图文为 0。 | 最小: `0` |
| `access` | [AccessDecision](#accessdecision) | 是 | 见关联对象。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "courseId": "id_10001",
  "title": "第一章：基础知识",
  "kind": "VIDEO",
  "sortOrder": 1,
  "isPreview": true,
  "durationSeconds": 180,
  "access": {
    "canAccess": true,
    "reason": "FREE"
  }
}
```


<a id="column"></a>
## Column

专栏用于组织内容，本身不售卖，不自动授予内容权限。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 专栏名。 | 最短: `1`；最长: `64` |
| `description` | string | 是 | 说明。 | 最长: `2000` |
| `cover` | [MediaSummary](#mediasummary) | 是 | 见关联对象。 |  |
| `contentCount` | integer | 是 | 已发布内容数量。 | 最小: `0` |
| `sortOrder` | integer | 是 | 排序。 | 最小: `0` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "亲密关系与健康",
  "description": "专题知识合集",
  "cover": {
    "id": "id_10001",
    "kind": "IMAGE",
    "status": "READY",
    "mimeType": "image/jpeg",
    "sizeBytes": 102400,
    "publicUrl": "https://cdn.example.com/cover.jpg"
  },
  "contentCount": 5,
  "sortOrder": 0
}
```


<a id="columncreate"></a>
## ColumnCreate

创建专栏，默认 DRAFT。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `name` | string | 是 | 名称。 | 最短: `1`；最长: `64` |
| `description` | string | 否 | 文本。 | 最长: `2000` |
| `coverMediaId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `sortOrder` | integer | 否 | 排序。 | 最小: `0` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "name": "亲密关系与健康",
  "coverMediaId": "id_10001"
}
```


<a id="columnpatch"></a>
## ColumnPatch

修改专栏资料。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `name` | string | 否 | 名称。 | 最短: `1`；最长: `64` |
| `description` | string | 否 | 文本。 | 最长: `2000` |
| `coverMediaId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `sortOrder` | integer | 否 | 排序。 | 最小: `0` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

对象至少包含 2 个字段（包含 version 时，至少另传一个可修改字段）。

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "name": "亲密关系与健康"
}
```


<a id="admincolumn"></a>
## AdminColumn

管理端专栏资料。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 专栏名。 | 最短: `1`；最长: `64` |
| `description` | string | 是 | 说明。 | 最长: `2000` |
| `cover` | [MediaSummary](#mediasummary) | 是 | 见关联对象。 |  |
| `contentCount` | integer | 是 | 已发布内容数量。 | 最小: `0` |
| `sortOrder` | integer | 是 | 排序。 | 最小: `0` |
| `status` | string | 是 | 发布状态。 | 枚举: `DRAFT, PUBLISHED, OFFLINE` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `updatedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "亲密关系与健康",
  "description": "专题知识合集",
  "cover": {
    "id": "id_10001",
    "kind": "IMAGE",
    "status": "READY",
    "mimeType": "image/jpeg",
    "sizeBytes": 102400,
    "publicUrl": "https://cdn.example.com/cover.jpg"
  },
  "contentCount": 5,
  "sortOrder": 0,
  "status": "DRAFT",
  "version": 1,
  "createdAt": "2026-10-22T02:00:00Z",
  "updatedAt": "2026-10-22T02:00:00Z"
}
```


<a id="columncontentinput"></a>
## ColumnContentInput

幂等设置单个内容在专栏中的位置；同值按关联 ID 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `sortOrder` | integer | 是 | 排序。 | 最小: `0` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "sortOrder": 1
}
```


<a id="contentcreate"></a>
## ContentCreate

创建内容草稿；kind 不可修改；科普必须 FREE、priceCents=0。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `kind` | string | 是 | 内容类型；课程由章节组成。 | 枚举: `SCIENCE_VIDEO, SCIENCE_ARTICLE, VIDEO_COURSE, ARTICLE_COURSE` |
| `title` | string | 是 | 标题。 | 最短: `1`；最长: `120` |
| `summary` | string | 是 | 文本。 | 最长: `2000` |
| `descriptionHtml` | string | 否 | 介绍 HTML；服务端清洗。 | 最长: `100000` |
| `coverMediaId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `categoryId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `authorName` | string | 否 | 作者。 | 最长: `64` |
| `tags` | string[] | 否 | 标签 | 最多项: `10`；元素不重复 |
| `accessPolicy` | string | 是 | 访问策略：免费／单独购买／会员或购买。 | 枚举: `FREE, PURCHASE, MEMBER_OR_PURCHASE` |
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "kind": "SCIENCE_VIDEO",
  "title": "认识身体与健康",
  "summary": "示例内容",
  "coverMediaId": "id_10001",
  "categoryId": "id_10001",
  "accessPolicy": "FREE",
  "priceCents": 0
}
```


<a id="contentpatch"></a>
## ContentPatch

部分更新；accessPolicy 与 priceCents 改动需同时提交；发布内容即时生效并留审计。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `title` | string | 否 | 标题。 | 最短: `1`；最长: `120` |
| `summary` | string | 否 | 文本。 | 最长: `2000` |
| `descriptionHtml` | string | 否 | 介绍 HTML；服务端清洗。 | 最长: `100000` |
| `coverMediaId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `categoryId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `authorName` | string | 否 | 作者。 | 最长: `64` |
| `tags` | string[] | 否 | 标签 | 最多项: `10`；元素不重复 |
| `accessPolicy` | string | 否 | 访问策略：免费／单独购买／会员或购买。 | 枚举: `FREE, PURCHASE, MEMBER_OR_PURCHASE` |
| `priceCents` | integer | 否 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

对象至少包含 2 个字段（包含 version 时，至少另传一个可修改字段）。

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "title": "认识身体与健康"
}
```


<a id="admincontent"></a>
## AdminContent

管理端内容详情，不直接携带媒体源。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `kind` | string | 是 | 内容类型；课程由章节组成。 | 枚举: `SCIENCE_VIDEO, SCIENCE_ARTICLE, VIDEO_COURSE, ARTICLE_COURSE` |
| `title` | string | 是 | 标题。 | 最短: `1`；最长: `120` |
| `summary` | string | 是 | 简介。 | 最长: `2000` |
| `cover` | [MediaSummary](#mediasummary) | 是 | 见关联对象。 |  |
| `category` | [ContentCategory](#contentcategory) | 是 | 见关联对象。 |  |
| `tags` | string[] | 是 | 标签 | 最多项: `10` |
| `accessPolicy` | string | 是 | 访问策略：免费／单独购买／会员或购买。 | 枚举: `FREE, PURCHASE, MEMBER_OR_PURCHASE` |
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `chapterCount` | integer | 是 | 科普为 0；课程为已发布章节数。 | 最小: `0` |
| `publishedAt` | string / null | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `descriptionHtml` | string | 是 | 经服务端清洗的介绍 HTML。 | 最长: `100000` |
| `authorName` | string | 是 | 作者／讲师显示名。 | 最长: `64` |
| `columnIds` | string[] | 是 | 所属专栏 ID |  |
| `access` | [AccessDecision](#accessdecision) | 是 | 见关联对象。 |  |
| `status` | string | 是 | 发布状态。 | 枚举: `DRAFT, PUBLISHED, OFFLINE` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `updatedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "kind": "SCIENCE_VIDEO",
  "title": "认识身体与健康",
  "summary": "以科学知识解答常见问题。",
  "cover": {
    "id": "id_10001",
    "kind": "IMAGE",
    "status": "READY",
    "mimeType": "image/jpeg",
    "sizeBytes": 102400,
    "publicUrl": "https://cdn.example.com/cover.jpg"
  },
  "category": {
    "id": "id_10001",
    "name": "健康科普",
    "scope": "CONTENT",
    "parentId": "id_10001",
    "sortOrder": 0,
    "enabled": true,
    "version": 1
  },
  "tags": [
    "基础知识"
  ],
  "accessPolicy": "FREE",
  "priceCents": 0,
  "currency": "CNY",
  "chapterCount": 0,
  "publishedAt": null,
  "descriptionHtml": "<p>课程介绍</p>",
  "authorName": "健康教育团队",
  "columnIds": [
    "id_10001"
  ],
  "access": {
    "canAccess": true,
    "reason": "FREE"
  },
  "status": "DRAFT",
  "version": 1,
  "createdAt": "2026-10-22T02:00:00Z",
  "updatedAt": "2026-10-22T02:00:00Z"
}
```


<a id="versioninput"></a>
## VersionInput

校验资源版本，防止覆盖其他管理员修改。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1
}
```


<a id="sciencebodyinput"></a>
## ScienceBodyInput

图文与视频请求二选一；同样适用于课程章节。

仅允许以下一种结构：

- [ArticleBodyWrite](#articlebodywrite)
- [VideoBodyWrite](#videobodywrite)


<a id="adminbody"></a>
## AdminBody

管理员读取已保存正文或媒体引用；非适用字段固定为 null。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `bodyHtml` | string / null | 是 | 图文 HTML；视频为 null。 | 最长: `500000` |
| `imageMediaIds` | string[] | 是 | 正文图片 ID |  |
| `videoMediaId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "bodyHtml": "<p>科普正文</p>",
  "imageMediaIds": [
    "id_10001"
  ],
  "videoMediaId": null,
  "version": 1
}
```


<a id="chaptercreate"></a>
## ChapterCreate

创建章节草稿；章节 kind 从课程继承。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `title` | string | 是 | 标题。 | 最短: `1`；最长: `120` |
| `sortOrder` | integer | 是 | 排序。 | 最小: `0` |
| `isPreview` | boolean | 否 | 免费预览整章；完整预览章需单独配置。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "title": "第一章",
  "sortOrder": 1
}
```


<a id="chapterpatch"></a>
## ChapterPatch

修改章节元信息。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `title` | string | 否 | 标题。 | 最短: `1`；最长: `120` |
| `sortOrder` | integer | 否 | 排序。 | 最小: `0` |
| `isPreview` | boolean | 否 | 免费预览整章；完整预览章需单独配置。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

对象至少包含 2 个字段（包含 version 时，至少另传一个可修改字段）。

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "title": "第一章"
}
```


<a id="adminchapter"></a>
## AdminChapter

管理员章节详情。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `courseId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `title` | string | 是 | 章节标题。 | 最短: `1`；最长: `120` |
| `kind` | string | 是 | 章节类型必须匹配课程类型。 | 枚举: `VIDEO, ARTICLE` |
| `sortOrder` | integer | 是 | 课程内排序。 | 最小: `0` |
| `isPreview` | boolean | 是 | 是否免费预览。 |  |
| `durationSeconds` | integer | 是 | 视频时长；图文为 0。 | 最小: `0` |
| `access` | [AccessDecision](#accessdecision) | 是 | 见关联对象。 |  |
| `status` | string | 是 | 发布状态。 | 枚举: `DRAFT, PUBLISHED, OFFLINE` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `updatedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "courseId": "id_10001",
  "title": "第一章：基础知识",
  "kind": "VIDEO",
  "sortOrder": 1,
  "isPreview": true,
  "durationSeconds": 180,
  "access": {
    "canAccess": true,
    "reason": "FREE"
  },
  "status": "DRAFT",
  "version": 1,
  "createdAt": "2026-10-22T02:00:00Z",
  "updatedAt": "2026-10-22T02:00:00Z"
}
```


<a id="skuattribute"></a>
## SkuAttribute

SKU 的规格维度。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `name` | string | 是 | 维度名。 | 最长: `32` |
| `value` | string | 是 | 取值。 | 最长: `64` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "name": "规格",
  "value": "标准装"
}
```


<a id="productsummary"></a>
## ProductSummary

公开产品摘要；只包含上架产品和可售 SKU。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 产品名。 | 最短: `1`；最长: `120` |
| `summary` | string | 是 | 文本。 | 最长: `2000` |
| `cover` | [MediaSummary](#mediasummary) | 是 | 见关联对象。 |  |
| `category` | [ProductCategory](#productcategory) | 是 | 见关联对象。 |  |
| `minPriceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `maxPriceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `inStock` | boolean | 是 | 至少一个可售 SKU 有可用库存。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "健康护理用品",
  "summary": "示例内容",
  "cover": {
    "id": "id_10001",
    "kind": "IMAGE",
    "status": "READY",
    "mimeType": "image/jpeg",
    "sizeBytes": 102400,
    "publicUrl": "https://cdn.example.com/cover.jpg"
  },
  "category": {
    "id": "id_10001",
    "name": "健康科普",
    "scope": "PRODUCT",
    "parentId": "id_10001",
    "sortOrder": 0,
    "enabled": true,
    "version": 1
  },
  "minPriceCents": 9900,
  "maxPriceCents": 9900,
  "currency": "CNY",
  "inStock": true
}
```


<a id="sku"></a>
## Sku

公开 SKU；服务端创建订单时重新检查库存。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `productId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `skuCode` | string | 是 | 商家 SKU 编号，全局唯一。 | 最长: `64` |
| `attributes` | [SkuAttribute[]](#skuattribute) | 是 | 规格列表 | 最多项: `10` |
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `availableStock` | integer | 是 | 可用库存 = 实物库存 - 预占库存。 | 最小: `0` |
| `enabled` | boolean | 是 | 可售。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "productId": "id_10001",
  "skuCode": "CARE-001",
  "attributes": [
    {
      "name": "规格",
      "value": "标准装"
    }
  ],
  "priceCents": 9900,
  "availableStock": 100,
  "enabled": true
}
```


<a id="productdetail"></a>
## ProductDetail

产品详情。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 产品名。 | 最短: `1`；最长: `120` |
| `summary` | string | 是 | 文本。 | 最长: `2000` |
| `cover` | [MediaSummary](#mediasummary) | 是 | 见关联对象。 |  |
| `category` | [ProductCategory](#productcategory) | 是 | 见关联对象。 |  |
| `minPriceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `maxPriceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `inStock` | boolean | 是 | 至少一个可售 SKU 有可用库存。 |  |
| `detailHtml` | string | 是 | 已清洗的详情 HTML。 | 最长: `100000` |
| `gallery` | [MediaSummary[]](#mediasummary) | 是 | 图片列表 |  |
| `skus` | [Sku[]](#sku) | 是 | 可售 SKU |  |
| `afterSalePolicy` | string | 是 | 售后政策展示文本；实际申请资格以服务端为准。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "健康护理用品",
  "summary": "示例内容",
  "cover": {
    "id": "id_10001",
    "kind": "IMAGE",
    "status": "READY",
    "mimeType": "image/jpeg",
    "sizeBytes": 102400,
    "publicUrl": "https://cdn.example.com/cover.jpg"
  },
  "category": {
    "id": "id_10001",
    "name": "健康科普",
    "scope": "PRODUCT",
    "parentId": "id_10001",
    "sortOrder": 0,
    "enabled": true,
    "version": 1
  },
  "minPriceCents": 9900,
  "maxPriceCents": 9900,
  "currency": "CNY",
  "inStock": true,
  "detailHtml": "<p>产品使用说明</p>",
  "gallery": [
    {
      "id": "id_10001",
      "kind": "IMAGE",
      "status": "READY",
      "mimeType": "image/jpeg",
      "sizeBytes": 102400,
      "publicUrl": "https://cdn.example.com/cover.jpg"
    }
  ],
  "skus": [
    {
      "id": "id_10001",
      "productId": "id_10001",
      "skuCode": "CARE-001",
      "attributes": [
        {
          "name": "规格",
          "value": "标准装"
        }
      ],
      "priceCents": 9900,
      "availableStock": 100,
      "enabled": true
    }
  ],
  "afterSalePolicy": "符合平台售后规则可申请售后。"
}
```


<a id="productcreate"></a>
## ProductCreate

创建产品草稿；至少有一个启用 SKU 才可发布。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `name` | string | 是 | 产品名。 | 最短: `1`；最长: `120` |
| `summary` | string | 是 | 文本。 | 最长: `2000` |
| `coverMediaId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `categoryId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `detailHtml` | string | 是 | 详情 HTML。 | 最长: `100000` |
| `galleryMediaIds` | string[] | 否 | READY 图片 | 最多项: `20`；元素不重复 |
| `afterSalePolicy` | string | 是 | 文本。 | 最长: `2000` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "name": "健康护理用品",
  "summary": "示例内容",
  "coverMediaId": "id_10001",
  "categoryId": "id_10001",
  "detailHtml": "<p>产品说明</p>",
  "afterSalePolicy": "示例内容"
}
```


<a id="productpatch"></a>
## ProductPatch

修改产品资料；库存走单独调整接口。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `name` | string | 否 | 产品名。 | 最短: `1`；最长: `120` |
| `summary` | string | 否 | 文本。 | 最长: `2000` |
| `coverMediaId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `categoryId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `detailHtml` | string | 否 | 详情 HTML。 | 最长: `100000` |
| `galleryMediaIds` | string[] | 否 | READY 图片 | 最多项: `20`；元素不重复 |
| `afterSalePolicy` | string | 否 | 文本。 | 最长: `2000` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

对象至少包含 2 个字段（包含 version 时，至少另传一个可修改字段）。

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "name": "健康护理用品"
}
```


<a id="adminproduct"></a>
## AdminProduct

管理端产品详情；含停用 SKU。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 产品名。 | 最短: `1`；最长: `120` |
| `summary` | string | 是 | 文本。 | 最长: `2000` |
| `cover` | [MediaSummary](#mediasummary) | 是 | 见关联对象。 |  |
| `category` | [ProductCategory](#productcategory) | 是 | 见关联对象。 |  |
| `minPriceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `maxPriceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `inStock` | boolean | 是 | 至少一个可售 SKU 有可用库存。 |  |
| `detailHtml` | string | 是 | 已清洗的详情 HTML。 | 最长: `100000` |
| `gallery` | [MediaSummary[]](#mediasummary) | 是 | 图片列表 |  |
| `skus` | [Sku[]](#sku) | 是 | 可售 SKU |  |
| `afterSalePolicy` | string | 是 | 售后政策展示文本；实际申请资格以服务端为准。 |  |
| `status` | string | 是 | 发布状态。 | 枚举: `DRAFT, PUBLISHED, OFFLINE` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `updatedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "健康护理用品",
  "summary": "示例内容",
  "cover": {
    "id": "id_10001",
    "kind": "IMAGE",
    "status": "READY",
    "mimeType": "image/jpeg",
    "sizeBytes": 102400,
    "publicUrl": "https://cdn.example.com/cover.jpg"
  },
  "category": {
    "id": "id_10001",
    "name": "健康科普",
    "scope": "PRODUCT",
    "parentId": "id_10001",
    "sortOrder": 0,
    "enabled": true,
    "version": 1
  },
  "minPriceCents": 9900,
  "maxPriceCents": 9900,
  "currency": "CNY",
  "inStock": true,
  "detailHtml": "<p>产品使用说明</p>",
  "gallery": [
    {
      "id": "id_10001",
      "kind": "IMAGE",
      "status": "READY",
      "mimeType": "image/jpeg",
      "sizeBytes": 102400,
      "publicUrl": "https://cdn.example.com/cover.jpg"
    }
  ],
  "skus": [
    {
      "id": "id_10001",
      "productId": "id_10001",
      "skuCode": "CARE-001",
      "attributes": [
        {
          "name": "规格",
          "value": "标准装"
        }
      ],
      "priceCents": 9900,
      "availableStock": 100,
      "enabled": true
    }
  ],
  "afterSalePolicy": "符合平台售后规则可申请售后。",
  "status": "DRAFT",
  "version": 1,
  "createdAt": "2026-10-22T02:00:00Z",
  "updatedAt": "2026-10-22T02:00:00Z"
}
```


<a id="skucreate"></a>
## SkuCreate

创建 SKU，初始库存 0，通过库存调整接口入库。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `skuCode` | string | 是 | 商家 SKU 编号。 | 最短: `1`；最长: `64` |
| `attributes` | [SkuAttribute[]](#skuattribute) | 是 | 同一产品内规格组合必须唯一 | 最多项: `10` |
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `enabled` | boolean | 否 | 可售。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "skuCode": "CARE-001",
  "attributes": [
    {
      "name": "规格",
      "value": "标准装"
    }
  ],
  "priceCents": 9900
}
```


<a id="skupatch"></a>
## SkuPatch

修改 SKU 价格、规格、启用状态。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `skuCode` | string | 否 | 商家 SKU 编号。 | 最短: `1`；最长: `64` |
| `attributes` | [SkuAttribute[]](#skuattribute) | 否 | 同一产品内规格组合必须唯一 | 最多项: `10` |
| `priceCents` | integer | 否 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `enabled` | boolean | 否 | 可售。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

对象至少包含 2 个字段（包含 version 时，至少另传一个可修改字段）。

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "skuCode": "CARE-001"
}
```


<a id="adminsku"></a>
## AdminSku

库存写入使用事务和版本控制。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `productId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `skuCode` | string | 是 | 商家 SKU 编号，全局唯一。 | 最长: `64` |
| `attributes` | [SkuAttribute[]](#skuattribute) | 是 | 规格列表 | 最多项: `10` |
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `availableStock` | integer | 是 | 可用库存 = 实物库存 - 预占库存。 | 最小: `0` |
| `enabled` | boolean | 是 | 可售。 |  |
| `onHandStock` | integer | 是 | 实物库存，发货时扣减。 | 最小: `0` |
| `reservedStock` | integer | 是 | 待发货订单预占。 | 最小: `0` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "productId": "id_10001",
  "skuCode": "CARE-001",
  "attributes": [
    {
      "name": "规格",
      "value": "标准装"
    }
  ],
  "priceCents": 9900,
  "availableStock": 100,
  "enabled": true,
  "onHandStock": 102,
  "reservedStock": 2,
  "version": 1
}
```


<a id="stockadjustmentinput"></a>
## StockAdjustmentInput

入库／盘点调整，不能使 onHandStock 小于 reservedStock。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `delta` | integer | 是 | 正数入库，负数盘亏；不能为 0。 |  |
| `reason` | string | 是 | 调整原因。 | 最短: `1`；最长: `200` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "delta": 10,
  "reason": "采购入库",
  "version": 1
}
```


<a id="stockadjustment"></a>
## StockAdjustment

不可改写的库存变更流水。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `skuId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `delta` | integer | 是 | 库存变化。 |  |
| `onHandStockAfter` | integer | 是 | 调整后实物库存。 | 最小: `0` |
| `reservedStockAfter` | integer | 是 | 调整后预占。 | 最小: `0` |
| `reason` | string | 是 | 文本。 | 最长: `2000` |
| `operatorId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "skuId": "id_10001",
  "delta": 10,
  "onHandStockAfter": 112,
  "reservedStockAfter": 2,
  "reason": "示例内容",
  "operatorId": "id_10001",
  "createdAt": "2026-10-22T02:00:00Z"
}
```


<a id="addresssnapshot"></a>
## AddressSnapshot

订单／退货地址快照；地址簿修改不影响历史订单。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `recipient` | string | 是 | 收件人。 | 最短: `1`；最长: `32` |
| `phone` | string | 是 | E.164 手机号；默认支持 +86，其他地区由短信配置决定。 | 正则: `^\+[1-9]\d{7,14}$` |
| `provinceCode` | string | 是 | 省级行政区划码。 | 正则: `^\d{6}$` |
| `province` | string | 是 | 省。 | 最短: `1`；最长: `32` |
| `cityCode` | string | 是 | 地市行政区划码。 | 正则: `^\d{6}$` |
| `city` | string | 是 | 市。 | 最短: `1`；最长: `32` |
| `districtCode` | string | 是 | 区县行政区划码。 | 正则: `^\d{6}$` |
| `district` | string | 是 | 区县。 | 最短: `1`；最长: `32` |
| `detail` | string | 是 | 详细地址。 | 最短: `1`；最长: `200` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "recipient": "张女士",
  "phone": "+8613800000000",
  "provinceCode": "310000",
  "province": "上海市",
  "cityCode": "310100",
  "city": "上海市",
  "districtCode": "310101",
  "district": "黄浦区",
  "detail": "示例路 100 号"
}
```


<a id="addressinput"></a>
## AddressInput

地址簿写入；isDefault=true 在事务中取消其他默认地址。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `recipient` | string | 是 | 收件人。 | 最短: `1`；最长: `32` |
| `phone` | string | 是 | E.164 手机号；默认支持 +86，其他地区由短信配置决定。 | 正则: `^\+[1-9]\d{7,14}$` |
| `provinceCode` | string | 是 | 省级行政区划码。 | 正则: `^\d{6}$` |
| `province` | string | 是 | 省。 | 最短: `1`；最长: `32` |
| `cityCode` | string | 是 | 地市行政区划码。 | 正则: `^\d{6}$` |
| `city` | string | 是 | 市。 | 最短: `1`；最长: `32` |
| `districtCode` | string | 是 | 区县行政区划码。 | 正则: `^\d{6}$` |
| `district` | string | 是 | 区县。 | 最短: `1`；最长: `32` |
| `detail` | string | 是 | 详细地址。 | 最短: `1`；最长: `200` |
| `isDefault` | boolean | 否 | 默认地址；首个地址自动默认；其他新增地址不传为 false。 | 默认: `False` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "recipient": "张女士",
  "phone": "+8613800000000",
  "provinceCode": "310000",
  "province": "上海市",
  "cityCode": "310100",
  "city": "上海市",
  "districtCode": "310101",
  "district": "黄浦区",
  "detail": "示例路 100 号"
}
```


<a id="address"></a>
## Address

用户地址。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `recipient` | string | 是 | 收件人。 | 最短: `1`；最长: `32` |
| `phone` | string | 是 | E.164 手机号；默认支持 +86，其他地区由短信配置决定。 | 正则: `^\+[1-9]\d{7,14}$` |
| `provinceCode` | string | 是 | 省级行政区划码。 | 正则: `^\d{6}$` |
| `province` | string | 是 | 省。 | 最短: `1`；最长: `32` |
| `cityCode` | string | 是 | 地市行政区划码。 | 正则: `^\d{6}$` |
| `city` | string | 是 | 市。 | 最短: `1`；最长: `32` |
| `districtCode` | string | 是 | 区县行政区划码。 | 正则: `^\d{6}$` |
| `district` | string | 是 | 区县。 | 最短: `1`；最长: `32` |
| `detail` | string | 是 | 详细地址。 | 最短: `1`；最长: `200` |
| `isDefault` | boolean | 是 | 默认地址；首个地址自动默认；其他新增地址不传为 false。 | 默认: `False` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "recipient": "张女士",
  "phone": "+8613800000000",
  "provinceCode": "310000",
  "province": "上海市",
  "cityCode": "310100",
  "city": "上海市",
  "districtCode": "310101",
  "district": "黄浦区",
  "detail": "示例路 100 号",
  "isDefault": true,
  "version": 1
}
```


<a id="addressreplace"></a>
## AddressReplace

完整替换本人地址，须带版本并明确默认标记。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `recipient` | string | 是 | 收件人。 | 最短: `1`；最长: `32` |
| `phone` | string | 是 | E.164 手机号；默认支持 +86，其他地区由短信配置决定。 | 正则: `^\+[1-9]\d{7,14}$` |
| `provinceCode` | string | 是 | 省级行政区划码。 | 正则: `^\d{6}$` |
| `province` | string | 是 | 省。 | 最短: `1`；最长: `32` |
| `cityCode` | string | 是 | 地市行政区划码。 | 正则: `^\d{6}$` |
| `city` | string | 是 | 市。 | 最短: `1`；最长: `32` |
| `districtCode` | string | 是 | 区县行政区划码。 | 正则: `^\d{6}$` |
| `district` | string | 是 | 区县。 | 最短: `1`；最长: `32` |
| `detail` | string | 是 | 详细地址。 | 最短: `1`；最长: `200` |
| `isDefault` | boolean | 是 | 默认地址；首个地址自动默认；其他新增地址不传为 false。 | 默认: `False` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "recipient": "张女士",
  "phone": "+8613800000000",
  "provinceCode": "310000",
  "province": "上海市",
  "cityCode": "310100",
  "city": "上海市",
  "districtCode": "310101",
  "district": "黄浦区",
  "detail": "示例路 100 号",
  "isDefault": true,
  "version": 1
}
```


<a id="purchaselineinput"></a>
## PurchaseLineInput

购买规格；不接收名称或金额。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `skuId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `quantity` | integer | 是 | 件数。 | 最小: `1`；最大: `99` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "skuId": "id_10001",
  "quantity": 1
}
```


<a id="productpurchase"></a>
## ProductPurchase

实物商品试算；同 SKU 必须先合并，否则校验失败。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `type` | string | 是 | 订单类型。 | 枚举: `PRODUCT` |
| `addressId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `items` | [PurchaseLineInput[]](#purchaselineinput) | 是 | 同一订单多个 SKU | 最少项: `1`；最多项: `50` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "type": "PRODUCT",
  "addressId": "id_10001",
  "items": [
    {
      "skuId": "id_10001",
      "quantity": 1
    }
  ]
}
```


<a id="coursepurchase"></a>
## CoursePurchase

单个课程购买；禁止重复购买有效课程权益。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `type` | string | 是 | 订单类型。 | 枚举: `COURSE` |
| `courseId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "type": "COURSE",
  "courseId": "id_10001"
}
```


<a id="membershippurchase"></a>
## MembershipPurchase

购买一个会员方案；有效会员付款成功后顺延。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `type` | string | 是 | 订单类型。 | 枚举: `MEMBERSHIP` |
| `planId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "type": "MEMBERSHIP",
  "planId": "id_10001"
}
```


<a id="quotecreate"></a>
## QuoteCreate

试算请求按 type 三选一，不支持混合商品、课程与会员。

仅允许以下一种结构：

- [ProductPurchase](#productpurchase)
- [CoursePurchase](#coursepurchase)
- [MembershipPurchase](#membershippurchase)


<a id="orderitem"></a>
## OrderItem

不可变成交快照；价格调整不影响历史。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `resourceId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `resourceType` | string | 是 | 引用 SKU／课程／会员方案。 | 枚举: `SKU, COURSE, MEMBERSHIP_PLAN` |
| `productId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `title` | string | 是 | 商品或课程名快照。 |  |
| `skuAttributes` | [SkuAttribute[]](#skuattribute) | 是 | 非实物为 [] |  |
| `coverUrl` | string / null | 是 | HTTPS URL。 | 格式: `uri` |
| `quantity` | integer | 是 | 件数。 | 最小: `1`；最大: `99` |
| `unitPriceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `subtotalCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `refundedQuantity` | integer | 是 | 已完成退款件数。 | 最小: `0` |
| `refundedAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "resourceId": "id_10001",
  "resourceType": "SKU",
  "productId": "id_10001",
  "title": "健康护理用品",
  "skuAttributes": [
    {
      "name": "规格",
      "value": "标准装"
    }
  ],
  "coverUrl": "https://cdn.example.com/cover.jpg",
  "quantity": 1,
  "unitPriceCents": 9900,
  "subtotalCents": 9900,
  "refundedQuantity": 0,
  "refundedAmountCents": 0
}
```


<a id="orderquote"></a>
## OrderQuote

十分钟内有效的服务端试算，不占库存，不授予权益。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `quoteId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `type` | string | 是 | 一种订单只允许一种业务类型。 | 枚举: `PRODUCT, COURSE, MEMBERSHIP` |
| `items` | [OrderItem[]](#orderitem) | 是 | 试算快照；订单创建后会分配新的 orderItem.id |  |
| `itemsAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `shippingFeeCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `payableAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `address` | [AddressSnapshot](#addresssnapshot) | 否 | 见关联对象。 |  |
| `expiresAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "quoteId": "id_10001",
  "type": "PRODUCT",
  "items": [
    {
      "id": "id_10001",
      "resourceId": "id_10001",
      "resourceType": "SKU",
      "productId": "id_10001",
      "title": "健康护理用品",
      "skuAttributes": [
        {
          "name": "规格",
          "value": "标准装"
        }
      ],
      "coverUrl": "https://cdn.example.com/cover.jpg",
      "quantity": 1,
      "unitPriceCents": 9900,
      "subtotalCents": 9900,
      "refundedQuantity": 0,
      "refundedAmountCents": 0
    }
  ],
  "itemsAmountCents": 9900,
  "shippingFeeCents": 0,
  "payableAmountCents": 9900,
  "currency": "CNY",
  "expiresAt": "2026-10-22T02:10:00Z",
  "address": {
    "recipient": "张女士",
    "phone": "+8613800000000",
    "provinceCode": "310000",
    "province": "上海市",
    "cityCode": "310100",
    "city": "上海市",
    "districtCode": "310101",
    "district": "黄浦区",
    "detail": "示例路 100 号"
  }
}
```


<a id="ordercreate"></a>
## OrderCreate

由有效试算生成订单；一个 quoteId 最多生成一个订单。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `quoteId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "quoteId": "id_10001"
}
```


<a id="ordersummary"></a>
## OrderSummary

订单列表对象。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `orderNo` | string | 是 | 展示用订单号，不能作为鉴权依据。 |  |
| `type` | string | 是 | 一种订单只允许一种业务类型。 | 枚举: `PRODUCT, COURSE, MEMBERSHIP` |
| `status` | string | 是 | 履约状态；支付与售后另有独立字段。 | 枚举: `PENDING_PAYMENT, PENDING_SHIPMENT, PENDING_RECEIPT, COMPLETED, CANCELLED, CLOSED` |
| `paymentStatus` | string | 是 | 订单汇总支付状态。 | 枚举: `UNPAID, PAID, PARTIALLY_REFUNDED, REFUNDED` |
| `afterSaleStatus` | string | 是 | 订单售后汇总。 | 枚举: `NONE, PROCESSING, PARTIALLY_COMPLETED, COMPLETED` |
| `items` | [OrderItem[]](#orderitem) | 是 | 行项目快照 |  |
| `itemsAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `shippingFeeCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `payableAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `paidAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `refundedAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `paymentDeadlineAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `paidAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "orderNo": "20261022000001",
  "type": "PRODUCT",
  "status": "PENDING_PAYMENT",
  "paymentStatus": "UNPAID",
  "afterSaleStatus": "NONE",
  "items": [
    {
      "id": "id_10001",
      "resourceId": "id_10001",
      "resourceType": "SKU",
      "productId": "id_10001",
      "title": "健康护理用品",
      "skuAttributes": [
        {
          "name": "规格",
          "value": "标准装"
        }
      ],
      "coverUrl": "https://cdn.example.com/cover.jpg",
      "quantity": 1,
      "unitPriceCents": 9900,
      "subtotalCents": 9900,
      "refundedQuantity": 0,
      "refundedAmountCents": 0
    }
  ],
  "itemsAmountCents": 9900,
  "shippingFeeCents": 0,
  "payableAmountCents": 9900,
  "paidAmountCents": 0,
  "refundedAmountCents": 0,
  "currency": "CNY",
  "paymentDeadlineAt": "2026-10-22T02:30:00Z",
  "paidAt": null,
  "createdAt": "2026-10-22T02:30:00Z"
}
```


<a id="orderactions"></a>
## OrderActions

前端用来控制按钮；调用时服务端再次校验。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `canPay` | boolean | 是 | 可支付。 |  |
| `canCancel` | boolean | 是 | 可取消。 |  |
| `canConfirmReceipt` | boolean | 是 | 可确认收货。 |  |
| `canApplyAfterSale` | boolean | 是 | 可申请产品售后。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "canPay": true,
  "canCancel": true,
  "canConfirmReceipt": false,
  "canApplyAfterSale": false
}
```


<a id="orderdetail"></a>
## OrderDetail

本人订单详情；数字订单不返回 address 字段。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `orderNo` | string | 是 | 展示用订单号，不能作为鉴权依据。 |  |
| `type` | string | 是 | 一种订单只允许一种业务类型。 | 枚举: `PRODUCT, COURSE, MEMBERSHIP` |
| `status` | string | 是 | 履约状态；支付与售后另有独立字段。 | 枚举: `PENDING_PAYMENT, PENDING_SHIPMENT, PENDING_RECEIPT, COMPLETED, CANCELLED, CLOSED` |
| `paymentStatus` | string | 是 | 订单汇总支付状态。 | 枚举: `UNPAID, PAID, PARTIALLY_REFUNDED, REFUNDED` |
| `afterSaleStatus` | string | 是 | 订单售后汇总。 | 枚举: `NONE, PROCESSING, PARTIALLY_COMPLETED, COMPLETED` |
| `items` | [OrderItem[]](#orderitem) | 是 | 行项目快照 |  |
| `itemsAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `shippingFeeCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `payableAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `paidAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `refundedAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `paymentDeadlineAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `paidAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `address` | [AddressSnapshot](#addresssnapshot) | 否 | 见关联对象。 |  |
| `actions` | [OrderActions](#orderactions) | 是 | 见关联对象。 |  |
| `cancelReason` | string / null | 是 | 文本。 | 最长: `2000` |
| `cancelledAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `completedAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `closedReason` | string / null | 是 | 文本。 | 最长: `2000` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "orderNo": "20261022000001",
  "type": "PRODUCT",
  "status": "PENDING_PAYMENT",
  "paymentStatus": "UNPAID",
  "afterSaleStatus": "NONE",
  "items": [
    {
      "id": "id_10001",
      "resourceId": "id_10001",
      "resourceType": "SKU",
      "productId": "id_10001",
      "title": "健康护理用品",
      "skuAttributes": [
        {
          "name": "规格",
          "value": "标准装"
        }
      ],
      "coverUrl": "https://cdn.example.com/cover.jpg",
      "quantity": 1,
      "unitPriceCents": 9900,
      "subtotalCents": 9900,
      "refundedQuantity": 0,
      "refundedAmountCents": 0
    }
  ],
  "itemsAmountCents": 9900,
  "shippingFeeCents": 0,
  "payableAmountCents": 9900,
  "paidAmountCents": 0,
  "refundedAmountCents": 0,
  "currency": "CNY",
  "paymentDeadlineAt": "2026-10-22T02:30:00Z",
  "paidAt": null,
  "createdAt": "2026-10-22T02:30:00Z",
  "actions": {
    "canPay": true,
    "canCancel": true,
    "canConfirmReceipt": false,
    "canApplyAfterSale": false
  },
  "cancelReason": null,
  "cancelledAt": null,
  "completedAt": null,
  "closedReason": null,
  "version": 1,
  "address": {
    "recipient": "张女士",
    "phone": "+8613800000000",
    "provinceCode": "310000",
    "province": "上海市",
    "cityCode": "310100",
    "city": "上海市",
    "districtCode": "310101",
    "district": "黄浦区",
    "detail": "示例路 100 号"
  }
}
```


<a id="ordercancelinput"></a>
## OrderCancelInput

只允许取消待支付订单。已支付实物走售后。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `reason` | string | 是 | 取消原因。 | 最短: `1`；最长: `200` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "reason": "暂时不需要",
  "version": 1
}
```


<a id="paymentcreate"></a>
## PaymentCreate

一期支持二维码支付和网页跳转；不提供原生 App SDK 支付参数。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `channel` | string | 是 | 已配置支付通道。 | 枚举: `WECHAT_NATIVE, ALIPAY_PAGE` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "channel": "WECHAT_NATIVE"
}
```


<a id="paymentattempt"></a>
## PaymentAttempt

支付尝试。多个尝试只能有一次合法订单入账。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `orderId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `channel` | string | 是 | 支付渠道。 | 枚举: `WECHAT_NATIVE, ALIPAY_PAGE` |
| `status` | string | 是 | 尝试状态；退款由 Refund 另行记录。 | 枚举: `PENDING, SUCCEEDED, CLOSED, FAILED` |
| `amountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `launchType` | string | 是 | 前端打开方式。 | 枚举: `QR_CODE, REDIRECT` |
| `launchUrl` | string | 是 | 二维码内容 URI（可为 weixin://）或支付网关 HTTPS 跳转地址。 | 格式: `uri` |
| `expiresAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `paidAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "orderId": "id_10001",
  "channel": "WECHAT_NATIVE",
  "status": "PENDING",
  "amountCents": 9900,
  "launchType": "QR_CODE",
  "launchUrl": "weixin://wxpay/bizpayurl?pr=demo",
  "expiresAt": "2026-10-22T02:30:00Z",
  "paidAt": null,
  "createdAt": "2026-10-22T02:30:00Z"
}
```


<a id="logisticsevent"></a>
## LogisticsEvent

物流事件；接口返回发生时间从新到旧。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `time` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `description` | string | 是 | 物流描述。 |  |
| `location` | string / null | 是 | 位置。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "time": "2026-10-22T02:00:00Z",
  "description": "快件已由收件人签收",
  "location": "上海"
}
```


<a id="shipment"></a>
## Shipment

一期每笔实物订单一个包裹，全部行一次性发货。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `orderId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `carrierCode` | string | 是 | 快递公司代码。 | 最短: `1`；最长: `32` |
| `carrierName` | string | 是 | 快递公司名称。 |  |
| `trackingNo` | string | 是 | 运单号。 | 最短: `1`；最长: `64` |
| `status` | string | 是 | 物流状态；不等于订单已确认收货。 | 枚举: `PENDING_PICKUP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION` |
| `shippedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `deliveredAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `lastSyncedAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "orderId": "id_10001",
  "carrierCode": "SF",
  "carrierName": "顺丰速运",
  "trackingNo": "SF1234567890",
  "status": "PENDING_PICKUP",
  "shippedAt": "2026-10-22T02:00:00Z",
  "deliveredAt": null,
  "lastSyncedAt": null,
  "version": 1
}
```


<a id="logisticsresult"></a>
## LogisticsResult

未发货返回 shipment=null、events=[]。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `shipment` | object / null | 是 | 一期每笔实物订单一个包裹，全部行一次性发货。 |  |
| `events` | [LogisticsEvent[]](#logisticsevent) | 是 | 最近物流事件 |  |
| `syncStatus` | string | 是 | 同步状态；失败时保留上次数据。 | 枚举: `NOT_SHIPPED, UP_TO_DATE, PENDING, FAILED` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "shipment": null,
  "events": [],
  "syncStatus": "NOT_SHIPPED"
}
```


<a id="shipmentcreate"></a>
## ShipmentCreate

平台发货并扣减实物库存／释放预占库存。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `carrierCode` | string | 是 | 快递公司代码。 | 最短: `1`；最长: `32` |
| `trackingNo` | string | 是 | 运单号。 | 最短: `1`；最长: `64` |
| `orderVersion` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "carrierCode": "SF",
  "trackingNo": "SF1234567890",
  "orderVersion": 1
}
```


<a id="shipmentpatch"></a>
## ShipmentPatch

仅 PENDING_PICKUP 且无揽收事件时允许纠错。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `carrierCode` | string | 是 | 快递公司代码。 | 最短: `1`；最长: `32` |
| `trackingNo` | string | 是 | 运单号。 | 最短: `1`；最长: `64` |
| `reason` | string | 是 | 纠错原因。 | 最短: `1`；最长: `200` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "carrierCode": "SF",
  "trackingNo": "SF1234567891",
  "reason": "录入错误",
  "version": 1
}
```


<a id="aftersalelineinput"></a>
## AfterSaleLineInput

按订单行申请退件，不接受客户端退款金额。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `orderItemId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `quantity` | integer | 是 | 件数。 | 最小: `1`；最大: `99` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "orderItemId": "id_10001",
  "quantity": 1
}
```


<a id="aftersalecreate"></a>
## AfterSaleCreate

只对本人的 PRODUCT 订单申请；一次申请支持多个行。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `orderId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `type` | string | 是 | 未发货仅退款；发货后退货退款。 | 枚举: `REFUND_ONLY, RETURN_REFUND` |
| `items` | [AfterSaleLineInput[]](#aftersalelineinput) | 是 | 行 ID 不重复；数量不超过剩余可售后量 | 最少项: `1`；最多项: `50` |
| `reasonCode` | string | 是 | 申请原因。 | 枚举: `NOT_NEEDED, QUALITY_ISSUE, WRONG_ITEM, OTHER` |
| `description` | string | 是 | 申请说明。 | 最短: `1`；最长: `2000` |
| `evidenceMediaIds` | string[] | 否 | 本人上传、用途 AFTERSALE_EVIDENCE 的 READY 图片 | 最多项: `9`；元素不重复 |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "orderId": "id_10001",
  "type": "REFUND_ONLY",
  "items": [
    {
      "orderItemId": "id_10001",
      "quantity": 1
    }
  ],
  "reasonCode": "NOT_NEEDED",
  "description": "收到的商品规格不符"
}
```


<a id="aftersaleline"></a>
## AfterSaleLine

服务端计算的售后行快照。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `orderItemId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `quantity` | integer | 是 | 件数。 | 最小: `1`；最大: `99` |
| `refundAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "orderItemId": "id_10001",
  "quantity": 1,
  "refundAmountCents": 9900
}
```


<a id="returnshipment"></a>
## ReturnShipment

退货运单，不复用原出库运单。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `carrierCode` | string | 是 | 快递代码。 |  |
| `trackingNo` | string | 是 | 退货单号。 |  |
| `submittedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "carrierCode": "SF",
  "trackingNo": "SF9988776655",
  "submittedAt": "2026-10-22T02:00:00Z"
}
```


<a id="aftersale"></a>
## AfterSale

售后申请。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `afterSaleNo` | string | 是 | 售后展示单号。 |  |
| `orderId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `type` | string | 是 | 售后类型。 | 枚举: `REFUND_ONLY, RETURN_REFUND` |
| `status` | string | 是 | 售后状态。 | 枚举: `PENDING_REVIEW, AWAITING_RETURN, RETURNING, REFUNDING, REFUND_FAILED, COMPLETED, REJECTED, CANCELLED, CLOSED` |
| `items` | [AfterSaleLine[]](#aftersaleline) | 是 | 本次申请行 |  |
| `itemsRefundAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `shippingRefundAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `refundAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `reasonCode` | string | 是 | 原因。 | 枚举: `NOT_NEEDED, QUALITY_ISSUE, WRONG_ITEM, OTHER` |
| `description` | string | 是 | 文本。 | 最长: `2000` |
| `evidence` | [PrivateEvidenceMedia[]](#privateevidencemedia) | 是 | 售后凭证；不提供永久公开 URL |  |
| `reviewNote` | string / null | 是 | 文本。 | 最长: `2000` |
| `returnDeadlineAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `returnAddress` | [AddressSnapshot](#addresssnapshot) | 否 | 见关联对象。 |  |
| `returnShipment` | [ReturnShipment](#returnshipment) | 否 | 见关联对象。 |  |
| `refundId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `updatedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "afterSaleNo": "AS202610220001",
  "orderId": "id_10001",
  "type": "REFUND_ONLY",
  "status": "PENDING_REVIEW",
  "items": [
    {
      "orderItemId": "id_10001",
      "quantity": 1,
      "refundAmountCents": 9900
    }
  ],
  "itemsRefundAmountCents": 9900,
  "shippingRefundAmountCents": 0,
  "refundAmountCents": 9900,
  "reasonCode": "NOT_NEEDED",
  "description": "示例内容",
  "evidence": [
    {
      "id": "id_10001",
      "kind": "IMAGE",
      "status": "READY",
      "mimeType": "image/jpeg",
      "sizeBytes": 102400,
      "publicUrl": null
    }
  ],
  "reviewNote": null,
  "returnDeadlineAt": null,
  "refundId": null,
  "createdAt": "2026-10-22T02:00:00Z",
  "updatedAt": "2026-10-22T02:00:00Z",
  "version": 1
}
```


<a id="aftersalereview"></a>
## AfterSaleReview

批准退货退款必须同时提供 returnAddress；拒绝必须 note 非空。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `decision` | string | 是 | 审核决定。 | 枚举: `APPROVE, REJECT` |
| `note` | string | 是 | 审核说明。 | 最短: `1`；最长: `1000` |
| `returnAddress` | [AddressSnapshot](#addresssnapshot) | 否 | 见关联对象。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "decision": "APPROVE",
  "note": "同意申请",
  "version": 1
}
```


<a id="returnshipmentinput"></a>
## ReturnShipmentInput

用户提交退货物流。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `carrierCode` | string | 是 | 快递代码。 | 最短: `1`；最长: `32` |
| `trackingNo` | string | 是 | 退货单号。 | 最短: `1`；最长: `64` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "carrierCode": "SF",
  "trackingNo": "SF9988776655",
  "version": 1
}
```


<a id="returnreceiptinput"></a>
## ReturnReceiptInput

管理员验收通过才发起退款；需补证或异常保持 RETURNING，人工跟进。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `note` | string | 是 | 验收说明。 | 最短: `1`；最长: `1000` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "note": "退件验收通过",
  "version": 1
}
```


<a id="refund"></a>
## Refund

退款流水；本地请求成功不代表支付渠道已退款。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `orderId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `afterSaleId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `reasonType` | string | 是 | 退款来源。 | 枚举: `AFTERSALE, DIGITAL_ORDER, LATE_PAYMENT, DUPLICATE_PAYMENT` |
| `amountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `status` | string | 是 | 渠道退款状态。 | 枚举: `PENDING, PROCESSING, SUCCEEDED, FAILED` |
| `failureCode` | string / null | 是 | 失败原因码。 |  |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `completedAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "orderId": "id_10001",
  "afterSaleId": "id_10001",
  "reasonType": "AFTERSALE",
  "amountCents": 9900,
  "status": "PENDING",
  "failureCode": null,
  "createdAt": "2026-10-22T02:00:00Z",
  "completedAt": null
}
```


<a id="digitalrefundinput"></a>
## DigitalRefundInput

人工全额退款数字订单；不接受金额；成功后撤销对应购买权益。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `reason` | string | 是 | 处理原因。 | 最短: `1`；最长: `1000` |
| `orderVersion` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "reason": "客服确认退款",
  "orderVersion": 1
}
```


<a id="membershipplan"></a>
## MembershipPlan

会员方案快照；一期无自动续费。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 方案名。 | 最短: `1`；最长: `64` |
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `durationDays` | integer | 是 | 有效天数；按 durationDays*24h 延长。 | 最小: `1`；最大: `3660` |
| `aiDailyLimit` | integer | 是 | 该方案每日 AI 次数；自然日按 Asia/Shanghai。 | 最小: `0` |
| `benefitCodes` | string[] | 是 | 权益 | 元素不重复 |
| `description` | string | 是 | 文本。 | 最长: `2000` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "30 天会员",
  "priceCents": 9900,
  "currency": "CNY",
  "durationDays": 30,
  "aiDailyLimit": 100,
  "benefitCodes": [
    "MEMBER_COURSES"
  ],
  "description": "示例内容"
}
```


<a id="membershipplancreate"></a>
## MembershipPlanCreate

创建会员方案，默认停用。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `name` | string | 是 | 方案名。 | 最短: `1`；最长: `64` |
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `durationDays` | integer | 是 | 有效天数；按 durationDays*24h 延长。 | 最小: `1`；最大: `3660` |
| `aiDailyLimit` | integer | 是 | 该方案每日 AI 次数；自然日按 Asia/Shanghai。 | 最小: `0` |
| `benefitCodes` | string[] | 是 | 权益 | 元素不重复 |
| `description` | string | 是 | 文本。 | 最长: `2000` |
| `sortOrder` | integer | 否 | 展示顺序。 | 最小: `0` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "name": "30 天会员",
  "priceCents": 9900,
  "durationDays": 30,
  "aiDailyLimit": 100,
  "benefitCodes": [
    "MEMBER_COURSES"
  ],
  "description": "示例内容"
}
```


<a id="membershipplanpatch"></a>
## MembershipPlanPatch

只影响后续购买；历史订单与权益使用成交快照。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `name` | string | 否 | 方案名。 | 最短: `1`；最长: `64` |
| `priceCents` | integer | 否 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `durationDays` | integer | 否 | 有效天数；按 durationDays*24h 延长。 | 最小: `1`；最大: `3660` |
| `aiDailyLimit` | integer | 否 | 该方案每日 AI 次数；自然日按 Asia/Shanghai。 | 最小: `0` |
| `benefitCodes` | string[] | 否 | 权益 | 元素不重复 |
| `description` | string | 否 | 文本。 | 最长: `2000` |
| `sortOrder` | integer | 否 | 展示顺序。 | 最小: `0` |
| `enabled` | boolean | 否 | 是否可购买。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

对象至少包含 2 个字段（包含 version 时，至少另传一个可修改字段）。

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "name": "30 天会员"
}
```


<a id="adminmembershipplan"></a>
## AdminMembershipPlan

管理端会员方案。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 方案名。 | 最短: `1`；最长: `64` |
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `durationDays` | integer | 是 | 有效天数；按 durationDays*24h 延长。 | 最小: `1`；最大: `3660` |
| `aiDailyLimit` | integer | 是 | 该方案每日 AI 次数；自然日按 Asia/Shanghai。 | 最小: `0` |
| `benefitCodes` | string[] | 是 | 权益 | 元素不重复 |
| `description` | string | 是 | 文本。 | 最长: `2000` |
| `enabled` | boolean | 是 | 可购买。 |  |
| `sortOrder` | integer | 是 | 排序。 | 最小: `0` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "30 天会员",
  "priceCents": 9900,
  "currency": "CNY",
  "durationDays": 30,
  "aiDailyLimit": 100,
  "benefitCodes": [
    "MEMBER_COURSES"
  ],
  "description": "示例内容",
  "enabled": false,
  "sortOrder": 0,
  "version": 1
}
```


<a id="membershipdetail"></a>
## MembershipDetail

当前会员及最近权益来源；会员资格由购买流水投影产生。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `active` | boolean | 是 | 当前是否为有效会员。 |  |
| `expiresAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `benefitCodes` | string[] | 是 | 当前权益；过期为 [] |  |
| `currentPlanName` | string / null | 是 | 当前时段生效方案名。 |  |
| `aiDailyLimit` | integer | 是 | 当前时段日限额；非会员使用基础额度。 | 最小: `0` |
| `updatedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "active": true,
  "expiresAt": "2026-11-21T02:00:00Z",
  "benefitCodes": [
    "MEMBER_COURSES"
  ],
  "currentPlanName": "30 天会员",
  "aiDailyLimit": 100,
  "updatedAt": "2026-10-22T02:00:00Z"
}
```


<a id="courseentitlement"></a>
## CourseEntitlement

独立购买课程的永久阅读权；退款后撤销。会员可读内容不混入已购列表。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `course` | [CourseSummary](#coursesummary) | 是 | 见关联对象。 |  |
| `orderId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `status` | string | 是 | 授权状态；下架不自动撤销已购权。 | 枚举: `ACTIVE, REVOKED` |
| `grantedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "course": {
    "id": "id_10001",
    "kind": "VIDEO_COURSE",
    "title": "认识身体与健康",
    "summary": "以科学知识解答常见问题。",
    "cover": {
      "id": "id_10001",
      "kind": "IMAGE",
      "status": "READY",
      "mimeType": "image/jpeg",
      "sizeBytes": 102400,
      "publicUrl": "https://cdn.example.com/cover.jpg"
    },
    "category": {
      "id": "id_10001",
      "name": "健康科普",
      "scope": "CONTENT",
      "parentId": "id_10001",
      "sortOrder": 0,
      "enabled": true,
      "version": 1
    },
    "tags": [
      "基础知识"
    ],
    "accessPolicy": "PURCHASE",
    "priceCents": 9900,
    "currency": "CNY",
    "chapterCount": 1,
    "publishedAt": "2026-10-22T02:00:00Z"
  },
  "orderId": "id_10001",
  "status": "ACTIVE",
  "grantedAt": "2026-10-22T02:00:00Z"
}
```


<a id="aiquota"></a>
## AiQuota

问答额度；服务端原子预占，失败且无有效输出时归还。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `date` | string | 是 | 额度日期，Asia/Shanghai。 | 格式: `date` |
| `limit` | integer | 是 | 今日当前额度上限。 | 最小: `0` |
| `used` | integer | 是 | 已结算使用次数。 | 最小: `0` |
| `reserved` | integer | 是 | 生成中的预占次数。 | 最小: `0` |
| `remaining` | integer | 是 | max(0,limit-used-reserved)。 | 最小: `0` |
| `resetsAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "date": "2026-10-22",
  "limit": 100,
  "used": 3,
  "reserved": 1,
  "remaining": 96,
  "resetsAt": "2026-10-22T16:00:00Z"
}
```


<a id="aiconversationinput"></a>
## AiConversationInput

创建会话。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `title` | string | 否 | 标题；不传则服务端生成。 | 最短: `1`；最长: `100` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{}
```


<a id="aiconversationpatch"></a>
## AiConversationPatch

改名。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `title` | string | 是 | 标题。 | 最短: `1`；最长: `100` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "title": "日常健康知识"
}
```


<a id="aiconversation"></a>
## AiConversation

仅本人可读取；管理端用户查询不包含 AI 会话。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `title` | string | 是 | 标题。 |  |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `updatedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "title": "健康知识咨询",
  "createdAt": "2026-10-22T02:00:00Z",
  "updatedAt": "2026-10-22T02:00:00Z"
}
```


<a id="aimessageinput"></a>
## AiMessageInput

每个会话同一时间一个生成任务；clientMessageId 在本人会话内唯一。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `clientMessageId` | string | 是 | 前端生成 UUID，网络重试复用。 | 格式: `uuid` |
| `content` | string | 是 | 用户问题；只做健康知识问答。 | 最短: `1`；最长: `4000` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "clientMessageId": "bde07d36-f847-4da9-8fa7-6e4c53e37aa0",
  "content": "怎样理解日常健康管理？"
}
```


<a id="aimessage"></a>
## AiMessage

持久化消息；失败输出不能伪装为完整回答。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `conversationId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `role` | string | 是 | 消息角色。 | 枚举: `USER, ASSISTANT` |
| `content` | string | 是 | 正文；生成中可为部分文本。 | 最长: `50000` |
| `status` | string | 是 | 消息状态。 | 枚举: `QUEUED, GENERATING, COMPLETED, FAILED, CANCELLED, BLOCKED` |
| `generationId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "conversationId": "id_10001",
  "role": "USER",
  "content": "以下是一般健康知识。",
  "status": "QUEUED",
  "generationId": "id_10001",
  "createdAt": "2026-10-22T02:00:00Z"
}
```


<a id="aimessagepage"></a>
## AiMessagePage

历史消息使用游标；按 createdAt,id 降序，界面可反向展示。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [AiMessage[]](#aimessage) | 是 | 消息 |  |
| `nextCursor` | string / null | 是 | 不透明游标。 |  |
| `hasMore` | boolean | 是 | 有下一批。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "conversationId": "id_10001",
      "role": "USER",
      "content": "以下是一般健康知识。",
      "status": "QUEUED",
      "generationId": "id_10001",
      "createdAt": "2026-10-22T02:00:00Z"
    }
  ],
  "nextCursor": "cursor_demo",
  "hasMore": false
}
```


<a id="aigeneration"></a>
## AiGeneration

异步生成任务；先返回任务，再流式订阅或轮询。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `conversationId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `userMessageId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `assistantMessageId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `status` | string | 是 | 生成状态。 | 枚举: `QUEUED, GENERATING, COMPLETED, FAILED, CANCELLED, BLOCKED` |
| `errorCode` | string / null | 是 | 失败业务码。 |  |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `completedAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "conversationId": "id_10001",
  "userMessageId": "id_10001",
  "assistantMessageId": "id_10001",
  "status": "QUEUED",
  "errorCode": null,
  "createdAt": "2026-10-22T02:00:00Z",
  "completedAt": null
}
```


<a id="ssemetaevent"></a>
## SseMetaEvent

event: meta，含生成任务身份。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `generationId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `assistantMessageId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "generationId": "id_10001",
  "assistantMessageId": "id_10001"
}
```


<a id="ssedeltaevent"></a>
## SseDeltaEvent

event: delta；按 SSE id 去重并依序拼接。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `text` | string | 是 | 增量内容。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "text": "日常健康"
}
```


<a id="ssedoneevent"></a>
## SseDoneEvent

event: done，流结束；以消息查询作为最终事实。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `generationId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `assistantMessageId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `finishReason` | string | 是 | 终止原因。 | 枚举: `STOP, LENGTH, CANCELLED, BLOCKED` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "generationId": "id_10001",
  "assistantMessageId": "id_10001",
  "finishReason": "STOP"
}
```


<a id="sseerrorevent"></a>
## SseErrorEvent

event: error；流已打开，不能改成 HTTP JSON 错误。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `code` | string | 是 | 业务错误码。 |  |
| `message` | string | 是 | 文本。 | 最长: `2000` |
| `retryable` | boolean | 是 | 可重新发起问题。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "code": "AI_PROVIDER_UNAVAILABLE",
  "message": "示例内容",
  "retryable": true
}
```


<a id="notificationtarget"></a>
## NotificationTarget

前端按 type 路由；只传业务 ID，不接受任意跳转 URL。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `type` | string | 是 | 目标页面。 | 枚举: `ORDER, AFTERSALE, CONTENT, MEMBERSHIP, NONE` |
| `resourceId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "type": "ORDER",
  "resourceId": "id_10001"
}
```


<a id="notification"></a>
## Notification

站内消息；系统事件可靠投递，目标读取仍需鉴权。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `category` | string | 是 | 消息类别。 | 枚举: `ORDER, LOGISTICS, AFTERSALE, MEMBERSHIP, SYSTEM` |
| `title` | string | 是 | 标题。 | 最长: `100` |
| `body` | string | 是 | 纯文本正文。 | 最长: `2000` |
| `target` | [NotificationTarget](#notificationtarget) | 是 | 见关联对象。 |  |
| `readAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "category": "ORDER",
  "title": "订单已发货",
  "body": "您的订单已发货，可查看物流。",
  "target": {
    "type": "ORDER",
    "resourceId": "id_10001"
  },
  "readAt": null,
  "createdAt": "2026-10-22T02:00:00Z"
}
```


<a id="unreadcount"></a>
## UnreadCount

本人未读统计。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `count` | integer | 是 | 未读条数。 | 最小: `0` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "count": 3
}
```


<a id="readallinput"></a>
## ReadAllInput

只标记截止时间前的消息，避免吞掉并发新消息。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `before` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "before": "2026-10-22T02:00:00Z"
}
```


<a id="notificationtaskinput"></a>
## NotificationTaskInput

通知范围二选一。

仅允许以下一种结构：

- [NotificationUsersInput](#notificationusersinput)
- [NotificationAllInput](#notificationallinput)


<a id="notificationtask"></a>
## NotificationTask

异步站内通知任务；按 taskId+userId 去重，不暴露其他用户资料。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `status` | string | 是 | 投递状态。 | 枚举: `PENDING, RUNNING, COMPLETED, PARTIAL_FAILED, FAILED` |
| `title` | string | 是 | 标题。 |  |
| `recipientCount` | integer | 是 | 接收人数。 | 最小: `0` |
| `sentCount` | integer | 是 | 已发送人数。 | 最小: `0` |
| `failedCount` | integer | 是 | 失败人数。 | 最小: `0` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "status": "PENDING",
  "title": "服务通知",
  "recipientCount": 100,
  "sentCount": 100,
  "failedCount": 0,
  "createdAt": "2026-10-22T02:00:00Z"
}
```


<a id="uploadcreate"></a>
## UploadCreate

预签名直传；服务端按用途限制媒体类型与权限。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `purpose` | string | 是 | 普通用户仅 AVATAR/AFTERSALE_EVIDENCE；管理员可上传内容及产品素材。 | 枚举: `AVATAR, AFTERSALE_EVIDENCE, CONTENT_COVER, CONTENT_BODY_IMAGE, CONTENT_VIDEO, PRODUCT_IMAGE, COLUMN_COVER` |
| `fileName` | string | 是 | 显示名，不作为存储路径。 | 最短: `1`；最长: `200` |
| `mimeType` | string | 是 | 一期允许类型。 | 枚举: `image/jpeg, image/png, image/webp, video/mp4` |
| `sizeBytes` | integer | 是 | 预期大小；服务端检查真实大小。图片<=10MiB，视频<=1GiB。 | 最小: `1`；最大: `1073741824` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "purpose": "AVATAR",
  "fileName": "cover.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 102400
}
```


<a id="uploadticket"></a>
## UploadTicket

PUT 到对象存储，不经过业务 API；必须带返回 headers。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `uploadId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `mediaId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `method` | string | 是 | 上传方法。 | 枚举: `PUT` |
| `uploadUrl` | string | 是 | HTTPS URL。 | 格式: `uri` |
| `headers` | object | 是 | 上传时原样携带的请求头。 |  |
| `expiresAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "uploadId": "id_10001",
  "mediaId": "id_10001",
  "method": "PUT",
  "uploadUrl": "https://storage.example.com/upload?signature=demo",
  "headers": {
    "Content-Type": "image/jpeg"
  },
  "expiresAt": "2026-10-22T02:10:00Z"
}
```


<a id="mediareadgrant"></a>
## MediaReadGrant

证据图片短时读取授权，仅本人及售后管理员。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `mediaId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `url` | string | 是 | HTTPS URL。 | 格式: `uri` |
| `expiresAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "mediaId": "id_10001",
  "url": "https://cdn.example.com/cover.jpg",
  "expiresAt": "2026-10-22T02:05:00Z"
}
```


<a id="adminuser"></a>
## AdminUser

管理端用户详情；默认仅脱敏手机号，无密码、refreshToken、AI 内容。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `nickname` | string | 是 | 昵称。 | 最短: `1`；最长: `32` |
| `avatarUrl` | string / null | 是 | HTTPS URL。 | 格式: `uri` |
| `phoneMasked` | string | 是 | 脱敏手机。 |  |
| `status` | string | 是 | 账号状态。 | 枚举: `ACTIVE, BANNED, DEACTIVATED` |
| `membership` | [MembershipSummary](#membershipsummary) | 是 | 见关联对象。 |  |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `banReason` | string / null | 是 | 文本。 | 最长: `2000` |
| `bannedUntil` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `lastLoginAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "nickname": "小雨",
  "avatarUrl": "https://cdn.example.com/cover.jpg",
  "phoneMasked": "138****0000",
  "status": "ACTIVE",
  "membership": {
    "active": true,
    "expiresAt": "2026-11-21T02:00:00Z",
    "benefitCodes": [
      "MEMBER_COURSES"
    ]
  },
  "createdAt": "2026-10-22T02:00:00Z",
  "banReason": null,
  "bannedUntil": null,
  "lastLoginAt": null,
  "version": 1
}
```


<a id="userbaninput"></a>
## UserBanInput

封禁立即撤销会话；到期解禁仍需重新登录。禁止用封禁阻止支付补账／退款。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `reason` | string | 是 | 封禁原因。 | 最短: `1`；最长: `1000` |
| `until` | string / null | 是 | 未来 UTC 时间；null 代表永久。 | 格式: `date-time` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "reason": "违反平台规则",
  "until": null,
  "version": 1
}
```


<a id="userunbaninput"></a>
## UserUnbanInput

解封不恢复已撤销的令牌。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `reason` | string | 是 | 解封原因。 | 最短: `1`；最长: `1000` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "reason": "申诉处理完成",
  "version": 1
}
```


<a id="adminorder"></a>
## AdminOrder

管理端订单，包含必要履约联系信息；读取需审计。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `orderNo` | string | 是 | 展示用订单号，不能作为鉴权依据。 |  |
| `type` | string | 是 | 一种订单只允许一种业务类型。 | 枚举: `PRODUCT, COURSE, MEMBERSHIP` |
| `status` | string | 是 | 履约状态；支付与售后另有独立字段。 | 枚举: `PENDING_PAYMENT, PENDING_SHIPMENT, PENDING_RECEIPT, COMPLETED, CANCELLED, CLOSED` |
| `paymentStatus` | string | 是 | 订单汇总支付状态。 | 枚举: `UNPAID, PAID, PARTIALLY_REFUNDED, REFUNDED` |
| `afterSaleStatus` | string | 是 | 订单售后汇总。 | 枚举: `NONE, PROCESSING, PARTIALLY_COMPLETED, COMPLETED` |
| `items` | [OrderItem[]](#orderitem) | 是 | 行项目快照 |  |
| `itemsAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `shippingFeeCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `payableAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `paidAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `refundedAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `paymentDeadlineAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `paidAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `address` | [AddressSnapshot](#addresssnapshot) | 否 | 见关联对象。 |  |
| `actions` | [OrderActions](#orderactions) | 是 | 见关联对象。 |  |
| `cancelReason` | string / null | 是 | 文本。 | 最长: `2000` |
| `cancelledAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `completedAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `closedReason` | string / null | 是 | 文本。 | 最长: `2000` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |
| `user` | [UserSummary](#usersummary) | 是 | 见关联对象。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "orderNo": "20261022000001",
  "type": "PRODUCT",
  "status": "PENDING_PAYMENT",
  "paymentStatus": "UNPAID",
  "afterSaleStatus": "NONE",
  "items": [
    {
      "id": "id_10001",
      "resourceId": "id_10001",
      "resourceType": "SKU",
      "productId": "id_10001",
      "title": "健康护理用品",
      "skuAttributes": [
        {
          "name": "规格",
          "value": "标准装"
        }
      ],
      "coverUrl": "https://cdn.example.com/cover.jpg",
      "quantity": 1,
      "unitPriceCents": 9900,
      "subtotalCents": 9900,
      "refundedQuantity": 0,
      "refundedAmountCents": 0
    }
  ],
  "itemsAmountCents": 9900,
  "shippingFeeCents": 0,
  "payableAmountCents": 9900,
  "paidAmountCents": 0,
  "refundedAmountCents": 0,
  "currency": "CNY",
  "paymentDeadlineAt": "2026-10-22T02:30:00Z",
  "paidAt": null,
  "createdAt": "2026-10-22T02:30:00Z",
  "actions": {
    "canPay": true,
    "canCancel": true,
    "canConfirmReceipt": false,
    "canApplyAfterSale": false
  },
  "cancelReason": null,
  "cancelledAt": null,
  "completedAt": null,
  "closedReason": null,
  "version": 1,
  "user": {
    "id": "id_10001",
    "nickname": "小雨",
    "avatarUrl": "https://cdn.example.com/cover.jpg",
    "phoneMasked": "138****0000",
    "status": "ACTIVE",
    "membership": {
      "active": true,
      "expiresAt": "2026-11-21T02:00:00Z",
      "benefitCodes": [
        "MEMBER_COURSES"
      ]
    },
    "createdAt": "2026-10-22T02:00:00Z"
  },
  "address": {
    "recipient": "张女士",
    "phone": "+8613800000000",
    "provinceCode": "310000",
    "province": "上海市",
    "cityCode": "310100",
    "city": "上海市",
    "districtCode": "310101",
    "district": "黄浦区",
    "detail": "示例路 100 号"
  }
}
```


<a id="adminordersummary"></a>
## AdminOrderSummary

管理端订单列表；收货地址仅详情接口返回。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `orderNo` | string | 是 | 展示用订单号，不能作为鉴权依据。 |  |
| `type` | string | 是 | 一种订单只允许一种业务类型。 | 枚举: `PRODUCT, COURSE, MEMBERSHIP` |
| `status` | string | 是 | 履约状态；支付与售后另有独立字段。 | 枚举: `PENDING_PAYMENT, PENDING_SHIPMENT, PENDING_RECEIPT, COMPLETED, CANCELLED, CLOSED` |
| `paymentStatus` | string | 是 | 订单汇总支付状态。 | 枚举: `UNPAID, PAID, PARTIALLY_REFUNDED, REFUNDED` |
| `afterSaleStatus` | string | 是 | 订单售后汇总。 | 枚举: `NONE, PROCESSING, PARTIALLY_COMPLETED, COMPLETED` |
| `items` | [OrderItem[]](#orderitem) | 是 | 行项目快照 |  |
| `itemsAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `shippingFeeCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `payableAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `paidAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `refundedAmountCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `paymentDeadlineAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `paidAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `user` | [UserSummary](#usersummary) | 是 | 见关联对象。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "orderNo": "20261022000001",
  "type": "PRODUCT",
  "status": "PENDING_PAYMENT",
  "paymentStatus": "UNPAID",
  "afterSaleStatus": "NONE",
  "items": [
    {
      "id": "id_10001",
      "resourceId": "id_10001",
      "resourceType": "SKU",
      "productId": "id_10001",
      "title": "健康护理用品",
      "skuAttributes": [
        {
          "name": "规格",
          "value": "标准装"
        }
      ],
      "coverUrl": "https://cdn.example.com/cover.jpg",
      "quantity": 1,
      "unitPriceCents": 9900,
      "subtotalCents": 9900,
      "refundedQuantity": 0,
      "refundedAmountCents": 0
    }
  ],
  "itemsAmountCents": 9900,
  "shippingFeeCents": 0,
  "payableAmountCents": 9900,
  "paidAmountCents": 0,
  "refundedAmountCents": 0,
  "currency": "CNY",
  "paymentDeadlineAt": "2026-10-22T02:30:00Z",
  "paidAt": null,
  "createdAt": "2026-10-22T02:30:00Z",
  "user": {
    "id": "id_10001",
    "nickname": "小雨",
    "avatarUrl": "https://cdn.example.com/cover.jpg",
    "phoneMasked": "138****0000",
    "status": "ACTIVE",
    "membership": {
      "active": true,
      "expiresAt": "2026-11-21T02:00:00Z",
      "benefitCodes": [
        "MEMBER_COURSES"
      ]
    },
    "createdAt": "2026-10-22T02:00:00Z"
  }
}
```


<a id="auditlog"></a>
## AuditLog

关键操作审计；请求体需脱敏，不记录密码令牌与健康问答正文。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `actorId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `action` | string | 是 | 操作名。 |  |
| `resourceType` | string | 是 | 资源类型。 |  |
| `resourceId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `requestId` | string | 是 | 追踪号。 |  |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "actorId": "id_10001",
  "action": "order.ship",
  "resourceType": "ORDER",
  "resourceId": "id_10001",
  "requestId": "req_demo_001",
  "createdAt": "2026-10-22T02:00:00Z"
}
```


<a id="externalwebhookpayload"></a>
## ExternalWebhookPayload

支付渠道的原始协议载荷，不是本平台 DTO。字段、加密、签名头及 ACK 格式按商户所接协议实现；不由客户端调用。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|

此对象为外部协议载荷，允许渠道定义的额外字段。

示例（仅结构示意，不作为可用业务 ID）：

```json
{}
```


<a id="articlebodywrite"></a>
## ArticleBodyWrite

图文正文写入；内容类型须由路由对应的资源匹配。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |
| `bodyHtml` | string | 是 | 服务端清洗的正文。 | 最短: `1`；最长: `500000` |
| `imageMediaIds` | string[] | 是 | 全部正文图片 ID；无图片传 [] | 最多项: `100`；元素不重复 |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "bodyHtml": "<p>科普正文</p>",
  "imageMediaIds": [
    "id_10001"
  ]
}
```


<a id="videobodywrite"></a>
## VideoBodyWrite

视频正文写入；仅 READY 且已转码素材。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |
| `videoMediaId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "videoMediaId": "id_10001"
}
```


<a id="healthstatus"></a>
## HealthStatus

服务与数据库就绪状态；不返回内部连接信息。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `status` | string | 是 | 就绪时返回 ok。 | 枚举: `ok` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "status": "ok"
}
```


<a id="legaldocument"></a>
## LegalDocument

注册页显示的当前协议；配置版本与注册记录一致。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `type` | string | 是 | 协议类型。 | 枚举: `TERMS, PRIVACY` |
| `version` | string | 是 | 版本。 |  |
| `contentHtml` | string | 是 | 协议全文 HTML。 |  |
| `updatedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "type": "TERMS",
  "version": "2026-10-01",
  "contentHtml": "<p>协议示例</p>",
  "updatedAt": "2026-10-22T02:00:00Z"
}
```


<a id="pagesession"></a>
## PageSession

Session 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [Session[]](#session) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "deviceLabel": "Chrome / Windows",
      "isCurrent": true,
      "lastActiveAt": "2026-10-22T02:00:00Z",
      "createdAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageaddress"></a>
## PageAddress

Address 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [Address[]](#address) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "recipient": "张女士",
      "phone": "+8613800000000",
      "provinceCode": "310000",
      "province": "上海市",
      "cityCode": "310100",
      "city": "上海市",
      "districtCode": "310101",
      "district": "黄浦区",
      "detail": "示例路 100 号",
      "isDefault": true,
      "version": 1
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pagecategory"></a>
## PageCategory

Category 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [Category[]](#category) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "name": "健康科普",
      "scope": "CONTENT",
      "parentId": "id_10001",
      "sortOrder": 0,
      "enabled": true,
      "version": 1
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pagecontentsummary"></a>
## PageContentSummary

ContentSummary 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [ContentSummary[]](#contentsummary) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "kind": "SCIENCE_VIDEO",
      "title": "认识身体与健康",
      "summary": "以科学知识解答常见问题。",
      "cover": {
        "id": "id_10001",
        "kind": "IMAGE",
        "status": "READY",
        "mimeType": "image/jpeg",
        "sizeBytes": 102400,
        "publicUrl": "https://cdn.example.com/cover.jpg"
      },
      "category": {
        "id": "id_10001",
        "name": "健康科普",
        "scope": "CONTENT",
        "parentId": "id_10001",
        "sortOrder": 0,
        "enabled": true,
        "version": 1
      },
      "tags": [
        "基础知识"
      ],
      "accessPolicy": "FREE",
      "priceCents": 0,
      "currency": "CNY",
      "chapterCount": 0,
      "publishedAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pagechaptersummary"></a>
## PageChapterSummary

ChapterSummary 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [ChapterSummary[]](#chaptersummary) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "courseId": "id_10001",
      "title": "第一章：基础知识",
      "kind": "VIDEO",
      "sortOrder": 1,
      "isPreview": true,
      "durationSeconds": 180,
      "access": {
        "canAccess": true,
        "reason": "FREE"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pagecolumn"></a>
## PageColumn

Column 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [Column[]](#column) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "name": "亲密关系与健康",
      "description": "专题知识合集",
      "cover": {
        "id": "id_10001",
        "kind": "IMAGE",
        "status": "READY",
        "mimeType": "image/jpeg",
        "sizeBytes": 102400,
        "publicUrl": "https://cdn.example.com/cover.jpg"
      },
      "contentCount": 5,
      "sortOrder": 0
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageproductsummary"></a>
## PageProductSummary

ProductSummary 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [ProductSummary[]](#productsummary) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "name": "健康护理用品",
      "summary": "示例内容",
      "cover": {
        "id": "id_10001",
        "kind": "IMAGE",
        "status": "READY",
        "mimeType": "image/jpeg",
        "sizeBytes": 102400,
        "publicUrl": "https://cdn.example.com/cover.jpg"
      },
      "category": {
        "id": "id_10001",
        "name": "健康科普",
        "scope": "PRODUCT",
        "parentId": "id_10001",
        "sortOrder": 0,
        "enabled": true,
        "version": 1
      },
      "minPriceCents": 9900,
      "maxPriceCents": 9900,
      "currency": "CNY",
      "inStock": true
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageordersummary"></a>
## PageOrderSummary

OrderSummary 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [OrderSummary[]](#ordersummary) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "orderNo": "20261022000001",
      "type": "PRODUCT",
      "status": "PENDING_PAYMENT",
      "paymentStatus": "UNPAID",
      "afterSaleStatus": "NONE",
      "items": [
        {
          "id": "id_10001",
          "resourceId": "id_10001",
          "resourceType": "SKU",
          "productId": "id_10001",
          "title": "健康护理用品",
          "skuAttributes": [
            {
              "name": "规格",
              "value": "标准装"
            }
          ],
          "coverUrl": "https://cdn.example.com/cover.jpg",
          "quantity": 1,
          "unitPriceCents": 9900,
          "subtotalCents": 9900,
          "refundedQuantity": 0,
          "refundedAmountCents": 0
        }
      ],
      "itemsAmountCents": 9900,
      "shippingFeeCents": 0,
      "payableAmountCents": 9900,
      "paidAmountCents": 0,
      "refundedAmountCents": 0,
      "currency": "CNY",
      "paymentDeadlineAt": "2026-10-22T02:30:00Z",
      "paidAt": null,
      "createdAt": "2026-10-22T02:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pagerefund"></a>
## PageRefund

Refund 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [Refund[]](#refund) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "orderId": "id_10001",
      "afterSaleId": "id_10001",
      "reasonType": "AFTERSALE",
      "amountCents": 9900,
      "status": "PENDING",
      "failureCode": null,
      "createdAt": "2026-10-22T02:00:00Z",
      "completedAt": null
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pagemembershipplan"></a>
## PageMembershipPlan

MembershipPlan 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [MembershipPlan[]](#membershipplan) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "name": "30 天会员",
      "priceCents": 9900,
      "currency": "CNY",
      "durationDays": 30,
      "aiDailyLimit": 100,
      "benefitCodes": [
        "MEMBER_COURSES"
      ],
      "description": "示例内容"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pagecourseentitlement"></a>
## PageCourseEntitlement

CourseEntitlement 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [CourseEntitlement[]](#courseentitlement) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "course": {
        "id": "id_10001",
        "kind": "VIDEO_COURSE",
        "title": "认识身体与健康",
        "summary": "以科学知识解答常见问题。",
        "cover": {
          "id": "id_10001",
          "kind": "IMAGE",
          "status": "READY",
          "mimeType": "image/jpeg",
          "sizeBytes": 102400,
          "publicUrl": "https://cdn.example.com/cover.jpg"
        },
        "category": {
          "id": "id_10001",
          "name": "健康科普",
          "scope": "CONTENT",
          "parentId": "id_10001",
          "sortOrder": 0,
          "enabled": true,
          "version": 1
        },
        "tags": [
          "基础知识"
        ],
        "accessPolicy": "PURCHASE",
        "priceCents": 9900,
        "currency": "CNY",
        "chapterCount": 1,
        "publishedAt": "2026-10-22T02:00:00Z"
      },
      "orderId": "id_10001",
      "status": "ACTIVE",
      "grantedAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageaftersale"></a>
## PageAfterSale

AfterSale 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [AfterSale[]](#aftersale) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "afterSaleNo": "AS202610220001",
      "orderId": "id_10001",
      "type": "REFUND_ONLY",
      "status": "PENDING_REVIEW",
      "items": [
        {
          "orderItemId": "id_10001",
          "quantity": 1,
          "refundAmountCents": 9900
        }
      ],
      "itemsRefundAmountCents": 9900,
      "shippingRefundAmountCents": 0,
      "refundAmountCents": 9900,
      "reasonCode": "NOT_NEEDED",
      "description": "示例内容",
      "evidence": [
        {
          "id": "id_10001",
          "kind": "IMAGE",
          "status": "READY",
          "mimeType": "image/jpeg",
          "sizeBytes": 102400,
          "publicUrl": null
        }
      ],
      "reviewNote": null,
      "returnDeadlineAt": null,
      "refundId": null,
      "createdAt": "2026-10-22T02:00:00Z",
      "updatedAt": "2026-10-22T02:00:00Z",
      "version": 1
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageaiconversation"></a>
## PageAiConversation

AiConversation 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [AiConversation[]](#aiconversation) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "title": "健康知识咨询",
      "createdAt": "2026-10-22T02:00:00Z",
      "updatedAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pagenotification"></a>
## PageNotification

Notification 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [Notification[]](#notification) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "category": "ORDER",
      "title": "订单已发货",
      "body": "您的订单已发货，可查看物流。",
      "target": {
        "type": "ORDER",
        "resourceId": "id_10001"
      },
      "readAt": null,
      "createdAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageadmincontent"></a>
## PageAdminContent

AdminContent 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [AdminContent[]](#admincontent) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "kind": "SCIENCE_VIDEO",
      "title": "认识身体与健康",
      "summary": "以科学知识解答常见问题。",
      "cover": {
        "id": "id_10001",
        "kind": "IMAGE",
        "status": "READY",
        "mimeType": "image/jpeg",
        "sizeBytes": 102400,
        "publicUrl": "https://cdn.example.com/cover.jpg"
      },
      "category": {
        "id": "id_10001",
        "name": "健康科普",
        "scope": "CONTENT",
        "parentId": "id_10001",
        "sortOrder": 0,
        "enabled": true,
        "version": 1
      },
      "tags": [
        "基础知识"
      ],
      "accessPolicy": "FREE",
      "priceCents": 0,
      "currency": "CNY",
      "chapterCount": 0,
      "publishedAt": null,
      "descriptionHtml": "<p>课程介绍</p>",
      "authorName": "健康教育团队",
      "columnIds": [
        "id_10001"
      ],
      "access": {
        "canAccess": true,
        "reason": "FREE"
      },
      "status": "DRAFT",
      "version": 1,
      "createdAt": "2026-10-22T02:00:00Z",
      "updatedAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageadminchapter"></a>
## PageAdminChapter

AdminChapter 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [AdminChapter[]](#adminchapter) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "courseId": "id_10001",
      "title": "第一章：基础知识",
      "kind": "VIDEO",
      "sortOrder": 1,
      "isPreview": true,
      "durationSeconds": 180,
      "access": {
        "canAccess": true,
        "reason": "FREE"
      },
      "status": "DRAFT",
      "version": 1,
      "createdAt": "2026-10-22T02:00:00Z",
      "updatedAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageadmincolumn"></a>
## PageAdminColumn

AdminColumn 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [AdminColumn[]](#admincolumn) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "name": "亲密关系与健康",
      "description": "专题知识合集",
      "cover": {
        "id": "id_10001",
        "kind": "IMAGE",
        "status": "READY",
        "mimeType": "image/jpeg",
        "sizeBytes": 102400,
        "publicUrl": "https://cdn.example.com/cover.jpg"
      },
      "contentCount": 5,
      "sortOrder": 0,
      "status": "DRAFT",
      "version": 1,
      "createdAt": "2026-10-22T02:00:00Z",
      "updatedAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageadminproduct"></a>
## PageAdminProduct

AdminProduct 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [AdminProduct[]](#adminproduct) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "name": "健康护理用品",
      "summary": "示例内容",
      "cover": {
        "id": "id_10001",
        "kind": "IMAGE",
        "status": "READY",
        "mimeType": "image/jpeg",
        "sizeBytes": 102400,
        "publicUrl": "https://cdn.example.com/cover.jpg"
      },
      "category": {
        "id": "id_10001",
        "name": "健康科普",
        "scope": "PRODUCT",
        "parentId": "id_10001",
        "sortOrder": 0,
        "enabled": true,
        "version": 1
      },
      "minPriceCents": 9900,
      "maxPriceCents": 9900,
      "currency": "CNY",
      "inStock": true,
      "detailHtml": "<p>产品使用说明</p>",
      "gallery": [
        {
          "id": "id_10001",
          "kind": "IMAGE",
          "status": "READY",
          "mimeType": "image/jpeg",
          "sizeBytes": 102400,
          "publicUrl": "https://cdn.example.com/cover.jpg"
        }
      ],
      "skus": [
        {
          "id": "id_10001",
          "productId": "id_10001",
          "skuCode": "CARE-001",
          "attributes": [
            {
              "name": "规格",
              "value": "标准装"
            }
          ],
          "priceCents": 9900,
          "availableStock": 100,
          "enabled": true
        }
      ],
      "afterSalePolicy": "符合平台售后规则可申请售后。",
      "status": "DRAFT",
      "version": 1,
      "createdAt": "2026-10-22T02:00:00Z",
      "updatedAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageadminsku"></a>
## PageAdminSku

AdminSku 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [AdminSku[]](#adminsku) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "productId": "id_10001",
      "skuCode": "CARE-001",
      "attributes": [
        {
          "name": "规格",
          "value": "标准装"
        }
      ],
      "priceCents": 9900,
      "availableStock": 100,
      "enabled": true,
      "onHandStock": 102,
      "reservedStock": 2,
      "version": 1
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pagestockadjustment"></a>
## PageStockAdjustment

StockAdjustment 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [StockAdjustment[]](#stockadjustment) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "skuId": "id_10001",
      "delta": 10,
      "onHandStockAfter": 112,
      "reservedStockAfter": 2,
      "reason": "示例内容",
      "operatorId": "id_10001",
      "createdAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageadminordersummary"></a>
## PageAdminOrderSummary

AdminOrderSummary 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [AdminOrderSummary[]](#adminordersummary) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "orderNo": "20261022000001",
      "type": "PRODUCT",
      "status": "PENDING_PAYMENT",
      "paymentStatus": "UNPAID",
      "afterSaleStatus": "NONE",
      "items": [
        {
          "id": "id_10001",
          "resourceId": "id_10001",
          "resourceType": "SKU",
          "productId": "id_10001",
          "title": "健康护理用品",
          "skuAttributes": [
            {
              "name": "规格",
              "value": "标准装"
            }
          ],
          "coverUrl": "https://cdn.example.com/cover.jpg",
          "quantity": 1,
          "unitPriceCents": 9900,
          "subtotalCents": 9900,
          "refundedQuantity": 0,
          "refundedAmountCents": 0
        }
      ],
      "itemsAmountCents": 9900,
      "shippingFeeCents": 0,
      "payableAmountCents": 9900,
      "paidAmountCents": 0,
      "refundedAmountCents": 0,
      "currency": "CNY",
      "paymentDeadlineAt": "2026-10-22T02:30:00Z",
      "paidAt": null,
      "createdAt": "2026-10-22T02:30:00Z",
      "user": {
        "id": "id_10001",
        "nickname": "小雨",
        "avatarUrl": "https://cdn.example.com/cover.jpg",
        "phoneMasked": "138****0000",
        "status": "ACTIVE",
        "membership": {
          "active": true,
          "expiresAt": "2026-11-21T02:00:00Z",
          "benefitCodes": [
            "MEMBER_COURSES"
          ]
        },
        "createdAt": "2026-10-22T02:00:00Z"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageadminuser"></a>
## PageAdminUser

AdminUser 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [AdminUser[]](#adminuser) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "nickname": "小雨",
      "avatarUrl": "https://cdn.example.com/cover.jpg",
      "phoneMasked": "138****0000",
      "status": "ACTIVE",
      "membership": {
        "active": true,
        "expiresAt": "2026-11-21T02:00:00Z",
        "benefitCodes": [
          "MEMBER_COURSES"
        ]
      },
      "createdAt": "2026-10-22T02:00:00Z",
      "banReason": null,
      "bannedUntil": null,
      "lastLoginAt": null,
      "version": 1
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageadminmembershipplan"></a>
## PageAdminMembershipPlan

AdminMembershipPlan 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [AdminMembershipPlan[]](#adminmembershipplan) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "name": "30 天会员",
      "priceCents": 9900,
      "currency": "CNY",
      "durationDays": 30,
      "aiDailyLimit": 100,
      "benefitCodes": [
        "MEMBER_COURSES"
      ],
      "description": "示例内容",
      "enabled": false,
      "sortOrder": 0,
      "version": 1
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pagenotificationtask"></a>
## PageNotificationTask

NotificationTask 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [NotificationTask[]](#notificationtask) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "status": "PENDING",
      "title": "服务通知",
      "recipientCount": 100,
      "sentCount": 100,
      "failedCount": 0,
      "createdAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pageauditlog"></a>
## PageAuditLog

AuditLog 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [AuditLog[]](#auditlog) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "id_10001",
      "actorId": "id_10001",
      "action": "order.ship",
      "resourceType": "ORDER",
      "resourceId": "id_10001",
      "requestId": "req_demo_001",
      "createdAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="privateevidencemedia"></a>
## PrivateEvidenceMedia

售后私有图片元数据；publicUrl 固定 null，须申请 read-grant。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `kind` | string | 是 | 媒体类型。 | 枚举: `IMAGE, VIDEO` |
| `status` | string | 是 | 上传后处理完成才可引用。 | 枚举: `UPLOADING, PROCESSING, READY, FAILED` |
| `mimeType` | string | 是 | 实际检查后的 MIME。 |  |
| `sizeBytes` | integer | 是 | 字节数。 | 最小: `0` |
| `publicUrl` | string / null | 是 | 固定 null。 | 枚举: `None` |
| `durationSeconds` | integer | 否 | 仅视频返回，处理前可不返回。 | 最小: `0` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "kind": "IMAGE",
  "status": "READY",
  "mimeType": "image/jpeg",
  "sizeBytes": 102400,
  "publicUrl": null
}
```


<a id="notificationusersinput"></a>
## NotificationUsersInput

向指定用户发送站内通知。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `audience` | string | 是 | 指定用户。 | 枚举: `USERS` |
| `userIds` | string[] | 是 | USERS 必填；ALL_ACTIVE 禁止传 | 最少项: `1`；最多项: `1000`；元素不重复 |
| `title` | string | 是 | 标题。 | 最短: `1`；最长: `100` |
| `body` | string | 是 | 纯文本。 | 最短: `1`；最长: `2000` |
| `target` | [NotificationTarget](#notificationtarget) | 是 | 见关联对象。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "audience": "USERS",
  "userIds": [
    "id_10001"
  ],
  "title": "服务通知",
  "body": "平台内容已更新。",
  "target": {
    "type": "ORDER",
    "resourceId": "id_10001"
  }
}
```


<a id="notificationallinput"></a>
## NotificationAllInput

任务创建时对活跃用户取接收者快照；不允许 userIds。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `audience` | string | 是 | 全部活跃用户。 | 枚举: `ALL_ACTIVE` |
| `title` | string | 是 | 标题。 | 最短: `1`；最长: `100` |
| `body` | string | 是 | 纯文本。 | 最短: `1`；最长: `2000` |
| `target` | [NotificationTarget](#notificationtarget) | 是 | 见关联对象。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "audience": "ALL_ACTIVE",
  "title": "服务通知",
  "body": "平台内容已更新。",
  "target": {
    "type": "ORDER",
    "resourceId": "id_10001"
  }
}
```


<a id="contentcategory"></a>
## ContentCategory

作用域固定为 CONTENT 的分类。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 分类名。 | 最短: `1`；最长: `32` |
| `scope` | string | 是 | 固定作用域。 | 枚举: `CONTENT` |
| `parentId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `sortOrder` | integer | 是 | 升序展示。 | 最小: `0` |
| `enabled` | boolean | 是 | 是否可用。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "健康科普",
  "scope": "CONTENT",
  "parentId": "id_10001",
  "sortOrder": 0,
  "enabled": true,
  "version": 1
}
```


<a id="productcategory"></a>
## ProductCategory

作用域固定为 PRODUCT 的分类。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 分类名。 | 最短: `1`；最长: `32` |
| `scope` | string | 是 | 固定作用域。 | 枚举: `PRODUCT` |
| `parentId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `sortOrder` | integer | 是 | 升序展示。 | 最小: `0` |
| `enabled` | boolean | 是 | 是否可用。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "健康科普",
  "scope": "PRODUCT",
  "parentId": "id_10001",
  "sortOrder": 0,
  "enabled": true,
  "version": 1
}
```


<a id="coursesummary"></a>
## CourseSummary

已购课程摘要，仅付费课程类型；不含授权正文。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `kind` | string | 是 | 课程类型。 | 枚举: `VIDEO_COURSE, ARTICLE_COURSE` |
| `title` | string | 是 | 标题。 | 最短: `1`；最长: `120` |
| `summary` | string | 是 | 简介。 | 最长: `2000` |
| `cover` | [MediaSummary](#mediasummary) | 是 | 见关联对象。 |  |
| `category` | [ContentCategory](#contentcategory) | 是 | 见关联对象。 |  |
| `tags` | string[] | 是 | 标签 | 最多项: `10` |
| `accessPolicy` | string | 是 | 可购买访问策略。 | 枚举: `PURCHASE, MEMBER_OR_PURCHASE` |
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `chapterCount` | integer | 是 | 科普为 0；课程为已发布章节数。 | 最小: `0` |
| `publishedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "kind": "VIDEO_COURSE",
  "title": "认识身体与健康",
  "summary": "以科学知识解答常见问题。",
  "cover": {
    "id": "id_10001",
    "kind": "IMAGE",
    "status": "READY",
    "mimeType": "image/jpeg",
    "sizeBytes": 102400,
    "publicUrl": "https://cdn.example.com/cover.jpg"
  },
  "category": {
    "id": "id_10001",
    "name": "健康科普",
    "scope": "CONTENT",
    "parentId": "id_10001",
    "sortOrder": 0,
    "enabled": true,
    "version": 1
  },
  "tags": [
    "基础知识"
  ],
  "accessPolicy": "PURCHASE",
  "priceCents": 9900,
  "currency": "CNY",
  "chapterCount": 1,
  "publishedAt": "2026-10-22T02:00:00Z"
}
```

