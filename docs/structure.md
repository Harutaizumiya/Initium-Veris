# Project Structure

## Overview
这是一个基于 Turborepo 组织的前后端分离食品库存管理仓库，根工作区通过 `pnpm` 和 `turbo` 统一调度 React 管理端与 Django API。前端负责登录态感知、权限路由、页面交互和图表展示；后端负责 cookie 认证、权限校验、商品与批次管理、库存操作、看板分析以及二维码标签/扫码审计。

## Modules
- 仓库编排层：根目录 `package.json`、`pnpm-workspace.yaml`、`turbo.json` 负责工作区发现、统一脚本入口和任务编排
- 前端接入层：`apps/web/src/main.tsx`、`App.tsx`、`routes`、`components/auth` 负责应用启动、路由注册、登录拦截和权限守卫
- 前端页面与展示层：`apps/web/src/components/pages`、`layout`、`dashboard`、`charts`、`tables` 负责库存管理、看板、分析、扫码、设置等业务界面
- 前端状态与 API 适配层：`apps/web/src/providers`、`api`、`lib` 负责认证状态、React Query 缓存、请求封装、扫码/打印工具和日志
- 后端认证与权限层：`apps/api/accounts` 负责 CSRF、登录登出、当前用户、角色/权限/用户管理，以及基于 cookie token 的鉴权
- 后端库存领域层：`apps/api/inventory` 负责商品、批次、库存操作、效期预警、二维码凭证、扫码审计、看板和分析接口
- 后端通用与配置层：`apps/api/config`、`common` 负责 Django 配置、URL 汇总、数据库与环境变量解析、统一响应和异常处理

## Data Flow
用户先通过前端接入层进入登录页或受保护页面，`AuthProvider` 调用 `/api/auth/*` 初始化登录态，路由守卫根据权限码决定是否放行。页面层通过前端 API 适配层请求 Django `/api` 接口，并由 React Query 管理缓存和失效。后端请求先进入 `config.urls` 汇总的认证或库存路由，再由 `accounts` 完成 cookie 认证和权限校验，随后交给 `inventory.services` 执行业务规则、数据库读写、效期计算和扫码审计，最终通过 `common` 的统一响应结构返回前端。开发时，根工作区通过 `turbo dev` 并发启动 `apps/web` 的 Vite 服务和 `apps/api` 的 Django 服务。

## Next Steps
- 核对根 README 中声明的子项目文档是否都与当前实现同步，尤其是前端结构文档和后端 API 契约
- 验证前端 `src/api` 与后端 `docs/backend/api.md` 是否仍完全一致，避免路由或字段漂移
- 后续如需沉淀共享组件、类型或构建配置，可优先在 `packages/` 下拆分，而不是重新耦合 `apps/web` 与 `apps/api`
