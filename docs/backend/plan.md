# Backend Plan

## Current Baseline
后端当前已经不是旧 FastAPI/Supabase gateway 迁移阶段，而是 `apps/api` 下的 Django 6 + Django REST Framework 项目。运行时通过 `DATABASE_URL` 直连 PostgreSQL，使用 Django ORM 映射业务表，并由 `accounts`、`inventory`、`common`、`config` 组成主要结构。

当前已落地能力：

- 首页 `/` 和健康检查 `/api/ping`
- opaque token 认证，支持 HttpOnly cookie 和 Bearer token
- `/api/auth/mobile-login` 返回 `auth_token`，Web 和移动端均可使用
- CSRF token 获取与 cookie 登录路径
- 当前用户、角色、权限目录和用户管理
- 组件级权限控制，超级管理员拥有全部权限
- 商品、批次、库存操作、撤销、效期预警
- 二维码标签凭证和扫码审计
- 库存看板和分析汇总
- 主数据操作审计
- 后端 Dockerfile 和 GitHub Actions SSH 部署

## Architecture

```text
apps/api/
├─ manage.py
├─ pyproject.toml
├─ Dockerfile
├─ config/          # Django settings, urls, wsgi/asgi
├─ common/          # response, errors, env, cache, base APIView, home/ping
├─ accounts/        # token auth, roles, permissions, users
├─ inventory/       # products, batches, operations, QR, dashboard, analytics
└─ templates/       # index.html
```

请求进入 `config.urls` 后分发到 `accounts.urls` 或 `inventory.urls`。各 view 使用 serializer 校验输入，调用 service 执行业务规则，最后通过 `success_response` 或统一异常映射返回固定结构。

## Data Source Strategy
当前运行时数据源是 PostgreSQL，不再保留旧计划中的 MySQL 运行时或 Supabase HTTP gateway。`DATABASE_URL` 必须是 `postgres` 或 `postgresql` scheme；测试命令使用 SQLite 文件 `test.sqlite3`。

业务表策略：

- `product`、`batches`、`batch_operations`、`batch_qr_credentials`、`qr_scan_audit_logs` 在 Django model 中为 `managed = False`，表结构需要由数据库维护流程保证。
- `accounts_auth_tokens`、`inventory_audit_logs`、Django `auth_*` 和 session 相关表由 Django migrations 管理。
- `inventory` migrations 还包含对既有业务表补充 actor 字段和性能索引的安全 SQL。

## Auth And Permission Plan
- 保留 cookie 登录：`POST /api/auth/login` 设置 `veris_auth_token` HttpOnly cookie。
- 保留 token 登录：`POST /api/auth/mobile-login` 返回 `auth_token`，用于 Web local/session storage 和移动端内存 token。
- Bearer token 请求跳过 CSRF；cookie 状态变更请求仍要求 `X-CSRFToken`。
- 组件权限继续复用 Django `auth_permission` 和 `auth_group`，权限 content type 为 `accounts.componentpermission`。
- 用户管理 API 不创建超级管理员，超级管理员仍应通过 Django Admin、`createsuperuser` 或受控数据库流程创建。

## Immediate Work
1. 让 README、部署说明和环境变量说明统一当前 API 默认地址和 token 登录路径。
2. 为 `mobile-login`、Bearer token、扫码审计和权限管理补齐端到端测试。
3. 拆分 `apps/mobile/src/App.tsx`，避免移动端继续把页面、状态和样式都压在单文件。
4. 为 `managed = False` 的业务表建立明确的生产 DDL 变更流程，避免 migrations 与真实表结构漂移。
5. 为生产部署补齐 `DJANGO_SECRET_KEY`、`AUTH_TOKEN_PEPPER`、`QR_TOKEN_PEPPER`、`DJANGO_ALLOWED_HOSTS` 和可选 `REDIS_URL`，避免使用开发默认配置。

## Out Of Scope
- 不恢复旧 FastAPI 运行时。
- 不引入 MySQL 运行时依赖。
- 不把旧 Supabase HTTP gateway 作为当前主链路。
- 不在文档更新中顺手重构后端代码。
