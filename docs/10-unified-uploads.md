# 统一文件上传与私有售后凭证

更新：2026-10-26，接口契约版本 `1.6.0`。后端提供 OSS 表单直传、完成校验、素材查询与删除，以及私有售后凭证授权读取。头像、产品、内容、专栏和售后继续引用媒体 ID；课程视频仍通过既有购买／会员权限控制播放。

**当前服务器尚未配置 OSS 凭证、ECS RAM 角色或私有 Bucket。** 统一上传代码与对象存储配置是两项条件：配置齐全后才能签发真实上传表单；配置缺失或存储不可用返回 `503 STORAGE_UNAVAILABLE`。现有公开图片地址登记、B 站／飞书外链和本地视频不依赖本次 OSS 上传配置，仍可使用。

接口前缀为 `/api/v1`。完整字段见 [数据格式](02-data-models.md)，可导入 [已实现 OpenAPI](openapi-implemented.json)，操作示例见 [uploads.http](../examples/uploads.http)。

## 文件用途、权限与存储位置

| purpose | 申请者 | 文件限制 | 完成后的可见性 |
|---|---|---|---|
| `AVATAR` | 普通用户本人 | JPEG／PNG／WebP，最大 10 MiB | 公开图片；只能绑定本人头像 |
| `AFTERSALE_EVIDENCE` | 普通用户本人 | JPEG／PNG／WebP，最大 10 MiB | 始终私有；授权读取 |
| `PRODUCT_IMAGE` | 管理员，`media:write` + `products:write` | JPEG／PNG／WebP，最大 10 MiB | 公开图片；可作产品封面／图库 |
| `CONTENT_COVER` | 管理员，`media:write` + `content:write` | JPEG／PNG／WebP，最大 10 MiB | 公开内容封面 |
| `COLUMN_COVER` | 管理员，`media:write` + `content:write` | JPEG／PNG／WebP，最大 10 MiB | 公开专栏封面 |
| `CONTENT_BODY_IMAGE` | 管理员，`media:write` + `content:write` | JPEG／PNG／WebP，最大 10 MiB | 公开正文图片 |
| `CONTENT_VIDEO` | 管理员，`media:write` + `content:write` | MP4，最大 100 MiB | 私有视频；已有内容播放授权 |

普通用户令牌不能上传后台用途素材。客户端和管理端使用独立登录令牌；不能通过修改请求中的用途获得另一端权限。后台用途的查询、确认和删除同样检查对应管理权限。公开图片地址可直接访问，私有凭证及视频的 `publicUrl` 固定为 `null`。

新上传全部先进入**私有 Bucket 的临时区域**。即使最终用途是公开头像或封面，也必须完成服务端校验与复制后才有公开 URL。临时上传授权不能写入最终对象位置；完成后的公开或私有文件不会被旧表单覆盖。

## 前端上传顺序

1. 登录后 `POST /uploads`，提交 `purpose`、`fileName`、`mimeType`、精确的 `sizeBytes`。视频可提供 `durationSeconds`（0–86400，省略默认为 0，表示未知）；图片不得携带该字段。
2. 收到 `uploadId`、`mediaId`、`method=POST`、`uploadUrl`、`fields`、`expiresAt`。两个 ID 相同，表单有效 10 分钟。
3. 新建 `FormData`，先添加返回的所有 `fields`，最后添加 `file`。直接 POST 到返回的 OSS `uploadUrl`，让浏览器生成 multipart 边界，不手动设置整个请求的 `Content-Type`。
4. OSS 上传成功后，调用 `POST /uploads/{uploadId}/complete`，无需请求体。OSS 上传响应不使用平台 JSON 格式；平台完成接口才返回统一响应。
5. 完成接口返回 `READY` 后，将 `mediaId` 写入头像、产品、内容、章节或售后。上传本身不改变业务对象。

```javascript
// ticket 为 POST /uploads 返回的 data；file 为用户选中的 File。
const form = new FormData();
for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
form.append('file', file);
const upload = await fetch(ticket.uploadUrl, { method: ticket.method, body: form });
if (!upload.ok) throw new Error('OSS 上传失败');
// 然后使用同一账户登录令牌调用平台的 complete 接口。
```

文件名用于显示，不能包含路径分隔符或控制字符，不决定存储 key。OSS 策略约束固定对象路径、类型、精确大小与有效期。完成时后端检查对象 HEAD 的大小、MIME 和文件特征，并使用 ETag 条件复制，拒绝校验期间被替换的对象。复制完成后才登记业务可用的素材；服务端不对 MP4 转码，管理员应提供浏览器可播放的编码。

`GET /media/{id}` 查询本人可管理的素材状态；管理员可按用途权限查询后台素材，也可凭 `aftersales:review` 读取已关联售后的 READY 凭证摘要。`UPLOADING` 表示等待上传和完成确认；`READY` 可被业务引用；`FAILED` 表示确认失败；`DELETED` 表示已删除。重复确认 READY 素材返回原结果，避免创建重复业务素材。发生过期或文件校验失败时应重新申请上传。

