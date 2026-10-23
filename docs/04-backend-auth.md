# 后端启动、认证接口与 MySQL

实现日期：2026-10-23。NestJS 11、TypeORM 0.3、MySQL 8.0.16+（推荐 8.4），依赖由 `package-lock.json` 锁定。

## 实现范围

所有路径以 `/api/v1` 开头。当前注册和密码登录均不需要手机验证码。

| 方法 | 路径 | 登录要求 | 功能 |
|---|---|---|---|
| GET | `/health` | 否 | 检查 API 与数据库是否就绪 |
| GET | `/public/legal-documents/{type}` | 否 | TERMS / PRIVACY 当前协议与版本 |
| POST | `/auth/register` | 否 | 注册并登录，HTTP 201 |
| POST | `/auth/login/password` | 否 | 密码登录，HTTP 200 |
| POST | `/auth/refresh` | 刷新令牌 | 轮换令牌，HTTP 200 |
| POST | `/auth/logout` | Bearer JWT | 退出当前设备 |
| GET | `/me` | Bearer JWT | 本人脱敏资料 |
| PUT | `/me/password` | Bearer JWT | 验证旧密码、改密并撤销全部会话 |
| GET | `/me/sessions` | Bearer JWT | 有效会话分页，page 默认 1、pageSize 默认 20、最大 100 |
| DELETE | `/me/sessions/{id}` | Bearer JWT | 撤销本人会话，id 为返回的 UUID |

导入 [认证 OpenAPI](openapi-auth.json) 即可仅查看已实现接口。[完整 OpenAPI](openapi.json) 保留业务设计，每个操作以 `x-implementation-status` 标注 implemented / planned / deferred。

管理员认证、短信发送、短信登录、忘记密码重置、资料编辑、订单、会员等未实现，当前路由返回 404。头像和会员模块接入前，`UserSummary.avatarUrl` 为 null，membership 返回非会员空权益。

手机号遵循已有 E.164 契约，例如 `+8613800000000`，当前仅为登录标识；`phone_verified_at` 为 NULL，不代表已核验联系号码。未来短信接入须补充用途绑定、有效期、尝试次数和一次性消费。本实现没有万能验证码或短信绕过开关。

## 本地启动与建表

要求 Node.js 22.14+、npm、MySQL 8.0.16+。Windows PowerShell 若阻止 npm.ps1，使用 `npm.cmd`。

```powershell
npm.cmd ci
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

编辑 `.env`：填写 `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`，将生成的随机串填入 `JWT_SECRET`。示例 JWT 密钥不能用于启动。`.env` 已被忽略，不提交凭据。

使用已有 MySQL 时，用管理账号执行以下 SQL，替换口令并将应用账号填入 `.env`。下列语句不修改其他数据库：

```sql
CREATE DATABASE chunai_platform
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'chunai'@'localhost' IDENTIFIED BY 'replace-with-your-db-password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON chunai_platform.* TO 'chunai'@'localhost';
```

如果使用 Docker，可替代手动建库步骤：

```powershell
docker compose up -d mysql
docker compose ps
```

Compose 创建 `.env` 指定的数据库与普通用户，只绑定本机端口。如果本机 3306 已占用，将 `DB_PORT` 改为 3307。初始化变量仅对新数据卷生效，修改 `.env` 不会自动修改已有数据卷的用户口令。

数据库就绪后：

```powershell
npm.cmd run migration:run
npm.cmd run start:dev
```

默认地址：`http://localhost:3000/api/v1`。启动不自动建表，不使用 `synchronize`。迁移由 `schema_migrations` 记录，重复执行会跳过已经完成的迁移。

生产运行：

```powershell
npm.cmd run build
npm.cmd run migration:run:prod
npm.cmd start
```

部署时保留 `dist/`、`database/schema.sql`、package 文件和生产依赖。配置 `NODE_ENV=production`、正式协议内容及版本、随机 JWT 密钥和 `CORS_ORIGINS`。生产环境会拒绝协议占位内容。

## 接口联调

先 GET `/public/legal-documents/TERMS` 和 `/public/legal-documents/PRIVACY` 展示当前协议，用户同意后提交版本。

注册请求：

```json
{
  "phone": "+8613800000000",
  "password": "Example#Password9",
  "nickname": "小雨",
  "termsVersion": "2026-10-01",
  "privacyVersion": "2026-10-01"
}
```

注册密码 10–72 个字符，昵称可选，默认“新用户”。未知字段均拒绝，包括 `role`、`status`、`membership`、`smsCode` 和 `challengeId`。记录用户同意的协议版本和时间。

密码登录请求：

```json
{"phone":"+8613800000000","password":"Example#Password9"}
```

响应为 `code/message/data/requestId/timestamp`；`data` 含 `accessToken`、`accessExpiresInSeconds`、`refreshToken`、`refreshExpiresAt`、`tokenType`、`user`。受保护接口使用 `Authorization: Bearer <accessToken>`。

