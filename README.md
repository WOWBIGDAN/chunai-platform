# 两性健康服务平台 · NestJS 后端

已实现客户端手机号＋密码注册登录，使用 **NestJS + TypeORM + MySQL**。当前不需要手机验证码；支持令牌刷新、退出、本人资料、修改密码和设备会话管理。管理员认证与其他业务仍为设计契约，短信相关功能暂缓。

## 启动

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
| [认证 OpenAPI](docs/openapi-auth.json) | 仅包含已实现的 9 个接口，可导入 Apifox / Swagger |
| [HTTP 请求示例](examples/auth.http) | 注册、登录、刷新、资料、改密、退出 |
| [建表 SQL](database/schema.sql) | MySQL 字段、索引和外键 |
| [对接总则](docs/00-conventions.md) | 业务默认规则、角色权限、登录、响应、幂等和模块划分 |
| [接口文档](docs/01-api-reference.md) | 155 个接口；方法、URL、是否登录、是否管理员、请求参数与响应对象 |
| [数据格式](docs/02-data-models.md) | 157 个具名结构，含全部输入输出 DTO、枚举、字段约束和示例 |
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
