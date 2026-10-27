# GitHub Actions 与云服务器部署

目标仓库：`WOWBIGDAN/chunai-platform`，分支 `main`。服务器 `47.97.46.242`，Ubuntu 24.04，Node.js 22、MySQL 8.0、Nginx、systemd。此次按测试服务部署，使用公网 IP 访问。

更新时间：2026-10-27。

购物车与收藏的增量迁移为 `CartFavorites1793232000000`，新增 `cart_items`、`content_favorites` 和可空 `order_quotes.cart_items`。不需要新增环境变量或第三方凭证；发布时先备份数据库，再由现有迁移步骤升级，详见 [购物车与收藏](11-cart-favorites.md)。

物流查询使用 `LogisticsTracking1793318400000` 增量迁移，扩展包裹同步字段、RETURNED 状态约束及轨迹去重索引。服务器 `/etc/chunai/api.env` 配置 `LOGISTICS_PROVIDER=ALIYUN` 和 `LOGISTICS_APPCODE`，权限 0600，真实凭证不提交仓库。默认 30 分钟缓存、每分钟扫描最多 10 单；配置、回退为人工模式及测试说明见 [物流轨迹](12-logistics.md)。发布前备份环境文件和数据库，迁移完成后重启服务。

分类拆分迁移为 `SplitContentCategories1793404800000`，将 CONTENT 拆成 SCIENCE 和 COURSE，保留原科普分类 ID，为课程复制同层级分类并更新课程关联。发布前备份；前端分类查询/创建须改用新 scope，旧 CONTENT 返回 400。无新增环境变量，详见 [分类说明](13-category-scopes.md)。

站内消息使用 `InAppMessages1793491200000` 增量迁移，新增 `user_message_states` 和 `user_messages`。原有完整管理员增加 `messages:write`，受限管理员权限保持原样。无需新环境变量、Redis 或消息队列；迁移后重启应用即可启用业务通知。前端按 60 秒以上间隔调用短轮询接口，隐藏页暂停，详见 [站内消息](14-messages.md)。迁移不会给历史业务补发消息。

实物交易、科普、课程购买访问与专栏使用同一 CI/CD。外链视频和有效期会员的配置、调用说明见 [内容模块](08-content-courses.md)。部署使用增量迁移，保留已有用户、产品与订单。视频目录使用 `/var/lib/chunai/content-media`，需安装当前 Nginx、systemd 模板并配置 `PUBLIC_API_URL`。新外链视频需要独立的 `CONTENT_MEDIA_ENCRYPTION_KEY`，必须先在服务器配置后再发布；数据库、私有视频及密钥须一起备份。以下首次部署记录保留为历史事实。

## 当前环境与部署记录