刷新提交 `{"refreshToken":"当前刷新令牌"}`。前端必须单飞刷新，成功后替换两个令牌；旧令牌重放会撤销整个会话，包括并发刷新中刚获得的新令牌。退出仅撤销当前设备，改密撤销全部设备。前端使用安全凭证存储，不把令牌写入 URL 或日志；当前采用 JSON 令牌，无 Cookie 会话。

可直接使用 [REST Client 请求示例](../examples/auth.http)。

| HTTP | code | 含义 |
|---|---|---|
| 400 | VALIDATION_ERROR | 格式、类型、未知字段错误 |
| 401 | AUTH_REQUIRED | 缺少访问令牌 |
| 401 | AUTH_INVALID_CREDENTIALS | 手机号或密码错误，不区分账号不存在 |
| 401 | TOKEN_EXPIRED | JWT 过期，可尝试一次刷新 |
| 401 | TOKEN_INVALID | JWT 无效、会话撤销或到期、刷新令牌无效 |
| 401 | REFRESH_TOKEN_REUSED | 旧刷新令牌重放，会话已撤销 |
| 403 | ACCOUNT_BANNED | 正确凭证对应的账号不可用 |
| 404 | RESOURCE_NOT_FOUND | 路由、资源不存在，或会话不属于本人 |
| 409 | PHONE_ALREADY_REGISTERED | 手机号已注册 |
| 409 | PROTOCOL_VERSION_CHANGED | 需要重新阅读并同意最新协议 |
| 429 | RATE_LIMITED | 等待 Retry-After 指定的秒数 |

## 数据表与认证机制

DDL：[database/schema.sql](../database/schema.sql)，迁移：[CreateAuth](../src/database/migrations/1792713600000-CreateAuth.ts)。推荐通过迁移建表，不要先手动导入 SQL 再执行首次迁移。

| 表 | 关键字段 | 用途与约束 |
|---|---|---|
| users | id、phone、password_hash、nickname、status、phone_verified_at、terms_version、privacy_version、consented_at、last_login_at | UUID 主键，手机号唯一，密码仅存随机盐 scrypt 哈希 |
| auth_sessions | id、user_id、device_label、expires_at、revoked_at、last_active_at | 外键关联用户，有效会话和到期索引，用于立即撤销 JWT |
| refresh_tokens | id、session_id、token_hash、used_at | 外键关联会话，SHA-256 哈希唯一，保留消费记录以识别重放 |
| schema_migrations | id、timestamp、name | TypeORM 创建的迁移记录 |

InnoDB、utf8mb4，ID、手机号与令牌哈希使用 ascii 精确比较，日期采用 UTC `datetime(3)`，默认值使用 UTC_TIMESTAMP，不依赖 MySQL 服务器时区。用户 updated_at 由服务端在修改时显式更新。用户创建、首个会话和令牌在同一事务内提交；数据库唯一约束处理并发重复注册。

刷新、改密、撤销按“用户 → 会话 → 令牌”顺序加行锁。重放时先提交会话撤销，再返回异常，避免回滚撤销结果。旧刷新令牌至少保留到会话到期；未来可分批清理到期会话，令牌通过外键级联删除。当前没有自动清理任务。

默认 JWT 15 分钟，会话与刷新令牌最长 30 天；刷新不延长绝对到期时间。每次鉴权检查会话和用户状态。未来封禁接口必须在修改状态的同一事务中撤销用户全部会话。

`migration:revert` 删除这三张业务表，仅适合可丢弃开发库，并需额外 DROP 权限。MySQL DDL 隐式提交，首次迁移失败后需检查已创建的表，再处理重试。

## 测试与部署边界

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
python scripts/build_api_docs.py
```

数据库端到端测试必须使用以 `_test` 结尾的独立库，先创建测试库及账号：

```sql
CREATE DATABASE chunai_auth_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'chunai_test'@'localhost' IDENTIFIED BY 'replace-with-your-test-password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON chunai_auth_test.* TO 'chunai_test'@'localhost';
```

在 `.env` 配置 `TEST_DB_*`，运行 `npm.cmd run test:e2e`。测试执行迁移，结束时仅删除本次测试用户及其级联会话，不删除数据库。覆盖 MySQL 唯一约束、外键、注册登录、并发刷新、重放撤销、退出、改密、会话归属、封禁、过期、参数和 HTTP 限流。

限流采用 NestJS 进程内存存储，适用于单实例：注册 5 次/分钟、登录 10 次/分钟、刷新 30 次/分钟、改密 5 次/分钟，均按 IP 计数。多实例部署需改用共享存储。默认不信任 X-Forwarded-For；经过反向代理时需明确可信代理范围和真实来源 IP。

实现参考：[NestJS 认证](https://docs.nestjs.com/security/authentication)、[TypeORM 迁移](https://typeorm.io/docs/advanced-topics/migrations/)。
