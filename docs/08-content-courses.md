# 科普、课程访问与专栏后端

本模块与现有 NestJS / MySQL、管理员权限、订单和测试退款共用一套后端。支持图文科普、视频科普、图文课程、视频课程，以及 `FREE`、`PURCHASE`、`MEMBER` 三种访问策略。封面可通过统一 OSS 上传或登记已有地址；科普视频可跳转 B 站，会员视频可在校验有效期后返回飞书链接与密码；本地与 OSS 私有 MP4 共用访问鉴权。会员支持管理员开通及套餐购买，详细规则见 [会员购买与用户管理](09-membership-users.md)。真实收付款和视频转码暂未接入。

## 权限与业务关系

| 角色／状态 | 可用范围 |
|---|---|
| 游客 | 已发布科普、课程介绍与目录、免费课程、已发布免费预览章、公开专栏 |
| 普通用户 | 游客能力；购买本人课程、查看本人订单和购买记录；有效购买权益对应的完整课程 |
| 有效网站会员 | 普通用户能力；读取已发布的 `MEMBER` 课程与章节；会员不自动解锁 `PURCHASE` 课程 |
| 管理员 `content:write` | 内容与章节 CRUD、发布／下架、分类、图片登记、视频上传、专栏和关联排序、管理端视频预览 |
| 管理员 `membership:write` | 查询指定用户会员；开通、续期和撤销会员，写入操作审计；不会因此获得视频预览权限 |
| 管理员 `orders:read` | 查看课程订单；不会因此获得内容编辑或付款权限 |
| 管理员 `payments:test` | 在测试结算开关开启时确认测试付款与退款结果 |
| 管理员 `aftersales:review` | 发起课程全额退款；失败后重试 |

用户与管理员令牌不能混用。管理端写操作在事务内再次核验管理员状态、会话和权限。客户端不能提交角色、课程授权、付款金额或发布状态来提升权限。

科普必须 `FREE` 且价格为 0；课程可以 `FREE`、`PURCHASE` 或 `MEMBER`。`MEMBER` 价格为 0，表示通过会员资格访问，不代表匿名免费。`PURCHASE` 价格至少 1 分；`MEMBER_OR_PURCHASE` 暂不支持。修改策略必须同时提交 `accessPolicy`、`priceCents` 和当前 `version`；已有购买订单历史的课程不能改成 `MEMBER`，避免改变已购用户待遇。公开列表、详情和目录不返回视频外链、网盘密码、受保护正文或内部路径；正文和播放授权重新检查权限。

课程至少有一章已发布章节才能发布。章节类型从课程继承。下架最后一章会自动下架课程并更新课程版本。下架停止公开发现、新下单和未付款订单的测试付款；已付款用户仍可访问下架课程及历史已发布章节。草稿章节始终不可被普通用户读取，包括已购用户。

曾发布或有交易记录的课程不能物理删除；已购课程的章节也不能删除，只能下架。可删除从未发布、没有引用的草稿。专栏是多对多的免费分组：关联或排序不会修改内容价格、发布状态或用户购买权益；删除下架专栏只删除分组及关联。

## 主要接口

全部路径相对 `/api/v1`。详细字段和完整操作见 [已实现 OpenAPI](openapi-implemented.json)；可直接导入 Apifox。