| 项目 | 当前值 |
|---|---|
| 服务入口 | [http://47.97.46.242](http://47.97.46.242)，根路径返回后端服务说明 JSON |
| API 基础地址 | `http://47.97.46.242/api/v1` |
| 健康检查 | [GET /api/v1/health](http://47.97.46.242/api/v1/health) |
| 运行环境 | `NODE_ENV=staging`，用于开发联调和功能测试 |
| 应用账号 | `chunai`，由 systemd 启动 |
| 自动部署账号 | `chunai-deploy`，使用专用 SSH 密钥 |
| 管理入口 | `ssh root@47.97.46.242`，SSH 端口 22 |
| 数据库 | `chunai_platform`，应用账号 `chunai`，仅通过本机 3306 连接 |
| OSS | 杭州 `cn-hangzhou`；公开图片 Bucket `chunai-photo`，私有 Bucket `chunai-private`，ECS RAM 角色 `chunai-oss`；全局与公开图片桶关闭“阻止公共访问”，私有桶保持开启 |
| 当前协议版本 | TERMS、PRIVACY 均为 `2026-10-23-test`，后续以协议接口为准 |

首次成功部署提交：[6745b62bcbc96d6d8369539d0ee8abf73e1d1637](https://github.com/WOWBIGDAN/chunai-platform/commit/6745b62bcbc96d6d8369539d0ee8abf73e1d1637)。[对应 GitHub Actions](https://github.com/WOWBIGDAN/chunai-platform/actions/runs/39931044243) 已完成测试、构建、契约校验、数据库迁移、自动发布和公网健康检查。公网注册、资料读取、密码登录、刷新、退出与令牌失效验证已通过，验证用临时账号及其会话已删除。

已完成的服务器清理范围为旧 `/opt/deepseek` 项目、`deepseek-api` PM2 进程及状态、旧 Nginx 站点配置。操作系统、SSH 和阿里云系统组件保留。新应用、MySQL 和 Nginx 均已启用开机自启动。

## 发布流程

[CI/CD 工作流](../.github/workflows/ci-cd.yml) 对 PR 和 main 推送运行类型检查、单元测试、真实 MySQL 端到端测试、构建和接口契约校验。只有 main 分支通过全部检查后才打包并部署。也可以在 Actions 页面手动运行。

构建在 GitHub Ubuntu runner 上完成；归档包含编译后的代码、SQL、生产依赖及提交 SHA。服务器无需拉取 GitHub 仓库或安装 npm 依赖。部署使用独立 SSH 用户、固定服务器主机公钥和文件 SHA256 校验。服务器登录密码不写入仓库或工作流。

部署按顺序执行：上传 → 校验和安全解包 → 以应用账号执行迁移 → 原子切换 current → 重启 → 本机和公网健康检查。并发发布通过 Actions concurrency 与服务器 flock 串行执行。

| 触发方式 | 执行结果 |
|---|---|
| 向 main 推送提交 | 测试、构建、打包，成功后自动部署至 staging |
| 创建或更新目标为 main 的 PR | 只运行测试与构建校验，不部署 |
| Actions → CI and deploy → Run workflow，选择 main | 手动运行同一条测试与部署流水线 |

数据库迁移在切换版本之前执行，迁移失败时旧版本继续运行。服务器本机健康检查最多尝试 30 次，每次失败后等待 2 秒；有上一个版本时恢复原 current 并重启，首次部署无旧版本时停止新应用。工作流最后的公网健康检查失败会将部署任务标记为失败，不自动再次回滚，需要检查 Nginx、安全组和外部网络。

应用回滚不撤销数据库迁移，后续迁移需要兼容上一版代码。单实例重启会有短暂切换时间。

每次发布完成后，在 [Actions 列表](https://github.com/WOWBIGDAN/chunai-platform/actions) 查看 verify-build 和 deploy 两个任务，再访问公网健康检查。构建归档在 Actions 中保留 3 天；服务器历史发布目录需由管理员按磁盘用量维护。

## GitHub Secrets

仓库 Settings → Secrets and variables → Actions 使用以下四项：

| 名称 | 内容 |
|---|---|
| DEPLOY_HOST | 47.97.46.242 |
| DEPLOY_USER | chunai-deploy |
| DEPLOY_SSH_KEY | 专用部署 SSH 私钥 |
| DEPLOY_KNOWN_HOSTS | 经首次 SSH 连接记录的服务器主机公钥 |

部署用户只对发布程序拥有 sudo 权限；应用以 `chunai` 用户运行。服务器管理员维护 `/usr/local/sbin/chunai-release`、systemd 单元和 Nginx 配置，工作流只发布应用归档，不自动覆盖这些系统文件。

## 服务器布局

| 路径 | 用途 |
|---|---|
| `/etc/chunai/api.env` | 数据库口令、JWT 密钥和运行配置，仅 root 可读 |
| `/opt/chunai/incoming/` | 部署用户上传的临时归档 |
| `/opt/chunai/releases/<commit>` | 由完整 Git 提交 SHA 标识的版本 |
| `/opt/chunai/current` | 当前应用版本的符号链接 |
| `/opt/chunai/previous` | 上一个成功版本的符号链接 |
| `/opt/chunai/DEPLOYED_REVISION` | 最近发布成功的提交 SHA |
| `/usr/local/sbin/chunai-release` | root 所有的发布入口 |
| `/etc/systemd/system/chunai-api.service` | 应用进程与资源限制 |
| `/etc/nginx/sites-available/chunai` | 公网 80 端口的代理配置 |
| `/etc/mysql/mysql.conf.d/chunai.cnf` | 本机绑定、UTC 和适合当前内存的数据缓存配置 |

公网入口为 `http://47.97.46.242`，API 前缀为 `/api/v1`，健康检查为 `/api/v1/health`。此仓库目前提供后端，没有前端站点；根路径返回服务说明 JSON。

Nginx 监听 80，应用只监听 `127.0.0.1:3000`，MySQL 只监听本机。Nginx 覆盖客户端传入的 X-Forwarded-For，应用只信任本机代理，使 IP 限流使用真实来源地址。

`NODE_ENV=staging` 表示本次测试部署；用户协议和隐私政策版本为 `2026-10-23-test`。注册前先查询当前协议版本，不直接提交开发文档的旧版本。正式上线时配置正式协议、允许的前端来源和域名 HTTPS，再将运行环境改为 production。

## 修改运行配置

SSH 登录后，以管理员身份编辑环境文件：

```bash
sudoedit /etc/chunai/api.env
systemctl restart chunai-api
curl --fail http://127.0.0.1:3000/api/v1/health
```

| 配置项 | 当前设置或修改方式 |
|---|---|
| NODE_ENV | staging；正式协议配置完成后才能切换 production |
| HOST / PORT | 127.0.0.1 / 3000，对应 Nginx 的本机上游 |
| TRUST_PROXY | loopback，仅信任本机 Nginx |
| CORS_ORIGINS | 当前允许 `http://47.97.46.242,http://localhost:5173`；新增前端来源以逗号分隔，不带路径 |
| DB_HOST / DB_PORT / DB_NAME | 127.0.0.1 / 3306 / chunai_platform |
| DB_PASSWORD / JWT_SECRET | 保存在服务器文件中；修改数据库口令时需同步修改 MySQL 账号 |
| CONTENT_IMAGE_OSS_HOST | chunai-photo.oss-cn-hangzhou.aliyuncs.com；新内容／专栏封面须为该主机下已存在的公开 HTTPS 对象 |
| UPLOAD_OSS_REGION | cn-hangzhou |
| UPLOAD_OSS_PUBLIC_BUCKET / UPLOAD_OSS_PRIVATE_BUCKET | chunai-photo / chunai-private；两桶 ACL 为 private，版本控制均未开启 |
| UPLOAD_OSS_RAM_ROLE | chunai-oss；通过已绑定的 ECS RAM 角色获取临时凭证，不混用 AccessKey／STS 环境变量 |
| CONTENT_MEDIA_ENCRYPTION_KEY | 32 字节随机密钥的标准 base64；仅存服务器环境文件，用于外链及飞书密码加密，必须备份，不能直接换值 |
| CONTENT_MEDIA_DIR / PUBLIC_API_URL | /var/lib/chunai/content-media 与 http://47.97.46.242/api/v1；保留本地视频及短时播放授权 |
| TERMS_VERSION / PRIVACY_VERSION | 当前均为 2026-10-23-test；更新协议时同时更新内容和版本 |
| TERMS_HTML / PRIVACY_HTML / LEGAL_UPDATED_AT | 协议正文和更新时间，更新时间使用 UTC ISO 8601 |

`/etc/chunai/api.env` 权限为 600、所有者 root，systemd 读取后传给应用。GitHub 发布不会覆盖该文件。服务器使用原生 MySQL 服务；仓库根目录的 Compose 配置用于本地开发。

私有 Bucket 已配置 `uploads/staging/` 一天过期的生命周期规则，CORS 允许 `http://47.97.46.242`、`http://localhost:5173` 的 `POST` 和 `Content-Type` 请求头。新增前端来源时同步维护 OSS CORS 与 API 的 `CORS_ORIGINS`。配置与完整联调步骤见 [统一上传说明](10-unified-uploads.md)；可按 [RAM 权限模板](../deploy/oss-ram-policy.example.json) 收窄角色权限。

发布公开图片还要求 OSS 全局与 `chunai-photo` 关闭“阻止公共访问”，以允许最终图片对象的 `public-read` ACL；当前已按此配置，`chunai-private` 保持开启。两桶 ACL 仍为 `private`，具体规则见[阿里云官方说明](https://help.aliyun.com/zh/oss/user-guide/block-public-access)。

2026-10-26 已通过 38 项真实 API 检查，覆盖公开头像／封面、私有售后凭证和 MP4 的 OSS 直传、完成确认、读取隔离、头像引用保护、退出撤权及会员视频 Range／撤权；本次测试用户、素材和课程分类已清理，详见 [真实 OSS 联调记录](10-unified-uploads.md#oss-配置与启用)。

修改 [发布程序](../deploy/chunai-release)、[systemd 模板](../deploy/chunai-api.service) 或 [Nginx 模板](../deploy/nginx.conf) 后，还需要管理员将对应文件安装到上表中的服务器路径。systemd 单元更新后执行 `systemctl daemon-reload` 并重启应用；Nginx 更新后先执行 `nginx -t`，通过后再 `systemctl reload nginx`。

## 日常运维

以下命令由服务器管理员执行：

```bash
systemctl status chunai-api --no-pager
journalctl -u chunai-api -n 100 --no-pager
curl --fail http://127.0.0.1:3000/api/v1/health
cat /opt/chunai/DEPLOYED_REVISION
readlink -f /opt/chunai/current
systemctl status mysql nginx --no-pager
systemctl is-enabled chunai-api mysql nginx
```

`DEPLOYED_REVISION` 记录最近一次自动发布成功的提交；手动回滚后，该文件仍保留发布记录，实际应用版本以 current 的指向为准。历史版本由管理员管理，清理时需保留 current 和 previous 指向的目录。

手动应用回滚：首次部署还没有 previous，需要先确认已存在上一版本。以下命令只切换应用，不操作数据库：

```bash
test -L /opt/chunai/previous
target=$(readlink -f /opt/chunai/previous)
case "$target" in /opt/chunai/releases/*) ;; *) exit 1 ;; esac
test -d "$target"
ln -sfn "$target" /opt/chunai/.rollback-next
mv -Tf /opt/chunai/.rollback-next /opt/chunai/current
systemctl restart chunai-api
curl --fail http://127.0.0.1:3000/api/v1/health
```

## 数据库备份

管理员可使用本机 MySQL 的 root Socket 认证导出数据，无需将应用数据库密码写入命令：

```bash
set -euo pipefail
umask 077
install -d -m 0700 /var/backups/chunai
backup_file="/var/backups/chunai/chunai-$(date -u +%Y%m%d-%H%M%S).sql.gz"
mysqldump --protocol=socket -uroot --single-transaction --no-tablespaces \
  --databases chunai_platform | gzip > "$backup_file"
gzip --test "$backup_file"
```

将验证通过的备份复制到服务器外部；仓库当前没有配置定时备份任务。恢复备份前，应核对目标库和备份时间，并先备份当前数据，因为 SQL 导入可能替换同名表。全部迁移执行后数据库有 36 张业务表（认证、交易、内容、会员、统一上传、购物车及收藏）和 schema_migrations，物流迁移扩展现有表。另行备份 `/var/lib/chunai/content-media` 与受保护的 `/etc/chunai/api.env`；丢失媒体加密密钥将无法解密数据库中的外链和密码。密钥备份按秘密保管，不能提交 Git。统一上传的 OSS 正式对象也需备份，不能仅备份数据库；配置要求见 [统一上传](10-unified-uploads.md)。

## 常见联调与部署问题

| 现象 | 检查方法 |
|---|---|
| 根路径显示 JSON | 当前提供后端 API；使用 `/api/v1` 调用接口，导入 [认证 OpenAPI](openapi-auth.json) 查看已实现功能 |
| 注册返回 409 PROTOCOL_VERSION_CHANGED | 重新读取 TERMS 和 PRIVACY，提交同一环境返回的当前版本 |
| 浏览器报告 CORS 错误 | 检查前端来源是否在 CORS_ORIGINS 中，修改后重启应用 |
| 访问尚未开发的业务接口返回 404 | 查看 OpenAPI 的 x-implementation-status，只调用 implemented 接口 |
| 公网返回 502 | 检查 `systemctl status chunai-api` 和应用日志，再请求本机 3000 端口的健康接口 |
| 健康接口返回 500 | 检查 MySQL 服务、应用数据库连接和迁移日志 |
| 旧令牌返回 401 | 退出、改密或刷新令牌重放后重新登录；刷新请求须单飞并保存新令牌 |
| Actions 上传或登录失败 | 检查部署账号的 authorized_keys、SSH 22 端口、四项 Secrets 和服务器主机公钥是否匹配 |
| 统一上传返回 503 STORAGE_UNAVAILABLE | 检查 ECS RAM 角色临时凭证、两桶区域、Bucket ACL／Policy／版本控制及 RAM 授权；当前使用杭州区域的 chunai-photo、chunai-private 与角色 chunai-oss，变量模板见 `.env.example`，完整步骤见 [统一上传配置](10-unified-uploads.md#oss-配置与启用) |
| OSS POST 成功但公开图片完成确认失败，OSS 返回 403／EC 0016-00000901 | 检查 OSS 全局与 chunai-photo 的“阻止公共访问”是否均已关闭；私有桶保持开启，公开图片需要服务端设置对象 public-read ACL |

部署私钥轮换时，更新 `chunai-deploy` 的 authorized_keys 和 GitHub 的 DEPLOY_SSH_KEY；服务器主机密钥变化时，核实新指纹后更新 DEPLOY_KNOWN_HOSTS。

参考：[GitHub 部署与并发](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)。
