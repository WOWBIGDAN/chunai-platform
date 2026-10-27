# 数据格式文档

> 所有名称对应 OpenAPI `components.schemas`，可生成前端 TypeScript 类型与 NestJS DTO。

## 基础约定

| 项目 | 约定 |
|---|---|
| ID | `string`，1–64 位，不转 JS Number，不通过 ID 推断权限 |
| 金额 | `integer` 人民币分，`currency=CNY`；如 9900 = ¥99.00；不传浮点金额 |
| 时间 | ISO 8601 UTC，如 `2026-10-22T02:00:00Z`；界面显示上海时间 |
| 分页 | `page/pageSize` 从 1 开始；数据为 `items/total/page/pageSize/hasNext`；空列表为 `[]` |
| 游标 | AI 消息用 `cursor/limit`；站内消息用互斥的 `beforeSequence/afterSequence` 与 `limit`，序号与 revision 均为十进制字符串 |
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

所有成功 JSON API 返回 `code/message/data/requestId/timestamp`；成功 `code=OK`。创建通常 201，异步受理 202，普通查询／操作 200。删除也返回 200；通常为 `{success:true}`，站内消息删除返回更新数量及收件箱状态。

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
- [PageAdminContent](#pageadmincontent)
- [PageAdminChapter](#pageadminchapter)
- [PageAdminColumn](#pageadmincolumn)
- [PageAdminProduct](#pageadminproduct)
- [PageAdminSku](#pageadminsku)
- [PageStockAdjustment](#pagestockadjustment)
- [PageAdminOrderSummary](#pageadminordersummary)
- [PageAdminUser](#pageadminuser)
- [PageAdminMembershipPlan](#pageadminmembershipplan)
- [PageAuditLog](#pageauditlog)
- [PrivateEvidenceMedia](#privateevidencemedia)
- [ProductImageCreate](#productimagecreate)
- [TestPaymentInput](#testpaymentinput)
- [TestRefundInput](#testrefundinput)
- [ManualLogisticsInput](#manuallogisticsinput)
- [ShipmentLine](#shipmentline)
- [CommerceAuditLog](#commerceauditlog)
- [PageCommerceAuditLog](#pagecommerceauditlog)
- [ImplementedPurchase](#implementedpurchase)
- [MembershipRecord](#membershiprecord)
- [MembershipWrite](#membershipwrite)
- [MembershipRevoke](#membershiprevoke)
- [ContentImageCreate](#contentimagecreate)
- [BilibiliVideoCreate](#bilibilivideocreate)
- [FeishuVideoCreate](#feishuvideocreate)
- [ExternalVideoCreate](#externalvideocreate)
- [MembershipPlanSnapshot](#membershipplansnapshot)
- [MembershipPeriod](#membershipperiod)
- [PageMembershipPeriod](#pagemembershipperiod)
- [UploadImageCreate](#uploadimagecreate)
- [UploadVideoCreate](#uploadvideocreate)
- [CartProduct](#cartproduct)
- [CartItem](#cartitem)
- [CartItemPut](#cartitemput)
- [CartQuoteLine](#cartquoteline)
- [CartQuoteCreate](#cartquotecreate)
- [FavoriteContent](#favoritecontent)
- [ContentFavorite](#contentfavorite)
- [NullableContentFavorite](#nullablecontentfavorite)
- [FavoriteState](#favoritestate)
- [PageCartItem](#pagecartitem)
- [PageContentFavorite](#pagecontentfavorite)
- [LogisticsCarrier](#logisticscarrier)
- [LogisticsCarriers](#logisticscarriers)
- [InAppMessage](#inappmessage)
- [MessagePollResult](#messagepollresult)
- [MessagePage](#messagepage)
- [MessageMutationResult](#messagemutationresult)
- [MessagesReadInput](#messagesreadinput)
- [MessagesReadAllInput](#messagesreadallinput)
- [AdminMessageInput](#adminmessageinput)
- [AdminMessageResult](#adminmessageresult)
- [ScienceCategory](#sciencecategory)
- [CourseCategory](#coursecategory)
- [ProductCategory](#productcategory)
- [ContentCategory](#contentcategory)
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
| `status` | string | 是 | 统一上传状态：UPLOADING 待确认；READY 可引用；FAILED 校验失败；DELETED 已逻辑删除。旧素材接口直接返回 READY。 | 枚举: `UPLOADING, READY, FAILED, DELETED` |
| `mimeType` | string | 是 | 实际检查后的 MIME。 |  |
| `sizeBytes` | integer | 是 | 字节数。 | 最小: `0` |
| `publicUrl` | string / null | 是 | 仅 READY 的公开图片返回稳定 OSS URL；待上传、失败、已删除、售后凭证及私有视频均为 null。 | 格式: `uri` |
| `durationSeconds` | integer | 否 | 仅视频返回，处理前可不返回。 | 最小: `0` |
| `provider` | string | 否 | 统一上传为 OSS；保留旧素材来源；不包含存储凭证、内部对象路径或受保护视频链接。 | 枚举: `LOCAL, OSS, EXTERNAL_IMAGE, BILIBILI, FEISHU` |

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
| `expiresAt` | string / null | 是 | 未撤销的管理员期限和 ACTIVE 付费段的最晚到期时间，包括未来或已过期时段；无候选记录时为 null。请用 active 判断当前资格。 | 格式: `date-time` |
| `benefitCodes` | string[] | 是 | 有效时为 [MEMBER_CONTENT]，无效时为 [] |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "active": true,
  "expiresAt": "2026-11-21T02:00:00Z",
  "benefitCodes": [
    "MEMBER_CONTENT"
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
| `avatarUrl` | string / null | 是 | 已上传到 CONTENT_IMAGE_OSS_HOST 的永久 HTTPS 对象地址，默认 chunai-photo.oss-cn-hangzhou.aliyuncs.com；不得带签名查询、fragment、账号或端口。null 清空头像，不传则保持。 | 格式: `uri`；最短: `1`；最长: `2048` |
| `phoneMasked` | string | 是 | 脱敏手机。 |  |
| `status` | string | 是 | 账号状态。 | 枚举: `ACTIVE, BANNED, DEACTIVATED` |
| `membership` | [MembershipSummary](#membershipsummary) | 是 | 见关联对象。 |  |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1`；最大: `2147483647` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "nickname": "小雨",
  "avatarUrl": "https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/avatars/replace-with-existing-object.jpg",
  "phoneMasked": "138****0000",
  "status": "ACTIVE",
  "membership": {
    "active": true,
    "expiresAt": "2026-11-21T02:00:00Z",
    "benefitCodes": [
      "MEMBER_CONTENT"
    ]
  },
  "createdAt": "2026-10-22T02:00:00Z",
  "version": 1
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
    "avatarUrl": "https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/avatars/replace-with-existing-object.jpg",
    "phoneMasked": "138****0000",
    "status": "ACTIVE",
    "membership": {
      "active": true,
      "expiresAt": "2026-11-21T02:00:00Z",
      "benefitCodes": [
        "MEMBER_CONTENT"
      ]
    },
    "createdAt": "2026-10-22T02:00:00Z",
    "version": 1
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

当前 version 与至少一个修改字段：nickname、avatarMediaId 或兼容字段 avatarUrl；两种头像字段互斥，头像 ID 仅接受本人 READY AVATAR。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1`；最大: `2147483647` |
| `nickname` | string | 否 | 前后空白会去除，禁止控制字符。 | 最短: `1`；最长: `32`；正则: `^[^\u0000-\u001f\u007f]+$` |
| `avatarUrl` | string / null | 否 | 已上传到 CONTENT_IMAGE_OSS_HOST 的永久 HTTPS 对象地址，默认 chunai-photo.oss-cn-hangzhou.aliyuncs.com；不得带签名查询、fragment、账号或端口。null 清空头像，不传则保持。 优先使用统一上传返回的 avatarMediaId。通过 URL 引用系统管理的头像时同样校验所有者，不能绑定他人上传的文件。 | 格式: `uri`；最短: `1`；最长: `2048` |
| `avatarMediaId` | string / null | 否 | 本人上传、用途 AVATAR、状态 READY 的素材 ID；null 清空头像。与 avatarUrl 互斥。 | 格式: `uuid` |

对象至少包含 2 个字段（包含 version 时，至少另传一个可修改字段）。

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "nickname": "cs测试昵称"
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

独立管理员会话，aud=admin；访问令牌默认 15 分钟，刷新会话绝对期限 24 小时。

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

商品、科普或课程分类；三种 scope 独立，禁止跨域使用或产生父子循环。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 分类名。 | 最短: `1`；最长: `32` |
| `scope` | string | 是 | 分类作用域。 | 枚举: `PRODUCT, SCIENCE, COURSE` |
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


<a id="categorycreate"></a>
## CategoryCreate

创建分类。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `name` | string | 是 | 名称。 | 最短: `1`；最长: `32` |
| `scope` | string | 是 | 作用域。 | 枚举: `PRODUCT, SCIENCE, COURSE` |
| `parentId` | string / null | 否 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `sortOrder` | integer | 否 | 排序。 | 最小: `0` |
| `enabled` | boolean | 否 | 启用。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "name": "健康科普",
  "scope": "PRODUCT"
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
| `accessPolicy` | string | 是 | FREE 免费、PURCHASE 独立购买、MEMBER 按网站会员有效期；MEMBER 仅课程且 priceCents=0。 | 枚举: `FREE, PURCHASE, MEMBER` |
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
    "scope": "SCIENCE",
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
| `reason` | string | 是 | 授权或阻断原因；MEMBERSHIP_REQUIRED 表示需要有效网站会员。 | 枚举: `FREE, PURCHASED, MEMBER, PREVIEW, ADMIN, LOGIN_REQUIRED, PURCHASE_REQUIRED, MEMBERSHIP_REQUIRED, CONTENT_UNAVAILABLE` |

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
| `accessPolicy` | string | 是 | FREE 免费、PURCHASE 独立购买、MEMBER 按网站会员有效期；MEMBER 仅课程且 priceCents=0。 | 枚举: `FREE, PURCHASE, MEMBER` |
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
    "scope": "SCIENCE",
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

统一视频访问结果。STREAM 使用 5 分钟本地播放授权；EXTERNAL_LINK 跳转第三方页面。FEISHU 的 externalUrl/accessPassword 仅在会员或管理员预览授权通过后返回，禁止缓存。已返回的外部链接不会随网站会员撤销而在第三方自动失效。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `contentId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `chapterId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `playbackUrl` | string / null | 是 | LOCAL 或 OSS 的 STREAM 返回短时应用代理地址；外链模式为 null。 | 格式: `uri` |
| `expiresAt` | string / null | 是 | STREAM 播放授权到期时间；外链模式为 null。 | 格式: `date-time` |
| `durationSeconds` | integer | 是 | 可播放时长。 | 最小: `0` |
| `preview` | boolean | 是 | 整章免费预览；不是在完整付费视频上做客户端限时。 |  |
| `provider` | string | 是 | 视频提供方。 | 枚举: `LOCAL, OSS, BILIBILI, FEISHU` |
| `mode` | string | 是 | 前端按此字段选择播放器或外部页面跳转。 | 枚举: `STREAM, EXTERNAL_LINK` |
| `externalUrl` | string / null | 是 | 外部跳转地址；STREAM 为 null。FEISHU 视为敏感数据。 | 格式: `uri` |
| `accessPassword` | string / null | 是 | 仅授权 FEISHU 返回网盘访问密码；其他模式为 null。 | 最短: `1`；最长: `128` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "contentId": "id_10001",
  "chapterId": "id_10001",
  "playbackUrl": "http://localhost:3000/api/v1/content-playback/media-id?token=example",
  "expiresAt": "2026-10-22T02:05:00Z",
  "durationSeconds": 180,
  "preview": false,
  "provider": "LOCAL",
  "mode": "STREAM",
  "externalUrl": null,
  "accessPassword": null
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
| `coverMediaId` | string | 是 | 科普必须选择 SCIENCE 分类，课程必须选择 COURSE 分类；分类须启用。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `categoryId` | string | 是 | 科普必须选择 SCIENCE 分类，课程必须选择 COURSE 分类；分类须启用。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `authorName` | string | 否 | 作者。 | 最长: `64` |
| `tags` | string[] | 否 | 标签 | 最多项: `10`；元素不重复 |
| `accessPolicy` | string | 是 | FREE 免费、PURCHASE 独立购买、MEMBER 按网站会员有效期；MEMBER 仅课程且 priceCents=0。 | 枚举: `FREE, PURCHASE, MEMBER` |
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

部分更新；accessPolicy 与 priceCents 改动需同时提交；发布内容即时生效并留审计。 已有购买订单历史的课程不能改为 MEMBER，返回 RESOURCE_IN_USE，保留原有购买权益。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `title` | string | 否 | 标题。 | 最短: `1`；最长: `120` |
| `summary` | string | 否 | 文本。 | 最长: `2000` |
| `descriptionHtml` | string | 否 | 介绍 HTML；服务端清洗。 | 最长: `100000` |
| `coverMediaId` | string | 否 | 必须与内容 kind 匹配：科普用 SCIENCE，课程用 COURSE。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `categoryId` | string | 否 | 必须与内容 kind 匹配：科普用 SCIENCE，课程用 COURSE。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `authorName` | string | 否 | 作者。 | 最长: `64` |
| `tags` | string[] | 否 | 标签 | 最多项: `10`；元素不重复 |
| `accessPolicy` | string | 否 | FREE 免费、PURCHASE 独立购买、MEMBER 按网站会员有效期；MEMBER 仅课程且 priceCents=0。 | 枚举: `FREE, PURCHASE, MEMBER` |
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
| `accessPolicy` | string | 是 | FREE 免费、PURCHASE 独立购买、MEMBER 按网站会员有效期；MEMBER 仅课程且 priceCents=0。 | 枚举: `FREE, PURCHASE, MEMBER` |
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
    "scope": "SCIENCE",
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
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `100000000` |
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
| `minPriceCents` | integer | 是 | 启用 SKU 价格范围；无启用 SKU 的草稿返回 0。 | 最小: `0`；最大: `9007199254740991` |
| `maxPriceCents` | integer | 是 | 启用 SKU 价格范围；无启用 SKU 的草稿返回 0。 | 最小: `0`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `inStock` | boolean | 是 | 至少一个可售 SKU 有可用库存。 |  |
| `detailHtml` | string | 是 | 已清洗的详情 HTML。 | 最长: `100000` |
| `gallery` | [MediaSummary[]](#mediasummary) | 是 | 图片列表 |  |
| `skus` | [AdminSku[]](#adminsku) | 是 | 含停用 SKU 和管理库存字段 |  |
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
      "enabled": true,
      "onHandStock": 102,
      "reservedStock": 2,
      "version": 1
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
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `100000000` |
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
| `priceCents` | integer | 否 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `100000000` |
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
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `1`；最大: `100000000` |
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
| `reservedDelta` | integer | 是 | 预占变化；业务自动预占／释放也记流水。 |  |
| `orderId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

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
  "createdAt": "2026-10-22T02:00:00Z",
  "reservedDelta": 0,
  "orderId": null
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
| `membershipSnapshot` | object / null | 否 | 会员订单为成交方案快照；其他类型为 null 或省略。 |  |

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
| `address` | object / null | 否 | 实物订单地址快照；课程和会员订单为 null。 |  |
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

本人订单详情；COURSE 和 MEMBERSHIP 不预占库存，不进入发货、收货或实物售后，address=null，运费为 0。

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
| `address` | object / null | 否 | 实物订单地址快照；课程和会员订单为 null。 |  |
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
| `source` | string | 是 | 来源：人工登记或阿里云物流服务。 | 枚举: `MANUAL, ALIYUN` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "time": "2026-10-22T02:00:00Z",
  "description": "快件已由收件人签收",
  "location": "上海",
  "source": "MANUAL"
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
| `status` | string | 是 | 物流状态；RETURNED 是退件签收，不是买家签收，也不会自动退款或入库。 | 枚举: `PENDING_PICKUP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION, RETURNED` |
| `shippedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `deliveredAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `lastSyncedAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |
| `items` | [ShipmentLine[]](#shipmentline) | 是 | 实际发货行与数量 |  |

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
  "version": 1,
  "items": [
    {
      "orderItemId": "id_10001",
      "quantity": 1
    }
  ]
}
```


<a id="logisticsresult"></a>
## LogisticsResult

未发货返回 shipment=null、events=[]。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `shipment` | object / null | 是 | 一期每笔实物订单一个包裹，全部行一次性发货。 |  |
| `events` | [LogisticsEvent[]](#logisticsevent) | 是 | 最近物流事件 |  |
| `syncStatus` | string | 是 | 未发货、未配置服务、待查询、查询中、查询成功、无轨迹或查询失败；失败时保留已有轨迹。 | 枚举: `NOT_SHIPPED, MANUAL, PENDING, SYNCING, UP_TO_DATE, NO_DATA, FAILED` |
| `syncErrorCode` | string / null | 是 | 查询失败的稳定错误代码，见物流文档；不包含供应商原文或凭证。 |  |
| `lastSyncAttemptAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `nextSyncAt` | string / null | 是 | 最早自动重查时间；终态、超出自动追踪期限、关闭订单或未配置服务时为 null。调度可能延后。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "shipment": null,
  "events": [],
  "syncStatus": "NOT_SHIPPED",
  "syncErrorCode": null,
  "lastSyncAttemptAt": null,
  "nextSyncAt": null
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
| `phoneLast4` | string | 否 | 可选收/寄件人手机号后四位；省略时发货默认使用订单收件手机尾号。查询时按公司要求附加，返回体不回显。 | 正则: `^\d{4}$` |

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

揽收前且无轨迹才可改公司/单号；同一公司/单号可单独纠正查询手机尾号。省略尾号保留旧值，null 恢复使用订单收件手机尾号。需 version 和原因。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `carrierCode` | string | 是 | 快递公司代码。 | 最短: `1`；最长: `32` |
| `trackingNo` | string | 是 | 运单号。 | 最短: `1`；最长: `64` |
| `reason` | string | 是 | 纠错原因。 | 最短: `1`；最长: `200` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |
| `phoneLast4` | string / null | 否 | 可选收/寄件人手机号后四位；省略时发货默认使用订单收件手机尾号。查询时按公司要求附加，返回体不回显。 | 正则: `^\d{4}$` |

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
| `evidenceMediaIds` | string[] | 否 | 最多 9 个不重复的本人 READY AFTERSALE_EVIDENCE 图片 ID；与售后创建在同一事务内校验并绑定。可省略或传 [] 提交纯文字说明。 | 最多项: `9`；元素不重复 |

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
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

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
  "completedAt": null,
  "version": 1
}
```


<a id="digitalrefundinput"></a>
## DigitalRefundInput

管理员发起数字订单全额退款；课程遵循原规则，会员仅允许尚未开始的完整未来权益段。请求不接受金额。

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

会员方案；公开接口只返回启用项。无自动续费，当前只授予 MEMBER_CONTENT。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 会员方案名称；去除前后空白。 | 最短: `1`；最长: `64` |
| `description` | string | 是 | 方案说明，允许空字符串。 | 最长: `2000` |
| `durationDays` | integer | 是 | 每一天为固定 24 小时。 | 最小: `1`；最大: `3650` |
| `priceCents` | integer | 是 | 人民币分；客户端不能自行决定成交金额。 | 最小: `1`；最大: `100000000` |
| `benefitCodes` | string[] | 是 | 仅支持 MEMBER_CONTENT；AI 次数和会员组合权益尚未接入。 | 最少项: `1`；最多项: `1`；元素不重复 |
| `sortOrder` | integer | 是 | 公开展示顺序，小值优先。 | 最小: `0`；最大: `1000000` |
| `enabled` | boolean | 是 | 是否可购买；停用后公共接口不可见。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1`；最大: `2147483647` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `updatedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "cs30天会员",
  "description": "cs会员内容访问测试方案",
  "durationDays": 30,
  "priceCents": 9900,
  "benefitCodes": [
    "MEMBER_CONTENT"
  ],
  "sortOrder": 0,
  "enabled": false,
  "version": 1,
  "createdAt": "2026-10-22T02:00:00Z",
  "updatedAt": "2026-10-22T02:00:00Z"
}
```


<a id="membershipplancreate"></a>
## MembershipPlanCreate

新建方案默认停用；需要另外 PATCH enabled=true 才可购买，不接受 enabled、currency 或 AI 次数字段。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `name` | string | 是 | 会员方案名称；去除前后空白。 | 最短: `1`；最长: `64` |
| `description` | string | 是 | 方案说明，允许空字符串。 | 最长: `2000` |
| `durationDays` | integer | 是 | 每一天为固定 24 小时。 | 最小: `1`；最大: `3650` |
| `priceCents` | integer | 是 | 人民币分；客户端不能自行决定成交金额。 | 最小: `1`；最大: `100000000` |
| `benefitCodes` | string[] | 否 | 仅支持 MEMBER_CONTENT；AI 次数和会员组合权益尚未接入。 | 最少项: `1`；最多项: `1`；元素不重复 |
| `sortOrder` | integer | 否 | 公开展示顺序，小值优先。 | 最小: `0`；最大: `1000000` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "name": "cs30天会员",
  "description": "cs会员内容访问测试方案",
  "durationDays": 30,
  "priceCents": 9900
}
```


<a id="membershipplanpatch"></a>
## MembershipPlanPatch

必须提交 version 和至少一项修改；历史订单的价格、天数、权益快照保持不变。无删除接口，使用停用。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1`；最大: `2147483647` |
| `name` | string | 否 | 会员方案名称；去除前后空白。 | 最短: `1`；最长: `64` |
| `description` | string | 否 | 方案说明，允许空字符串。 | 最长: `2000` |
| `durationDays` | integer | 否 | 每一天为固定 24 小时。 | 最小: `1`；最大: `3650` |
| `priceCents` | integer | 否 | 人民币分；客户端不能自行决定成交金额。 | 最小: `1`；最大: `100000000` |
| `benefitCodes` | string[] | 否 | 仅支持 MEMBER_CONTENT；AI 次数和会员组合权益尚未接入。 | 最少项: `1`；最多项: `1`；元素不重复 |
| `sortOrder` | integer | 否 | 公开展示顺序，小值优先。 | 最小: `0`；最大: `1000000` |
| `enabled` | boolean | 否 | 是否允许新报价、下单及待付款订单结算。 |  |

对象至少包含 2 个字段（包含 version 时，至少另传一个可修改字段）。

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "name": "cs30天会员"
}
```


<a id="adminmembershipplan"></a>
## AdminMembershipPlan

管理员会员方案；包括启用与停用记录。历史订单使用成交快照，停用保留历史引用。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 会员方案名称；去除前后空白。 | 最短: `1`；最长: `64` |
| `description` | string | 是 | 方案说明，允许空字符串。 | 最长: `2000` |
| `durationDays` | integer | 是 | 每一天为固定 24 小时。 | 最小: `1`；最大: `3650` |
| `priceCents` | integer | 是 | 人民币分；客户端不能自行决定成交金额。 | 最小: `1`；最大: `100000000` |
| `benefitCodes` | string[] | 是 | 仅支持 MEMBER_CONTENT；AI 次数和会员组合权益尚未接入。 | 最少项: `1`；最多项: `1`；元素不重复 |
| `sortOrder` | integer | 是 | 公开展示顺序，小值优先。 | 最小: `0`；最大: `1000000` |
| `enabled` | boolean | 是 | 是否可购买；停用后公共接口不可见。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1`；最大: `2147483647` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `updatedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "cs30天会员",
  "description": "cs会员内容访问测试方案",
  "durationDays": 30,
  "priceCents": 9900,
  "benefitCodes": [
    "MEMBER_CONTENT"
  ],
  "sortOrder": 0,
  "enabled": false,
  "version": 1,
  "createdAt": "2026-10-22T02:00:00Z",
  "updatedAt": "2026-10-22T02:00:00Z"
}
```


<a id="membershipdetail"></a>
## MembershipDetail

服务器聚合管理员期限及购买权益段判断当前会员；会员明细分页通过 /me/membership/periods 查询。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `active` | boolean | 是 | 当前是否为有效会员。 |  |
| `expiresAt` | string / null | 是 | 未撤销的管理员期限和 ACTIVE 付费段的最晚到期时间，包括未来或已过期时段；无候选记录时为 null。请用 active 判断当前资格。 | 格式: `date-time` |
| `benefitCodes` | string[] | 是 | 有效时为 [MEMBER_CONTENT]，无效时为 [] |  |
| `membership` | object / null | 是 | 管理员手工维护的期限记录，独立于购买权益；没有手工记录时为 null，即使有有效购买权益也可为 null。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "active": true,
  "expiresAt": "2026-11-21T02:00:00Z",
  "benefitCodes": [
    "MEMBER_CONTENT"
  ],
  "membership": null
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
      "scope": "COURSE",
      "parentId": "id_10001",
      "sortOrder": 0,
      "enabled": true,
      "version": 1
    },
    "tags": [
      "基础知识"
    ],
    "accessPolicy": "FREE",
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


<a id="uploadcreate"></a>
## UploadCreate

图片或私有 MP4 二选一；图片不能携带 durationSeconds。

仅允许以下一种结构：

- [UploadImageCreate](#uploadimagecreate)
- [UploadVideoCreate](#uploadvideocreate)


<a id="uploadticket"></a>
## UploadTicket

十分钟有效的 OSS POST 表单授权；返回字段原样作为 multipart/form-data 的文本字段，最后追加 file。文件不经业务 API 上传。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `uploadId` | string | 是 | 服务端生成的 UUID；uploadId 与 mediaId 相同。 | 格式: `uuid` |
| `mediaId` | string | 是 | 服务端生成的 UUID；uploadId 与 mediaId 相同。 | 格式: `uuid` |
| `method` | string | 是 | 固定为表单 POST，不能按 PUT 上传。 | 枚举: `POST` |
| `uploadUrl` | string | 是 | 私有 Bucket 的 HTTPS OSS 地址。 | 格式: `uri` |
| `fields` | object | 是 | 服务端签发的表单字段；不可改写 key、policy、Content-Type、签名或临时令牌。签名只允许上传本次指定对象。 |  |
| `expiresAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "uploadId": "e17c8ad0-8f08-4a4b-8a77-2b730ab323da",
  "mediaId": "e17c8ad0-8f08-4a4b-8a77-2b730ab323da",
  "method": "POST",
  "uploadUrl": "https://your-private-bucket.oss-cn-hangzhou.aliyuncs.com",
  "fields": {
    "key": "uploads/staging/e17c8ad0-8f08-4a4b-8a77-2b730ab323da.png",
    "Content-Type": "image/png",
    "success_action_status": "201",
    "policy": "replace-with-server-policy",
    "x-oss-signature": "replace-with-server-signature"
  },
  "expiresAt": "2026-10-22T02:10:00Z"
}
```


<a id="mediareadgrant"></a>
## MediaReadGrant

私有售后凭证读取授权，有效 60 秒，绑定当前账户、会话及素材；每次读取重查权限、封禁和售后关联。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `mediaId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `url` | string | 是 | 应用代理 URL；不是 OSS 永久地址或可脱离平台权限使用的存储签名。不要记录到日志或公共缓存。 | 格式: `uri` |
| `expiresAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "mediaId": "id_10001",
  "url": "http://localhost:3000/api/v1/media/e17c8ad0-8f08-4a4b-8a77-2b730ab323da/file?token=replace-with-read-grant",
  "expiresAt": "2026-10-22T02:01:00Z"
}
```


<a id="adminuser"></a>
## AdminUser

管理端用户资料；手机号始终脱敏，不返回密码、会话令牌或问答内容。封禁时间永久保留到解封，当前不支持定时封禁。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `nickname` | string | 是 | 昵称。 | 最短: `1`；最长: `32` |
| `avatarUrl` | string / null | 是 | 已上传到 CONTENT_IMAGE_OSS_HOST 的永久 HTTPS 对象地址，默认 chunai-photo.oss-cn-hangzhou.aliyuncs.com；不得带签名查询、fragment、账号或端口。null 清空头像，不传则保持。 | 格式: `uri`；最短: `1`；最长: `2048` |
| `phoneMasked` | string | 是 | 脱敏手机。 |  |
| `status` | string | 是 | 账号状态。 | 枚举: `ACTIVE, BANNED, DEACTIVATED` |
| `membership` | [MembershipSummary](#membershipsummary) | 是 | 见关联对象。 |  |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1`；最大: `2147483647` |
| `banReason` | string / null | 是 | 当前封禁原因；未封禁时为 null。 | 最长: `500` |
| `bannedAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `lastLoginAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `updatedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "nickname": "小雨",
  "avatarUrl": "https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/avatars/replace-with-existing-object.jpg",
  "phoneMasked": "138****0000",
  "status": "ACTIVE",
  "membership": {
    "active": true,
    "expiresAt": "2026-11-21T02:00:00Z",
    "benefitCodes": [
      "MEMBER_CONTENT"
    ]
  },
  "createdAt": "2026-10-22T02:00:00Z",
  "version": 1,
  "banReason": null,
  "bannedAt": "2026-10-22T02:00:00Z",
  "lastLoginAt": "2026-10-22T02:00:00Z",
  "updatedAt": "2026-10-22T02:00:00Z"
}
```


<a id="userbaninput"></a>
## UserBanInput

封禁 ACTIVE 用户并立即撤销全部客户端会话。必须携带最新版本和幂等键。DEACTIVATED 不允许此操作。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1`；最大: `2147483647` |
| `reason` | string | 是 | 操作原因；去除前后空白，写入审计。 | 最短: `1`；最长: `500` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "reason": "cs权限联调"
}
```


<a id="userunbaninput"></a>
## UserUnbanInput

解封 BANNED 用户；旧令牌保持失效，必须重新登录。必须携带最新版本和幂等键。DEACTIVATED 不允许此操作。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1`；最大: `2147483647` |
| `reason` | string | 是 | 操作原因；去除前后空白，写入审计。 | 最短: `1`；最长: `500` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "reason": "cs权限联调"
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
| `address` | object / null | 否 | 实物订单地址快照；课程和会员订单为 null。 |  |
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
    "avatarUrl": "https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/avatars/replace-with-existing-object.jpg",
    "phoneMasked": "138****0000",
    "status": "ACTIVE",
    "membership": {
      "active": true,
      "expiresAt": "2026-11-21T02:00:00Z",
      "benefitCodes": [
        "MEMBER_CONTENT"
      ]
    },
    "createdAt": "2026-10-22T02:00:00Z",
    "version": 1
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
    "avatarUrl": "https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/avatars/replace-with-existing-object.jpg",
    "phoneMasked": "138****0000",
    "status": "ACTIVE",
    "membership": {
      "active": true,
      "expiresAt": "2026-11-21T02:00:00Z",
      "benefitCodes": [
        "MEMBER_CONTENT"
      ]
    },
    "createdAt": "2026-10-22T02:00:00Z",
    "version": 1
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

引用 READY CONTENT_VIDEO 素材。LOCAL／OSS 为私有 MP4；BILIBILI 仅科普；FEISHU 仅 MEMBER 视频课程非预览章。

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
      "scope": "PRODUCT",
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
        "scope": "SCIENCE",
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
      "completedAt": null,
      "version": 1
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
      "name": "cs30天会员",
      "description": "cs会员内容访问测试方案",
      "durationDays": 30,
      "priceCents": 9900,
      "benefitCodes": [
        "MEMBER_CONTENT"
      ],
      "sortOrder": 0,
      "enabled": false,
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
          "scope": "COURSE",
          "parentId": "id_10001",
          "sortOrder": 0,
          "enabled": true,
          "version": 1
        },
        "tags": [
          "基础知识"
        ],
        "accessPolicy": "FREE",
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
        "scope": "SCIENCE",
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
          "enabled": true,
          "onHandStock": 102,
          "reservedStock": 2,
          "version": 1
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
      "createdAt": "2026-10-22T02:00:00Z",
      "reservedDelta": 0,
      "orderId": null
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
        "avatarUrl": "https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/avatars/replace-with-existing-object.jpg",
        "phoneMasked": "138****0000",
        "status": "ACTIVE",
        "membership": {
          "active": true,
          "expiresAt": "2026-11-21T02:00:00Z",
          "benefitCodes": [
            "MEMBER_CONTENT"
          ]
        },
        "createdAt": "2026-10-22T02:00:00Z",
        "version": 1
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
      "avatarUrl": "https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/avatars/replace-with-existing-object.jpg",
      "phoneMasked": "138****0000",
      "status": "ACTIVE",
      "membership": {
        "active": true,
        "expiresAt": "2026-11-21T02:00:00Z",
        "benefitCodes": [
          "MEMBER_CONTENT"
        ]
      },
      "createdAt": "2026-10-22T02:00:00Z",
      "version": 1,
      "banReason": null,
      "bannedAt": "2026-10-22T02:00:00Z",
      "lastLoginAt": "2026-10-22T02:00:00Z",
      "updatedAt": "2026-10-22T02:00:00Z"
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
      "name": "cs30天会员",
      "description": "cs会员内容访问测试方案",
      "durationDays": 30,
      "priceCents": 9900,
      "benefitCodes": [
        "MEMBER_CONTENT"
      ],
      "sortOrder": 0,
      "enabled": false,
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

本人提交的私有售后图片摘要；publicUrl 永远为 null。经 read-grant 获取短时应用代理地址。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `kind` | string | 是 | 媒体类型。 | 枚举: `IMAGE, VIDEO` |
| `status` | string | 是 | 统一上传状态：UPLOADING 待确认；READY 可引用；FAILED 校验失败；DELETED 已逻辑删除。旧素材接口直接返回 READY。 | 枚举: `UPLOADING, READY, FAILED, DELETED` |
| `mimeType` | string | 是 | 实际检查后的 MIME。 |  |
| `sizeBytes` | integer | 是 | 字节数。 | 最小: `0` |
| `publicUrl` | string / null | 是 | 固定 null，不暴露 OSS 私有地址。 | 枚举: `None` |
| `durationSeconds` | integer | 否 | 仅视频返回，处理前可不返回。 | 最小: `0` |
| `provider` | string | 否 | 统一上传为 OSS；保留旧素材来源；不包含存储凭证、内部对象路径或受保护视频链接。 | 枚举: `LOCAL, OSS, EXTERNAL_IMAGE, BILIBILI, FEISHU` |

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


<a id="productimagecreate"></a>
## ProductImageCreate

兼容登记已经托管的公开 HTTPS 产品图片；该接口不检查远程字节。新文件可通过统一上传完成校验后直接取得相同用途的素材 ID。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `publicUrl` | string | 是 | HTTPS 公开图片地址，不得含用户名或密码。 | 格式: `uri`；最长: `2048` |
| `mimeType` | string | 是 | 管理员登记的图片 MIME。 | 枚举: `image/jpeg, image/png, image/webp` |
| `sizeBytes` | integer | 是 | 管理员登记的文件大小。 | 最小: `1`；最大: `20971520` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "publicUrl": "https://example.com/product.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 1024
}
```


<a id="testpaymentinput"></a>
## TestPaymentInput

仅测试环境且 COMMERCE_TEST_PAYMENTS=true；金额取订单，不发生真实扣款。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |
| `transactionNo` | string | 是 | 测试流水号，全局唯一。 | 正则: `^[A-Za-z0-9_-]{1,64}$` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "transactionNo": "test_payment_001"
}
```


<a id="testrefundinput"></a>
## TestRefundInput

测试退款确认：COURSE 和 MEMBERSHIP 的 version 取退款流水；PRODUCT 取售后单。会员退款成功撤销目标未来段并顺延整理其余段，失败恢复。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |
| `result` | string | 是 | 测试结果。 | 枚举: `SUCCEEDED, FAILED` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "result": "SUCCEEDED"
}
```


<a id="manuallogisticsinput"></a>
## ManualLogisticsInput

人工登记物流事件，记录操作者；不是快递平台的自动查询结果。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |
| `status` | string | 是 | 物流状态。 | 枚举: `IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION` |
| `time` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `description` | string | 是 | 人工确认的物流说明。 | 最短: `1`；最长: `500` |
| `location` | string | 否 | 位置。 | 最短: `1`；最长: `100` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "status": "IN_TRANSIT",
  "time": "2026-10-22T02:00:00Z",
  "description": "管理员登记揽收"
}
```


<a id="shipmentline"></a>
## ShipmentLine

发出的剩余未退款商品快照。

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


<a id="commerceauditlog"></a>
## CommerceAuditLog

交易变更及敏感详情读取的审计记录；不含密码和令牌。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `actorKey` | string | 是 | user/admin/system 前缀和操作者 ID。 |  |
| `action` | string | 是 | 操作。 |  |
| `resourceId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `details` | object | 是 | 最小必要操作信息。 |  |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "actorKey": "admin:id_10001",
  "action": "order.ship",
  "resourceId": "id_10001",
  "details": {},
  "createdAt": "2026-10-22T02:00:00Z"
}
```


<a id="pagecommerceauditlog"></a>
## PageCommerceAuditLog

CommerceAuditLog 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [CommerceAuditLog[]](#commerceauditlog) | 是 | 当前页数据；空页为 [] |  |
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
      "actorKey": "admin:id_10001",
      "action": "order.ship",
      "resourceId": "id_10001",
      "details": {},
      "createdAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="implementedpurchase"></a>
## ImplementedPurchase

商品、课程、会员方案三选一；禁止混单和客户端传金额。

仅允许以下一种结构：

- [ProductPurchase](#productpurchase)
- [CoursePurchase](#coursepurchase)
- [MembershipPurchase](#membershippurchase)


<a id="membershiprecord"></a>
## MembershipRecord

管理员维护的一名用户的会员期限；修改须校验 version。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `userId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `startsAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `expiresAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `revokedAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "userId": "id_10001",
  "startsAt": "2026-10-22T02:00:00Z",
  "expiresAt": "2026-10-22T02:00:00Z",
  "revokedAt": "2026-10-22T02:00:00Z",
  "version": 1
}
```


<a id="membershipwrite"></a>
## MembershipWrite

开通、续期或重新开通会员；从 GET 读取 version，无记录用 0。expiresAt 必须晚于 startsAt 且晚于当前时间。 存在未到期付费段或待处理退款时返回 MEMBERSHIP_PAID_TERM_EXISTS；付费权益通过订单退款维护。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `version` | integer | 是 | 创建用 0，已有记录用当前版本。 | 最小: `0`；最大: `4294967294` |
| `startsAt` | string | 是 | ISO 8601 时间，必须包含秒和明确时区；可含至多 3 位小数。会员区间为 startsAt <= now < expiresAt。 | 格式: `date-time` |
| `expiresAt` | string | 是 | ISO 8601 时间，必须包含秒和明确时区；可含至多 3 位小数。会员区间为 startsAt <= now < expiresAt。 | 格式: `date-time` |
| `reason` | string | 是 | 管理员操作原因，写入审计。 | 最短: `1`；最长: `500` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 0,
  "startsAt": "2026-10-22T02:00:00Z",
  "expiresAt": "2026-11-21T02:00:00Z",
  "reason": "cs开通30天测试会员"
}
```


<a id="membershiprevoke"></a>
## MembershipRevoke

撤销会员；立即停止签发受会员保护的访问数据。 存在未到期付费段或待处理退款时返回 MEMBERSHIP_PAID_TERM_EXISTS；付费权益通过订单退款维护。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1`；最大: `4294967294` |
| `reason` | string | 是 | 撤销原因。 | 最短: `1`；最长: `500` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "version": 1,
  "reason": "cs撤销测试会员"
}
```


<a id="contentimagecreate"></a>
## ContentImageCreate

登记已托管公开 HTTPS 图片元数据。CONTENT_COVER/COLUMN_COVER 仅允许 CONTENT_IMAGE_OSS_HOST（默认 chunai-photo.oss-cn-hangzhou.aliyuncs.com），正文图片仍允许已有 HTTPS 地址。不会上传或下载文件。 新文件可改走统一上传；完成后直接使用返回素材 ID，无须重复登记。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `publicUrl` | string | 是 | HTTPS 公开图片地址，不得含用户名或密码。 | 格式: `uri`；最长: `2048` |
| `mimeType` | string | 是 | 管理员登记的图片 MIME。 | 枚举: `image/jpeg, image/png, image/webp` |
| `sizeBytes` | integer | 是 | 管理员登记的文件大小。 | 最小: `1`；最大: `20971520` |
| `purpose` | string | 是 | 图片用途；引用时精确匹配。 | 枚举: `CONTENT_COVER, COLUMN_COVER, CONTENT_BODY_IMAGE` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "publicUrl": "https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/covers/replace-with-existing-object.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 1024,
  "purpose": "CONTENT_COVER"
}
```


<a id="bilibilivideocreate"></a>
## BilibiliVideoCreate

登记 B 站科普视频，禁止传 accessPassword。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `provider` | string | 是 | 外部视频提供方。 | 枚举: `BILIBILI` |
| `externalUrl` | string | 是 | B 站仅 bilibili.com/www.bilibili.com 的 /video/BV+10位字母数字或 /video/av数字，及 b23.tv 的 4–64 位字母数字短链；飞书仅 feishu.cn 或一层租户子域，路径 /file/、/drive/file/、/drive/folder/ 加分享 token。拒绝用户名密码、显式端口、非空 fragment；保留普通 query。示例仅格式占位。 | 格式: `uri`；最短: `1`；最长: `2048` |
| `durationSeconds` | integer | 是 | 时长秒数；未知可填 0。 | 最小: `0`；最大: `86400` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "provider": "BILIBILI",
  "externalUrl": "https://www.bilibili.com/video/BV0000000000",
  "durationSeconds": 0
}
```


<a id="feishuvideocreate"></a>
## FeishuVideoCreate

登记飞书会员视频，必须提供 accessPassword。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `provider` | string | 是 | 外部视频提供方。 | 枚举: `FEISHU` |
| `externalUrl` | string | 是 | B 站仅 bilibili.com/www.bilibili.com 的 /video/BV+10位字母数字或 /video/av数字，及 b23.tv 的 4–64 位字母数字短链；飞书仅 feishu.cn 或一层租户子域，路径 /file/、/drive/file/、/drive/folder/ 加分享 token。拒绝用户名密码、显式端口、非空 fragment；保留普通 query。示例仅格式占位。 | 格式: `uri`；最短: `1`；最长: `2048` |
| `durationSeconds` | integer | 是 | 时长秒数；未知可填 0。 | 最小: `0`；最大: `86400` |
| `accessPassword` | string | 是 | 飞书网盘访问密码，必须提供；与链接一起加密保存，不在素材响应或审计中返回。 | 最短: `1`；最长: `128` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "provider": "FEISHU",
  "externalUrl": "https://example.feishu.cn/file/replace_with_real_share_id",
  "durationSeconds": 0,
  "accessPassword": "replace-with-real-share-password"
}
```


<a id="externalvideocreate"></a>
## ExternalVideoCreate

外部视频来源二选一；链接与密码均加密保存。

仅允许以下一种结构：

- [BilibiliVideoCreate](#bilibilivideocreate)
- [FeishuVideoCreate](#feishuvideocreate)


<a id="membershipplansnapshot"></a>
## MembershipPlanSnapshot

报价、成交订单和权益段使用的方案快照；修改方案不改写已成交条款。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `planId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 会员方案名称；去除前后空白。 | 最短: `1`；最长: `64` |
| `durationDays` | integer | 是 | 每一天为固定 24 小时。 | 最小: `1`；最大: `3650` |
| `priceCents` | integer | 是 | 人民币分；客户端不能自行决定成交金额。 | 最小: `1`；最大: `100000000` |
| `benefitCodes` | string[] | 是 | 仅支持 MEMBER_CONTENT；AI 次数和会员组合权益尚未接入。 | 最少项: `1`；最多项: `1`；元素不重复 |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "planId": "id_10001",
  "name": "cs30天会员",
  "durationDays": 30,
  "priceCents": 9900,
  "benefitCodes": [
    "MEMBER_CONTENT"
  ]
}
```


<a id="membershipperiod"></a>
## MembershipPeriod

一笔会员订单对应的完整权益段；ACTIVE 不等于当前生效，仍须判断时间和账号状态。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `userId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `planId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `orderId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `snapshot` | [MembershipPlanSnapshot](#membershipplansnapshot) | 是 | 见关联对象。 |  |
| `startsAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `expiresAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `status` | string | 是 | ACTIVE 可按时间生效；REFUND_PENDING 为退款目标；SUSPENDED 为等待退款结果的其他未来段；REVOKED 已退款。 | 枚举: `ACTIVE, REFUND_PENDING, SUSPENDED, REVOKED` |
| `revokedAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "userId": "id_10001",
  "planId": "id_10001",
  "orderId": "id_10001",
  "snapshot": {
    "planId": "id_10001",
    "name": "cs30天会员",
    "durationDays": 30,
    "priceCents": 9900,
    "benefitCodes": [
      "MEMBER_CONTENT"
    ]
  },
  "startsAt": "2026-10-22T02:00:00Z",
  "expiresAt": "2026-10-22T02:00:00Z",
  "status": "ACTIVE",
  "revokedAt": "2026-10-22T02:00:00Z",
  "createdAt": "2026-10-22T02:00:00Z"
}
```


<a id="pagemembershipperiod"></a>
## PageMembershipPeriod

MembershipPeriod 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [MembershipPeriod[]](#membershipperiod) | 是 | 当前页数据；空页为 [] |  |
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
      "userId": "id_10001",
      "planId": "id_10001",
      "orderId": "id_10001",
      "snapshot": {
        "planId": "id_10001",
        "name": "cs30天会员",
        "durationDays": 30,
        "priceCents": 9900,
        "benefitCodes": [
          "MEMBER_CONTENT"
        ]
      },
      "startsAt": "2026-10-22T02:00:00Z",
      "expiresAt": "2026-10-22T02:00:00Z",
      "status": "ACTIVE",
      "revokedAt": "2026-10-22T02:00:00Z",
      "createdAt": "2026-10-22T02:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="uploadimagecreate"></a>
## UploadImageCreate

图片直传申请；JPEG、PNG、WebP，最大 10 MiB；所有文件先上传到私有临时区域。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `purpose` | string | 是 | 用户仅 AVATAR／AFTERSALE_EVIDENCE；管理员内容用途需要 media:write + content:write，产品图片需要 media:write + products:write。 | 枚举: `AVATAR, AFTERSALE_EVIDENCE, CONTENT_COVER, CONTENT_BODY_IMAGE, PRODUCT_IMAGE, COLUMN_COVER` |
| `fileName` | string | 是 | 原始显示名称，不作为对象路径；拒绝路径分隔符与控制字符。 | 最短: `1`；最长: `200` |
| `mimeType` | string | 是 | 申请 MIME，完成后检查真实对象头与文件特征。 | 枚举: `image/jpeg, image/png, image/webp` |
| `sizeBytes` | integer | 是 | 精确文件大小；OSS POST 策略及完成确认都会校验。 | 最小: `1`；最大: `10485760` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "purpose": "AVATAR",
  "fileName": "cs-avatar.png",
  "mimeType": "image/png",
  "sizeBytes": 1024
}
```


<a id="uploadvideocreate"></a>
## UploadVideoCreate

仅管理员，需 media:write + content:write；MP4 最大 100 MiB，私有存储，不转码。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `purpose` | string | 是 | 视频固定用途。 | 枚举: `CONTENT_VIDEO` |
| `fileName` | string | 是 | 原始显示名称，不作为对象路径；拒绝路径分隔符与控制字符。 | 最短: `1`；最长: `200` |
| `mimeType` | string | 是 | 仅 MP4。 | 枚举: `video/mp4` |
| `sizeBytes` | integer | 是 | 精确文件大小。 | 最小: `1`；最大: `104857600` |
| `durationSeconds` | integer | 否 | 可省略，默认 0 表示未知；管理员提供时长，不提供自动探测或转码。 | 最小: `0`；最大: `86400` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "purpose": "CONTENT_VIDEO",
  "fileName": "cs-video.mp4",
  "mimeType": "video/mp4",
  "sizeBytes": 102400
}
```


<a id="cartproduct"></a>
## CartProduct

当前公开商品信息；下架或分类停用后为 null。不保存旧价格快照。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `name` | string | 是 | 商品名称。 |  |
| `coverUrl` | string / null | 是 | HTTPS URL。 | 格式: `uri` |
| `skuAttributes` | [SkuAttribute[]](#skuattribute) | 是 | 当前规格。 |  |
| `unitPriceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `subtotalCents` | integer | 是 | 当前单价 × 保存数量，仅供展示，不是订单报价。 | 最小: `0` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "name": "cs商品",
  "coverUrl": "https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/cs.png",
  "skuAttributes": [
    {
      "name": "规格",
      "value": "标准"
    }
  ],
  "unitPriceCents": 1200,
  "subtotalCents": 2400,
  "currency": "CNY"
}
```


<a id="cartitem"></a>
## CartItem

本人购物车的一种 SKU；数量不占库存；可购买状态在每次读取时重新计算。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | UUID v4。 | 格式: `uuid` |
| `skuId` | string | 是 | UUID v4。 | 格式: `uuid` |
| `productId` | string | 是 | UUID v4。 | 格式: `uuid` |
| `quantity` | integer | 是 | 保存的期望数量，库存减少时不自动改写。 | 最小: `1`；最大: `999` |
| `selected` | boolean | 是 | 是否勾选；失效后保留选择意图，仍不可结算。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `updatedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `availability` | string | 是 | 按商品、分类、SKU、可售库存、保存数量依次判定。 | 枚举: `AVAILABLE, PRODUCT_UNAVAILABLE, CATEGORY_UNAVAILABLE, SKU_DISABLED, OUT_OF_STOCK, STOCK_INSUFFICIENT` |
| `canPurchase` | boolean | 是 | 仅 availability=AVAILABLE 为 true；不取决于 selected。 |  |
| `availableStock` | integer | 是 | 实物库存减去订单预占；购物车本身不预占。 | 最小: `0` |
| `maxQuantity` | integer | 是 | min(999, availableStock)；仍需同时判断 canPurchase／availability。 | 最小: `0`；最大: `999` |
| `product` | [CartProduct](#cartproduct) | 是 | 见关联对象。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "fedb46b4-eae6-44a8-8abd-1739bb089611",
  "skuId": "fedb46b4-eae6-44a8-8abd-1739bb089611",
  "productId": "fedb46b4-eae6-44a8-8abd-1739bb089611",
  "quantity": 2,
  "selected": true,
  "version": 1,
  "createdAt": "2026-10-22T02:00:00Z",
  "updatedAt": "2026-10-22T02:00:00Z",
  "availability": "AVAILABLE",
  "canPurchase": true,
  "availableStock": 5,
  "maxQuantity": 5,
  "product": {
    "name": "cs商品",
    "coverUrl": "https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/cs.png",
    "skuAttributes": [
      {
        "name": "规格",
        "value": "标准"
      }
    ],
    "unitPriceCents": 1200,
    "subtotalCents": 2400,
    "currency": "CNY"
  }
}
```


<a id="cartitemput"></a>
## CartItemPut

按 SKU 设置绝对数量，不累加。首次 version=0；已有条目使用最新 version。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `quantity` | integer | 是 | 整数 1–999；不能用 0 删除。 | 最小: `1`；最大: `999` |
| `version` | integer | 是 | 首次为 0；旧版本返回 VERSION_CONFLICT。 | 最小: `0`；最大: `2147483647` |
| `selected` | boolean | 否 | 可省略：新建默认 true；更新保留原值。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "quantity": 2,
  "version": 0
}
```


<a id="cartquoteline"></a>
## CartQuoteLine

本次明确选择的购物车 SKU 与当前购物车条目版本。数量从数据库取。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `skuId` | string | 是 | UUID v4。 | 格式: `uuid` |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "skuId": "fedb46b4-eae6-44a8-8abd-1739bb089611",
  "version": 1
}
```


<a id="cartquotecreate"></a>
## CartQuoteCreate

购物车结算试算；不接受客户端金额、数量或用户 ID。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `addressId` | string | 是 | UUID v4。 | 格式: `uuid` |
| `items` | [CartQuoteLine[]](#cartquoteline) | 是 | 1–50 个不重复的本人已勾选 SKU；任一不可购买则整个试算失败。 | 最少项: `1`；最多项: `50`；元素不重复 |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "addressId": "fedb46b4-eae6-44a8-8abd-1739bb089611",
  "items": [
    {
      "skuId": "fedb46b4-eae6-44a8-8abd-1739bb089611",
      "version": 1
    }
  ]
}
```


<a id="favoritecontent"></a>
## FavoriteContent

有效收藏返回当前公开摘要；下架或分类停用为 null，不返回旧标题、封面、正文或视频链接。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `kind` | string | 是 | 内容类型；课程由章节组成。 | 枚举: `SCIENCE_VIDEO, SCIENCE_ARTICLE, VIDEO_COURSE, ARTICLE_COURSE` |
| `title` | string | 是 | 标题。 | 最短: `1`；最长: `120` |
| `summary` | string | 是 | 简介。 | 最长: `2000` |
| `cover` | [MediaSummary](#mediasummary) | 是 | 见关联对象。 |  |
| `category` | [Category](#category) | 是 | 见关联对象。 |  |
| `tags` | string[] | 是 | 标签 | 最多项: `10` |
| `accessPolicy` | string | 是 | FREE 免费、PURCHASE 独立购买、MEMBER 按网站会员有效期；MEMBER 仅课程且 priceCents=0。 | 枚举: `FREE, PURCHASE, MEMBER` |
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
| `currency` | string | 是 | 币种。 | 枚举: `CNY` |
| `chapterCount` | integer | 是 | 科普为 0；课程为已发布章节数。 | 最小: `0` |
| `publishedAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
null
```


<a id="contentfavorite"></a>
## ContentFavorite

收藏关系不等于访问权益。失效项保留供取消或重新上架后恢复。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | UUID v4。 | 格式: `uuid` |
| `contentId` | string | 是 | UUID v4。 | 格式: `uuid` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `valid` | boolean | 是 | 当前内容是否上架且所属分类启用。 |  |
| `invalidReason` | string / null | 是 | 有效时 null；下架优先于分类停用。 | 枚举: `None, CONTENT_UNAVAILABLE, CATEGORY_UNAVAILABLE` |
| `content` | [FavoriteContent](#favoritecontent) | 是 | 见关联对象。 |  |
| `access` | [AccessDecision](#accessdecision) | 是 | 见关联对象。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "fedb46b4-eae6-44a8-8abd-1739bb089611",
  "contentId": "fedb46b4-eae6-44a8-8abd-1739bb089611",
  "createdAt": "2026-10-27T00:00:00Z",
  "valid": false,
  "invalidReason": "CONTENT_UNAVAILABLE",
  "content": null,
  "access": {
    "canAccess": false,
    "reason": "CONTENT_UNAVAILABLE"
  }
}
```


<a id="nullablecontentfavorite"></a>
## NullableContentFavorite

未收藏时为 null；收藏后包含当前有效性与访问判定。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | UUID v4。 | 格式: `uuid` |
| `contentId` | string | 是 | UUID v4。 | 格式: `uuid` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |
| `valid` | boolean | 是 | 当前内容是否上架且所属分类启用。 |  |
| `invalidReason` | string / null | 是 | 有效时 null；下架优先于分类停用。 | 枚举: `None, CONTENT_UNAVAILABLE, CATEGORY_UNAVAILABLE` |
| `content` | [FavoriteContent](#favoritecontent) | 是 | 见关联对象。 |  |
| `access` | [AccessDecision](#accessdecision) | 是 | 见关联对象。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
null
```


<a id="favoritestate"></a>
## FavoriteState

查询本人是否已收藏，包含失效收藏；未知 UUID 返回未收藏，不暴露其他用户记录。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `contentId` | string | 是 | UUID v4。 | 格式: `uuid` |
| `favorited` | boolean | 是 | 本人是否保存此收藏关系。 |  |
| `favorite` | [NullableContentFavorite](#nullablecontentfavorite) | 是 | 见关联对象。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "contentId": "fedb46b4-eae6-44a8-8abd-1739bb089611",
  "favorited": false,
  "favorite": null
}
```


<a id="pagecartitem"></a>
## PageCartItem

CartItem 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [CartItem[]](#cartitem) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "fedb46b4-eae6-44a8-8abd-1739bb089611",
      "skuId": "fedb46b4-eae6-44a8-8abd-1739bb089611",
      "productId": "fedb46b4-eae6-44a8-8abd-1739bb089611",
      "quantity": 2,
      "selected": true,
      "version": 1,
      "createdAt": "2026-10-22T02:00:00Z",
      "updatedAt": "2026-10-22T02:00:00Z",
      "availability": "AVAILABLE",
      "canPurchase": true,
      "availableStock": 5,
      "maxQuantity": 5,
      "product": {
        "name": "cs商品",
        "coverUrl": "https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/cs.png",
        "skuAttributes": [
          {
            "name": "规格",
            "value": "标准"
          }
        ],
        "unitPriceCents": 1200,
        "subtotalCents": 2400,
        "currency": "CNY"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="pagecontentfavorite"></a>
## PageContentFavorite

ContentFavorite 的分页结果。固定按白名单排序；同值用 id 排序。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [ContentFavorite[]](#contentfavorite) | 是 | 当前页数据；空页为 [] |  |
| `total` | integer | 是 | 匹配记录总数 | 最小: `0` |
| `page` | integer | 是 | 页码，从 1 开始 | 最小: `1` |
| `pageSize` | integer | 是 | 每页条数 | 最小: `1`；最大: `100` |
| `hasNext` | boolean | 是 | 是否有下一页 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "fedb46b4-eae6-44a8-8abd-1739bb089611",
      "contentId": "fedb46b4-eae6-44a8-8abd-1739bb089611",
      "createdAt": "2026-10-27T00:00:00Z",
      "valid": false,
      "invalidReason": "CONTENT_UNAVAILABLE",
      "content": null,
      "access": {
        "canAccess": false,
        "reason": "CONTENT_UNAVAILABLE"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "hasNext": false
}
```


<a id="logisticscarrier"></a>
## LogisticsCarrier

平台支持的公司与查询要求；前端应使用此列表。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `code` | string | 是 | 平台快递代码。 |  |
| `name` | string | 是 | 公司名称。 |  |
| `phoneLast4Required` | boolean | 是 | 服务商是否要求手机尾号；不传则使用订单地址快照的手机尾号。 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "code": "SF",
  "name": "顺丰速运",
  "phoneLast4Required": true
}
```


<a id="logisticscarriers"></a>
## LogisticsCarriers

当前支持的快递公司。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [LogisticsCarrier[]](#logisticscarrier) | 是 | 公司列表 |  |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "code": "SF",
      "name": "顺丰速运",
      "phoneLast4Required": true
    }
  ]
}
```


<a id="inappmessage"></a>
## InAppMessage

本人站内消息。正文纯文本，使用 textContent 或框架默认转义渲染；资源跳转仍需对应业务接口鉴权。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | UUID v4。 | 格式: `uuid` |
| `sequence` | string | 是 | 本人收件箱内单调递增的序号，实际消息大于 0；不同用户序号独立。 | 最长: `19`；正则: `^(0 / [1-9]\d{0,18})$` |
| `category` | string | 是 | 消息分类；发货与运单更正归 ORDER。 | 枚举: `ORDER, AFTERSALE, MEMBERSHIP, SYSTEM` |
| `title` | string | 是 | 纯文本标题。 | 最短: `1`；最长: `120` |
| `body` | string | 是 | 纯文本正文，不作为 HTML 执行。 | 最短: `1`；最长: `2000` |
| `resourceType` | string / null | 是 | 关联资源类别；管理员手动消息为 null；前端使用固定路由。 | 枚举: `ORDER, AFTERSALE, MEMBERSHIP, None` |
| `resourceId` | string / null | 是 | 关联订单或售后 ID；MEMBERSHIP 为本人用户 ID，前端读取 /me/membership；无关联时为 null。 | 格式: `uuid` |
| `readAt` | string / null | 是 | UTC 时间；未发生时为 null。 | 格式: `date-time` |
| `createdAt` | string | 是 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 | 格式: `date-time` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "fedb46b4-eae6-44a8-8abd-1739bb089611",
  "sequence": "12",
  "category": "ORDER",
  "title": "订单已发货",
  "body": "您的订单已发货，请进入订单查看物流。",
  "resourceType": "ORDER",
  "resourceId": "fedb46b4-eae6-44a8-8abd-1739bb089611",
  "readAt": "2026-10-22T02:00:00Z",
  "createdAt": "2026-10-22T02:00:00Z"
}
```


<a id="messagepollresult"></a>
## MessagePollResult

短轮询立即返回当前状态，不保持连接。无消息且 revision=0 时 changed=false。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `changed` | boolean | 是 | 收件箱当前 revision 是否与请求不同；已读和删除也可能触发。 |  |
| `revision` | string | 是 | 本人收件箱版本；新增、已读、删除实际改变状态时递增，不能用作消息序号。 | 最长: `19`；正则: `^(0 / [1-9]\d{0,18})$` |
| `unreadCount` | integer | 是 | 未删除消息的未读数量，由写事务维护；轮询不执行 COUNT。 | 最小: `0` |
| `latestSequence` | string | 是 | 本人历来分配的最大消息序号；删除不回退，空收件箱为字符串 0。 | 最长: `19`；正则: `^(0 / [1-9]\d{0,18})$` |
| `pollAfterSeconds` | integer | 是 | 建议至少等待的轮询间隔，固定 60 秒，可再增加 0–10 秒随机抖动。 | 最小: `60`；最大: `60` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "changed": true,
  "revision": "12",
  "unreadCount": 2,
  "latestSequence": "12",
  "pollAfterSeconds": 60
}
```


<a id="messagepage"></a>
## MessagePage

游标分页，无 total 和 COUNT。afterSequence 升序读取新消息，其余按序号倒序读取历史。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `items` | [InAppMessage[]](#inappmessage) | 是 | 当前页，空列表为 []；不含已删除消息。 |  |
| `hasMore` | boolean | 是 | 当前方向是否还有消息；使用 limit+1 判定。 |  |
| `nextBeforeSequence` | string / null | 是 | 历史模式且 hasMore=true 时为本页最后序号；其他情况 null。 | 最长: `19`；正则: `^(0 / [1-9]\d{0,18})$` |
| `nextAfterSequence` | string / null | 是 | 增量模式为本页最后序号；空页保留请求 afterSequence，即使 hasMore=false 也返回。历史模式为 null。 | 最长: `19`；正则: `^(0 / [1-9]\d{0,18})$` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "items": [
    {
      "id": "fedb46b4-eae6-44a8-8abd-1739bb089611",
      "sequence": "12",
      "category": "ORDER",
      "title": "订单已发货",
      "body": "您的订单已发货，请进入订单查看物流。",
      "resourceType": "ORDER",
      "resourceId": "fedb46b4-eae6-44a8-8abd-1739bb089611",
      "readAt": "2026-10-22T02:00:00Z",
      "createdAt": "2026-10-22T02:00:00Z"
    }
  ],
  "hasMore": false,
  "nextBeforeSequence": "12",
  "nextAfterSequence": "12"
}
```


<a id="messagemutationresult"></a>
## MessageMutationResult

已读／删除操作后的收件箱状态；无实际变化时 revision 不增加。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `updated` | integer | 是 | 实际修改的消息数；重复已读为 0，成功删除为 1。 | 最小: `0` |
| `revision` | string | 是 | 本人收件箱版本；新增、已读、删除实际改变状态时递增，不能用作消息序号。 | 最长: `19`；正则: `^(0 / [1-9]\d{0,18})$` |
| `unreadCount` | integer | 是 | 未删除消息的未读数量，由写事务维护；轮询不执行 COUNT。 | 最小: `0` |
| `latestSequence` | string | 是 | 本人历来分配的最大消息序号；删除不回退，空收件箱为字符串 0。 | 最长: `19`；正则: `^(0 / [1-9]\d{0,18})$` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "updated": 1,
  "revision": "12",
  "unreadCount": 2,
  "latestSequence": "12"
}
```


<a id="messagesreadinput"></a>
## MessagesReadInput

批量标记本人消息已读；任一 ID 不存在、已删除或属于他人，整个操作 404 并回滚。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `ids` | string[] | 是 | 1–100 个不重复的本人消息 UUID v4。 | 最少项: `1`；最多项: `100`；元素不重复 |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "ids": [
    "fedb46b4-eae6-44a8-8abd-1739bb089611"
  ]
}
```


<a id="messagesreadallinput"></a>
## MessagesReadAllInput

标记已知快照范围内全部已读；不得使用未来上界，防止把并发到达的新消息标记已读。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `throughSequence` | string | 是 | 此前轮询返回的 latestSequence；只更新 <= 此值的本人未读消息，大于服务器当前最大序号返回 400。 | 最长: `19`；正则: `^(0 / [1-9]\d{0,18})$` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "throughSequence": "12"
}
```


<a id="adminmessageinput"></a>
## AdminMessageInput

向明确指定的活跃用户同步发送 SYSTEM 纯文本消息；不接受任意链接、资源目标或用户群发选择器。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `userIds` | string[] | 是 | 1–100 个不重复的 ACTIVE 用户 UUID v4；任一接收者不可用则整体 404，不会部分发送。 | 最少项: `1`；最多项: `100`；元素不重复 |
| `title` | string | 是 | 纯文本标题，不能全为空白。 | 最短: `1`；最长: `120`；正则: `\S` |
| `body` | string | 是 | 纯文本正文，不能全为空白；前端必须转义显示。 | 最短: `1`；最长: `2000`；正则: `\S` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "userIds": [
    "fedb46b4-eae6-44a8-8abd-1739bb089611"
  ],
  "title": "cs服务通知",
  "body": "您可以在消息中心查看订单、售后和会员通知。"
}
```


<a id="adminmessageresult"></a>
## AdminMessageResult

已在同一事务内全部投递；相同幂等键及请求重放返回原结果。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `sentCount` | integer | 是 | 本次接收人数。 | 最小: `1`；最大: `100` |
| `messageIds` | string[] | 是 | 生成的消息 ID；不承诺与输入 userIds 的顺序对应。 | 最少项: `1`；最多项: `100`；元素不重复 |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "sentCount": 1,
  "messageIds": [
    "fedb46b4-eae6-44a8-8abd-1739bb089611"
  ]
}
```


<a id="sciencecategory"></a>
## ScienceCategory

作用域固定为 SCIENCE 的分类。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 分类名。 | 最短: `1`；最长: `32` |
| `scope` | string | 是 | 固定作用域。 | 枚举: `SCIENCE` |
| `parentId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `sortOrder` | integer | 是 | 升序展示。 | 最小: `0` |
| `enabled` | boolean | 是 | 是否可用。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "健康科普",
  "scope": "SCIENCE",
  "parentId": "id_10001",
  "sortOrder": 0,
  "enabled": true,
  "version": 1
}
```


<a id="coursecategory"></a>
## CourseCategory

作用域固定为 COURSE 的分类。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 分类名。 | 最短: `1`；最长: `32` |
| `scope` | string | 是 | 固定作用域。 | 枚举: `COURSE` |
| `parentId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `sortOrder` | integer | 是 | 升序展示。 | 最小: `0` |
| `enabled` | boolean | 是 | 是否可用。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "健康科普",
  "scope": "COURSE",
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


<a id="contentcategory"></a>
## ContentCategory

作用域固定为 SCIENCE|COURSE 的分类。

| 字段 | 类型 | 必填 | 说明 | 约束／枚举 |
|---|---|---|---|---|
| `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `name` | string | 是 | 分类名。 | 最短: `1`；最长: `32` |
| `scope` | string | 是 | 固定作用域。 | 枚举: `SCIENCE, COURSE` |
| `parentId` | string / null | 是 | 不透明业务 ID；前端必须按字符串保存。 | 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| `sortOrder` | integer | 是 | 升序展示。 | 最小: `0` |
| `enabled` | boolean | 是 | 是否可用。 |  |
| `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 | 最小: `1` |

示例（仅结构示意，不作为可用业务 ID）：

```json
{
  "id": "id_10001",
  "name": "健康科普",
  "scope": "SCIENCE",
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
| `category` | [CourseCategory](#coursecategory) | 是 | 见关联对象。 |  |
| `tags` | string[] | 是 | 标签 | 最多项: `10` |
| `accessPolicy` | string | 是 | 课程当前访问策略；编辑价格不会改写历史订单。 | 枚举: `FREE, PURCHASE, MEMBER` |
| `priceCents` | integer | 是 | 金额，单位为人民币分；由服务端计算，禁止浮点。 | 最小: `0`；最大: `9007199254740991` |
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
    "scope": "COURSE",
    "parentId": "id_10001",
    "sortOrder": 0,
    "enabled": true,
    "version": 1
  },
  "tags": [
    "基础知识"
  ],
  "accessPolicy": "FREE",
  "priceCents": 9900,
  "currency": "CNY",
  "chapterCount": 1,
  "publishedAt": "2026-10-22T02:00:00Z"
}
```

