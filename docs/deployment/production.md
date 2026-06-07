# Production Deployment

本文档记录 Initium-Veris 完整应用的生产部署流程。README 只保留快速入口，Docker、Nginx、systemd 和 GitHub Actions 等细节集中维护在这里。

## 1. 部署 PostgreSQL

准备生产 PostgreSQL，并创建业务数据库。后端通过 `DATABASE_URL` 读取连接信息：

```env
DATABASE_URL=postgresql://user:password@db-host:5432/initium_veris?sslmode=require
```

如果需要 Redis cache，额外提供：

```env
REDIS_URL=redis://redis-host:6379/0
```

## 2. 配置后端环境变量

在服务器创建 `/opt/Initium-Veris/apps/api/.env`：

```env
DATABASE_URL=postgresql://user:password@db-host:5432/initium_veris?sslmode=require
DJANGO_SECRET_KEY=replace-with-long-random-secret
AUTH_TOKEN_PEPPER=replace-with-long-random-secret
QR_TOKEN_PEPPER=replace-with-long-random-secret
DJANGO_ALLOWED_HOSTS=your-domain.example,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://your-domain.example
CSRF_TRUSTED_ORIGINS=https://your-domain.example
AUTH_TOKEN_COOKIE_SECURE=true
CSRF_COOKIE_SECURE=true
```

生产环境不要设置 `DJANGO_DEBUG=1`。

## 3. 构建并运行后端 API

生产环境至少需要：

- Linux 服务器
- Docker
- PostgreSQL 连接串
- `/opt/Initium-Veris` 仓库工作树
- `/opt/Initium-Veris/apps/api/.env` 生产环境变量文件

构建镜像：

```bash
cd /opt/Initium-Veris
docker build -t initium-veris-api:latest apps/api
```

运行容器：

```bash
docker run --rm --name initium-veris-api \
  --env-file /opt/Initium-Veris/apps/api/.env \
  -p 127.0.0.1:8000:8000 \
  initium-veris-api:latest
```

验证 API：

```bash
curl http://127.0.0.1:8000/api/ping
```

正常响应：

```text
pong
```

## 4. 使用 systemd 托管后端

创建 `/etc/systemd/system/initium-veris-api.service`：

```ini
[Unit]
Description=Initium-Veris Django API
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/opt/Initium-Veris
ExecStartPre=-/usr/bin/docker stop initium-veris-api
ExecStartPre=-/usr/bin/docker rm initium-veris-api
ExecStart=/usr/bin/docker run --rm --name initium-veris-api --env-file /opt/Initium-Veris/apps/api/.env -p 127.0.0.1:8000:8000 initium-veris-api:latest
ExecStop=/usr/bin/docker stop initium-veris-api
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable initium-veris-api.service
sudo systemctl restart initium-veris-api.service
sudo systemctl status initium-veris-api.service
```

## 5. 部署 Web 管理端

构建 Web：

```bash
pnpm install
pnpm --filter web build
```

构建产物位于：

```text
apps/web/dist
```

将 `apps/web/dist` 上传到静态托管平台或 Nginx 静态目录。部署平台需要开启 SPA 回退，把未知路径回退到 `index.html`。

Nginx 静态站点示例：

```nginx
server {
  listen 80;
  server_name your-domain.example;
  root /var/www/initium-veris-web;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## 6. 配置反向代理

如果 Web 与 API 使用同一域名，可将 `/api/` 转发到 Django API：

```nginx
server {
  listen 443 ssl http2;
  server_name your-domain.example;

  root /var/www/initium-veris-web;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:8000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

请确保 `DJANGO_ALLOWED_HOSTS`、`CORS_ALLOWED_ORIGINS` 和 `CSRF_TRUSTED_ORIGINS` 与生产域名一致。

## 7. 使用 GitHub Actions 部署后端

仓库内置 `.github/workflows/deploy-api.yml`，会在 push 到 `main` 或手动触发时部署后端 API。

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 配置：

| Secret | 必填 | 说明 |
| --- | --- | --- |
| `SERVER_HOST` | 是 | 服务器地址 |
| `SERVER_SSH_KEY` | 是 | 可登录服务器的 SSH 私钥 |
| `SERVER_PORT` | 否 | SSH 端口，默认 `22` |
| `SERVER_USER` | 否 | SSH 用户，默认 `root` |
| `GH_DEPLOY_TOKEN` | 否 | 私有仓库拉取代码时使用 |

服务器需提前满足：

- `/opt/Initium-Veris` 已经是该仓库的 Git working tree
- Docker 可用
- systemd 服务 `initium-veris-api.service` 已存在
- `/opt/Initium-Veris/apps/api/.env` 已存在并至少包含 `DATABASE_URL`

工作流会拉取 `main`、构建 `initium-veris-api:latest`、重启 systemd 服务，并检查 `/api/ping`。

更详细的 Actions 说明见 [github-actions.md](github-actions.md)。

## 8. 部署移动端

移动端生产构建前必须设置 API 地址：

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-domain.example/api pnpm --filter mobile android
```

iOS 构建同理：

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-domain.example/api pnpm --filter mobile ios
```

真机或生产包需要能访问同一个 Django API 域名，并与后端 CORS / CSRF 配置保持一致。
