# Initium-Veris

<p align="center">
  <img src="docs/images/logo.png" width="112" alt="Initium-Veris logo" />
</p>

<p align="center">
  <strong>面向食品库存、批次、效期和扫码审计的现代化库存管理系统。</strong>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-22%2B-339933.svg" />
  <img alt="Python" src="https://img.shields.io/badge/Python-3.12%2B-3776AB.svg" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB.svg" />
  <img alt="Django" src="https://img.shields.io/badge/Django-6-092E20.svg" />
  <img alt="Turborepo" src="https://img.shields.io/badge/Turborepo-2-EF4444.svg" />
  <img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" />
</p>

Initium-Veris 是一个基于 Turborepo 的食品库存管理 monorepo。主链路由 React Web 管理端、Expo/React Native 移动端、共享 TypeScript API client 和 Django 6 / DRF 后端组成。后端通过 PostgreSQL 直连业务表，负责认证、组件级权限、商品、批次、库存操作、效期预警、二维码标签与扫码审计。

> `main` 分支保留完整应用代码与部署流程。若只需要无后端、无数据库的静态界面演示，请使用 `demo` 分支。

## 截图展示

| 库存看板 | 库存状态 |
| --- | --- |
| ![库存看板](docs/images/screenshot-dashboard.png) | ![库存状态](docs/images/screenshot-status.png) |

| 角色与权限 | 库存盘点 |
| --- | --- |
| ![角色与权限](docs/images/screenshot-roles.png) | ![库存盘点](docs/images/screenshot-stocktakes.png) |

## 核心功能

- **库存看板**：汇总库存概览、效期风险、趋势图表和待处理事项。
- **商品与批次管理**：维护商品主数据、批次信息、存储位置、保质期和库存状态。
- **库存操作链路**：支持入库、出库、调整、撤销、报损和操作审计。
- **效期预警**：根据批次到期时间计算临期、过期和正常状态。
- **二维码标签**：为批次生成二维码凭证，支持标签打印和移动端扫码核验。
- **扫码审计**：记录扫码来源、批次状态和处理结果，保留可追溯操作记录。
- **角色与权限**：通过账号、角色和组件级权限控制 Web 与移动端入口。
- **跨端复用**：`packages/api-client` 统一封装请求、认证头、CSRF、DTO 类型和 React Query 查询键。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| Web 管理端 | React 19、TypeScript、Vite、Tailwind CSS 4、React Router、React Query、Vitest |
| 移动端 | Expo、React Native、TypeScript、React Query、Expo Camera |
| API 服务 | Django 6、Django REST Framework、PostgreSQL、Redis cache 可选、Gunicorn |
| 共享包 | TypeScript API client、DTO 类型、接口函数、查询键 |
| 工程化 | pnpm workspace、Turborepo、uv、Docker、GitHub Actions |

## 仓库结构

```text
Initium-Veris/
├── apps/
│   ├── web/                 # React Web 管理端
│   ├── mobile/              # Expo / React Native 移动端
│   └── api/                 # Django 6 / DRF 后端
├── packages/
│   └── api-client/          # 共享 TypeScript API client
├── docs/
│   ├── backend/             # API、数据库和迁移说明
│   ├── deployment/          # 部署说明
│   ├── frontend/            # 前端结构、设计系统和日志说明
│   ├── mobile/              # 移动端结构说明
│   ├── shared/              # 共享包说明
│   └── images/              # README 截图资源
├── package.json             # 根任务入口
├── pnpm-workspace.yaml      # workspace 配置
└── turbo.json               # Turbo 任务编排
```

更多模块说明见 [docs/structure.md](docs/structure.md)。

## 环境要求

- Node.js 22+
- pnpm 10+
- Python 3.12+
- uv
- PostgreSQL 14+
- Docker，可选，生产镜像部署需要
- Redis，可选，启用共享缓存时需要

## 本地开发

安装 JavaScript workspace 依赖：

```bash
corepack enable
pnpm install
```

安装后端 Python 依赖：

```bash
cd apps/api
uv sync
cd ../..
```

创建 `apps/api/.env`：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/initium_veris
DJANGO_DEBUG=1
DJANGO_SECRET_KEY=local-django-secret-key
AUTH_TOKEN_PEPPER=dev-auth-token-pepper
QR_TOKEN_PEPPER=dev-qr-token-pepper
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

初始化数据库：

```bash
cd apps/api
uv run python manage.py migrate
cd ../..
```

启动 Web 与 API：

