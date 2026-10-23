# 两性健康服务平台 · NestJS 后端

已实现客户端手机号＋密码注册登录，使用 **NestJS + TypeORM + MySQL**。当前不需要手机验证码；支持令牌刷新、退出、本人资料、修改密码和设备会话管理。管理员认证与其他业务仍为设计契约，短信相关功能暂缓。

## 已部署的测试环境

更新时间：2026-10-23。

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

联调可使用 [HTTP 请求示例](examples/auth.http)，或将 [已实现接口 OpenAPI](docs/openapi-auth.json) 导入 Apifox / Swagger 后选择测试服务器。现有 10 个认证与健康检查接口已实现；完整文档中的其余接口带有“设计中”或“暂缓实现”标记。

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

默认地址：`http://localhost:3000/api/v1`。迁移创建 `users`、`auth_sessions`、`refresh_tokens` 三张认证业务表和迁移记录表。

## 文档

| 文档 | 用途 |
|---|---|
| [后端启动与数据库](docs/04-backend-auth.md) | 环境配置、建库建表命令、认证范围、测试与部署 |
| [认证 OpenAPI](docs/openapi-auth.json) | 已实现的认证与健康检查接口，可导入 Apifox / Swagger |
| [CI/CD 与服务器部署](docs/05-deployment.md) | GitHub Actions、服务器布局、更新、回滚与运维 |
| [HTTP 请求示例](examples/auth.http) | 注册、登录、刷新、资料、改密、退出 |
| [建表 SQL](database/schema.sql) | MySQL 字段、索引和外键 |
| [对接总则](docs/00-conventions.md) | 业务默认规则、角色权限、登录、响应、幂等和模块划分 |
| [接口文档](docs/01-api-reference.md) | 156 个接口；方法、URL、是否登录、是否管理员、请求参数与响应对象 |
| [数据格式](docs/02-data-models.md) | 158 个具名结构，含全部输入输出 DTO、枚举、字段约束和示例 |
| [流程与联调](docs/03-business-flows.md) | 支付／订单／售后状态图、调用示例、会员与课程权益、SSE 和验收场景 |
| [OpenAPI 3.0.3](docs/openapi.json) | 导入 Swagger／Apifox；可生成前端类型和请求客户端 |

文档覆盖注册登录、用户与地址、视频图文、课程章节、专栏、产品与 SKU、订单、支付、物流、售后退款、会员、问答、消息、素材、封禁和管理审计。

默认科普免费，课程按购买或会员策略授权；实物订单一单一包裹。支付渠道回调明确采用外部协议，商户及供应商配置需在实现阶段落实。

## 验证

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
python scripts/build_api_docs.py
```

配置独立测试库的 `TEST_DB_*` 后执行 `npm.cmd run test:e2e`，验证真实 MySQL 事务与 HTTP 接口。

编辑 [生成脚本](scripts/build_api_docs.py) 后运行 `python scripts/build_api_docs.py` 可更新接口文档与 OpenAPI，校验引用、示例和链接；生成过程不会覆盖 README。