| 功能 | 接口 |
|---|---|
| 内容分类 | `GET /categories?scope=CONTENT` |
| 图文发现与详情 | `GET /articles`、`GET /articles/{id}` |
| 视频发现与详情 | `GET /videos`、`GET /videos/{id}` |
| 科普正文／视频 | `GET /articles/{id}/body`、`GET /videos/{id}/playback` |
| 课程目录 | `GET /courses/{id}/chapters` |
| 课程章节 | `GET /chapters/{id}/body`、`GET /chapters/{id}/playback` |
| 已购课程 | `GET /me/courses?status=ACTIVE`（也支持 `REVOKED`） |
| 本人网站会员 | `GET /me/membership` |
| 管理会员 | `GET/PUT /admin/users/{id}/membership`、`POST /admin/users/{id}/membership/revoke` |
| 公开专栏 | `GET /columns`、`GET /columns/{id}`、`GET /columns/{id}/contents` |
| 内容管理 | `GET/POST /admin/contents`、`GET/PATCH/DELETE /admin/contents/{id}` |
| 内容发布 | `POST /admin/contents/{id}/publish`、`POST .../unpublish` |
| 科普正文管理 | `GET/PUT /admin/contents/{id}/body` |
| 章节管理 | `GET/POST /admin/courses/{id}/chapters`、`GET/PATCH/DELETE /admin/chapters/{id}` |
| 章节正文与发布 | `GET/PUT /admin/chapters/{id}/body`、`POST .../publish`、`POST .../unpublish` |
| 专栏管理 | `GET/POST /admin/columns`、`GET/PATCH/DELETE /admin/columns/{id}`、`POST .../publish`、`POST .../unpublish` |
| 专栏关联 | `GET /admin/columns/{id}/contents`、`PUT/DELETE /admin/columns/{id}/contents/{contentId}` |
| 图片与视频 | `POST /admin/content-media/images`、`POST /admin/content-media/videos`、`POST /admin/content-media/external-videos` |

图文和视频列表支持 `keyword`、`kind`、`categoryId`、`columnId`、`accessPolicy`、`tag`、分页与排序。搜索只涉及公开标题、简介、标签。管理列表另支持 `status`。分页默认 20 条，`pageSize` 最大 100。写操作带最新 `version`；关联内容的 PUT 为幂等设置排序，重复相同排序不会增加专栏版本。

## 课程购买与退款测试

1. 用普通用户令牌 `POST /order-quotes`：`{"type":"COURSE","courseId":"课程 UUID"}`。不传地址、SKU 或金额。
2. `POST /orders`：传 `quoteId` 和独立 `Idempotency-Key`。报价有效 10 分钟，订单待付款 30 分钟。同用户同课程只允许一份有效待付款订单。
3. 管理员 `POST /admin/orders/{id}/test-payment`：传订单 `version`、唯一 `transactionNo` 和 `Idempotency-Key`。环境须为 development/test/staging 且 `COMMERCE_TEST_PAYMENTS=true`。
4. 成功后订单直接 `COMPLETED`，付款与 `ACTIVE` 课程权益在同一事务中落库；课程不预占产品库存，也不进入发货、收货或实物售后流程。
5. 普通用户访问付费章节，或 `GET /me/courses` 查看权益。不能查看其他用户的订单或权益。
6. 管理员 `POST /admin/orders/{id}/digital-refund`：传 `orderVersion`、`reason`、幂等键，得到 `PROCESSING` 退款。
7. 管理员 `POST /admin/refunds/{id}/test-result`：传**退款流水** `version`、`result=SUCCEEDED/FAILED`、幂等键。成功才全额退款、关闭订单并撤销该订单的权益；失败保留访问权。重试失败退款时重新调用第 6 步，使用订单最新版本，沿用原退款记录。

产品售后退款确认仍使用售后单版本；课程退款确认使用退款流水版本。成功退款后用户可以重新购买，新的权益归属新订单，旧退款不会撤销新权益。测试支付和退款不产生真实资金流。

## 网站会员开通、续期和撤销

会员资格来自管理员维护的期限记录或套餐购买产生的 ACTIVE 权益段，和单门课程购买权益分别保存。有效条件为账号有效、对应期限没有撤销、`startsAt <= 当前服务器时间 < expiresAt`。未开始、已过期、已撤销或退款冻结的段不提供访问资格，不需要等待定时任务刷新状态。已购买的 `PURCHASE` 课程不受会员到期影响。以下接口只维护手工期限；套餐和付费段见 [会员购买说明](09-membership-users.md)。

管理员先 `GET /admin/users/{userId}/membership`。没有记录时 `membership=null`，首次 PUT 使用 `version=0`；已有记录使用返回的 `membership.version`。PUT 请求为：

```json
{"version":0,"startsAt":"2026-10-25T00:00:00.000Z","expiresAt":"2026-11-24T00:00:00.000Z","reason":"cs开通测试会员"}
```