申请、确认和删除均不要求 `Idempotency-Key`；申请每次新建票据，确认 READY 和重复删除可安全重试。每个账户最多 20 个有效待完成票据，滚动 24 小时普通用户最多申请 100 次、管理员最多 500 次；达到限制时等待已有票据完成或过期。素材查询返回基础摘要，不返回上传者 ID、对象 key、Bucket 名称或存储凭证。

## 绑定头像、产品与内容

头像：上传 `AVATAR` 并完成，然后 `GET /me` 读取 `version`，再 `PATCH /me` 提交 `{"version":当前版本,"avatarMediaId":"素材 UUID"}`。后端验证素材属于当前用户、用途为头像且状态 READY；`avatarMediaId=null` 清空。兼容字段 `avatarUrl` 仍可登记既有 OSS 图片，与 `avatarMediaId` 不能同时传；通过 URL 引用系统管理的上传对象也必须属于本人。

产品图片：上传 `PRODUCT_IMAGE`，完成后使用返回 ID 作为 `coverMediaId` 或 `galleryMediaIds`。无需再调用 `/admin/product-images` 重复登记。

系统上传目录 `uploads/` 内的公开地址只能使用完成接口返回的原始 HTTPS URL；不接受编码路径、附加查询参数或片段等别名，避免绕过所有者、用途和引用检查。推荐直接传素材 ID。

内容与专栏封面：分别上传 `CONTENT_COVER`、`COLUMN_COVER`，完成后将返回 ID 写入对应 `coverMediaId`。正文图片用 `CONTENT_BODY_IMAGE`，按既有正文约定同时填写 `bodyHtml` 和 `imageMediaIds`；不同用途不能混用。

视频：上传 `CONTENT_VIDEO` 后，将 ID 写入内容或章节的 `videoMediaId`。`provider=OSS`，播放接口返回 `mode=STREAM` 和应用代理 `playbackUrl`，每次请求重新检查发布状态、预览设置、购买／会员资格及会话，支持 Range。B 站科普和飞书会员视频的临时外链方案继续使用原有接口。

公开头像、封面、产品图和正文图片的文件可以由 OSS 直接读取。付费正文的文本访问资格仍由内容 API 校验；不要将必须保密的资料作为公开图片用途上传。

## 售后凭证与授权阅读

用户先完成 `AFTERSALE_EVIDENCE` 上传，再在 `POST /aftersales` 中提交 `evidenceMediaIds`，最多 9 个、不重复。服务端在售后事务中校验所有者、用途及 READY 状态，并绑定凭证。每份图片最多关联一份售后；需要用于另一份售后时重新上传。仍可省略或传空数组提交文字说明。

售后详情返回 `evidence` 元数据，始终没有公开地址。查看时调用 `POST /media/{id}/read-grant`：

- 原上传用户可预览本人的 READY 凭证，包括提交售后之前。
- 管理员需要 `aftersales:review`，且凭证已关联售后；`media:write` 本身不授予查看用户凭证的权限。

授权响应包含 `mediaId`、`url`、`expiresAt`，有效 **60 秒**。`url` 指向平台的 `GET /media/{id}/file?token=...`，成功返回原始图片字节，不套 JSON 外壳；每次请求重新检查素材状态、账号封禁、当前会话、管理员权限和售后关联。退出、封禁或撤销相应权限后，旧授权在下次请求时失效；已下载到客户端的字节无法追回。

授权响应与私有流使用 `Cache-Control: private, no-store`。前端按到期时间重新申请，不把 URL 保存到聊天、埋点或公共日志中。Nginx 的私有媒体代理路径应关闭访问日志，避免记录查询串令牌。

## 删除与对象清理

`DELETE /media/{id}` 删除未引用的本人上传素材。用于当前头像、产品封面／图库、内容／章节正文、专栏、有效报价／历史订单或已绑定售后凭证时，返回 `409 MEDIA_IN_USE`。更换当前封面不会删除历史订单中的成交图片；售后终结也不会自动允许删除凭证。

删除先变更数据库状态并返回 `{"success":true}`，重复删除同样成功。后台等待上传票据到期并再过 60 秒后清理 OSS 对象，避免旧表单仍有效时重建已删对象。临时上传过期后转 FAILED，校验失败对象也会清理；外部存储失败保留清理状态以便重试。READY 且尚未绑定的素材保留，需显式 DELETE。应用只处理本系统生成的上传前缀，不批量清理已有 OSS 业务文件。不要为 `uploads/private/` 或 `uploads/public/` 设置会主动删除仍在使用素材的生命周期规则。

