# Frontend Structure

## Overview
前端由 Web 管理端、Expo 移动端和共享 API client 三部分组成。Web 负责桌面中后台体验，移动端负责移动工作台和扫码，二者共享 `@initium-veris/api-client` 的接口、类型、DTO 转换、query keys 和请求错误模型。

## Web App

- 入口：`apps/web/src/main.tsx` 创建 React 根节点，引入 `index.css`，并通过 `QueryProvider` 与 `AuthProvider` 包裹应用。
- 路由：`apps/web/src/App.tsx` 使用 React Router，公开 `/login`，其余页面进入 `ProtectedRoute` 和 `RouteAccessGuard`。
- 路由配置：`apps/web/src/routes/appRoutes.tsx` 定义总览、货物管理、库存状态、报损、扫码审计、分析、账号信息、用户管理、角色管理和权限目录。
- 权限：`routeAccess.ts` 按 `requiredPermissions`、`permissionMode` 和 `requiresSuperuser` 计算可访问页面；超级管理员自动放行。
- 数据：`apps/web/src/api` 主要重新导出 `@initium-veris/api-client`，并补充 Web 本地存储 token、日志、库存展示转换和二维码扫描封装。
- 页面：`apps/web/src/components/pages` 承载 Dashboard、商品、库存、报损、扫码、分析和设置页面。
- 布局：`components/layout`、`components/navigation`、`components/actions` 提供侧栏、顶部栏、资料区和浮动操作入口。
- 通用组件：`components/common` 提供错误边界、分页、徽标、位置、趋势和操作反馈。
- 图表和表格：`components/charts`、`components/tables` 提供看板和分析页面复用展示组件。
- 样式：`apps/web/src/index.css` 定义 Tailwind 4 `@theme` token、基础字体、全局 surface 和阴影工具。

## Mobile App

- 入口：`apps/mobile/src/App.tsx` 当前为单文件 Expo 应用，包含登录、导航、页面、弹窗、扫码和样式。
- API：移动端通过 `configureApiClient` 复用共享 API client，关闭 CSRF，并用 `Authorization: Bearer <token>` 调用后端。
- 登录：移动端调用 `/auth/mobile-login`，保存返回的 `auth_token` 到内存变量 `mobileAuthToken`。
- Cookie：移动端手动解析和回放 `Set-Cookie`，用于兼容服务端需要 cookie 的场景。
- 导航：底部一级导航为仪表盘、库存管理、个人；二级菜单根据权限显示总览、分析、货物、库存、报损、扫码、账号、用户、角色和权限。
- 摄像头：使用 `expo-camera` 读取二维码，再调用共享 API client 的扫码接口提交服务端审计。

## Shared API Client

- 位置：`packages/api-client/src`。
- 请求核心：`client.ts` 提供 `createApiClient`、默认 client、CSRF 获取、Bearer header 注入、统一错误 `ApiClientError`。
- 认证：`auth.ts` 使用 `/auth/mobile-login` 登录，`/auth/me` 初始化用户，`/auth/logout` 退出。
- 资源接口：`products.ts`、`batches.ts`、`inventory.ts`、`dashboard.ts`、`analytics.ts`、`qrScans.ts`、`authManagement.ts` 覆盖当前业务 API。
- 缓存键：`queryKeys.ts` 为 Web 和移动端共享 React Query key。

## Data Flow
页面组件通过 React Query 调用共享 API client。client 将请求发送到 `VITE_API_BASE_URL` 或 `EXPO_PUBLIC_API_BASE_URL`，收到后端统一响应后只返回 `data`。登录成功后，Web 将 `auth_token` 写入 localStorage/sessionStorage，移动端写入内存变量；后续状态变更请求以 Bearer token 跳过 CSRF，cookie 登录路径仍由 client 自动获取 `/auth/csrf`。

## Current Gaps
- `apps/mobile/src/App.tsx` 体积过大，后续应拆分为 `screens`、`components`、`hooks`、`api` 和 `styles`。
- Web 和移动端都依赖 `mobile-login` token 登录路径，`/auth/login` 的 cookie 登录更多是后端兼容能力。
- `apps/web/README.md` 中默认 API URL 与当前共享 client 默认生产地址不完全一致，后续可统一说明。
