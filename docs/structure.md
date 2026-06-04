# Project Structure

## Overview
Initium-Veris 是一个基于 Turborepo 的食品库存管理 monorepo。当前主链路由 React Web 管理端、Expo/React Native 移动端、共享 TypeScript API client 和 Django 6/DRF 后端组成；后端通过 PostgreSQL 直连业务表，负责认证、组件级权限、商品、批次、库存操作、效期预警、二维码标签与扫码审计。

## Modules
- 仓库编排层：根目录 `package.json`、`pnpm-workspace.yaml`、`turbo.json` 负责 pnpm workspace 发现、统一脚本入口和 Turbo 任务编排
- 共享 API client：`packages/api-client` 提供请求封装、CSRF/Bearer token 处理、接口函数、DTO 类型、查询键和前端展示 adapter
- Web 管理端：`apps/web` 基于 React 19、Vite、Tailwind CSS 4、React Router 和 React Query，提供登录、权限路由、看板、商品、库存、报损、扫码审计、分析和设置页面
- 移动端：`apps/mobile` 基于 Expo、React Native 和 React Query，复用共享 API client，提供移动登录、库存查看、商品/批次操作、报损、扫码和账号/权限管理入口
- 后端认证与权限层：`apps/api/accounts` 负责 opaque token 签发与吊销、cookie/Bearer token 鉴权、CSRF、当前用户、角色、权限目录和用户管理
- 后端库存领域层：`apps/api/inventory` 负责商品、批次、库存增减与撤销、效期计算、二维码凭证、扫码审计、看板聚合、分析汇总和主数据审计
- 后端通用与配置层：`apps/api/config`、`apps/api/common` 负责 Django 设置、URL 汇总、环境变量解析、统一响应、异常映射、缓存和首页/健康检查
- 部署层：`.github/workflows/deploy-api.yml` 与 `apps/api/Dockerfile` 负责后端镜像构建、服务器 systemd 重启和 `/api/ping` 健康检查

## Data Flow
Web 和移动端通过 `packages/api-client` 访问 Django `/api`。登录主要走 `/api/auth/mobile-login` 获取 Bearer token，浏览器也可使用 `/api/auth/login` 获取 HttpOnly cookie；后续请求由 `CookieTokenAuthentication` 从 `Authorization: Bearer ...` 或 `veris_auth_token` cookie 解析用户。请求进入 `config.urls` 后分发到 `accounts` 或 `inventory`，DRF view 负责参数校验和权限解析，service 层执行业务规则并通过 Django ORM 读写 PostgreSQL。成功结果使用 `{ code, message, data }` 返回，前端由 React Query 缓存并在 mutation 后按 `queryKeys` 失效刷新。部署时 GitHub Actions 通过 SSH 拉取 `main`、构建后端 Docker 镜像、重启 systemd 服务，再检查 `/api/ping`。

## Next Steps
- 根 README 仍有“暂未拆分 `packages/*`”的历史表述，后续应同步为当前 `packages/api-client` 结构
- `apps/mobile/src/App.tsx` 当前承载大量页面和样式，后续应按页面、hooks、组件和样式拆分，避免移动端继续单文件膨胀
- 后端生产库业务表由 Django model 映射但部分为 `managed = False`，变更表结构前必须先对照 `docs/backend/db.md`
