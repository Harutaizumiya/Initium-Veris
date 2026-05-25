# GitHub Actions Deployment

后端部署由 `.github/workflows/deploy-api.yml` 触发：

- push 到 `main` 分支时自动部署
- 也可以在 GitHub Actions 页面手动运行 `Deploy API`

## Required Secrets

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 添加：

| Secret | Value |
| --- | --- |
| `SERVER_HOST` | `47.98.36.24` |
| `SERVER_USER` | `root` |
| `SERVER_PORT` | `22` |
| `SERVER_SSH_KEY` | 可登录服务器的私钥内容 |

如果仓库不是公开仓库，还需要添加：

| Secret | Value |
| --- | --- |
| `GH_DEPLOY_TOKEN` | 具有读取仓库权限的 GitHub token |

## Server Contract

工作流假设服务器已有：

- systemd 服务：`initium-veris-api.service`
- 环境文件：`/opt/initium-veris-api/.env`
- Docker 可用

每次部署会在服务器执行：

1. 在 `/opt/initium-veris-api/src` 拉取 `main` 分支最新代码。
2. 使用 `apps/api/Dockerfile` 构建 `initium-veris-api:latest`。
3. 重启 `initium-veris-api.service`。
4. 检查 `http://127.0.0.1:8000/api/auth/me` 返回 `200` 或未登录态 `401`。