```bash
pnpm dev
```

默认地址：

- Web：`http://localhost:3000`
- API：`http://127.0.0.1:8000`
- 健康检查：`http://127.0.0.1:8000/api/ping`

移动端本地开发：

```bash
pnpm dev:mobile
```

真机调试时请把 API 地址设为电脑局域网 IP：

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:8000/api pnpm --filter mobile dev
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 通过 Turborepo 同时启动 `web` 和 `api` |
| `pnpm dev:debug` | 以前端 debug 模式启动 Web |
| `pnpm dev:mobile` | 启动 Expo 移动端 |
| `pnpm build` | 检查共享 API client、构建 Web，并执行 API 占位构建 |
| `pnpm test` | 运行共享包、Web 和 API 测试 |
| `pnpm lint` | 运行 TypeScript / Django check |
| `pnpm check-types` | 检查共享包、Web、API 和移动端类型 |

## 环境变量

### 后端 `apps/api/.env`

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接串，格式如 `postgresql://user:pass@host:5432/db` |
| `DJANGO_SECRET_KEY` | 生产必填 | Django 密钥，本地 debug 可使用开发默认值 |
| `AUTH_TOKEN_PEPPER` | 生产必填 | opaque auth token 的服务端 pepper |
| `QR_TOKEN_PEPPER` | 生产必填 | 二维码 token 的服务端 pepper |
| `DJANGO_ALLOWED_HOSTS` | 生产必填 | 逗号分隔的允许 Host |
| `CORS_ALLOWED_ORIGINS` | 生产必填 | 逗号分隔的前端源 |
| `CSRF_TRUSTED_ORIGINS` | 生产必填 | 逗号分隔的 CSRF 信任源 |
| `DJANGO_DEBUG` | 否 | 本地可设为 `1`，生产不要开启 |
| `REDIS_URL` | 否 | 配置后使用 Redis cache，否则使用本地内存 cache |

### Web

参考 [apps/web/.env.example](apps/web/.env.example)。日志相关变量：

```env
VITE_LOG_ENABLED=false
VITE_LOG_LEVEL=info
VITE_LOG_MAX_ENTRIES=200
```

### 移动端

生产构建必须显式设置：

```env
EXPO_PUBLIC_API_BASE_URL=https://your-domain.example/api
```

## 完整部署流程

### 1. 部署 PostgreSQL

准备生产 PostgreSQL，并创建业务数据库。后端通过 `DATABASE_URL` 读取连接信息：

```env
DATABASE_URL=postgresql://user:password@db-host:5432/initium_veris?sslmode=require
```

如果需要 Redis cache，额外提供：

```env
REDIS_URL=redis://redis-host:6379/0
```

### 2. 部署后端 API

生产环境至少需要：

- Linux 服务器
- Docker
- PostgreSQL 连接串
- `/opt/Initium-Veris` 仓库工作树
- `/opt/Initium-Veris/apps/api/.env` 生产环境变量文件

后端 `.env` 示例：

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

### 3. 使用 systemd 托管后端

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

### 4. 部署 Web 管理端

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

### 5. 配置反向代理

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

### 6. 使用 GitHub Actions 部署后端

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

详细说明见 [docs/deployment/github-actions.md](docs/deployment/github-actions.md)。

### 7. 部署移动端

移动端生产构建前必须设置 API 地址：

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-domain.example/api pnpm --filter mobile android
```

iOS 构建同理：

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-domain.example/api pnpm --filter mobile ios
```

真机或生产包需要能访问同一个 Django API 域名，并与后端 CORS / CSRF 配置保持一致。

## 文档

- [项目结构](docs/structure.md)
- [共享 API client](docs/shared/api-client.md)
- [Web 结构](docs/frontend/structure.md)
- [Web 设计系统](docs/frontend/design.md)
- [Web 日志与 debug](docs/frontend/logging.md)
- [移动端结构](docs/mobile/structure.md)
- [后端 API 契约](docs/backend/api.md)
- [后端数据库结构](docs/backend/db.md)
- [后端迁移计划](docs/backend/plan.md)
- [GitHub Actions 部署](docs/deployment/github-actions.md)

## 贡献

提交前建议至少运行：

```bash
pnpm lint
pnpm test
pnpm check-types
```

如果改动涉及数据库结构，请先对照 [docs/backend/db.md](docs/backend/db.md)。当前后端部分业务表由 Django model 映射既有生产表，变更前需要确认迁移边界。

## 开源协议

本项目使用 Apache License 2.0。
