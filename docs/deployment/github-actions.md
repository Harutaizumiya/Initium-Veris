# GitHub Actions Deployment

后端部署由 `.github/workflows/deploy-api.yml` 执行，当前只部署 `apps/api`。

## Trigger
- push 到 `main`
- GitHub Actions 页面手动运行 `Deploy API`

工作流使用 `concurrency.group = deploy-api`，新的部署会取消仍在运行的旧部署。

## Required Secrets
在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 添加：

| Secret | Required | Default | 说明 |
| --- | --- | --- | --- |
| `SERVER_HOST` | 是 | 无 | 目标服务器地址 |
| `SERVER_SSH_KEY` | 是 | 无 | 可登录服务器的私钥内容 |
| `SERVER_PORT` | 否 | `22` | SSH 端口 |
| `SERVER_USER` | 否 | `root` | SSH 用户 |
| `GH_DEPLOY_TOKEN` | 否 | 空 | 私有仓库或受限仓库拉取代码时使用 |

## Server Contract
服务器需要提前满足：

- `/opt/Initium-Veris` 已是该仓库的 Git working tree
- Docker 可用
- systemd 服务 `initium-veris-api.service` 存在
- 后端环境文件位于 `/opt/Initium-Veris/apps/api/.env`
- `.env` 至少提供生产可用的 `DATABASE_URL`
- 部署脚本会在缺失时生成 `DJANGO_SECRET_KEY`、`AUTH_TOKEN_PEPPER`、`QR_TOKEN_PEPPER`
- 部署脚本会写入生产域名相关的 `DJANGO_ALLOWED_HOSTS`、`CORS_ALLOWED_ORIGINS`、`CSRF_TRUSTED_ORIGINS`

生产环境不应设置 `DJANGO_DEBUG=1`。当前 Django 默认 `DEBUG=false`，本地 `pnpm --filter api dev` 才会显式开启。

## Deployment Steps
工作流通过 SSH 在服务器执行：

1. 设置仓库远端为 `https://github.com/Harutaizumiya/Initium-Veris.git`。
2. fetch `main` 分支。
3. `git reset --hard origin/main` 更新 `/opt/Initium-Veris`。
4. 检查 `/opt/Initium-Veris/apps/api/.env` 是否包含 `DATABASE_URL`，并补齐后端生产密钥、Host、CORS 和 CSRF 配置。
5. 使用 `apps/api/Dockerfile` 构建 `initium-veris-api:latest`。
6. `systemctl daemon-reload`。
7. 重启 `initium-veris-api.service`。
8. 检查 systemd 服务处于 active。
9. 最多等待 20 秒检查 `http://127.0.0.1:8000/api/ping` 返回 `pong`。
10. 如果健康检查失败，输出 `systemctl status` 和最近的 service journal，便于定位容器启动错误。

## Health Check

```text
GET /api/ping
```

正常响应：

```text
pong
```

该接口不需要登录，不访问数据库，适合作为容器和 systemd 启动后的快速探活。

## Notes
- 工作流当前只构建后端镜像，不部署 Web 或移动端。
- 远端更新使用 `git reset --hard origin/main`，服务器工作树不能承载未备份的本地改动。
- Dockerfile 直接安装 Python 依赖并启动 `gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2`。
- `apps/api/.dockerignore` 会排除 `.env`，生产环境变量必须由 systemd/docker 运行时注入，不能依赖镜像内置。