日期为结构示例，请替换为实际期限；必须带秒及明确时区，小数最多 3 位。到期时间必须晚于起始时间且晚于当前时间。续期读取最新版本，保留原起始时间并延长到期时间，再 PUT 完整区间；过期重开可设置新的起始时间。PUT 会清除已有撤销标记。不同管理员并发修改由版本号保护，冲突返回 `409 VERSION_CONFLICT`。

撤销使用 POST `/admin/users/{userId}/membership/revoke`，请求 `{"version":1,"reason":"cs撤销测试会员"}`。返回与 GET、PUT 相同的结构：`active`、`expiresAt`、`benefitCodes`、`membership`。`expiresAt` 为未撤销手工期限及 ACTIVE 付费段的最晚到期时间，可能已过期，无候选记录时为 null；应使用 `active` 判断当前资格。有效时 `benefitCodes=["MEMBER_CONTENT"]`，否则为 `[]`。`membership` 仅为手工记录，购买历史通过 `/me/membership/periods` 分页查询。普通用户不能写入期限；存在未到期付费段或处理中的退款时，手工改期与撤销返回 `MEMBERSHIP_PAID_TERM_EXISTS`，须从对应订单办理退款。

撤销或到期后，新的飞书授权请求立即拒绝，本地视频的后续 Range 请求也重新校验会员。已经返回给用户的第三方分享链接和密码无法由网站接口远程收回；需要在飞书分享设置中修改密码或停止分享。

## OSS 封面与图文正文

图文正文只允许安全文本标签和已登记的 `CONTENT_BODY_IMAGE` 图片。提交 `bodyHtml` 与 `imageMediaIds`；视频正文只提交 `videoMediaId`，两种结构不能混用。脚本、事件属性和任意图片地址会被清洗或拒绝。

图文 HTML 保存在 MySQL 的 `contents.body_html` 或 `course_chapters.body_html`，图片文件由 OSS 或既有外部图片服务提供，正文中只保存经过清洗的图片引用。

内容封面用 `CONTENT_COVER`，专栏封面用 `COLUMN_COVER`，正文图片用 `CONTENT_BODY_IMAGE`，不能跨用途引用。新文件可通过 [统一上传](10-unified-uploads.md) 申请 OSS 表单并完成服务端校验，直接使用返回的素材 `id`，需要 `media:write` + `content:write`。统一上传需要服务器 OSS 凭证与独立私有 Bucket，当前测试服务器尚待配置。

兼容图片登记接口接受已存在的 HTTPS 公开地址、MIME、大小和 `purpose`；新封面登记仅接受 `https://chunai-photo.oss-cn-hangzhou.aliyuncs.com/<对象路径>`，主机由 `CONTENT_IMAGE_OSS_HOST` 配置。此登记路径不代传、下载或校验远程对象，不需要 OSS AccessKey；正文图片继续兼容已托管的 HTTPS 地址。

存量测试封面地址保留，不会替换成不存在的 OSS 对象。新建内容、专栏或更换封面时，同样校验 OSS 域名，不能借用旧的外部封面素材绕过限制；仅修改原内容的标题等资料不要求立即更换旧封面。公开封面可直接访问，业务接口不为封面签发会员授权。

## B 站科普与飞书会员视频

管理员用 `POST /admin/content-media/external-videos` 登记外部视频，返回素材摘要和 `id`，再通过原有正文接口写入 `videoMediaId`。摘要含 `provider`，不含外部视频链接或密码。接口支持：

| provider | 登记字段 | 允许绑定 |
|---|---|---|
| `BILIBILI` | `provider`、`externalUrl`、`durationSeconds`；禁止 `accessPassword` | 免费 `SCIENCE_VIDEO` 科普 |
| `FEISHU` | 同上，并且必须提供 `accessPassword` | `MEMBER` 策略的 `VIDEO_COURSE` 章节；必须 `isPreview=false` |

`durationSeconds` 为 0–86400 的整数，未知可以为 0。B 站支持 `bilibili.com`／`www.bilibili.com` 的 `/video/BV...`、`/video/av...` 视频链接，以及 `b23.tv` 短链接。飞书支持 `feishu.cn` 或一层租户子域的 `/file/<token>`、`/drive/file/<token>`、`/drive/folder/<token>`。仅 HTTPS，拒绝带账号、显式端口、非空 fragment 或相似域名的链接；服务端不抓取目标页面。

