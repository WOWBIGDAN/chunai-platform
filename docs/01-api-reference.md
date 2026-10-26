# 接口文档

> 更新：2026-10-26。已实现认证、用户资料与后台用户管理、实物交易、科普／课程／专栏、会员方案购买、统一 OSS 上传与私有凭证及 B 站／飞书访问；线上以部署版本为准。统一上传在 OSS 凭证及公私 Bucket 配置齐全后启用。支付退款使用测试模式，短信及第三方收付款暂缓。

已实现接口的运行方法见 [后端启动与数据库](04-backend-auth.md)。

测试 API：`http://47.97.46.242/api/v1`。详见 [交易模块](06-commerce.md)、[科普与课程](08-content-courses.md)、[会员购买与用户管理](09-membership-users.md)、[统一上传](10-unified-uploads.md) 及 [部署说明](05-deployment.md)。
注册示例采用本地默认协议版本 `2026-10-01`；公网测试环境当前为 `2026-10-23-test`，提交前须读取当前环境的协议接口。

所有下列 URL 统一加前缀 `/api/v1`。请求默认 `application/json`；返回默认使用统一响应结构，表中的响应类型指 `data`。
请求及响应对象的全部字段见 [数据格式文档](02-data-models.md)，状态与联调步骤见 [业务流程文档](03-business-flows.md)。

“可选登录”表示可不传 token；如已传入，则必须有效。管理员接口必须使用独立管理员 token 并具备表中权限。`Path` 参数均为必填字符串，特殊枚举已在参数说明中列出。

分页列表未注明时按 `createdAt,id` 降序。`page` 默认 1，`pageSize` 默认 20、最大 100；排序与过滤参数只接受文档列出的值。

## 模块索引

