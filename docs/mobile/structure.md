# Mobile Structure

## Overview
`apps/mobile` 是 Expo + React Native + TypeScript 移动端工作台，面向移动库存查看、商品/批次操作、报损、二维码扫码和账号/权限管理。它复用 `@initium-veris/api-client`，通过 `/api/auth/mobile-login` 获取 Bearer token，再以 React Query 管理服务端数据。

## Runtime
- Expo：`expo start`
- Android：`expo run:android`
- iOS：`expo run:ios`
- Web 预览：`expo start --web`
- API 地址：`EXPO_PUBLIC_API_BASE_URL`，未设置时 Android 模拟器使用 `http://10.0.2.2:8000/api`，其他平台使用 `http://localhost:8000/api`

## Modules
- App Shell：`AppShell` 管理登录态、一级底部导航、二级菜单、toast 和页面切换。
- Auth：`AuthProvider` 保存当前用户，处理 `mobileLoginRequest`、`getCurrentUser`、`logout` 和 401 清理。
- API Bridge：`configureApiClient` 注入移动端 `fetchFn`、Bearer header、cookie 读写和 `csrf: false`。
- Dashboard/Analytics：读取看板和分析汇总，展示指标、趋势和高风险批次。
- Products：商品列表、搜索、新增和编辑。
- Inventory：批次列表、批次创建、库存操作记录和入库/出库。
- Loss：复用批次和库存操作接口提交报损。
- QR Scan：使用 `expo-camera` 获取二维码内容并提交 `/qr-scans`。
- Settings：账号信息、用户管理、角色管理和权限目录。
- Style Tokens：`tokens` 常量保存与 Web 设计系统一致的颜色值。

## Data Flow
移动端启动后先尝试 `getCurrentUser`。未登录时展示登录页，登录调用 `/auth/mobile-login` 并把返回的 `auth_token` 写入内存变量 `mobileAuthToken`。共享 API client 后续为请求添加 `Authorization: Bearer <token>`；React Query 根据 `queryKeys` 缓存看板、商品、批次、操作、用户、角色和权限数据。扫码时 `CameraView` 读取二维码，页面调用 `createQrScan`，服务端负责格式校验、凭证匹配、效期判断和审计落库。

## Current Gaps
- `src/App.tsx` 当前过大，后续应拆分为页面、组件、hooks、API 配置和样式文件。
- token 目前只保存在内存中，应用重启后需要重新登录；若需要持久登录，应引入安全存储并同步登出清理。
- Android 工程已存在于 `apps/mobile/android`，修改 Expo 配置后需要注意原生工程同步。