飞书章节不能设置免费预览，也不能改绑到免费／单独购买课程。创建会员视频的顺序：登记 OSS 封面 → 创建 `VIDEO_COURSE`、`accessPolicy=MEMBER`、`priceCents=0` → 创建非预览章节 → 登记飞书素材并绑定章节 → 发布章节 → 发布课程。科普则创建 `SCIENCE_VIDEO`、`FREE`，绑定 B 站素材后发布。实际文件、B 站视频地址、飞书链接和密码由管理员提供，现有 50 条样本保持原有本地 MP4 和测试封面。

前端仍调用 `GET /videos/{id}/playback` 或 `GET /chapters/{id}/playback`，按响应 `mode` 选择显示方式：

| provider / mode | playbackUrl | externalUrl | accessPassword | expiresAt |
|---|---|---|---|---|
| `LOCAL / STREAM` | 本地短时流地址 | null | null | 5 分钟后 |
| `BILIBILI / EXTERNAL_LINK` | null | B 站地址 | null | null |
| `FEISHU / EXTERNAL_LINK` | null | 飞书地址 | 授权后才返回的密码 | null |

外链模式的 `expiresAt=null` 只表示本接口没有签发本地播放令牌，不代表第三方分享永久有效。普通用户未登录返回 401，无有效会员返回 `403 CONTENT_ACCESS_DENIED`；内容详情可通过 `access.reason=MEMBERSHIP_REQUIRED` 显示开通提示。持 `content:write` 的管理员可走管理端预览接口，不需要冒充会员。

所有播放授权响应使用 `Cache-Control: private, no-store`。不要将飞书响应存入公共缓存、日志或埋点。后端提供授权后的 `externalUrl` 与 `accessPassword`；普通网页受浏览器跨域规则限制，不能直接操作飞书网页的密码框，自动输入需要前端另行使用具备相应能力的扩展或受支持集成，本接口不保证普通页面跳转后自动填入。

## 本地与 OSS 私有 MP4

视频直接上传 MP4 原始字节：

```bash
curl -X POST "$BASE/admin/content-media/videos?durationSeconds=3" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: video/mp4' \
  --data-binary @database/seeds/cs-sample.mp4
```

上限 100 MiB；目前校验 MP4 容器头，时长由管理员填写，不转码。上传前应准备浏览器兼容 MP4（如 H.264/AAC）。视频 `publicUrl=null`，私有文件不在公开静态目录内。

也可通过统一上传的 `CONTENT_VIDEO` 将 MP4 存储到 OSS 私有 Bucket，完成后用相同 `videoMediaId` 绑定接口。两种来源的播放 URL 均有效 5 分钟，`GET /content-playback/{mediaId}?token=...` 支持 HTTP Range（200／206／416），每次请求重新核验内容状态、预览设置、购买／会员权益、账号与会话。退款成功、会员到期或撤销、会话撤销、管理员权限收回后，旧链接在下一次请求时失效。已经下载的字节无法追回，当前不提供 DRM。Nginx 对播放接口关闭访问日志，避免记录短时令牌。

部署配置：

```dotenv
CONTENT_MEDIA_DIR=/var/lib/chunai/content-media
PUBLIC_API_URL=http://47.97.46.242/api/v1
CONTENT_IMAGE_OSS_HOST=chunai-photo.oss-cn-hangzhou.aliyuncs.com
CONTENT_MEDIA_ENCRYPTION_KEY=<32字节随机密钥的base64编码>
COMMERCE_TEST_PAYMENTS=true
```

`CONTENT_MEDIA_ENCRYPTION_KEY` 可用 `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` 生成一次，存入受保护的环境文件。外部视频链接与飞书密码在 MySQL 中以 AES-256-GCM 密文保存；密钥缺失时外链登记／解密失败，不降级为明文，也不复用 JWT 密钥。必须独立妥善备份密钥，直接换成新随机值会使已有密文无法解密；轮换需另行完成数据重加密。

