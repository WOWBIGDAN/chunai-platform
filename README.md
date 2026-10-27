# 两性健康服务平台 · NestJS 后端

已实现 **NestJS + TypeORM + MySQL** 用户认证、独立管理员认证、产品与 SKU、库存、实物订单、阿里云物流查询与人工录单、售后退款、图文／视频科普、付费课程访问、专栏、会员购买续期、用户资料与后台用户管理，以及统一 OSS 文件上传和私有售后凭证。科普视频可跳转 B 站，会员视频经资格校验后返回飞书网盘链接与密码，本地／OSS 私有 MP4 共用播放鉴权。注册登录不需要手机验证码。支付、退款按测试模式完成流程。

使用方法、管理员权限和业务约束见 [交易后端说明](docs/06-commerce.md) 与 [科普／课程后端说明](docs/08-content-courses.md)。内容模块附 50 条以 `cs` 开头的样本、40 个章节和 4 个专栏，支持手动重复导入。

## 已部署的测试环境

更新时间：2026-10-26。

| 项目 | 地址或说明 |
|---|---|
| 服务入口 | [http://47.97.46.242](http://47.97.46.242)，根路径返回后端服务说明 |
| API 基础地址 | `http://47.97.46.242/api/v1` |
| 健康检查 | [GET /api/v1/health](http://47.97.46.242/api/v1/health)，同时检查数据库连接 |
| 用户协议 | [GET /public/legal-documents/TERMS](http://47.97.46.242/api/v1/public/legal-documents/TERMS) |
| 隐私政策 | [GET /public/legal-documents/PRIVACY](http://47.97.46.242/api/v1/public/legal-documents/PRIVACY) |
| 自动部署 | [GitHub Actions](https://github.com/WOWBIGDAN/chunai-platform/actions)：推送 main 后自动测试、构建、迁移并发布 |
| 首次成功部署 | [6745b62](https://github.com/WOWBIGDAN/chunai-platform/commit/6745b62bcbc96d6d8369539d0ee8abf73e1d1637) · [成功流水线](https://github.com/WOWBIGDAN/chunai-platform/actions/runs/39931044243) |

当前为 `staging` 测试服务，协议版本为 `2026-10-23-test`。注册前读取最新协议版本；手机号按 `+8613800000000` 这样的 E.164 格式提交，不传验证码字段。

用户认证可使用 [认证 HTTP 示例](examples/auth.http)。交易和内容对接使用 [交易 HTTP 示例](examples/commerce.http)、[科普／课程 HTTP 示例](examples/content-courses.http) 与 [已实现接口 OpenAPI](docs/openapi-implemented.json)。完整文档为每个接口标注实现状态；公网接口以当前部署版本为准。

服务器使用 Nginx + systemd + MySQL，运行配置位于 `/etc/chunai/api.env`。更新、日志、回滚和数据库备份见 [部署与运维说明](docs/05-deployment.md)。

## 本地启动

要求 Node.js 22.14+、MySQL 8.0.16+。Windows PowerShell 使用 `npm.cmd`，其他终端可用 `npm`。

```powershell
npm.cmd ci
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

填写 `.env` 的数据库配置，将随机串填入 `JWT_SECRET`，按 [运行文档](docs/04-backend-auth.md) 创建空库及应用账号，或用 `docker compose up -d mysql` 启动数据库。

```powershell
npm.cmd run migration:run
npm.cmd run start:dev
```

默认地址：`http://localhost:3000/api/v1`。迁移创建 3 张认证表、20 张管理员与交易表、6 张内容与购买权益表、3 张会员期限／套餐／购买权益表、2 张上传与售后凭证表、2 张购物车与收藏表，以及迁移记录表；已有库只执行新增迁移，不清除业务数据。

头像、内容封面、正文图片、产品图片与私有 MP4 可通过「申请 OSS 表单 → 直传 → 完成校验」生成素材 ID。当前测试服务器已配置杭州区域的公开图片 Bucket `chunai-photo`、私有 Bucket `chunai-private` 和 ECS RAM 角色 `chunai-oss`，已通过真实 OSS 上传及权限联调。OSS 全局与公开图片桶已关闭“阻止公共访问”，私有桶保持开启。配置、权限与 38 项联调检查记录见 [统一上传说明](docs/10-unified-uploads.md)。已有公开 OSS 图片仍可用原登记接口；公开图片主机为 `chunai-photo.oss-cn-hangzhou.aliyuncs.com`。

使用 B 站／飞书外链前，按 `.env.example` 生成并设置独立的 `CONTENT_MEDIA_ENCRYPTION_KEY`，妥善备份该密钥；链接与密码在数据库加密保存。管理员开通／续期／撤销会员需要 `membership:write`，内容预览仍需要 `content:write`。具体调用顺序见 [内容与会员说明](docs/08-content-courses.md)。

本地测试交易时显式配置 `COMMERCE_TEST_PAYMENTS=true`，并按 [管理员初始化](docs/06-commerce.md#管理员初始化与权限) 创建管理员；生产环境始终禁用测试结算。

购物车支持 SKU 数量与勾选、实时可购买状态及事务结算清理；图文／视频收藏支持下架失效和会员／购买权限判定。详见 [购物车与收藏](docs/11-cart-favorites.md)。

## 文档

| 文档 | 用途 |
|---|---|
| [后端启动与数据库](docs/04-backend-auth.md) | 环境配置、建库建表命令、认证范围、测试与部署 |
| [认证 OpenAPI](docs/openapi-auth.json) | 已实现的认证与健康检查接口，可导入 Apifox / Swagger |
| [交易后端说明](docs/06-commerce.md) | 管理员权限、库存／订单／售后联动、测试付款退款和发布步骤 |
| [已实现业务 OpenAPI](docs/openapi-implemented.json) | 已实现的认证、交易、内容、会员与视频访问接口 |
| [cs 产品测试样本](docs/07-product-samples.md) | 已写入服务器的测试商品、重复导入命令、产品 CRUD 请求示例 |
| [科普／课程与专栏](docs/08-content-courses.md) | 内容 CRUD、OSS 封面、B 站／飞书视频、会员管理、付费访问和 50 条 cs 样本 |
| [会员购买与用户管理](docs/09-membership-users.md) | 会员套餐、购买续期与退款、昵称头像、用户查询和封禁；[HTTP 示例](examples/membership-users.http) |
| [统一文件上传](docs/10-unified-uploads.md) | OSS 表单直传、素材归属和清理、私有售后凭证、配置要求；[HTTP 示例](examples/uploads.http) |
| [物流轨迹与录单](docs/12-logistics.md) | 阿里云快递查询、管理录单与纠错、权限、缓存及数据库迁移；[HTTP 示例](examples/logistics.http) |
| [商品／科普／课程分类](docs/13-category-scopes.md) | 分类作用域、内容匹配规则、旧 CONTENT 迁移；[HTTP 示例](examples/category-scopes.http) |
| [CI/CD 与服务器部署](docs/05-deployment.md) | GitHub Actions、服务器布局、更新、回滚与运维 |
| [HTTP 请求示例](examples/auth.http) | 注册、登录、刷新、资料、改密、退出 |
| [建表 SQL](database/schema.sql) | MySQL 字段、索引和外键 |
| [交易建表 SQL](database/commerce.sql) | 20 张新增表、外键、唯一索引与库存／退款约束 |
| [内容建表 SQL](database/content.sql) | 6 张内容与购买权益表；交易字段升级通过 TypeORM 迁移执行 |
| [对接总则](docs/00-conventions.md) | 业务默认规则、角色权限、登录、响应、幂等和模块划分 |
| [接口文档](docs/01-api-reference.md) | 全部接口的实现状态、方法、URL、权限、请求与响应 |
| [数据格式](docs/02-data-models.md) | 输入输出 DTO、枚举、字段约束和示例 |
| [流程与联调](docs/03-business-flows.md) | 支付／订单／售后状态图、调用示例、会员与课程权益、SSE 和验收场景 |
| [OpenAPI 3.0.3](docs/openapi.json) | 导入 Swagger／Apifox；可生成前端类型和请求客户端 |

文档覆盖注册登录、用户与地址、视频图文、课程章节、专栏、产品与 SKU、订单、支付、物流、售后退款、会员、问答、消息、素材、封禁和管理审计。

科普免费；课程支持免费、单独购买或网站会员三种独立策略。会员可由管理员开通或通过套餐购买，续期追加独立期限，未来未开始段可全额退款。用户可修改昵称和 OSS 头像；后台按 `users:read`、`users:ban` 分别控制查询和封禁。实物订单一单一包裹；数字订单付款成功直接完成并授权。真实支付、退款回调仍待接入；物流已接入阿里云查询服务，管理录单、缓存、同步及配置见 [物流轨迹](docs/12-logistics.md)。

## 验证

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
python scripts/build_api_docs.py
```

配置独立测试库的 `TEST_DB_*` 后执行 `npm.cmd run test:e2e`，验证真实 MySQL 事务与 HTTP 接口。

编辑 [生成脚本](scripts/build_api_docs.py) 后运行 `python scripts/build_api_docs.py` 可更新接口文档与 OpenAPI，校验引用、示例和链接；生成过程不会覆盖 README。
