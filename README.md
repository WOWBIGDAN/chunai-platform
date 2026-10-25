# 两性健康服务平台 · NestJS 后端

已实现 **NestJS + TypeORM + MySQL** 用户认证、独立管理员认证、产品与 SKU、库存、实物订单、人工物流、售后退款、图文／视频科普、付费课程访问、专栏与有效期会员管理。封面支持登记阿里云 OSS 地址，科普视频可跳转 B 站，会员视频经资格校验后返回飞书网盘链接与密码，原有本地视频播放保留。注册登录不需要手机验证码。支付、退款按测试模式完成流程。

使用方法、管理员权限和业务约束见 [交易后端说明](docs/06-commerce.md) 与 [科普／课程后端说明](docs/08-content-courses.md)。内容模块附 50 条以 `cs` 开头的样本、40 个章节和 4 个专栏，支持手动重复导入。

## 已部署的测试环境

更新时间：2026-10-25。

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

默认地址：`http://localhost:3000/api/v1`。迁移创建 3 张认证表、20 张管理员与交易表、6 张内容与购买权益表、1 张网站会员表，以及迁移记录表；已有库只执行新增迁移，不清除业务数据。

新封面须先上传到 `chunai-photo.oss-cn-hangzhou.aliyuncs.com`，再通过素材接口登记公开 HTTPS 地址。使用 B 站／飞书外链前，按 `.env.example` 生成并设置独立的 `CONTENT_MEDIA_ENCRYPTION_KEY`，妥善备份该密钥；链接与密码在数据库加密保存。管理员开通／续期／撤销会员需要 `membership:write`，内容预览仍需要 `content:write`。具体调用顺序见 [内容与会员说明](docs/08-content-courses.md)。

本地测试交易时显式配置 `COMMERCE_TEST_PAYMENTS=true`，并按 [管理员初始化](docs/06-commerce.md#管理员初始化与权限) 创建管理员；生产环境始终禁用测试结算。

## 文档

| 文档 | 用途 |
|---|---|
| [后端启动与数据库](docs/04-backend-auth.md) | 环境配置、建库建表命令、认证范围、测试与部署 |
| [认证 OpenAPI](docs/openapi-auth.json) | 已实现的认证与健康检查接口，可导入 Apifox / Swagger |
| [交易后端说明](docs/06-commerce.md) | 管理员权限、库存／订单／售后联动、测试付款退款和发布步骤 |
| [已实现业务 OpenAPI](docs/openapi-implemented.json) | 已实现的认证、交易、内容、会员与视频访问接口 |
| [cs 产品测试样本](docs/07-product-samples.md) | 已写入服务器的测试商品、重复导入命令、产品 CRUD 请求示例 |
| [科普／课程与专栏](docs/08-content-courses.md) | 内容 CRUD、OSS 封面、B 站／飞书视频、会员管理、付费访问和 50 条 cs 样本 |
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

科普免费；课程支持免费、单独购买或网站会员三种独立策略。会员按管理员维护的有效期即时验证，会员方案购买暂未实现。实物订单一单一包裹；课程订单付款成功直接完成并授权。真实支付、退款回调及第三方物流仍待服务商配置。

## 验证

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
python scripts/build_api_docs.py
```

配置独立测试库的 `TEST_DB_*` 后执行 `npm.cmd run test:e2e`，验证真实 MySQL 事务与 HTTP 接口。

编辑 [生成脚本](scripts/build_api_docs.py) 后运行 `python scripts/build_api_docs.py` 可更新接口文档与 OpenAPI，校验引用、示例和链接；生成过程不会覆盖 README。
