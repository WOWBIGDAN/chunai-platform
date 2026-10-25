# 科普、课程访问与专栏后端

本模块与现有 NestJS / MySQL、管理员权限、订单和测试退款共用一套后端。支持图文科普、视频科普、图文课程、视频课程。当前支持 `FREE` 和 `PURCHASE`；会员权益、真实收付款和视频转码暂未接入。

## 权限与业务关系

| 角色／状态 | 可用范围 |
|---|---|
| 游客 | 已发布科普、课程介绍与目录、免费课程、已发布免费预览章、公开专栏 |
| 普通用户 | 游客能力；购买本人课程、查看本人订单和购买记录；有效购买权益对应的完整课程 |
| 管理员 `content:write` | 内容与章节 CRUD、发布／下架、分类、图片登记、视频上传、专栏和关联排序、管理端视频预览 |
| 管理员 `orders:read` | 查看课程订单；不会因此获得内容编辑或付款权限 |
| 管理员 `payments:test` | 在测试结算开关开启时确认测试付款与退款结果 |
| 管理员 `aftersales:review` | 发起课程全额退款；失败后重试 |

用户与管理员令牌不能混用。管理端写操作在事务内再次核验管理员状态、会话和权限。客户端不能提交角色、课程授权、付款金额或发布状态来提升权限。

科普必须免费；课程可以免费或单独购买。价格以分为单位。修改价格策略必须同时提交 `accessPolicy`、`priceCents` 和当前 `version`。公开列表、详情和目录不返回付费正文、视频源地址或内部文件路径；正文和播放授权分别检查权限。

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
| 公开专栏 | `GET /columns`、`GET /columns/{id}`、`GET /columns/{id}/contents` |
| 内容管理 | `GET/POST /admin/contents`、`GET/PATCH/DELETE /admin/contents/{id}` |
| 内容发布 | `POST /admin/contents/{id}/publish`、`POST .../unpublish` |
| 科普正文管理 | `GET/PUT /admin/contents/{id}/body` |
| 章节管理 | `GET/POST /admin/courses/{id}/chapters`、`GET/PATCH/DELETE /admin/chapters/{id}` |
| 章节正文与发布 | `GET/PUT /admin/chapters/{id}/body`、`POST .../publish`、`POST .../unpublish` |
| 专栏管理 | `GET/POST /admin/columns`、`GET/PATCH/DELETE /admin/columns/{id}`、`POST .../publish`、`POST .../unpublish` |
| 专栏关联 | `GET /admin/columns/{id}/contents`、`PUT/DELETE /admin/columns/{id}/contents/{contentId}` |
| 图片与视频 | `POST /admin/content-media/images`、`POST /admin/content-media/videos` |

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

## 正文与私有视频

图文正文只允许安全文本标签和已登记的 `CONTENT_BODY_IMAGE` 图片。提交 `bodyHtml` 与 `imageMediaIds`；视频正文只提交 `videoMediaId`，两种结构不能混用。脚本、事件属性和任意图片地址会被清洗或拒绝。

图片登记接口接受 HTTPS 公开地址、MIME、大小和 `purpose`。内容封面用 `CONTENT_COVER`，专栏封面用 `COLUMN_COVER`，正文图片用 `CONTENT_BODY_IMAGE`，不能跨用途引用。图片是管理员提供的外部公开资源，登记接口不下载文件。

视频直接上传 MP4 原始字节：

```bash
curl -X POST "$BASE/admin/content-media/videos?durationSeconds=3" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: video/mp4' \
  --data-binary @database/seeds/cs-sample.mp4
```

上限 100 MiB；目前校验 MP4 容器头，时长由管理员填写，不转码。上传前应准备浏览器兼容 MP4（如 H.264/AAC）。视频 `publicUrl=null`，私有文件不在公开静态目录内。

正文／播放接口每次检查当前权限。播放 URL 有效 5 分钟，`GET /content-playback/{mediaId}?token=...` 支持 HTTP Range（200／206／416），每次请求重新核验内容状态、预览设置、购买权益、账号与会话。退款成功、会话撤销、管理员权限收回后，旧链接在下一次请求时失效。已经下载的字节无法追回，当前不提供 DRM。Nginx 对播放接口关闭访问日志，避免记录短时令牌。

部署配置：

```dotenv
CONTENT_MEDIA_DIR=/var/lib/chunai/content-media
PUBLIC_API_URL=http://47.97.46.242/api/v1
COMMERCE_TEST_PAYMENTS=true
```

目录归应用用户 `chunai`，systemd 使用持久化 `/var/lib/chunai` 可写目录；发布新版本不会丢失视频。更新 [systemd 模板](../deploy/chunai-api.service) 和 [Nginx 模板](../deploy/nginx.conf)，以支持正文大小、视频上传和受保护视频流。备份时同时备份 MySQL 与私有视频目录。

## 数据库与 50 条 cs 样本

新增 6 张表：`content_media`、`contents`、`course_chapters`、`content_columns`、`column_contents`、`course_entitlements`。迁移兼容已有产品订单：扩展报价／订单类型，课程订单地址为空；订单行保留 SKU 外键并增加独立课程外键；退款可关联数字订单。数据库唯一约束保证同一用户同一课程最多一份有效权益。

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

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e
python scripts/validate_commerce_responses.py
python scripts/build_api_docs.py
npm.cmd run build
```
