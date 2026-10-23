# GitHub Actions 与云服务器部署

目标仓库：`WOWBIGDAN/chunai-platform`，分支 `main`。服务器 `47.97.46.242`，Ubuntu 24.04，Node.js 22、MySQL 8.0、Nginx、systemd。此次按测试服务部署，使用公网 IP 访问。

## 发布流程

[CI/CD 工作流](../.github/workflows/ci-cd.yml) 对 PR 和 main 推送运行类型检查、单元测试、真实 MySQL 端到端测试、构建和接口契约校验。只有 main 分支通过全部检查后才打包并部署。也可以在 Actions 页面手动运行。

构建在 GitHub Ubuntu runner 上完成；归档包含编译后的代码、SQL、生产依赖及提交 SHA。服务器无需拉取 GitHub 仓库或安装 npm 依赖。部署使用独立 SSH 用户、固定服务器主机公钥和文件 SHA256 校验。服务器登录密码不写入仓库或工作流。

部署按顺序执行：上传 → 校验和安全解包 → 以应用账号执行迁移 → 原子切换 current → 重启 → 本机和公网健康检查。并发发布通过 Actions concurrency 与服务器 flock 串行执行。数据库迁移失败时旧版本继续运行；应用健康检查失败时自动切回上一个应用版本。

应用回滚不撤销数据库迁移，后续迁移需要兼容上一版代码。单实例重启会有短暂切换时间。

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

## 日常运维

以下命令由服务器管理员执行：

```bash
systemctl status chunai-api --no-pager
journalctl -u chunai-api -n 100 --no-pager
curl --fail http://127.0.0.1:3000/api/v1/health
cat /opt/chunai/DEPLOYED_REVISION
systemctl status mysql nginx --no-pager
```

修改 `/etc/chunai/api.env` 后执行 `systemctl restart chunai-api`。定期将 MySQL 备份到服务器外部，并根据磁盘用量清理旧发布目录；当前不自动删除历史成功版本。

手动应用回滚（先确认 previous 指向的确为所需版本）：

```bash
target=$(readlink -f /opt/chunai/previous)
case "$target" in /opt/chunai/releases/*) ;; *) exit 1 ;; esac
test -d "$target"
ln -sfn "$target" /opt/chunai/.rollback-next
mv -Tf /opt/chunai/.rollback-next /opt/chunai/current
systemctl restart chunai-api
curl --fail http://127.0.0.1:3000/api/v1/health
```

部署私钥轮换时，更新 `chunai-deploy` 的 authorized_keys 和 GitHub 的 DEPLOY_SSH_KEY；服务器主机密钥变化时，核实新指纹后更新 DEPLOY_KNOWN_HOSTS。

参考：[GitHub 部署与并发](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)。