还需在**私有 Bucket** 配置一条生命周期规则：前缀 `uploads/staging/`，按最后修改时间设置一天过期。OSS 按日执行规则，并非满 24 小时立即删除，详见[官方生命周期说明](https://www.alibabacloud.com/help/en/oss/user-guide/lifecycle-rules-based-on-the-last-modified-time)。表单在到期前开始的慢上传可能在后台清理后才结束，60 秒宽限无法覆盖所有迟到对象；OSS 生命周期负责清理这些暂存文件。规则只用于暂存前缀，不能扩展至正式文件目录。

## OSS 配置与启用

在服务器受保护的 `/etc/chunai/api.env` 配置以下变量；本地使用 `.env`。凭证不写入 Git、接口示例或浏览器代码。

```dotenv
UPLOAD_OSS_REGION=cn-hangzhou
UPLOAD_OSS_PUBLIC_BUCKET=chunai-photo
UPLOAD_OSS_PRIVATE_BUCKET=<另建的私有Bucket名称>
CONTENT_IMAGE_OSS_HOST=chunai-photo.oss-cn-hangzhou.aliyuncs.com

# 二选一：使用服务器已绑定的 ECS RAM 角色。
UPLOAD_OSS_RAM_ROLE=<角色名称>

# 或使用受限 RAM 账号/STS 凭证；此时不要设置 RAM_ROLE。
# UPLOAD_OSS_ACCESS_KEY_ID=<在受保护环境文件中配置>
# UPLOAD_OSS_ACCESS_KEY_SECRET=<在受保护环境文件中配置>
# UPLOAD_OSS_SECURITY_TOKEN=<使用STS时必填，长期RAM凭证时省略>
```

区域默认 `cn-hangzhou`，公开 Bucket 默认 `chunai-photo`；私有 Bucket 必填且不得与公开 Bucket 相同。公开主机必须与配置的公开 Bucket 标准 OSS HTTPS 主机相同。ECS 角色使用 IMDSv2，禁用 IMDSv1；角色与静态／STS 凭证不可混用。静态 STS 到期后需更新环境配置；ECS 角色通过凭证供应器刷新临时凭证。

当前适配器要求两个 Bucket 的版本控制均未开启（`Enabled` 与 `Suspended` 均拒绝），防止删除当前对象后遗留历史私有版本。私有 Bucket ACL 必须为 `private`，不得通过 Bucket Policy 向匿名用户授权。公开 Bucket 可为 `private` 或 `public-read`，最终公开对象由服务端设置为可读；禁止 `public-read-write` 和匿名写权限。

RAM 权限限制到以下 Bucket 与对象前缀，不需要整个账户的 OSS 管理员权限：

| 资源 | 权限用途 |
|---|---|
| 两个 Bucket | `oss:GetBucketAcl`、`oss:GetBucketVersioning`、`oss:GetBucketPolicy`，用于发布前检查 |
| 私有 Bucket 的 `uploads/staging/*` | `oss:PutObject`、`oss:GetObject`、`oss:DeleteObject`、`oss:PutObjectAcl`，用于直传、校验与清理 |
| 私有 Bucket 的 `uploads/private/*` | 同上，用于复制发布、私有流读取和删除 |
| 公开 Bucket 的 `uploads/public/*` | 同上，用于复制发布、校验及删除 |

跨 Bucket Copy 需要源对象 `GetObject` 和目标对象 `PutObject` 权限。应用不需要列出全部对象的权限。为私有 Bucket 配置浏览器跨域：允许实际前端来源、`POST` 方法及所需请求头；避免把 OSS CORS 与 API 的 `CORS_ORIGINS` 混为一项。读取公开图片若用于 Canvas，也需按前端需求配置公开 Bucket CORS。

配置后重启 `chunai-api`，使用一个 `cs` 测试头像实际完成「申请 → OSS POST → 确认 → 绑定 → 解绑 → 删除」，并用售后凭证检查匿名读取被拒绝、其他用户无法读取、管理员须先获得售后关联。普通健康检查只验证应用及数据库，不代表 OSS 配置已生效。真实 OSS 联调需完成这些配置后执行；自动测试使用存储替身结合真实 MySQL 验证业务和权限。

OSS 表单及签名规则参考阿里云官方 [PostObject](https://www.alibabacloud.com/help/en/oss/developer-reference/postobject)、[V4 签名](https://www.alibabacloud.com/help/en/oss/developer-reference/signature-version-4-recommend)。

测试管理员 `admin` 已授权 `media:write`，并保留已有的产品和内容管理权限。其他管理员应按职责分别授予权限；售后凭证查看只要求 `aftersales:review` 和对应售后关联。

## 数据库与兼容性

增量迁移增加统一上传记录 `upload_media` 与售后凭证关联 `after_sale_evidence`，并为用户头像保存素材引用；内容媒体扩展 OSS 私有视频约束。已有公开图片登记、本地视频、外链及交易记录保留。执行 `npm run migration:run`，不要手工重建表。

`upload_media` 保存所有者、用途、声明大小和 MIME、生命周期、对象位置及清理时间；对象 key 不通过 API 元数据返回。上传确认为产品／内容创建相同 ID 的可引用媒体记录，统一上传与既有业务共享素材引用校验。