目录归应用用户 `chunai`，systemd 使用持久化 `/var/lib/chunai` 可写目录；发布新版本不会丢失视频。更新 [systemd 模板](../deploy/chunai-api.service) 和 [Nginx 模板](../deploy/nginx.conf)，以支持正文大小、视频上传和受保护视频流。备份 MySQL、私有视频目录及加密密钥；OSS 对象另行在阿里云侧维护备份与可见性。

来源采用独立 `provider` 字段与统一播放授权响应，正文继续引用素材 ID，购买和会员授权不依赖特定网盘。OSS 私有视频已纳入 STREAM 分支；未来接入 CDN 或点播服务时，可新增来源适配及签名逻辑，保留课程、章节和会员关系；前端以 `mode` 分支处理。

## 数据库与 50 条 cs 样本

新增 6 张表：`content_media`、`contents`、`course_chapters`、`content_columns`、`column_contents`、`course_entitlements`。迁移兼容已有产品订单：扩展报价／订单类型，课程订单地址为空；订单行保留 SKU 外键并增加独立课程外键；退款可关联数字订单。数据库唯一约束保证同一用户同一课程最多一份有效权益。

本次 [增量迁移](../src/database/migrations/1792972800000-ExternalMediaMembership.ts) 增加 `user_memberships` 表，用户外键唯一，含起止时间、撤销时间和乐观锁版本；扩展 `content_media.provider`、`external_url_encrypted`、`access_password_encrypted`，并允许内容访问策略 `MEMBER`。存量视频归为 `LOCAL`，已有图片按原来源保留；迁移不删除业务数据，不伪造第三方链接。已有库运行 `migration:run`，不要手工重建表。

```powershell
npm.cmd run build
npm.cmd run migration:run
npm.cmd run seed:content
```

以上手动导入命令仅允许 development/test/staging。种子不会在应用启动或 CI/CD 时自动执行，不覆盖用户修改，不重置版本、正文、发布状态或已购权益。重复执行跳过已有内容；如果手动删除整条草稿后重新导入，会补回该条。科普、课程、章节、分类和专栏名称全部以 `cs` 开头；不会自动给任何用户购买权益。

数据文件：[cs-contents.json](../database/seeds/cs-contents.json)；视频文件：[cs-sample.mp4](../database/seeds/cs-sample.mp4)；接口联调：[content-courses.http](../examples/content-courses.http)。视频样本为 3 秒人工生成的测试画面，图文为接口测试占位正文。

| 类型 | 总数 | 已发布 | 草稿 | 已下架 |
|---|---:|---:|---:|---:|
| 图文科普 | 15 | 13 | 1 | 1 |
| 视频科普 | 15 | 13 | 1 | 1 |
| 付费图文课程 | 10 | 8 | 1 | 1 |
| 付费视频课程 | 10 | 8 | 1 | 1 |
| 合计 | 50 | 42 | 4 | 4 |

另建 40 个课程章节（每课一个免费预览章、一个付费章）、4 个内容分类、4 个专栏。新导入时管理员列表 `GET /admin/contents?keyword=cs&pageSize=100` 可查看 50 条；公共 `/articles`、`/videos` 各返回 21 条已发布样本。

导入报告会返回每条真实 UUID 与章节 ID，可直接用于增删改查；导入脚本需要可用的数据库环境配置和已编译代码。示例保留原来的测试管理员账号，另有一个停用的 `cs_content_seed_operator` 只用于素材与审计外键，不能登录。

## 自动验收

[内容 E2E 测试](../test/e2e/content.e2e.spec.ts) 使用独立 MySQL 测试库，覆盖权限隔离、字段校验、HTML 清洗、正文访问、报价／付款／退款事务、重复请求、取消超时、下架权益、专栏 CRUD 和排序、私有 MP4 Range、过期令牌及退款撤权。测试只清理本次创建的记录。

外链与会员测试另覆盖 OSS 域名、链接校验、密文绑定与篡改、敏感信息不出现在列表或审计中、会员未开始／到期／撤销／续期、权限动态撤销、并发版本冲突、飞书禁止试看与购买权益隔离。

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e
python scripts/validate_commerce_responses.py
python scripts/build_api_docs.py
npm.cmd run build
```