- [01 登录与鉴权](#module-01)
- [02 用户与地址](#module-02)
- [03 视频、图文与专栏](#module-03)
- [04 产品](#module-04)
- [05 订单、支付与物流](#module-05)
- [06 渠道回调（非前端）](#module-06)
- [07 会员与已购课程](#module-07)
- [08 产品售后](#module-08)
- [09 大模型问答](#module-09)
- [10 消息与通知](#module-10)
- [11 文件与媒体](#module-11)
- [12 管理端鉴权](#module-12)
- [13 分类与内容管理](#module-13)
- [14 专栏管理](#module-14)
- [15 产品与库存管理](#module-15)
- [16 订单、物流与售后管理](#module-16)
- [17 用户与会员管理](#module-17)
- [18 站内通知与审计管理](#module-18)

<a id="module-01"></a>
## 01 登录与鉴权

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A001](#a001) | 服务与数据库健康检查 | `GET` | `/health` | 否 | 否 | `—` | — | [HealthStatus](02-data-models.md#healthstatus) | 200 |
| [A002](#a002) | 获取当前协议 | `GET` | `/public/legal-documents/{type}` | 否 | 否 | `—` | — | [LegalDocument](02-data-models.md#legaldocument) | 200 |
| [A003](#a003) | 获取短信验证码 | `POST` | `/auth/sms-codes` | 否 | 否 | `—` | [SmsRequest](02-data-models.md#smsrequest) | [SmsChallenge](02-data-models.md#smschallenge) | 202 |
| [A004](#a004) | 用户注册 | `POST` | `/auth/register` | 否 | 否 | `—` | [RegisterInput](02-data-models.md#registerinput) | [AuthTokens](02-data-models.md#authtokens) | 201 |
| [A005](#a005) | 密码登录 | `POST` | `/auth/login/password` | 否 | 否 | `—` | [PasswordLoginInput](02-data-models.md#passwordlogininput) | [AuthTokens](02-data-models.md#authtokens) | 200 |
| [A006](#a006) | 短信登录 | `POST` | `/auth/login/sms` | 否 | 否 | `—` | [SmsLoginInput](02-data-models.md#smslogininput) | [AuthTokens](02-data-models.md#authtokens) | 200 |
| [A007](#a007) | 轮换客户端令牌 | `POST` | `/auth/refresh` | 否（需刷新令牌） | 否 | `—` | [RefreshInput](02-data-models.md#refreshinput) | [AuthTokens](02-data-models.md#authtokens) | 200 |
| [A008](#a008) | 退出当前会话 | `POST` | `/auth/logout` | 是 | 否 | `—` | — | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A009](#a009) | 忘记密码重置 | `POST` | `/auth/password/reset` | 否 | 否 | `—` | [PasswordResetInput](02-data-models.md#passwordresetinput) | [ActionResult](02-data-models.md#actionresult) | 200 |

### 参数与业务约束

<a id="a001"></a>
#### A001 服务与数据库健康检查

`GET /api/v1/health`

**实现状态：** 已实现

无额外参数或请求体。

成功：HTTP `200`，`data` 为 [HealthStatus](02-data-models.md#healthstatus)。

<a id="a002"></a>
#### A002 获取当前协议

`GET /api/v1/public/legal-documents/{type}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `type` | string | 是 | 协议类型。 枚举: `TERMS, PRIVACY` |

成功：HTTP `200`，`data` 为 [LegalDocument](02-data-models.md#legaldocument)。

<a id="a003"></a>
#### A003 获取短信验证码

`POST /api/v1/auth/sms-codes`

**实现状态：** 暂缓实现（当前返回 404）

暂缓实现，当前调用返回 404。以下为未来短信接入设计：验证码不返回客户端；有效期 5 分钟、单用途、一次性，最多 5 次验证。

请求体：[SmsRequest](02-data-models.md#smsrequest)，完整字段及必填规则见对应对象。

成功：HTTP `202`，`data` 为 [SmsChallenge](02-data-models.md#smschallenge)。

<a id="a004"></a>
#### A004 用户注册

`POST /api/v1/auth/register`

**实现状态：** 已实现

当前使用手机号和密码注册，无验证码。协议版本须等于当前版本；不接受 role、status、membership、smsCode、challengeId 等字段。手机号唯一，phone_verified_at 保持 NULL。

请求体：[RegisterInput](02-data-models.md#registerinput)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [AuthTokens](02-data-models.md#authtokens)。

<a id="a005"></a>
#### A005 密码登录

`POST /api/v1/auth/login/password`

**实现状态：** 已实现

请求体：[PasswordLoginInput](02-data-models.md#passwordlogininput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AuthTokens](02-data-models.md#authtokens)。

<a id="a006"></a>
#### A006 短信登录

`POST /api/v1/auth/login/sms`

**实现状态：** 暂缓实现（当前返回 404）

暂缓实现，当前返回 404；开通短信服务后再启用。

请求体：[SmsLoginInput](02-data-models.md#smslogininput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AuthTokens](02-data-models.md#authtokens)。

<a id="a007"></a>
#### A007 轮换客户端令牌

`POST /api/v1/auth/refresh`

**实现状态：** 已实现

请求体：[RefreshInput](02-data-models.md#refreshinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AuthTokens](02-data-models.md#authtokens)。

<a id="a008"></a>
#### A008 退出当前会话

`POST /api/v1/auth/logout`

**实现状态：** 已实现

撤销当前 accessToken 所属 session 及整个 refresh 链。

无额外参数或请求体。

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a009"></a>
#### A009 忘记密码重置

`POST /api/v1/auth/password/reset`

**实现状态：** 暂缓实现（当前返回 404）

暂缓实现，当前返回 404；未接入身份核验前不能仅凭手机号重置密码。已登录用户可凭旧密码调用 PUT /me/password。

请求体：[PasswordResetInput](02-data-models.md#passwordresetinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。


<a id="module-02"></a>
## 02 用户与地址

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A010](#a010) | 本人资料 | `GET` | `/me` | 是 | 否 | `—` | — | [UserSummary](02-data-models.md#usersummary) | 200 |
| [A011](#a011) | 修改本人资料 | `PATCH` | `/me` | 是 | 否 | `—` | [UserPatch](02-data-models.md#userpatch) | [UserSummary](02-data-models.md#usersummary) | 200 |
| [A012](#a012) | 修改本人密码 | `PUT` | `/me/password` | 是 | 否 | `—` | [PasswordChangeInput](02-data-models.md#passwordchangeinput) | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A013](#a013) | 本人设备会话 | `GET` | `/me/sessions` | 是 | 否 | `—` | — | [PageSession](02-data-models.md#pagesession) | 200 |
| [A014](#a014) | 撤销本人设备会话 | `DELETE` | `/me/sessions/{id}` | 是 | 否 | `—` | — | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A015](#a015) | 本人收货地址列表 | `GET` | `/me/addresses` | 是 | 否 | `—` | — | [PageAddress](02-data-models.md#pageaddress) | 200 |
| [A016](#a016) | 新增收货地址 | `POST` | `/me/addresses` | 是 | 否 | `—` | [AddressInput](02-data-models.md#addressinput) | [Address](02-data-models.md#address) | 201 |
| [A017](#a017) | 收货地址详情 | `GET` | `/me/addresses/{id}` | 是 | 否 | `—` | — | [Address](02-data-models.md#address) | 200 |
| [A018](#a018) | 替换收货地址 | `PUT` | `/me/addresses/{id}` | 是 | 否 | `—` | [AddressReplace](02-data-models.md#addressreplace) | [Address](02-data-models.md#address) | 200 |
| [A019](#a019) | 删除收货地址 | `DELETE` | `/me/addresses/{id}` | 是 | 否 | `—` | — | [ActionResult](02-data-models.md#actionresult) | 200 |

### 参数与业务约束

<a id="a010"></a>
#### A010 本人资料

`GET /api/v1/me`

**实现状态：** 已实现

无额外参数或请求体。

成功：HTTP `200`，`data` 为 [UserSummary](02-data-models.md#usersummary)。

<a id="a011"></a>
#### A011 修改本人资料

`PATCH /api/v1/me`

**实现状态：** 已实现

先 GET /me 获取 version；修改 nickname，或传本人 READY AVATAR 素材的 avatarMediaId（null 清空）。avatarUrl 作为兼容路径保留，与 avatarMediaId 互斥；管理上传地址仍须本人所有。版本冲突返回 409。

请求体：[UserPatch](02-data-models.md#userpatch)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [UserSummary](02-data-models.md#usersummary)。

<a id="a012"></a>
#### A012 修改本人密码

`PUT /api/v1/me/password`

**实现状态：** 已实现

请求体：[PasswordChangeInput](02-data-models.md#passwordchangeinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a013"></a>
#### A013 本人设备会话

`GET /api/v1/me/sessions`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |

成功：HTTP `200`，`data` 为 [PageSession](02-data-models.md#pagesession)。

<a id="a014"></a>
#### A014 撤销本人设备会话

`DELETE /api/v1/me/sessions/{id}`

**实现状态：** 已实现

不能撤销其他用户会话；撤销当前设备后需要重新登录。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a015"></a>
#### A015 本人收货地址列表

`GET /api/v1/me/addresses`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |

成功：HTTP `200`，`data` 为 [PageAddress](02-data-models.md#pageaddress)。

<a id="a016"></a>
#### A016 新增收货地址

`POST /api/v1/me/addresses`

**实现状态：** 已实现

请求体：[AddressInput](02-data-models.md#addressinput)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [Address](02-data-models.md#address)。

<a id="a017"></a>
#### A017 收货地址详情

`GET /api/v1/me/addresses/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [Address](02-data-models.md#address)。

<a id="a018"></a>
#### A018 替换收货地址

`PUT /api/v1/me/addresses/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[AddressReplace](02-data-models.md#addressreplace)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [Address](02-data-models.md#address)。

<a id="a019"></a>
#### A019 删除收货地址

`DELETE /api/v1/me/addresses/{id}`

**实现状态：** 已实现

仅删除地址簿记录；若它是默认地址，剩余最近更新地址成为默认。历史订单快照不受影响。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 最小: `1` |

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。


<a id="module-03"></a>
## 03 视频、图文与专栏

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A020](#a020) | 查询启用分类 | `GET` | `/categories` | 否 | 否 | `—` | — | [PageCategory](02-data-models.md#pagecategory) | 200 |
| [A021](#a021) | 浏览／搜索视频科普／视频课程 | `GET` | `/videos` | 否 | 否 | `—` | — | [PageContentSummary](02-data-models.md#pagecontentsummary) | 200 |
| [A022](#a022) | 查询视频科普／视频课程详情 | `GET` | `/videos/{id}` | 可选 | 否 | `—` | — | [ContentDetail](02-data-models.md#contentdetail) | 200 |
| [A023](#a023) | 浏览／搜索图文科普／图文课程 | `GET` | `/articles` | 否 | 否 | `—` | — | [PageContentSummary](02-data-models.md#pagecontentsummary) | 200 |
| [A024](#a024) | 查询图文科普／图文课程详情 | `GET` | `/articles/{id}` | 可选 | 否 | `—` | — | [ContentDetail](02-data-models.md#contentdetail) | 200 |
| [A025](#a025) | 获取科普视频播放授权 | `GET` | `/videos/{id}/playback` | 可选 | 否 | `—` | — | [PlaybackGrant](02-data-models.md#playbackgrant) | 200 |
| [A026](#a026) | 读取科普图文正文 | `GET` | `/articles/{id}/body` | 可选 | 否 | `—` | — | [ArticleBody](02-data-models.md#articlebody) | 200 |
| [A027](#a027) | 课程目录 | `GET` | `/courses/{id}/chapters` | 可选 | 否 | `—` | — | [PageChapterSummary](02-data-models.md#pagechaptersummary) | 200 |
| [A028](#a028) | 读取课程图文章节 | `GET` | `/chapters/{id}/body` | 可选 | 否 | `—` | — | [ArticleBody](02-data-models.md#articlebody) | 200 |
| [A029](#a029) | 获取课程视频播放授权 | `GET` | `/chapters/{id}/playback` | 可选 | 否 | `—` | — | [PlaybackGrant](02-data-models.md#playbackgrant) | 200 |
| [A030](#a030) | 专栏列表 | `GET` | `/columns` | 否 | 否 | `—` | — | [PageColumn](02-data-models.md#pagecolumn) | 200 |
| [A031](#a031) | 专栏详情 | `GET` | `/columns/{id}` | 否 | 否 | `—` | — | [Column](02-data-models.md#column) | 200 |
| [A032](#a032) | 专栏内容列表 | `GET` | `/columns/{id}/contents` | 否 | 否 | `—` | — | [PageContentSummary](02-data-models.md#pagecontentsummary) | 200 |
| [A033](#a033) | 读取授权视频字节 | `GET` | `/content-playback/{id}` | 否 | 否 | `—` | — | 原始文件字节 | 200 |

### 参数与业务约束

<a id="a020"></a>
#### A020 查询启用分类

`GET /api/v1/categories`

**实现状态：** 已实现

支持 CONTENT 和 PRODUCT；父子分类必须同域。被子分类、产品或内容引用时不可删除。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `scope` | string | 否 | 分类作用域；公共列表省略时默认 PRODUCT。 枚举: `CONTENT, PRODUCT` |
| query | `parentId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [PageCategory](02-data-models.md#pagecategory)。

<a id="a021"></a>
#### A021 浏览／搜索视频科普／视频课程

`GET /api/v1/videos`

**实现状态：** 已实现

仅返回 PUBLISHED；只搜索公开标题、标签和简介，不能命中付费正文。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `keyword` | string | 否 | 搜索标题／名称；去首尾空格，最长 100。 最长: `100` |
| query | `categoryId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `kind` | string | 否 | 内容类型过滤；不传则包含此路由两种类型。 枚举: `SCIENCE_VIDEO, VIDEO_COURSE` |
| query | `columnId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `accessPolicy` | string | 否 | 访问策略：免费／单独购买／网站有效期会员；科普只能 FREE。 枚举: `FREE, PURCHASE, MEMBER` |
| query | `sort` | string | 否 | 排序白名单，默认 publishedAt:desc。 枚举: `publishedAt:desc, publishedAt:asc, priceCents:asc, priceCents:desc` |
| query | `tag` | string | 否 | 精确匹配公开标签。 最短: `1`；最长: `20` |

成功：HTTP `200`，`data` 为 [PageContentSummary](02-data-models.md#pagecontentsummary)。

<a id="a022"></a>
#### A022 查询视频科普／视频课程详情

`GET /api/v1/videos/{id}`

**实现状态：** 已实现

必须匹配路由的内容类型。OFFLINE 课程仅持有有效独立购买权益者能由已购入口读取。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [ContentDetail](02-data-models.md#contentdetail)。

<a id="a023"></a>
#### A023 浏览／搜索图文科普／图文课程

`GET /api/v1/articles`

**实现状态：** 已实现

仅返回 PUBLISHED；只搜索公开标题、标签和简介，不能命中付费正文。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `keyword` | string | 否 | 搜索标题／名称；去首尾空格，最长 100。 最长: `100` |
| query | `categoryId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `kind` | string | 否 | 内容类型过滤；不传则包含此路由两种类型。 枚举: `SCIENCE_ARTICLE, ARTICLE_COURSE` |
| query | `columnId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `accessPolicy` | string | 否 | 访问策略：免费／单独购买／网站有效期会员；科普只能 FREE。 枚举: `FREE, PURCHASE, MEMBER` |
| query | `sort` | string | 否 | 排序白名单，默认 publishedAt:desc。 枚举: `publishedAt:desc, publishedAt:asc, priceCents:asc, priceCents:desc` |
| query | `tag` | string | 否 | 精确匹配公开标签。 最短: `1`；最长: `20` |

成功：HTTP `200`，`data` 为 [PageContentSummary](02-data-models.md#pagecontentsummary)。

<a id="a024"></a>
#### A024 查询图文科普／图文课程详情

`GET /api/v1/articles/{id}`

**实现状态：** 已实现

必须匹配路由的内容类型。OFFLINE 课程仅持有有效独立购买权益者能由已购入口读取。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [ContentDetail](02-data-models.md#contentdetail)。

<a id="a025"></a>
#### A025 获取科普视频播放授权

`GET /api/v1/videos/{id}/playback`

**实现状态：** 已实现

仅 SCIENCE_VIDEO。按 mode 分支：STREAM 返回本地短时 playbackUrl；EXTERNAL_LINK 返回 BILIBILI externalUrl，不能当作视频文件 URL 播放。响应禁止缓存。 OSS 私有 MP4 与 LOCAL 共用 STREAM 授权及应用代理流，每次 Range 请求重查权益。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [PlaybackGrant](02-data-models.md#playbackgrant)。

<a id="a026"></a>
#### A026 读取科普图文正文

`GET /api/v1/articles/{id}/body`

**实现状态：** 已实现

仅 SCIENCE_ARTICLE；课程图文走章节正文接口。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [ArticleBody](02-data-models.md#articlebody)。

<a id="a027"></a>
#### A027 课程目录

`GET /api/v1/courses/{id}/chapters`

**实现状态：** 已实现

id 必须是课程。游客／普通会员只展示 PUBLISHED 章节；持有该课有效独立购买权益者可见 PUBLISHED 与 OFFLINE 历史章节，DRAFT 始终不可见。按 sortOrder,id 升序。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |

成功：HTTP `200`，`data` 为 [PageChapterSummary](02-data-models.md#pagechaptersummary)。

<a id="a028"></a>
#### A028 读取课程图文章节

`GET /api/v1/chapters/{id}/body`

**实现状态：** 已实现

仅 ARTICLE 章节；免费预览可匿名，否则校验课程购买／会员权益。返回 contentId 为所属课程 ID。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [ArticleBody](02-data-models.md#articlebody)。

<a id="a029"></a>
#### A029 获取课程视频播放授权

`GET /api/v1/chapters/{id}/playback`

**实现状态：** 已实现

仅 VIDEO 章节。LOCAL 保留短时流播放；FEISHU 仅用于 MEMBER 视频课程非预览章节，重新校验有效网站会员后返回链接和密码。无会员返回 403，不泄漏外链。管理员使用专属预览接口。响应禁止缓存。 OSS 私有 MP4 与 LOCAL 共用 STREAM 授权及应用代理流，每次 Range 请求重查权益。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [PlaybackGrant](02-data-models.md#playbackgrant)。

<a id="a030"></a>
#### A030 专栏列表

`GET /api/v1/columns`

**实现状态：** 已实现

仅 PUBLISHED，按 sortOrder,id 升序。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `keyword` | string | 否 | 搜索标题／名称；去首尾空格，最长 100。 最长: `100` |

成功：HTTP `200`，`data` 为 [PageColumn](02-data-models.md#pagecolumn)。

<a id="a031"></a>
#### A031 专栏详情

`GET /api/v1/columns/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [Column](02-data-models.md#column)。

<a id="a032"></a>
#### A032 专栏内容列表

`GET /api/v1/columns/{id}/contents`

**实现状态：** 已实现

只返回 PUBLISHED 内容；按专栏关联 sortOrder,id 升序。不会授予付费内容访问权。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `kind` | string | 否 | 内容类型；课程由章节组成。 枚举: `SCIENCE_VIDEO, SCIENCE_ARTICLE, VIDEO_COURSE, ARTICLE_COURSE` |

成功：HTTP `200`，`data` 为 [PageContentSummary](02-data-models.md#pagecontentsummary)。

<a id="a033"></a>
#### A033 读取授权视频字节

`GET /api/v1/content-playback/{id}`

**实现状态：** 已实现

只接受 aud=content-playback 的有效签名；校验原授权内容及当前会话和权益，不能直接用媒体 ID 下载。返回 video/mp4，支持 200、206 和 416，不套 JSON 成功外壳。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `token` | string | 是 | 播放接口签发的短时令牌。 最长: `4096` |
| header | `Range` | string | 否 | 支持单个字节区间。  |


<a id="module-04"></a>
## 04 产品

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A034](#a034) | 浏览／搜索产品 | `GET` | `/products` | 否 | 否 | `—` | — | [PageProductSummary](02-data-models.md#pageproductsummary) | 200 |
| [A035](#a035) | 产品详情（含 SKU） | `GET` | `/products/{id}` | 否 | 否 | `—` | — | [ProductDetail](02-data-models.md#productdetail) | 200 |

### 参数与业务约束

<a id="a034"></a>
#### A034 浏览／搜索产品

`GET /api/v1/products`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `keyword` | string | 否 | 搜索标题／名称；去首尾空格，最长 100。 最长: `100` |
| query | `categoryId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `minPriceCents` | integer | 否 | 金额，单位为人民币分；由服务端计算，禁止浮点。 最小: `0`；最大: `9007199254740991` |
| query | `maxPriceCents` | integer | 否 | 金额，单位为人民币分；由服务端计算，禁止浮点。 最小: `0`；最大: `9007199254740991` |
| query | `inStock` | boolean | 否 | 仅展示有库存产品。  |
| query | `sort` | string | 否 | 默认 createdAt:desc；价格排序基于产品最低可售 SKU 价。 枚举: `createdAt:desc, priceCents:asc, priceCents:desc` |

成功：HTTP `200`，`data` 为 [PageProductSummary](02-data-models.md#pageproductsummary)。

<a id="a035"></a>
#### A035 产品详情（含 SKU）

`GET /api/v1/products/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [ProductDetail](02-data-models.md#productdetail)。


<a id="module-05"></a>
## 05 订单、支付与物流

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A036](#a036) | 商品／课程／会员下单试算 | `POST` | `/order-quotes` | 是 | 否 | `—` | [ImplementedPurchase](02-data-models.md#implementedpurchase) | [OrderQuote](02-data-models.md#orderquote) | 201 |
| [A037](#a037) | 创建订单 | `POST` | `/orders` | 是 | 否 | `—` | [OrderCreate](02-data-models.md#ordercreate) | [OrderDetail](02-data-models.md#orderdetail) | 201 |
| [A038](#a038) | 本人订单列表 | `GET` | `/orders` | 是 | 否 | `—` | — | [PageOrderSummary](02-data-models.md#pageordersummary) | 200 |
| [A039](#a039) | 本人订单详情 | `GET` | `/orders/{id}` | 是 | 否 | `—` | — | [OrderDetail](02-data-models.md#orderdetail) | 200 |
| [A040](#a040) | 取消待支付订单 | `POST` | `/orders/{id}/cancel` | 是 | 否 | `—` | [OrderCancelInput](02-data-models.md#ordercancelinput) | [OrderDetail](02-data-models.md#orderdetail) | 200 |
| [A041](#a041) | 发起订单支付 | `POST` | `/orders/{id}/payment-attempts` | 是 | 否 | `—` | [PaymentCreate](02-data-models.md#paymentcreate) | [PaymentAttempt](02-data-models.md#paymentattempt) | 201 |
| [A042](#a042) | 查询本人支付状态 | `GET` | `/payment-attempts/{id}` | 是 | 否 | `—` | — | [PaymentAttempt](02-data-models.md#paymentattempt) | 200 |
| [A043](#a043) | 主动补查渠道支付结果 | `POST` | `/payment-attempts/{id}/sync` | 是 | 否 | `—` | — | [PaymentAttempt](02-data-models.md#paymentattempt) | 200 |
| [A044](#a044) | 本人订单物流 | `GET` | `/orders/{id}/logistics` | 是 | 否 | `—` | — | [LogisticsResult](02-data-models.md#logisticsresult) | 200 |
| [A045](#a045) | 确认收货 | `POST` | `/orders/{id}/confirm-receipt` | 是 | 否 | `—` | [VersionInput](02-data-models.md#versioninput) | [OrderDetail](02-data-models.md#orderdetail) | 200 |
| [A046](#a046) | 本人订单退款进度 | `GET` | `/orders/{id}/refunds` | 是 | 否 | `—` | — | [PageRefund](02-data-models.md#pagerefund) | 200 |

### 参数与业务约束

<a id="a036"></a>
#### A036 商品／课程／会员下单试算

`POST /api/v1/order-quotes`

**实现状态：** 已实现

PRODUCT、COURSE、MEMBERSHIP 三选一。会员只传 type 和 planId；单份数量 1，无地址和运费。报价有效 10 分钟，方案停用或价格、天数、权益改变后须重新报价。

请求体：[ImplementedPurchase](02-data-models.md#implementedpurchase)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [OrderQuote](02-data-models.md#orderquote)。

<a id="a037"></a>
#### A037 创建订单

`POST /api/v1/orders`

**实现状态：** 已实现

报价归属本人且最多创建一单；重校验可售和成交条款，待付款 30 分钟。会员允许续购；同用户同方案最多一份有效待付款会员订单。付款按订单快照追加完整会员段。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

请求体：[OrderCreate](02-data-models.md#ordercreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [OrderDetail](02-data-models.md#orderdetail)。

<a id="a038"></a>
#### A038 本人订单列表

`GET /api/v1/orders`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `type` | string | 否 | 一种订单只允许一种业务类型。 枚举: `PRODUCT, COURSE, MEMBERSHIP` |
| query | `status` | string | 否 | 履约状态；支付与售后另有独立字段。 枚举: `PENDING_PAYMENT, PENDING_SHIPMENT, PENDING_RECEIPT, COMPLETED, CANCELLED, CLOSED` |
| query | `paymentStatus` | string | 否 | 订单汇总支付状态。 枚举: `UNPAID, PAID, PARTIALLY_REFUNDED, REFUNDED` |
| query | `createdFrom` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |
| query | `createdTo` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |
| query | `sort` | string | 否 | 白名单排序，默认 createdAt:desc；同值用 id 排序。 枚举: `createdAt:desc, createdAt:asc` |
| query | `afterSaleStatus` | string | 否 | 售后汇总。 枚举: `NONE, PROCESSING, PARTIALLY_COMPLETED, COMPLETED` |

成功：HTTP `200`，`data` 为 [PageOrderSummary](02-data-models.md#pageordersummary)。

<a id="a039"></a>
#### A039 本人订单详情

`GET /api/v1/orders/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [OrderDetail](02-data-models.md#orderdetail)。

<a id="a040"></a>
#### A040 取消待支付订单

`POST /api/v1/orders/{id}/cancel`

**实现状态：** 已实现

仅本人待付款订单，与测试付款抢同一订单锁；取消成功释放预占。当前无外部支付单。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[OrderCancelInput](02-data-models.md#ordercancelinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [OrderDetail](02-data-models.md#orderdetail)。

<a id="a041"></a>
#### A041 发起订单支付

`POST /api/v1/orders/{id}/payment-attempts`

**实现状态：** 设计中（尚未实现）

只允许未过期、未支付订单。同通道未过期支付尝试可复用；支付金额从订单读取。支付回跳不授予权益。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[PaymentCreate](02-data-models.md#paymentcreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [PaymentAttempt](02-data-models.md#paymentattempt)。

<a id="a042"></a>
#### A042 查询本人支付状态

`GET /api/v1/payment-attempts/{id}`

**实现状态：** 设计中（尚未实现）

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [PaymentAttempt](02-data-models.md#paymentattempt)。

<a id="a043"></a>
#### A043 主动补查渠道支付结果

`POST /api/v1/payment-attempts/{id}/sync`

**实现状态：** 设计中（尚未实现）

服务端直接查询渠道并复用入账逻辑；按用户和支付尝试限流，禁止用前端结果更新状态。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [PaymentAttempt](02-data-models.md#paymentattempt)。

<a id="a044"></a>
#### A044 本人订单物流

`GET /api/v1/orders/{id}/logistics`

**实现状态：** 已实现

未发货返回空包裹；已发货返回人工登记物流，syncStatus=MANUAL，lastSyncedAt=null。尚未接入第三方快递查询。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [LogisticsResult](02-data-models.md#logisticsresult)。

<a id="a045"></a>
#### A045 确认收货

`POST /api/v1/orders/{id}/confirm-receipt`

**实现状态：** 已实现

仅 PENDING_RECEIPT；存在进行中售后则拒绝。物流签收不会直接代替用户确认；一期不自动收货。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[VersionInput](02-data-models.md#versioninput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [OrderDetail](02-data-models.md#orderdetail)。

<a id="a046"></a>
#### A046 本人订单退款进度

`GET /api/v1/orders/{id}/refunds`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |

成功：HTTP `200`，`data` 为 [PageRefund](02-data-models.md#pagerefund)。


<a id="module-06"></a>
## 06 渠道回调（非前端）

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A047](#a047) | 支付结果回调 | `POST` | `/webhooks/payments/{provider}` | 否（需渠道验签） | 否 | `—` | [ExternalWebhookPayload](02-data-models.md#externalwebhookpayload) | 渠道协议 ACK | 200 |
| [A048](#a048) | 退款结果回调 | `POST` | `/webhooks/refunds/{provider}` | 否（需渠道验签） | 否 | `—` | [ExternalWebhookPayload](02-data-models.md#externalwebhookpayload) | 渠道协议 ACK | 200 |

### 参数与业务约束

<a id="a047"></a>
#### A047 支付结果回调

`POST /api/v1/webhooks/payments/{provider}`

**实现状态：** 设计中（尚未实现）

provider=wechat 或 alipay。读取原始 body；验证渠道签名、证书／密钥、时间窗、商户号、币种、金额和交易号，必要时解密及主动查单。渠道重试可重复到达。ACK 严格遵循所接商户协议，不套统一响应。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `provider` | string | 是 | 支付渠道；只对接已经配置的商户协议。 枚举: `wechat, alipay` |

请求体：[ExternalWebhookPayload](02-data-models.md#externalwebhookpayload)，完整字段及必填规则见对应对象。

<a id="a048"></a>
#### A048 退款结果回调

`POST /api/v1/webhooks/refunds/{provider}`

**实现状态：** 设计中（尚未实现）

provider=wechat 或 alipay。读取原始 body；验证渠道签名、证书／密钥、时间窗、商户号、币种、金额和交易号，必要时解密及主动查单。渠道重试可重复到达。ACK 严格遵循所接商户协议，不套统一响应。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `provider` | string | 是 | 支付渠道；只对接已经配置的商户协议。 枚举: `wechat, alipay` |

请求体：[ExternalWebhookPayload](02-data-models.md#externalwebhookpayload)，完整字段及必填规则见对应对象。


<a id="module-07"></a>
## 07 会员与已购课程

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A049](#a049) | 可购买会员方案 | `GET` | `/membership-plans` | 否 | 否 | `—` | — | [PageMembershipPlan](02-data-models.md#pagemembershipplan) | 200 |
| [A050](#a050) | 会员方案详情 | `GET` | `/membership-plans/{id}` | 否 | 否 | `—` | — | [MembershipPlan](02-data-models.md#membershipplan) | 200 |
| [A051](#a051) | 本人会员权益 | `GET` | `/me/membership` | 是 | 否 | `—` | — | [MembershipDetail](02-data-models.md#membershipdetail) | 200 |
| [A052](#a052) | 本人独立购买课程 | `GET` | `/me/courses` | 是 | 否 | `—` | — | [PageCourseEntitlement](02-data-models.md#pagecourseentitlement) | 200 |
| [A053](#a053) | 本人会员购买权益段 | `GET` | `/me/membership/periods` | 是 | 否 | `—` | — | [PageMembershipPeriod](02-data-models.md#pagemembershipperiod) | 200 |

### 参数与业务约束

<a id="a049"></a>
#### A049 可购买会员方案

`GET /api/v1/membership-plans`

**实现状态：** 已实现

按 sortOrder 升序、createdAt 降序、id 升序；公共接口只显示启用方案。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `keyword` | string | 否 | 方案名称子串。 最短: `1`；最长: `64` |

成功：HTTP `200`，`data` 为 [PageMembershipPlan](02-data-models.md#pagemembershipplan)。

<a id="a050"></a>
#### A050 会员方案详情

`GET /api/v1/membership-plans/{id}`

**实现状态：** 已实现

仅启用方案可见；未启用或不存在返回 404。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [MembershipPlan](02-data-models.md#membershipplan)。

<a id="a051"></a>
#### A051 本人会员权益

`GET /api/v1/me/membership`

**实现状态：** 已实现

有效账号且管理员期限或 ACTIVE 购买权益段覆盖当前时间才 active=true；只覆盖 MEMBER 内容。membership 字段专指手工期限，购买明细见 /membership/periods。

无额外参数或请求体。

成功：HTTP `200`，`data` 为 [MembershipDetail](02-data-models.md#membershipdetail)。

<a id="a052"></a>
#### A052 本人独立购买课程

`GET /api/v1/me/courses`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `status` | string | 否 | 默认 ACTIVE。 枚举: `ACTIVE, REVOKED` |

成功：HTTP `200`，`data` 为 [PageCourseEntitlement](02-data-models.md#pagecourseentitlement)。

<a id="a053"></a>
#### A053 本人会员购买权益段

`GET /api/v1/me/membership/periods`

**实现状态：** 已实现

仅本人，按 createdAt 降序、id 升序；保留未来、过期和已退款历史。资格以 GET /me/membership 的 active 为准。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |

成功：HTTP `200`，`data` 为 [PageMembershipPeriod](02-data-models.md#pagemembershipperiod)。


<a id="module-08"></a>
## 08 产品售后

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A054](#a054) | 申请产品售后 | `POST` | `/aftersales` | 是 | 否 | `—` | [AfterSaleCreate](02-data-models.md#aftersalecreate) | [AfterSale](02-data-models.md#aftersale) | 201 |
| [A055](#a055) | 本人售后列表 | `GET` | `/aftersales` | 是 | 否 | `—` | — | [PageAfterSale](02-data-models.md#pageaftersale) | 200 |
| [A056](#a056) | 本人售后详情 | `GET` | `/aftersales/{id}` | 是 | 否 | `—` | — | [AfterSale](02-data-models.md#aftersale) | 200 |
| [A057](#a057) | 撤销售后申请 | `POST` | `/aftersales/{id}/cancel` | 是 | 否 | `—` | [VersionInput](02-data-models.md#versioninput) | [AfterSale](02-data-models.md#aftersale) | 200 |
| [A058](#a058) | 填写退货物流 | `POST` | `/aftersales/{id}/return-shipment` | 是 | 否 | `—` | [ReturnShipmentInput](02-data-models.md#returnshipmentinput) | [AfterSale](02-data-models.md#aftersale) | 200 |

### 参数与业务约束

<a id="a054"></a>
#### A054 申请产品售后

`POST /api/v1/aftersales`

**实现状态：** 已实现

仅本人已支付实物订单。未发货 REFUND_ONLY；已发货 RETURN_REFUND，完成后 7*24h 内可申请（设计默认值）。同一订单同时最多一张活跃售后单；单张可包含多行，终态后可申请剩余量。原子冻结数量、退款额度和未发货订单的整单发货。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

请求体：[AfterSaleCreate](02-data-models.md#aftersalecreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [AfterSale](02-data-models.md#aftersale)。

<a id="a055"></a>
#### A055 本人售后列表

`GET /api/v1/aftersales`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `status` | string | 否 | 售后状态。 枚举: `PENDING_REVIEW, AWAITING_RETURN, RETURNING, REFUNDING, REFUND_FAILED, COMPLETED, REJECTED, CANCELLED, CLOSED` |
| query | `orderId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [PageAfterSale](02-data-models.md#pageaftersale)。

<a id="a056"></a>
#### A056 本人售后详情

`GET /api/v1/aftersales/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AfterSale](02-data-models.md#aftersale)。

<a id="a057"></a>
#### A057 撤销售后申请

`POST /api/v1/aftersales/{id}/cancel`

**实现状态：** 已实现

仅 PENDING_REVIEW／AWAITING_RETURN；释放本次冻结。已提交退货运单或已发起退款不可撤销。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[VersionInput](02-data-models.md#versioninput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AfterSale](02-data-models.md#aftersale)。

<a id="a058"></a>
#### A058 填写退货物流

`POST /api/v1/aftersales/{id}/return-shipment`

**实现状态：** 已实现

仅 AWAITING_RETURN 且未超过退货期限；转 RETURNING。批准退货后 7*24h 内未提交运单则 CLOSED 并释放冻结。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[ReturnShipmentInput](02-data-models.md#returnshipmentinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AfterSale](02-data-models.md#aftersale)。


<a id="module-09"></a>
## 09 大模型问答

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A059](#a059) | 本人问答额度 | `GET` | `/ai/quota` | 是 | 否 | `—` | — | [AiQuota](02-data-models.md#aiquota) | 200 |
| [A060](#a060) | 本人会话列表 | `GET` | `/ai/conversations` | 是 | 否 | `—` | — | [PageAiConversation](02-data-models.md#pageaiconversation) | 200 |
| [A061](#a061) | 创建问答会话 | `POST` | `/ai/conversations` | 是 | 否 | `—` | [AiConversationInput](02-data-models.md#aiconversationinput) | [AiConversation](02-data-models.md#aiconversation) | 201 |
| [A062](#a062) | 会话详情 | `GET` | `/ai/conversations/{id}` | 是 | 否 | `—` | — | [AiConversation](02-data-models.md#aiconversation) | 200 |
| [A063](#a063) | 会话改名 | `PATCH` | `/ai/conversations/{id}` | 是 | 否 | `—` | [AiConversationPatch](02-data-models.md#aiconversationpatch) | [AiConversation](02-data-models.md#aiconversation) | 200 |
| [A064](#a064) | 删除本人会话 | `DELETE` | `/ai/conversations/{id}` | 是 | 否 | `—` | — | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A065](#a065) | 会话历史消息 | `GET` | `/ai/conversations/{id}/messages` | 是 | 否 | `—` | — | [AiMessagePage](02-data-models.md#aimessagepage) | 200 |
| [A066](#a066) | 提问并创建生成任务 | `POST` | `/ai/conversations/{id}/messages` | 是 | 否 | `—` | [AiMessageInput](02-data-models.md#aimessageinput) | [AiGeneration](02-data-models.md#aigeneration) | 202 |
| [A067](#a067) | 查询生成任务 | `GET` | `/ai/generations/{id}` | 是 | 否 | `—` | — | [AiGeneration](02-data-models.md#aigeneration) | 200 |
| [A068](#a068) | 订阅生成任务 SSE | `GET` | `/ai/generations/{id}/events` | 是 | 否 | `—` | — | SSE 事件 | 200 |
| [A069](#a069) | 停止生成 | `POST` | `/ai/generations/{id}/cancel` | 是 | 否 | `—` | — | [AiGeneration](02-data-models.md#aigeneration) | 200 |

### 参数与业务约束

<a id="a059"></a>
#### A059 本人问答额度

`GET /api/v1/ai/quota`

**实现状态：** 设计中（尚未实现）

无额外参数或请求体。

成功：HTTP `200`，`data` 为 [AiQuota](02-data-models.md#aiquota)。

<a id="a060"></a>
#### A060 本人会话列表

`GET /api/v1/ai/conversations`

**实现状态：** 设计中（尚未实现）

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `sort` | string | 否 | 白名单排序，默认 createdAt:desc；同值用 id 排序。 枚举: `createdAt:desc, createdAt:asc` |

成功：HTTP `200`，`data` 为 [PageAiConversation](02-data-models.md#pageaiconversation)。

<a id="a061"></a>
#### A061 创建问答会话

`POST /api/v1/ai/conversations`

**实现状态：** 设计中（尚未实现）

请求体：[AiConversationInput](02-data-models.md#aiconversationinput)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [AiConversation](02-data-models.md#aiconversation)。

<a id="a062"></a>
#### A062 会话详情

`GET /api/v1/ai/conversations/{id}`

**实现状态：** 设计中（尚未实现）

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AiConversation](02-data-models.md#aiconversation)。

<a id="a063"></a>
#### A063 会话改名

`PATCH /api/v1/ai/conversations/{id}`

**实现状态：** 设计中（尚未实现）

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[AiConversationPatch](02-data-models.md#aiconversationpatch)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AiConversation](02-data-models.md#aiconversation)。

<a id="a064"></a>
#### A064 删除本人会话

`DELETE /api/v1/ai/conversations/{id}`

**实现状态：** 设计中（尚未实现）

同时取消进行中任务，立即撤销读取；正文按保留策略清理。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a065"></a>
#### A065 会话历史消息

`GET /api/v1/ai/conversations/{id}/messages`

**实现状态：** 设计中（尚未实现）

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `cursor` | string | 否 | 不透明游标；第一页不传。 最长: `512` |
| query | `limit` | integer | 否 | 默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |

成功：HTTP `200`，`data` 为 [AiMessagePage](02-data-models.md#aimessagepage)。

<a id="a066"></a>
#### A066 提问并创建生成任务

`POST /api/v1/ai/conversations/{id}/messages`

**实现状态：** 设计中（尚未实现）

先做输入过滤再原子预占次数；clientMessageId 防止跨幂等键重复提问。一次只允许一个活跃生成任务。模型调用失败且无有效输出返还次数。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[AiMessageInput](02-data-models.md#aimessageinput)，完整字段及必填规则见对应对象。

成功：HTTP `202`，`data` 为 [AiGeneration](02-data-models.md#aigeneration)。

<a id="a067"></a>
#### A067 查询生成任务

`GET /api/v1/ai/generations/{id}`

**实现状态：** 设计中（尚未实现）

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AiGeneration](02-data-models.md#aigeneration)。

<a id="a068"></a>
#### A068 订阅生成任务 SSE

`GET /api/v1/ai/generations/{id}/events`

**实现状态：** 设计中（尚未实现）

使用支持 Authorization 请求头的 fetch 流。仅订阅已存在任务，不会再次扣额度；Last-Event-ID 从最后确认序号续读。断流不取消生成。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| header | `Last-Event-ID` | string | 否 | 已消费的最后事件序号。 正则: `^\d+$` |

<a id="a069"></a>
#### A069 停止生成

`POST /api/v1/ai/generations/{id}/cancel`

**实现状态：** 设计中（尚未实现）

终态重复调用返回原任务；取消前已有有效输出则计一次，无输出返还预占。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AiGeneration](02-data-models.md#aigeneration)。


<a id="module-10"></a>
## 10 消息与通知

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A070](#a070) | 本人消息列表 | `GET` | `/me/notifications` | 是 | 否 | `—` | — | [PageNotification](02-data-models.md#pagenotification) | 200 |
| [A071](#a071) | 未读数量 | `GET` | `/me/notifications/unread-count` | 是 | 否 | `—` | — | [UnreadCount](02-data-models.md#unreadcount) | 200 |
| [A072](#a072) | 消息详情 | `GET` | `/me/notifications/{id}` | 是 | 否 | `—` | — | [Notification](02-data-models.md#notification) | 200 |
| [A073](#a073) | 幂等标记已读 | `PUT` | `/me/notifications/{id}/read` | 是 | 否 | `—` | — | [Notification](02-data-models.md#notification) | 200 |
| [A074](#a074) | 批量已读 | `PUT` | `/me/notifications/read-all` | 是 | 否 | `—` | [ReadAllInput](02-data-models.md#readallinput) | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A075](#a075) | 删除本人站内消息 | `DELETE` | `/me/notifications/{id}` | 是 | 否 | `—` | — | [ActionResult](02-data-models.md#actionresult) | 200 |

### 参数与业务约束

<a id="a070"></a>
#### A070 本人消息列表

`GET /api/v1/me/notifications`

**实现状态：** 设计中（尚未实现）

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `category` | string | 否 | 类别。 枚举: `ORDER, LOGISTICS, AFTERSALE, MEMBERSHIP, SYSTEM` |
| query | `unreadOnly` | boolean | 否 | 只看未读。  |

成功：HTTP `200`，`data` 为 [PageNotification](02-data-models.md#pagenotification)。

<a id="a071"></a>
#### A071 未读数量

`GET /api/v1/me/notifications/unread-count`

**实现状态：** 设计中（尚未实现）

无额外参数或请求体。

成功：HTTP `200`，`data` 为 [UnreadCount](02-data-models.md#unreadcount)。

<a id="a072"></a>
#### A072 消息详情

`GET /api/v1/me/notifications/{id}`

**实现状态：** 设计中（尚未实现）

读取详情不自动标已读。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [Notification](02-data-models.md#notification)。

<a id="a073"></a>
#### A073 幂等标记已读

`PUT /api/v1/me/notifications/{id}/read`

**实现状态：** 设计中（尚未实现）

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [Notification](02-data-models.md#notification)。

<a id="a074"></a>
#### A074 批量已读

`PUT /api/v1/me/notifications/read-all`

**实现状态：** 设计中（尚未实现）

请求体：[ReadAllInput](02-data-models.md#readallinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a075"></a>
#### A075 删除本人站内消息

`DELETE /api/v1/me/notifications/{id}`

**实现状态：** 设计中（尚未实现）

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。


<a id="module-11"></a>
## 11 文件与媒体

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A076](#a076) | 申请直传地址 | `POST` | `/uploads` | 是（用户或管理员） | 按操作与素材用途 | `管理员: 按用途校验，见下文` | [UploadCreate](02-data-models.md#uploadcreate) | [UploadTicket](02-data-models.md#uploadticket) | 201 |
| [A077](#a077) | 通知上传完成 | `POST` | `/uploads/{id}/complete` | 是（用户或管理员） | 按操作与素材用途 | `管理员: 按用途校验，见下文` | — | [MediaSummary](02-data-models.md#mediasummary) | 200 |
| [A078](#a078) | 读取可管理媒体处理状态 | `GET` | `/media/{id}` | 是（用户或管理员） | 按操作与素材用途 | `管理员: 按用途校验，见下文` | — | [MediaSummary](02-data-models.md#mediasummary) | 200 |
| [A079](#a079) | 申请私有凭证图片读取授权 | `POST` | `/media/{id}/read-grant` | 是（用户或管理员） | 按操作与素材用途 | `管理员: aftersales:review` | — | [MediaReadGrant](02-data-models.md#mediareadgrant) | 200 |
| [A080](#a080) | 删除未引用的本人素材 | `DELETE` | `/media/{id}` | 是（用户或管理员） | 按操作与素材用途 | `管理员: 按用途校验，见下文` | — | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A081](#a081) | 读取授权私有售后凭证 | `GET` | `/media/{id}/file` | 否 | 否 | `—` | — | 原始文件字节 | 200 |

### 参数与业务约束

<a id="a076"></a>
#### A076 申请直传地址

`POST /api/v1/uploads`

**实现状态：** 已实现

普通用户可上传本人头像和售后凭证。管理员内容素材须 media:write + content:write，产品图片须 media:write + products:write。全部文件先上传到私有临时区域；缺少 OSS 凭证或任一 Bucket 配置时返回 503，不签发假上传地址。无需幂等键，每次创建新票据；每个账户最多 20 个有效待完成申请，滚动 24 小时用户限 100 个、管理员限 500 个。

请求体：[UploadCreate](02-data-models.md#uploadcreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [UploadTicket](02-data-models.md#uploadticket)。

<a id="a077"></a>
#### A077 通知上传完成

`POST /api/v1/uploads/{id}/complete`

**实现状态：** 已实现

上传到 OSS 成功后调用，无请求体。服务端校验实际大小、MIME 与文件特征，复制到新的最终对象后才变为 READY；公开图片发布到公开 Bucket，证据和 MP4 保持私有。重复成功确认返回原素材；不转码。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [MediaSummary](02-data-models.md#mediasummary)。

<a id="a078"></a>
#### A078 读取可管理媒体处理状态

`GET /api/v1/media/{id}`

**实现状态：** 已实现

普通用户仅查询本人上传；管理员查询后台用途素材需 media:write 和对应内容／产品权限，读取已绑定售后的 READY 凭证需 aftersales:review。不返回临时 key、私有源地址或凭证。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [MediaSummary](02-data-models.md#mediasummary)。

<a id="a079"></a>
#### A079 申请私有凭证图片读取授权

`POST /api/v1/media/{id}/read-grant`

**实现状态：** 已实现

仅 READY AFTERSALE_EVIDENCE 图片。本人可预览；管理员须 aftersales:review，且素材已绑定售后。返回 60 秒应用代理地址；每次读取重查当前会话、账号及关联。内容视频使用现有播放授权接口。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [MediaReadGrant](02-data-models.md#mediareadgrant)。

<a id="a080"></a>
#### A080 删除未引用的本人素材

`DELETE /api/v1/media/{id}`

**实现状态：** 已实现

仅本人未引用素材；管理员仍需对应用途权限。头像、商品、正文、内容封面、专栏、有效报价／历史订单或售后凭证仍引用时返回 MEDIA_IN_USE。先逻辑删除，票据过期 60 秒后后台清理对象并重试失败清理。重复删除成功，无需幂等键。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a081"></a>
#### A081 读取授权私有售后凭证

`GET /api/v1/media/{id}/file`

**实现状态：** 已实现

返回原始图片字节，不套 JSON 成功外壳；每次读取重查素材状态、账户与会话。管理员还需当前 aftersales:review 权限及售后关联。不能用普通登录 JWT 代替授权令牌。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `token` | string | 是 | read-grant 签发的 60 秒短时令牌。 最长: `4096` |


<a id="module-12"></a>
## 12 管理端鉴权

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A082](#a082) | 管理员登录 | `POST` | `/admin/auth/login` | 否 | 是（管理员凭证） | `—` | [AdminLoginInput](02-data-models.md#adminlogininput) | [AdminAuthTokens](02-data-models.md#adminauthtokens) | 200 |
| [A083](#a083) | 轮换管理员令牌 | `POST` | `/admin/auth/refresh` | 否（需管理员刷新令牌） | 是 | `—` | [RefreshInput](02-data-models.md#refreshinput) | [AdminAuthTokens](02-data-models.md#adminauthtokens) | 200 |
| [A084](#a084) | 管理员退出 | `POST` | `/admin/auth/logout` | 是 | 是 | `—` | — | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A085](#a085) | 当前管理员与权限 | `GET` | `/admin/me` | 是 | 是 | `—` | — | [AdminPrincipal](02-data-models.md#adminprincipal) | 200 |

### 参数与业务约束

<a id="a082"></a>
#### A082 管理员登录

`POST /api/v1/admin/auth/login`

**实现状态：** 已实现

不要求已经登录，但只验证独立管理员账号与密码，不接受客户凭证。

请求体：[AdminLoginInput](02-data-models.md#adminlogininput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminAuthTokens](02-data-models.md#adminauthtokens)。

<a id="a083"></a>
#### A083 轮换管理员令牌

`POST /api/v1/admin/auth/refresh`

**实现状态：** 已实现

请求体：[RefreshInput](02-data-models.md#refreshinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminAuthTokens](02-data-models.md#adminauthtokens)。

<a id="a084"></a>
#### A084 管理员退出

`POST /api/v1/admin/auth/logout`

**实现状态：** 已实现

无额外参数或请求体。

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a085"></a>
#### A085 当前管理员与权限

`GET /api/v1/admin/me`

**实现状态：** 已实现

无额外参数或请求体。

成功：HTTP `200`，`data` 为 [AdminPrincipal](02-data-models.md#adminprincipal)。


<a id="module-13"></a>
## 13 分类与内容管理

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A086](#a086) | 查询分类列表 | `GET` | `/admin/categories` | 是 | 是 | `content:write` | — | [PageCategory](02-data-models.md#pagecategory) | 200 |
| [A087](#a087) | 创建分类 | `POST` | `/admin/categories` | 是 | 是 | `content:write` | [CategoryCreate](02-data-models.md#categorycreate) | [Category](02-data-models.md#category) | 201 |
| [A088](#a088) | 查询分类详情 | `GET` | `/admin/categories/{id}` | 是 | 是 | `content:write` | — | [Category](02-data-models.md#category) | 200 |
| [A089](#a089) | 修改分类 | `PATCH` | `/admin/categories/{id}` | 是 | 是 | `content:write` | [CategoryPatch](02-data-models.md#categorypatch) | [Category](02-data-models.md#category) | 200 |
| [A090](#a090) | 删除分类 | `DELETE` | `/admin/categories/{id}` | 是 | 是 | `content:write` | — | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A091](#a091) | 查询科普／课程列表 | `GET` | `/admin/contents` | 是 | 是 | `content:write` | — | [PageAdminContent](02-data-models.md#pageadmincontent) | 200 |
| [A092](#a092) | 创建科普／课程 | `POST` | `/admin/contents` | 是 | 是 | `content:write` | [ContentCreate](02-data-models.md#contentcreate) | [AdminContent](02-data-models.md#admincontent) | 201 |
| [A093](#a093) | 查询科普／课程详情 | `GET` | `/admin/contents/{id}` | 是 | 是 | `content:write` | — | [AdminContent](02-data-models.md#admincontent) | 200 |
| [A094](#a094) | 修改科普／课程 | `PATCH` | `/admin/contents/{id}` | 是 | 是 | `content:write` | [ContentPatch](02-data-models.md#contentpatch) | [AdminContent](02-data-models.md#admincontent) | 200 |
| [A095](#a095) | 删除科普／课程 | `DELETE` | `/admin/contents/{id}` | 是 | 是 | `content:write` | — | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A096](#a096) | 发布科普／课程 | `POST` | `/admin/contents/{id}/publish` | 是 | 是 | `content:write` | [VersionInput](02-data-models.md#versioninput) | [AdminContent](02-data-models.md#admincontent) | 200 |
| [A097](#a097) | 下架科普／课程 | `POST` | `/admin/contents/{id}/unpublish` | 是 | 是 | `content:write` | [VersionInput](02-data-models.md#versioninput) | [AdminContent](02-data-models.md#admincontent) | 200 |
| [A098](#a098) | 查询科普正文／视频引用 | `GET` | `/admin/contents/{id}/body` | 是 | 是 | `content:write` | — | [AdminBody](02-data-models.md#adminbody) | 200 |
| [A099](#a099) | 替换科普正文／视频引用 | `PUT` | `/admin/contents/{id}/body` | 是 | 是 | `content:write` | [ScienceBodyInput](02-data-models.md#sciencebodyinput) | [AdminBody](02-data-models.md#adminbody) | 200 |
| [A100](#a100) | 管理课程章节列表 | `GET` | `/admin/courses/{id}/chapters` | 是 | 是 | `content:write` | — | [PageAdminChapter](02-data-models.md#pageadminchapter) | 200 |
| [A101](#a101) | 创建课程章节草稿 | `POST` | `/admin/courses/{id}/chapters` | 是 | 是 | `content:write` | [ChapterCreate](02-data-models.md#chaptercreate) | [AdminChapter](02-data-models.md#adminchapter) | 201 |
| [A102](#a102) | 章节详情 | `GET` | `/admin/chapters/{id}` | 是 | 是 | `content:write` | — | [AdminChapter](02-data-models.md#adminchapter) | 200 |
| [A103](#a103) | 修改章节 | `PATCH` | `/admin/chapters/{id}` | 是 | 是 | `content:write` | [ChapterPatch](02-data-models.md#chapterpatch) | [AdminChapter](02-data-models.md#adminchapter) | 200 |
| [A104](#a104) | 删除未发布章节 | `DELETE` | `/admin/chapters/{id}` | 是 | 是 | `content:write` | — | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A105](#a105) | 查询章节正文／视频引用 | `GET` | `/admin/chapters/{id}/body` | 是 | 是 | `content:write` | — | [AdminBody](02-data-models.md#adminbody) | 200 |
| [A106](#a106) | 替换章节正文／视频引用 | `PUT` | `/admin/chapters/{id}/body` | 是 | 是 | `content:write` | [ScienceBodyInput](02-data-models.md#sciencebodyinput) | [AdminBody](02-data-models.md#adminbody) | 200 |
| [A107](#a107) | 发布课程章节 | `POST` | `/admin/chapters/{id}/publish` | 是 | 是 | `content:write` | [VersionInput](02-data-models.md#versioninput) | [AdminChapter](02-data-models.md#adminchapter) | 200 |
| [A108](#a108) | 下架课程章节 | `POST` | `/admin/chapters/{id}/unpublish` | 是 | 是 | `content:write` | [VersionInput](02-data-models.md#versioninput) | [AdminChapter](02-data-models.md#adminchapter) | 200 |
| [A109](#a109) | 预览科普视频（含草稿） | `GET` | `/admin/contents/{id}/playback` | 是 | 是 | `content:write` | — | [PlaybackGrant](02-data-models.md#playbackgrant) | 200 |
| [A110](#a110) | 预览视频章节（含草稿） | `GET` | `/admin/chapters/{id}/playback` | 是 | 是 | `content:write` | — | [PlaybackGrant](02-data-models.md#playbackgrant) | 200 |
| [A111](#a111) | 登记公开内容图片 | `POST` | `/admin/content-media/images` | 是 | 是 | `content:write` | [ContentImageCreate](02-data-models.md#contentimagecreate) | [MediaSummary](02-data-models.md#mediasummary) | 201 |
| [A112](#a112) | 登记 B 站／飞书视频 | `POST` | `/admin/content-media/external-videos` | 是 | 是 | `content:write` | [ExternalVideoCreate](02-data-models.md#externalvideocreate) | [MediaSummary](02-data-models.md#mediasummary) | 201 |
| [A113](#a113) | 上传私有 MP4 | `POST` | `/admin/content-media/videos` | 是 | 是 | `content:write` | — | [MediaSummary](02-data-models.md#mediasummary) | 201 |

### 参数与业务约束

<a id="a086"></a>
#### A086 查询分类列表

`GET /api/v1/admin/categories`

**实现状态：** 已实现

支持 CONTENT 和 PRODUCT；父子分类必须同域。被子分类、产品或内容引用时不可删除。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `scope` | string | 否 | 分类作用域；公共列表省略时默认 PRODUCT。 枚举: `CONTENT, PRODUCT` |
| query | `keyword` | string | 否 | 搜索标题／名称；去首尾空格，最长 100。 最长: `100` |

成功：HTTP `200`，`data` 为 [PageCategory](02-data-models.md#pagecategory)。

<a id="a087"></a>
#### A087 创建分类

`POST /api/v1/admin/categories`

**实现状态：** 已实现

支持 CONTENT 和 PRODUCT；父子分类必须同域。被子分类、产品或内容引用时不可删除。

请求体：[CategoryCreate](02-data-models.md#categorycreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [Category](02-data-models.md#category)。

<a id="a088"></a>
#### A088 查询分类详情

`GET /api/v1/admin/categories/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [Category](02-data-models.md#category)。

<a id="a089"></a>
#### A089 修改分类

`PATCH /api/v1/admin/categories/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[CategoryPatch](02-data-models.md#categorypatch)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [Category](02-data-models.md#category)。

<a id="a090"></a>
#### A090 删除分类

`DELETE /api/v1/admin/categories/{id}`

**实现状态：** 已实现

分类存在子分类或内容／产品引用时拒绝删除。产品分类管理也需 content:write（共享分类权限）。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 最小: `1` |

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a091"></a>
#### A091 查询科普／课程列表

`GET /api/v1/admin/contents`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `kind` | string | 否 | 内容类型；课程由章节组成。 枚举: `SCIENCE_VIDEO, SCIENCE_ARTICLE, VIDEO_COURSE, ARTICLE_COURSE` |
| query | `status` | string | 否 | 发布状态。 枚举: `DRAFT, PUBLISHED, OFFLINE` |
| query | `categoryId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `keyword` | string | 否 | 搜索标题／名称；去首尾空格，最长 100。 最长: `100` |
| query | `sort` | string | 否 | 白名单排序，默认 createdAt:desc；同值用 id 排序。 枚举: `createdAt:desc, createdAt:asc` |

成功：HTTP `200`，`data` 为 [PageAdminContent](02-data-models.md#pageadmincontent)。

<a id="a092"></a>
#### A092 创建科普／课程

`POST /api/v1/admin/contents`

**实现状态：** 已实现

请求体：[ContentCreate](02-data-models.md#contentcreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [AdminContent](02-data-models.md#admincontent)。

<a id="a093"></a>
#### A093 查询科普／课程详情

`GET /api/v1/admin/contents/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AdminContent](02-data-models.md#admincontent)。

<a id="a094"></a>
#### A094 修改科普／课程

`PATCH /api/v1/admin/contents/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[ContentPatch](02-data-models.md#contentpatch)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminContent](02-data-models.md#admincontent)。

<a id="a095"></a>
#### A095 删除科普／课程

`DELETE /api/v1/admin/contents/{id}`

**实现状态：** 已实现

只物理删除从未发布、没有章节、专栏、报价或订单引用的草稿；已发布内容保留历史，使用下架。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 最小: `1` |

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a096"></a>
#### A096 发布科普／课程

`POST /api/v1/admin/contents/{id}/publish`

**实现状态：** 已实现

发布前校验全部必填资料、启用分类和 READY 素材。下架停止新购买与公开发现，已有购买权益可从已购入口访问。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[VersionInput](02-data-models.md#versioninput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminContent](02-data-models.md#admincontent)。

<a id="a097"></a>
#### A097 下架科普／课程

`POST /api/v1/admin/contents/{id}/unpublish`

**实现状态：** 已实现

发布前校验全部必填资料、启用分类和 READY 素材。下架停止新购买与公开发现，已有购买权益可从已购入口访问。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[VersionInput](02-data-models.md#versioninput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminContent](02-data-models.md#admincontent)。

<a id="a098"></a>
#### A098 查询科普正文／视频引用

`GET /api/v1/admin/contents/{id}/body`

**实现状态：** 已实现

图文传 bodyHtml + imageMediaIds，视频只传 videoMediaId，不能混用。BILIBILI 仅可绑定 SCIENCE_VIDEO；FEISHU 仅可绑定 MEMBER 视频课程且 isPreview=false；LOCAL 保留。正文图片必须是 CONTENT_BODY_IMAGE 素材。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AdminBody](02-data-models.md#adminbody)。

<a id="a099"></a>
#### A099 替换科普正文／视频引用

`PUT /api/v1/admin/contents/{id}/body`

**实现状态：** 已实现

图文传 bodyHtml + imageMediaIds，视频只传 videoMediaId，不能混用。BILIBILI 仅可绑定 SCIENCE_VIDEO；FEISHU 仅可绑定 MEMBER 视频课程且 isPreview=false；LOCAL 保留。正文图片必须是 CONTENT_BODY_IMAGE 素材。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[ScienceBodyInput](02-data-models.md#sciencebodyinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminBody](02-data-models.md#adminbody)。

<a id="a100"></a>
#### A100 管理课程章节列表

`GET /api/v1/admin/courses/{id}/chapters`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `status` | string | 否 | 发布状态。 枚举: `DRAFT, PUBLISHED, OFFLINE` |

成功：HTTP `200`，`data` 为 [PageAdminChapter](02-data-models.md#pageadminchapter)。

<a id="a101"></a>
#### A101 创建课程章节草稿

`POST /api/v1/admin/courses/{id}/chapters`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[ChapterCreate](02-data-models.md#chaptercreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [AdminChapter](02-data-models.md#adminchapter)。

<a id="a102"></a>
#### A102 章节详情

`GET /api/v1/admin/chapters/{id}`

**实现状态：** 已实现

章节类型由课程继承。已发布或有购买关联的章节不可删除，可下架并保留已购访问。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AdminChapter](02-data-models.md#adminchapter)。

<a id="a103"></a>
#### A103 修改章节

`PATCH /api/v1/admin/chapters/{id}`

**实现状态：** 已实现

章节类型由课程继承。已发布或有购买关联的章节不可删除，可下架并保留已购访问。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[ChapterPatch](02-data-models.md#chapterpatch)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminChapter](02-data-models.md#adminchapter)。

<a id="a104"></a>
#### A104 删除未发布章节

`DELETE /api/v1/admin/chapters/{id}`

**实现状态：** 已实现

章节类型由课程继承。已发布或有购买关联的章节不可删除，可下架并保留已购访问。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 最小: `1` |

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a105"></a>
#### A105 查询章节正文／视频引用

`GET /api/v1/admin/chapters/{id}/body`

**实现状态：** 已实现

图文传 bodyHtml + imageMediaIds，视频只传 videoMediaId，不能混用。BILIBILI 仅可绑定 SCIENCE_VIDEO；FEISHU 仅可绑定 MEMBER 视频课程且 isPreview=false；LOCAL 保留。正文图片必须是 CONTENT_BODY_IMAGE 素材。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AdminBody](02-data-models.md#adminbody)。

<a id="a106"></a>
#### A106 替换章节正文／视频引用

`PUT /api/v1/admin/chapters/{id}/body`

**实现状态：** 已实现

图文传 bodyHtml + imageMediaIds，视频只传 videoMediaId，不能混用。BILIBILI 仅可绑定 SCIENCE_VIDEO；FEISHU 仅可绑定 MEMBER 视频课程且 isPreview=false；LOCAL 保留。正文图片必须是 CONTENT_BODY_IMAGE 素材。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[ScienceBodyInput](02-data-models.md#sciencebodyinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminBody](02-data-models.md#adminbody)。

<a id="a107"></a>
#### A107 发布课程章节

`POST /api/v1/admin/chapters/{id}/publish`

**实现状态：** 已实现

发布前校验全部必填资料、启用分类和 READY 素材。下架停止新购买与公开发现，已有购买权益可从已购入口访问。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[VersionInput](02-data-models.md#versioninput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminChapter](02-data-models.md#adminchapter)。

<a id="a108"></a>
#### A108 下架课程章节

`POST /api/v1/admin/chapters/{id}/unpublish`

**实现状态：** 已实现

下架最后一章时自动下架课程，并增加课程版本。已购用户可继续读取历史已发布章节；草稿始终不可见。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[VersionInput](02-data-models.md#versioninput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminChapter](02-data-models.md#adminchapter)。

<a id="a109"></a>
#### A109 预览科普视频（含草稿）

`GET /api/v1/admin/contents/{id}/playback`

**实现状态：** 已实现

仅科普视频且素材 READY；允许管理端预览 DRAFT／OFFLINE，不需要客户购买权益，操作审计。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [PlaybackGrant](02-data-models.md#playbackgrant)。

<a id="a110"></a>
#### A110 预览视频章节（含草稿）

`GET /api/v1/admin/chapters/{id}/playback`

**实现状态：** 已实现

仅 VIDEO 章节且素材 READY；允许管理员预览，签发短时授权并审计。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [PlaybackGrant](02-data-models.md#playbackgrant)。

<a id="a111"></a>
#### A111 登记公开内容图片

`POST /api/v1/admin/content-media/images`

**实现状态：** 已实现

请求体：[ContentImageCreate](02-data-models.md#contentimagecreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [MediaSummary](02-data-models.md#mediasummary)。

<a id="a112"></a>
#### A112 登记 B 站／飞书视频

`POST /api/v1/admin/content-media/external-videos`

**实现状态：** 已实现

只保存素材元数据与加密外部链接，响应不含 externalUrl/accessPassword；随后用返回 id 写入内容或章节 videoMediaId。需配置 CONTENT_MEDIA_ENCRYPTION_KEY。

请求体：[ExternalVideoCreate](02-data-models.md#externalvideocreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [MediaSummary](02-data-models.md#mediasummary)。

<a id="a113"></a>
#### A113 上传私有 MP4

`POST /api/v1/admin/content-media/videos`

**实现状态：** 已实现

请求 Content-Type: video/mp4，body 为原始文件字节，最大 100 MiB。保存在 CONTENT_MEDIA_DIR；视频 publicUrl 固定 null。须预先编码为浏览器兼容 MP4（建议 H.264/AAC），当前不转码。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `durationSeconds` | integer | 是 | 管理员填写的视频时长秒数。 最小: `1`；最大: `86400` |

成功：HTTP `201`，`data` 为 [MediaSummary](02-data-models.md#mediasummary)。


<a id="module-14"></a>
## 14 专栏管理

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A114](#a114) | 查询专栏列表 | `GET` | `/admin/columns` | 是 | 是 | `content:write` | — | [PageAdminColumn](02-data-models.md#pageadmincolumn) | 200 |
| [A115](#a115) | 创建专栏 | `POST` | `/admin/columns` | 是 | 是 | `content:write` | [ColumnCreate](02-data-models.md#columncreate) | [AdminColumn](02-data-models.md#admincolumn) | 201 |
| [A116](#a116) | 查询专栏详情 | `GET` | `/admin/columns/{id}` | 是 | 是 | `content:write` | — | [AdminColumn](02-data-models.md#admincolumn) | 200 |
| [A117](#a117) | 修改专栏 | `PATCH` | `/admin/columns/{id}` | 是 | 是 | `content:write` | [ColumnPatch](02-data-models.md#columnpatch) | [AdminColumn](02-data-models.md#admincolumn) | 200 |
| [A118](#a118) | 删除专栏 | `DELETE` | `/admin/columns/{id}` | 是 | 是 | `content:write` | — | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A119](#a119) | 发布专栏 | `POST` | `/admin/columns/{id}/publish` | 是 | 是 | `content:write` | [VersionInput](02-data-models.md#versioninput) | [AdminColumn](02-data-models.md#admincolumn) | 200 |
| [A120](#a120) | 下架专栏 | `POST` | `/admin/columns/{id}/unpublish` | 是 | 是 | `content:write` | [VersionInput](02-data-models.md#versioninput) | [AdminColumn](02-data-models.md#admincolumn) | 200 |
| [A121](#a121) | 专栏已关联内容 | `GET` | `/admin/columns/{id}/contents` | 是 | 是 | `content:write` | — | [PageAdminContent](02-data-models.md#pageadmincontent) | 200 |
| [A122](#a122) | 关联内容／修改专栏内排序 | `PUT` | `/admin/columns/{id}/contents/{contentId}` | 是 | 是 | `content:write` | [ColumnContentInput](02-data-models.md#columncontentinput) | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A123](#a123) | 移除专栏内内容关联 | `DELETE` | `/admin/columns/{id}/contents/{contentId}` | 是 | 是 | `content:write` | — | [ActionResult](02-data-models.md#actionresult) | 200 |

### 参数与业务约束

<a id="a114"></a>
#### A114 查询专栏列表

`GET /api/v1/admin/columns`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `status` | string | 否 | 发布状态。 枚举: `DRAFT, PUBLISHED, OFFLINE` |
| query | `keyword` | string | 否 | 搜索标题／名称；去首尾空格，最长 100。 最长: `100` |

成功：HTTP `200`，`data` 为 [PageAdminColumn](02-data-models.md#pageadmincolumn)。

<a id="a115"></a>
#### A115 创建专栏

`POST /api/v1/admin/columns`

**实现状态：** 已实现

请求体：[ColumnCreate](02-data-models.md#columncreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [AdminColumn](02-data-models.md#admincolumn)。

<a id="a116"></a>
#### A116 查询专栏详情

`GET /api/v1/admin/columns/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AdminColumn](02-data-models.md#admincolumn)。

<a id="a117"></a>
#### A117 修改专栏

`PATCH /api/v1/admin/columns/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[ColumnPatch](02-data-models.md#columnpatch)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminColumn](02-data-models.md#admincolumn)。

<a id="a118"></a>
#### A118 删除专栏

`DELETE /api/v1/admin/columns/{id}`

**实现状态：** 已实现

先下架专栏再删除；同时移除分组关联，内容、课程和购买权益保留。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 最小: `1` |

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a119"></a>
#### A119 发布专栏

`POST /api/v1/admin/columns/{id}/publish`

**实现状态：** 已实现

发布前校验全部必填资料、启用分类和 READY 素材。下架停止新购买与公开发现，已有购买权益可从已购入口访问。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[VersionInput](02-data-models.md#versioninput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminColumn](02-data-models.md#admincolumn)。

<a id="a120"></a>
#### A120 下架专栏

`POST /api/v1/admin/columns/{id}/unpublish`

**实现状态：** 已实现

发布前校验全部必填资料、启用分类和 READY 素材。下架停止新购买与公开发现，已有购买权益可从已购入口访问。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[VersionInput](02-data-models.md#versioninput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminColumn](02-data-models.md#admincolumn)。

<a id="a121"></a>
#### A121 专栏已关联内容

`GET /api/v1/admin/columns/{id}/contents`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `status` | string | 否 | 发布状态。 枚举: `DRAFT, PUBLISHED, OFFLINE` |
| query | `kind` | string | 否 | 内容类型；课程由章节组成。 枚举: `SCIENCE_VIDEO, SCIENCE_ARTICLE, VIDEO_COURSE, ARTICLE_COURSE` |

成功：HTTP `200`，`data` 为 [PageAdminContent](02-data-models.md#pageadmincontent)。

<a id="a122"></a>
#### A122 关联内容／修改专栏内排序

`PUT /api/v1/admin/columns/{id}/contents/{contentId}`

**实现状态：** 已实现

幂等 upsert；同一内容可属于多个专栏。不会修改内容自身发布状态或价格。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| path | `contentId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[ColumnContentInput](02-data-models.md#columncontentinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a123"></a>
#### A123 移除专栏内内容关联

`DELETE /api/v1/admin/columns/{id}/contents/{contentId}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| path | `contentId` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。


<a id="module-15"></a>
## 15 产品与库存管理

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A124](#a124) | 查询产品列表 | `GET` | `/admin/products` | 是 | 是 | `products:write` | — | [PageAdminProduct](02-data-models.md#pageadminproduct) | 200 |
| [A125](#a125) | 创建产品 | `POST` | `/admin/products` | 是 | 是 | `products:write` | [ProductCreate](02-data-models.md#productcreate) | [AdminProduct](02-data-models.md#adminproduct) | 201 |
| [A126](#a126) | 查询产品详情 | `GET` | `/admin/products/{id}` | 是 | 是 | `products:write` | — | [AdminProduct](02-data-models.md#adminproduct) | 200 |
| [A127](#a127) | 修改产品 | `PATCH` | `/admin/products/{id}` | 是 | 是 | `products:write` | [ProductPatch](02-data-models.md#productpatch) | [AdminProduct](02-data-models.md#adminproduct) | 200 |
| [A128](#a128) | 删除产品 | `DELETE` | `/admin/products/{id}` | 是 | 是 | `products:write` | — | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A129](#a129) | 发布产品 | `POST` | `/admin/products/{id}/publish` | 是 | 是 | `products:write` | [VersionInput](02-data-models.md#versioninput) | [AdminProduct](02-data-models.md#adminproduct) | 200 |
| [A130](#a130) | 下架产品 | `POST` | `/admin/products/{id}/unpublish` | 是 | 是 | `products:write` | [VersionInput](02-data-models.md#versioninput) | [AdminProduct](02-data-models.md#adminproduct) | 200 |
| [A131](#a131) | 产品全部 SKU | `GET` | `/admin/products/{id}/skus` | 是 | 是 | `products:write` | — | [PageAdminSku](02-data-models.md#pageadminsku) | 200 |
| [A132](#a132) | 创建 SKU | `POST` | `/admin/products/{id}/skus` | 是 | 是 | `products:write` | [SkuCreate](02-data-models.md#skucreate) | [AdminSku](02-data-models.md#adminsku) | 201 |
| [A133](#a133) | SKU 详情 | `GET` | `/admin/skus/{id}` | 是 | 是 | `products:write` | — | [AdminSku](02-data-models.md#adminsku) | 200 |
| [A134](#a134) | 修改 SKU | `PATCH` | `/admin/skus/{id}` | 是 | 是 | `products:write` | [SkuPatch](02-data-models.md#skupatch) | [AdminSku](02-data-models.md#adminsku) | 200 |
| [A135](#a135) | 删除未引用 SKU | `DELETE` | `/admin/skus/{id}` | 是 | 是 | `products:write` | — | [ActionResult](02-data-models.md#actionresult) | 200 |
| [A136](#a136) | 调整实物库存 | `POST` | `/admin/skus/{id}/stock-adjustments` | 是 | 是 | `products:write` | [StockAdjustmentInput](02-data-models.md#stockadjustmentinput) | [StockAdjustment](02-data-models.md#stockadjustment) | 201 |
| [A137](#a137) | 库存调整记录 | `GET` | `/admin/skus/{id}/stock-adjustments` | 是 | 是 | `products:write` | — | [PageStockAdjustment](02-data-models.md#pagestockadjustment) | 200 |
| [A138](#a138) | 登记公开产品图片 | `POST` | `/admin/product-images` | 是 | 是 | `products:write` | [ProductImageCreate](02-data-models.md#productimagecreate) | [MediaSummary](02-data-models.md#mediasummary) | 201 |

### 参数与业务约束

<a id="a124"></a>
#### A124 查询产品列表

`GET /api/v1/admin/products`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `status` | string | 否 | 发布状态。 枚举: `DRAFT, PUBLISHED, OFFLINE` |
| query | `categoryId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `keyword` | string | 否 | 搜索标题／名称；去首尾空格，最长 100。 最长: `100` |

成功：HTTP `200`，`data` 为 [PageAdminProduct](02-data-models.md#pageadminproduct)。

<a id="a125"></a>
#### A125 创建产品

`POST /api/v1/admin/products`

**实现状态：** 已实现

请求体：[ProductCreate](02-data-models.md#productcreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [AdminProduct](02-data-models.md#adminproduct)。

<a id="a126"></a>
#### A126 查询产品详情

`GET /api/v1/admin/products/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AdminProduct](02-data-models.md#adminproduct)。

<a id="a127"></a>
#### A127 修改产品

`PATCH /api/v1/admin/products/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[ProductPatch](02-data-models.md#productpatch)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminProduct](02-data-models.md#adminproduct)。

<a id="a128"></a>
#### A128 删除产品

`DELETE /api/v1/admin/products/{id}`

**实现状态：** 已实现

禁止删除有历史库存、报价或订单引用的 SKU；产品仅可删除无 SKU 的草稿。业务历史保留，已使用资源改为下架或停用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 最小: `1` |

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a129"></a>
#### A129 发布产品

`POST /api/v1/admin/products/{id}/publish`

**实现状态：** 已实现

发布前校验全部必填资料、启用分类和 READY 素材。下架停止新购买与公开发现，已有购买权益可从已购入口访问。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[VersionInput](02-data-models.md#versioninput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminProduct](02-data-models.md#adminproduct)。

<a id="a130"></a>
#### A130 下架产品

`POST /api/v1/admin/products/{id}/unpublish`

**实现状态：** 已实现

发布前校验全部必填资料、启用分类和 READY 素材。下架停止新购买与公开发现，已有购买权益可从已购入口访问。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[VersionInput](02-data-models.md#versioninput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminProduct](02-data-models.md#adminproduct)。

<a id="a131"></a>
#### A131 产品全部 SKU

`GET /api/v1/admin/products/{id}/skus`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |

成功：HTTP `200`，`data` 为 [PageAdminSku](02-data-models.md#pageadminsku)。

<a id="a132"></a>
#### A132 创建 SKU

`POST /api/v1/admin/products/{id}/skus`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[SkuCreate](02-data-models.md#skucreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [AdminSku](02-data-models.md#adminsku)。

<a id="a133"></a>
#### A133 SKU 详情

`GET /api/v1/admin/skus/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AdminSku](02-data-models.md#adminsku)。

<a id="a134"></a>
#### A134 修改 SKU

`PATCH /api/v1/admin/skus/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[SkuPatch](02-data-models.md#skupatch)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminSku](02-data-models.md#adminsku)。

<a id="a135"></a>
#### A135 删除未引用 SKU

`DELETE /api/v1/admin/skus/{id}`

**实现状态：** 已实现

禁止删除有历史库存、报价或订单引用的 SKU；产品仅可删除无 SKU 的草稿。业务历史保留，已使用资源改为下架或停用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `version` | integer | 是 | 乐观锁版本；写操作必须提交最近读取的版本。 最小: `1` |

成功：HTTP `200`，`data` 为 [ActionResult](02-data-models.md#actionresult)。

<a id="a136"></a>
#### A136 调整实物库存

`POST /api/v1/admin/skus/{id}/stock-adjustments`

**实现状态：** 已实现

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[StockAdjustmentInput](02-data-models.md#stockadjustmentinput)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [StockAdjustment](02-data-models.md#stockadjustment)。

<a id="a137"></a>
#### A137 库存调整记录

`GET /api/v1/admin/skus/{id}/stock-adjustments`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `createdFrom` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |
| query | `createdTo` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |

成功：HTTP `200`，`data` 为 [PageStockAdjustment](02-data-models.md#pagestockadjustment)。

<a id="a138"></a>
#### A138 登记公开产品图片

`POST /api/v1/admin/product-images`

**实现状态：** 已实现

请求体：[ProductImageCreate](02-data-models.md#productimagecreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [MediaSummary](02-data-models.md#mediasummary)。


<a id="module-16"></a>
## 16 订单、物流与售后管理

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A139](#a139) | 查询用户订单 | `GET` | `/admin/orders` | 是 | 是 | `orders:read` | — | [PageAdminOrderSummary](02-data-models.md#pageadminordersummary) | 200 |
| [A140](#a140) | 用户订单详情 | `GET` | `/admin/orders/{id}` | 是 | 是 | `orders:read` | — | [AdminOrder](02-data-models.md#adminorder) | 200 |
| [A141](#a141) | 查询订单物流 | `GET` | `/admin/orders/{id}/logistics` | 是 | 是 | `orders:read` | — | [LogisticsResult](02-data-models.md#logisticsresult) | 200 |
| [A142](#a142) | 订单发货 | `POST` | `/admin/orders/{id}/shipment` | 是 | 是 | `orders:ship` | [ShipmentCreate](02-data-models.md#shipmentcreate) | [Shipment](02-data-models.md#shipment) | 201 |
| [A143](#a143) | 纠正出库物流单号 | `PATCH` | `/admin/shipments/{id}` | 是 | 是 | `orders:ship` | [ShipmentPatch](02-data-models.md#shipmentpatch) | [Shipment](02-data-models.md#shipment) | 200 |
| [A144](#a144) | 查询用户售后 | `GET` | `/admin/aftersales` | 是 | 是 | `aftersales:review` | — | [PageAfterSale](02-data-models.md#pageaftersale) | 200 |
| [A145](#a145) | 用户售后详情 | `GET` | `/admin/aftersales/{id}` | 是 | 是 | `aftersales:review` | — | [AfterSale](02-data-models.md#aftersale) | 200 |
| [A146](#a146) | 批准／驳回售后 | `POST` | `/admin/aftersales/{id}/review` | 是 | 是 | `aftersales:review` | [AfterSaleReview](02-data-models.md#aftersalereview) | [AfterSale](02-data-models.md#aftersale) | 200 |
| [A147](#a147) | 验收退货并退款 | `POST` | `/admin/aftersales/{id}/confirm-return` | 是 | 是 | `aftersales:review` | [ReturnReceiptInput](02-data-models.md#returnreceiptinput) | [AfterSale](02-data-models.md#aftersale) | 200 |
| [A148](#a148) | 重试失败退款 | `POST` | `/admin/aftersales/{id}/retry-refund` | 是 | 是 | `aftersales:review` | [VersionInput](02-data-models.md#versioninput) | [AfterSale](02-data-models.md#aftersale) | 200 |
| [A149](#a149) | 查询退款流水 | `GET` | `/admin/refunds` | 是 | 是 | `aftersales:review` | — | [PageRefund](02-data-models.md#pagerefund) | 200 |
| [A150](#a150) | 数字订单人工全额退款 | `POST` | `/admin/orders/{id}/digital-refund` | 是 | 是 | `aftersales:review` | [DigitalRefundInput](02-data-models.md#digitalrefundinput) | [Refund](02-data-models.md#refund) | 202 |
| [A151](#a151) | 测试确认订单付款 | `POST` | `/admin/orders/{id}/test-payment` | 是 | 是 | `payments:test` | [TestPaymentInput](02-data-models.md#testpaymentinput) | [AdminOrder](02-data-models.md#adminorder) | 200 |
| [A152](#a152) | 测试确认退款结果 | `POST` | `/admin/refunds/{id}/test-result` | 是 | 是 | `payments:test` | [TestRefundInput](02-data-models.md#testrefundinput) | [Refund](02-data-models.md#refund) | 200 |
| [A153](#a153) | 登记人工物流轨迹 | `POST` | `/admin/shipments/{id}/events` | 是 | 是 | `orders:ship` | [ManualLogisticsInput](02-data-models.md#manuallogisticsinput) | [Shipment](02-data-models.md#shipment) | 200 |
| [A154](#a154) | 交易审计日志 | `GET` | `/admin/commerce-audit-logs` | 是 | 是 | `audit:read` | — | [PageCommerceAuditLog](02-data-models.md#pagecommerceauditlog) | 200 |

### 参数与业务约束

<a id="a139"></a>
#### A139 查询用户订单

`GET /api/v1/admin/orders`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `userId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `orderNo` | string | 否 | 精确订单号。  |
| query | `type` | string | 否 | 一种订单只允许一种业务类型。 枚举: `PRODUCT, COURSE, MEMBERSHIP` |
| query | `status` | string | 否 | 履约状态；支付与售后另有独立字段。 枚举: `PENDING_PAYMENT, PENDING_SHIPMENT, PENDING_RECEIPT, COMPLETED, CANCELLED, CLOSED` |
| query | `paymentStatus` | string | 否 | 订单汇总支付状态。 枚举: `UNPAID, PAID, PARTIALLY_REFUNDED, REFUNDED` |
| query | `createdFrom` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |
| query | `createdTo` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |
| query | `sort` | string | 否 | 白名单排序，默认 createdAt:desc；同值用 id 排序。 枚举: `createdAt:desc, createdAt:asc` |
| query | `afterSaleStatus` | string | 否 | 售后汇总。 枚举: `NONE, PROCESSING, PARTIALLY_COMPLETED, COMPLETED` |

成功：HTTP `200`，`data` 为 [PageAdminOrderSummary](02-data-models.md#pageadminordersummary)。

<a id="a140"></a>
#### A140 用户订单详情

`GET /api/v1/admin/orders/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AdminOrder](02-data-models.md#adminorder)。

<a id="a141"></a>
#### A141 查询订单物流

`GET /api/v1/admin/orders/{id}/logistics`

**实现状态：** 已实现

未发货返回空包裹；已发货返回人工登记物流，syncStatus=MANUAL，lastSyncedAt=null。尚未接入第三方快递查询。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [LogisticsResult](02-data-models.md#logisticsresult)。

<a id="a142"></a>
#### A142 订单发货

`POST /api/v1/admin/orders/{id}/shipment`

**实现状态：** 已实现

仅 PENDING_SHIPMENT 且不存在活跃售后／退款；一期一单一包裹，所有剩余未退款行一次发出。使用行锁与售后申请互斥，防止边退款边发货。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[ShipmentCreate](02-data-models.md#shipmentcreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [Shipment](02-data-models.md#shipment)。

<a id="a143"></a>
#### A143 纠正出库物流单号

`PATCH /api/v1/admin/shipments/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[ShipmentPatch](02-data-models.md#shipmentpatch)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [Shipment](02-data-models.md#shipment)。

<a id="a144"></a>
#### A144 查询用户售后

`GET /api/v1/admin/aftersales`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `status` | string | 否 | 售后状态。 枚举: `PENDING_REVIEW, AWAITING_RETURN, RETURNING, REFUNDING, REFUND_FAILED, COMPLETED, REJECTED, CANCELLED, CLOSED` |
| query | `orderId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `userId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `createdFrom` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |
| query | `createdTo` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |

成功：HTTP `200`，`data` 为 [PageAfterSale](02-data-models.md#pageaftersale)。

<a id="a145"></a>
#### A145 用户售后详情

`GET /api/v1/admin/aftersales/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AfterSale](02-data-models.md#aftersale)。

<a id="a146"></a>
#### A146 批准／驳回售后

`POST /api/v1/admin/aftersales/{id}/review`

**实现状态：** 已实现

仅 PENDING_REVIEW；REFUND_ONLY 批准后异步退款；RETURN_REFUND 批准后返回退货地址和期限。驳回释放冻结额度。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[AfterSaleReview](02-data-models.md#aftersalereview)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AfterSale](02-data-models.md#aftersale)。

<a id="a147"></a>
#### A147 验收退货并退款

`POST /api/v1/admin/aftersales/{id}/confirm-return`

**实现状态：** 已实现

仅 RETURNING；验收写入审计后转 REFUNDING。退件验收不会自动重新入可售库存；质检后另做入库。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[ReturnReceiptInput](02-data-models.md#returnreceiptinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AfterSale](02-data-models.md#aftersale)。

<a id="a148"></a>
#### A148 重试失败退款

`POST /api/v1/admin/aftersales/{id}/retry-refund`

**实现状态：** 已实现

仅 REFUND_FAILED，重用原 refund.id。当前 TEST 支付不调用外部渠道；接入真实退款时必须先查单。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[VersionInput](02-data-models.md#versioninput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AfterSale](02-data-models.md#aftersale)。

<a id="a149"></a>
#### A149 查询退款流水

`GET /api/v1/admin/refunds`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `orderId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `status` | string | 否 | 退款状态。 枚举: `PENDING, PROCESSING, SUCCEEDED, FAILED` |
| query | `createdFrom` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |
| query | `createdTo` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |

成功：HTTP `200`，`data` 为 [PageRefund](02-data-models.md#pagerefund)。

<a id="a150"></a>
#### A150 数字订单人工全额退款

`POST /api/v1/admin/orders/{id}/digital-refund`

**实现状态：** 已实现

COURSE 或 MEMBERSHIP 全额退款。会员只允许未来尚未开始的完整段：目标转 REFUND_PENDING，其他未来付费段转 SUSPENDED；已开始段继续。处理中阻止会员结算与手工改期。成功撤销目标并按完整时长整理后续段；失败恢复。已开始或已过期段返回 MEMBERSHIP_REFUND_NOT_ALLOWED。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[DigitalRefundInput](02-data-models.md#digitalrefundinput)，完整字段及必填规则见对应对象。

成功：HTTP `202`，`data` 为 [Refund](02-data-models.md#refund)。

<a id="a151"></a>
#### A151 测试确认订单付款

`POST /api/v1/admin/orders/{id}/test-payment`

**实现状态：** 已实现

仅测试环境且显式开启测试支付。会员付款、订单 COMPLETED 和权益段追加在同一事务完成；从 max(now,未撤销手工期限,现有付费段结束) 开始，不提前生效未来方案。方案修改不改已下单条款，停用阻止结算。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[TestPaymentInput](02-data-models.md#testpaymentinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminOrder](02-data-models.md#adminorder)。

<a id="a152"></a>
#### A152 测试确认退款结果

`POST /api/v1/admin/refunds/{id}/test-result`

**实现状态：** 已实现

仅 TEST 支付；数字订单 version 为退款流水版本，产品售后为售后单版本。会员成功撤销目标段并整理其余未来段；失败恢复，重试须目标仍未开始。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[TestRefundInput](02-data-models.md#testrefundinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [Refund](02-data-models.md#refund)。

<a id="a153"></a>
#### A153 登记人工物流轨迹

`POST /api/v1/admin/shipments/{id}/events`

**实现状态：** 已实现

必须遵守物流状态顺序，时间不得早于发货或已有最新事件。签收不等于用户确认收货；人工记录不更新 lastSyncedAt。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[ManualLogisticsInput](02-data-models.md#manuallogisticsinput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [Shipment](02-data-models.md#shipment)。

<a id="a154"></a>
#### A154 交易审计日志

`GET /api/v1/admin/commerce-audit-logs`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |

成功：HTTP `200`，`data` 为 [PageCommerceAuditLog](02-data-models.md#pagecommerceauditlog)。


<a id="module-17"></a>
## 17 用户与会员管理

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A155](#a155) | 查询用户及会员状态 | `GET` | `/admin/users` | 是 | 是 | `users:read` | — | [PageAdminUser](02-data-models.md#pageadminuser) | 200 |
| [A156](#a156) | 用户详情及会员信息 | `GET` | `/admin/users/{id}` | 是 | 是 | `users:read` | — | [AdminUser](02-data-models.md#adminuser) | 200 |
| [A157](#a157) | 用户会员权益详情 | `GET` | `/admin/users/{id}/membership` | 是 | 是 | `membership:write` | — | [MembershipDetail](02-data-models.md#membershipdetail) | 200 |
| [A158](#a158) | 封禁用户 | `POST` | `/admin/users/{id}/ban` | 是 | 是 | `users:ban` | [UserBanInput](02-data-models.md#userbaninput) | [AdminUser](02-data-models.md#adminuser) | 200 |
| [A159](#a159) | 解除用户封禁 | `POST` | `/admin/users/{id}/unban` | 是 | 是 | `users:ban` | [UserUnbanInput](02-data-models.md#userunbaninput) | [AdminUser](02-data-models.md#adminuser) | 200 |
| [A160](#a160) | 管理会员方案 | `GET` | `/admin/membership-plans` | 是 | 是 | `membership:write` | — | [PageAdminMembershipPlan](02-data-models.md#pageadminmembershipplan) | 200 |
| [A161](#a161) | 创建会员方案（停用） | `POST` | `/admin/membership-plans` | 是 | 是 | `membership:write` | [MembershipPlanCreate](02-data-models.md#membershipplancreate) | [AdminMembershipPlan](02-data-models.md#adminmembershipplan) | 201 |
| [A162](#a162) | 会员方案详情 | `GET` | `/admin/membership-plans/{id}` | 是 | 是 | `membership:write` | — | [AdminMembershipPlan](02-data-models.md#adminmembershipplan) | 200 |
| [A163](#a163) | 修改／启停会员方案 | `PATCH` | `/admin/membership-plans/{id}` | 是 | 是 | `membership:write` | [MembershipPlanPatch](02-data-models.md#membershipplanpatch) | [AdminMembershipPlan](02-data-models.md#adminmembershipplan) | 200 |
| [A164](#a164) | 开通／续期网站会员 | `PUT` | `/admin/users/{id}/membership` | 是 | 是 | `membership:write` | [MembershipWrite](02-data-models.md#membershipwrite) | [MembershipDetail](02-data-models.md#membershipdetail) | 200 |
| [A165](#a165) | 撤销网站会员 | `POST` | `/admin/users/{id}/membership/revoke` | 是 | 是 | `membership:write` | [MembershipRevoke](02-data-models.md#membershiprevoke) | [MembershipDetail](02-data-models.md#membershipdetail) | 200 |
| [A166](#a166) | 用户会员购买权益段 | `GET` | `/admin/users/{id}/membership/periods` | 是 | 是 | `membership:write` | — | [PageMembershipPeriod](02-data-models.md#pagemembershipperiod) | 200 |

### 参数与业务约束

<a id="a155"></a>
#### A155 查询用户及会员状态

`GET /api/v1/admin/users`

**实现状态：** 已实现

按 createdAt,id 降序；手机号精确匹配，响应仍脱敏；搜索值不写入审计。createdFrom/createdTo 均包含边界，from<=to。仅允许列出的筛选字段。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `keyword` | string | 否 | 昵称字面子串；% 和 _ 不作为通配符。 最短: `1`；最长: `64` |
| query | `phone` | string | 否 | E.164 手机号；默认支持 +86，其他地区由短信配置决定。 正则: `^\+[1-9]\d{7,14}$` |
| query | `status` | string | 否 | 账号状态。 枚举: `ACTIVE, BANNED, DEACTIVATED` |
| query | `hasMembership` | boolean | 否 | 按当前时间及账号状态过滤有效会员。  |
| query | `createdFrom` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |
| query | `createdTo` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |

成功：HTTP `200`，`data` 为 [PageAdminUser](02-data-models.md#pageadminuser)。

<a id="a156"></a>
#### A156 用户详情及会员信息

`GET /api/v1/admin/users/{id}`

**实现状态：** 已实现

返回脱敏用户资料和即时会员摘要，读取记录审计。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AdminUser](02-data-models.md#adminuser)。

<a id="a157"></a>
#### A157 用户会员权益详情

`GET /api/v1/admin/users/{id}/membership`

**实现状态：** 已实现

有效账号且管理员期限或 ACTIVE 购买权益段覆盖当前时间才 active=true；只覆盖 MEMBER 内容。membership 字段专指手工期限，购买明细见 /membership/periods。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [MembershipDetail](02-data-models.md#membershipdetail)。

<a id="a158"></a>
#### A158 封禁用户

`POST /api/v1/admin/users/{id}/ban`

**实现状态：** 已实现

须 users:ban、最新 version 和 Idempotency-Key；封禁立即撤销全部客户端会话，解封后重新登录。保留订单及会员期限，封禁期间管理员仍可退款；会员计时不暂停。不支持 until。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[UserBanInput](02-data-models.md#userbaninput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminUser](02-data-models.md#adminuser)。

<a id="a159"></a>
#### A159 解除用户封禁

`POST /api/v1/admin/users/{id}/unban`

**实现状态：** 已实现

须 users:ban、最新 version 和 Idempotency-Key；封禁立即撤销全部客户端会话，解封后重新登录。保留订单及会员期限，封禁期间管理员仍可退款；会员计时不暂停。不支持 until。

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[UserUnbanInput](02-data-models.md#userunbaninput)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminUser](02-data-models.md#adminuser)。

<a id="a160"></a>
#### A160 管理会员方案

`GET /api/v1/admin/membership-plans`

**实现状态：** 已实现

按 sortOrder 升序、createdAt 降序、id 升序；公共接口只显示启用方案。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `keyword` | string | 否 | 方案名称子串。 最短: `1`；最长: `64` |
| query | `enabled` | boolean | 否 | 启用状态。  |

成功：HTTP `200`，`data` 为 [PageAdminMembershipPlan](02-data-models.md#pageadminmembershipplan)。

<a id="a161"></a>
#### A161 创建会员方案（停用）

`POST /api/v1/admin/membership-plans`

**实现状态：** 已实现

请求体：[MembershipPlanCreate](02-data-models.md#membershipplancreate)，完整字段及必填规则见对应对象。

成功：HTTP `201`，`data` 为 [AdminMembershipPlan](02-data-models.md#adminmembershipplan)。

<a id="a162"></a>
#### A162 会员方案详情

`GET /api/v1/admin/membership-plans/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [AdminMembershipPlan](02-data-models.md#adminmembershipplan)。

<a id="a163"></a>
#### A163 修改／启停会员方案

`PATCH /api/v1/admin/membership-plans/{id}`

**实现状态：** 已实现

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[MembershipPlanPatch](02-data-models.md#membershipplanpatch)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [AdminMembershipPlan](02-data-models.md#adminmembershipplan)。

<a id="a164"></a>
#### A164 开通／续期网站会员

`PUT /api/v1/admin/users/{id}/membership`

**实现状态：** 已实现

首次 version=0；续期先读取当前记录，再设置完整起止时间和 version。用户、会员记录与管理员权限在事务内校验；乐观锁避免覆盖并发更新。此操作不创建订单或收款。 存在未到期 ACTIVE 付费段或退款中段时返回 MEMBERSHIP_PAID_TERM_EXISTS，防止覆盖已付费时长。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[MembershipWrite](02-data-models.md#membershipwrite)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [MembershipDetail](02-data-models.md#membershipdetail)。

<a id="a165"></a>
#### A165 撤销网站会员

`POST /api/v1/admin/users/{id}/membership/revoke`

**实现状态：** 已实现

只撤销手工期限，存在未到期付费段或退款中段则返回 MEMBERSHIP_PAID_TERM_EXISTS；付费段通过订单退款维护。会员内容访问每次重查资格。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

请求体：[MembershipRevoke](02-data-models.md#membershiprevoke)，完整字段及必填规则见对应对象。

成功：HTTP `200`，`data` 为 [MembershipDetail](02-data-models.md#membershipdetail)。

<a id="a166"></a>
#### A166 用户会员购买权益段

`GET /api/v1/admin/users/{id}/membership/periods`

**实现状态：** 已实现

分页读取指定用户权益段，按 createdAt 降序、id 升序，读取审计；无用户返回 404。

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |

成功：HTTP `200`，`data` 为 [PageMembershipPeriod](02-data-models.md#pagemembershipperiod)。


<a id="module-18"></a>
## 18 站内通知与审计管理

| 编号 | 接口名称 | 方法 | URL | 是否登录 | 是否管理员 | 额外权限 | 请求体 | 成功 data | HTTP |
|---|---|---|---|---|---|---|---|---|---|
| [A167](#a167) | 通知任务列表 | `GET` | `/admin/notification-tasks` | 是 | 是 | `notifications:write` | — | [PageNotificationTask](02-data-models.md#pagenotificationtask) | 200 |
| [A168](#a168) | 创建站内通知任务 | `POST` | `/admin/notification-tasks` | 是 | 是 | `notifications:write` | [NotificationTaskInput](02-data-models.md#notificationtaskinput) | [NotificationTask](02-data-models.md#notificationtask) | 202 |
| [A169](#a169) | 通知投递结果 | `GET` | `/admin/notification-tasks/{id}` | 是 | 是 | `notifications:write` | — | [NotificationTask](02-data-models.md#notificationtask) | 200 |
| [A170](#a170) | 操作审计查询 | `GET` | `/admin/audit-logs` | 是 | 是 | `audit:read` | — | [PageAuditLog](02-data-models.md#pageauditlog) | 200 |

### 参数与业务约束

<a id="a167"></a>
#### A167 通知任务列表

`GET /api/v1/admin/notification-tasks`

**实现状态：** 设计中（尚未实现）

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |

成功：HTTP `200`，`data` 为 [PageNotificationTask](02-data-models.md#pagenotificationtask)。

<a id="a168"></a>
#### A168 创建站内通知任务

`POST /api/v1/admin/notification-tasks`

**实现状态：** 设计中（尚未实现）

**必填请求头：** `Idempotency-Key`，16–64 位字母、数字、下划线或连字符；相同业务意图重试复用。

请求体：[NotificationTaskInput](02-data-models.md#notificationtaskinput)，完整字段及必填规则见对应对象。

成功：HTTP `202`，`data` 为 [NotificationTask](02-data-models.md#notificationtask)。

<a id="a169"></a>
#### A169 通知投递结果

`GET /api/v1/admin/notification-tasks/{id}`

**实现状态：** 设计中（尚未实现）

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| path | `id` | string | 是 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |

成功：HTTP `200`，`data` 为 [NotificationTask](02-data-models.md#notificationtask)。

<a id="a170"></a>
#### A170 操作审计查询

`GET /api/v1/admin/audit-logs`

**实现状态：** 设计中（尚未实现）

| 位置 | 名称 | 类型 | 必填 | 说明与约束 |
|---|---|---|---|---|
| query | `page` | integer | 否 | 页码，默认 1。 最小: `1`；默认: `1` |
| query | `pageSize` | integer | 否 | 每页条数，默认 20，最多 100。 最小: `1`；最大: `100`；默认: `20` |
| query | `actorId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `action` | string | 否 | 操作名。 最长: `64` |
| query | `resourceId` | string | 否 | 不透明业务 ID；前端必须按字符串保存。 最短: `1`；最长: `64`；正则: `^[A-Za-z0-9_-]{1,64}$` |
| query | `createdFrom` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |
| query | `createdTo` | string | 否 | UTC 时间，ISO 8601；界面按 Asia/Shanghai 展示。 格式: `date-time` |

成功：HTTP `200`，`data` 为 [PageAuditLog](02-data-models.md#pageauditlog)。

## 通用失败响应

所有平台 JSON API 失败返回 [ErrorResponse](02-data-models.md#errorresponse)。HTTP 状态与业务码对应如下；鉴权、参数校验、依赖失败等均按此约定。

| HTTP | code | 含义 | 前端处理 |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | DTO、Query 或 Path 参数不合法 | 根据 error.details 标记字段 |
| 400 | `SMS_CODE_INVALID` | 验证码无效、过期、用途不符或超过尝试次数 | 重新获取对应用途验证码 |
| 400 | `MEDIA_NOT_READY` | 素材未完成处理或用途／类型不匹配 | 轮询素材状态或重新上传 |
| 401 | `AUTH_REQUIRED` | 缺少登录令牌 | 进入登录 |
| 401 | `AUTH_INVALID_CREDENTIALS` | 账号或密码错误 | 统一提示，避免账号枚举 |
| 401 | `TOKEN_EXPIRED` | 访问令牌过期 | 单飞刷新后最多重放一次 |
| 401 | `TOKEN_INVALID` | 令牌错误、会话撤销或 audience 不符 | 清理对应端会话 |
| 401 | `MEDIA_GRANT_INVALID` | 私有凭证授权过期、会话已撤销或管理员权限不足 | 重新登录并申请读取授权 |
| 401 | `REFRESH_TOKEN_INVALID` | 刷新令牌无效或过期 | 重新登录 |
| 401 | `REFRESH_TOKEN_REUSED` | 已轮换刷新令牌被重放 | 撤销该会话链并重新登录 |
| 403 | `ACCOUNT_BANNED` | 账号封禁中 | 显示封禁提示，停止刷新 |
| 403 | `ADMIN_REQUIRED` | 管理接口使用了客户端身份 | 使用管理员登录 |
| 403 | `PERMISSION_DENIED` | 缺少指定管理权限 | 隐藏相应操作 |
| 403 | `CONTENT_ACCESS_DENIED` | 未购买且无适用会员权益 | 显示购买／会员入口 |
| 404 | `RESOURCE_NOT_FOUND` | 不存在、不可见或不属于当前用户 | 统一显示资源不可用 |
| 409 | `PHONE_ALREADY_REGISTERED` | 注册手机号已存在 | 引导登录或重置密码 |
| 409 | `PROTOCOL_VERSION_CHANGED` | 提交的协议版本已更新 | 重新展示当前协议再提交 |
| 409 | `VERSION_CONFLICT` | 资源已被他人更新 | 重取详情，展示最新状态 |
| 409 | `IDEMPOTENCY_CONFLICT` | 同幂等键对应不同请求内容 | 为新的业务意图生成新键 |
| 409 | `IDEMPOTENCY_IN_PROGRESS` | 同幂等操作仍处理中 | 按 Retry-After 用同键重试 |
| 409 | `QUOTE_EXPIRED` | 试算已过期 | 重新试算并让用户确认新金额 |
| 409 | `OUT_OF_STOCK` | 库存不足 | 重取产品与库存 |
| 409 | `RESOURCE_NOT_SELLABLE` | 产品、SKU、课程或会员方案已停售 | 重取资源 |
| 409 | `COURSE_ALREADY_PURCHASED` | 已有该课程有效独立购买权益 | 直接进入已购课程 |
| 409 | `ORDER_STATE_INVALID` | 订单当前状态不允许该操作 | 重取订单和 actions |
| 409 | `PAYMENT_EXPIRED` | 订单或支付尝试已过期 | 重取订单，必要时重新下单 |
| 409 | `AFTERSALE_NOT_ELIGIBLE` | 申请时间、订单类型或状态不符合规则 | 重取售后资格 |
| 409 | `AFTERSALE_IN_PROGRESS` | 同一订单存在另一张活跃售后单 | 先完成或撤销原申请 |
| 409 | `AFTERSALE_QUANTITY_EXCEEDED` | 申请数量已被其他售后占用或已退款 | 重取订单和售后 |
| 409 | `AFTERSALE_STATE_INVALID` | 售后状态不允许该操作 | 重取售后 |
| 409 | `DIGITAL_REFUND_NOT_ELIGIBLE` | 不是可退款的数字订单或会员权益段已开始 | 转人工核对业务政策 |
| 409 | `RESOURCE_IN_USE` | 素材、分类或其他对象仍被引用 | 先处理引用／下架 |
| 409 | `MEDIA_IN_USE` | 上传素材被当前业务或历史记录引用，或凭证已关联售后 | 保留历史引用；为新售后重新上传 |
| 409 | `MEDIA_UNAVAILABLE` | 媒体尚未 READY、已删除或用途不匹配 | 选择本人正确用途且已完成的媒体 |
| 409 | `UPLOAD_NOT_RECEIVED` | OSS 尚无该次上传对象 | 先完成 OSS 表单上传再确认 |
| 409 | `UPLOAD_EXPIRED` | 上传票据已过期 | 重新申请上传 |
| 409 | `UPLOAD_STATE_INVALID` | 已失败或已删除的上传不能完成确认 | 重新申请上传 |
| 409 | `UPLOAD_OBJECT_CHANGED` | 校验和复制期间对象变化或目标冲突 | 重新申请上传 |
| 409 | `STOCK_CONFLICT` | 库存调整会使实物库存低于预占 | 重取库存与版本 |
| 409 | `AI_GENERATION_IN_PROGRESS` | 会话存在活跃生成任务 | 等待完成或取消 |
| 410 | `STREAM_CURSOR_EXPIRED` | SSE 重放窗口已过期 | 读取任务和历史消息恢复 |
| 413 | `PAYLOAD_TOO_LARGE` | 请求体或文件超过限制 | 减小正文或文件 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 文件实际类型不受支持 | 更换允许的格式 |
| 422 | `UPLOAD_OBJECT_INVALID` | 实际大小、MIME 或文件特征不符合申请 | 该上传标记失败；检查文件后重新申请 |
| 429 | `RATE_LIMITED` | 短信、登录、支付补查等请求过频 | 遵循 Retry-After |
| 429 | `UPLOAD_LIMIT_EXCEEDED` | 有效待完成票据或滚动 24 小时上传次数达到上限 | 完成已有上传或等待额度恢复 |
| 429 | `AI_QUOTA_EXCEEDED` | 今日问答次数不足 | 展示额度与恢复时间 |
| 500 | `INTERNAL_ERROR` | 服务端未预期错误 | 携带 requestId 联系支持 |
| 503 | `DEPENDENCY_UNAVAILABLE` | 短信、存储、支付等依赖暂不可用 | 幂等写入使用同键重试 |
| 503 | `STORAGE_UNAVAILABLE` | OSS 未配置、Bucket 安全检查失败或存储暂不可用 | 配置凭证与公私 Bucket，核对权限或稍后重试 |
| 503 | `AI_PROVIDER_UNAVAILABLE` | 模型供应商暂不可用 | 提示稍后再试；检查额度归还 |

例外：SSE 在建立前返回统一 JSON 错误，建立后通过 `event: error` 报错；支付渠道回调按渠道 ACK 协议回应。对象存储直传响应也不属于平台 JSON API。

