# Shared API Client

## Overview
`packages/api-client` 是 Web 和移动端共享的 TypeScript API 层。它不依赖 React，负责统一请求、认证 header、CSRF、错误模型、错误提示格式化、DTO 类型、资源接口和 React Query key。

## Exports
`src/index.ts` 重新导出：

- `analytics`
- `auth`
- `authManagement`
- `batches`
- `client`
- `dashboard`
- `errorMessages`
- `inventory`
- `products`
- `qrScans`
- `queryKeys`
- `types`

## Client Behavior
- 默认 Base URL：`http://localhost:8000/api`
- 默认凭证：`credentials: "include"`
- 默认启用 CSRF，状态变更请求会先调用 `/auth/csrf`
- 可通过 `configureApiClient` 注入 `baseUrl`、`fetchFn`、`getAuthHeaders`、`readCookie`、logger 和 401 handler
- 响应必须包含 `{ code, message, data }`，client 只返回 `data`
- 非 2xx 响应抛出 `ApiClientError(message, status, code)`

## Error Messages
- 用户可见错误提示统一使用 `formatErrorMessage(error, options)`。
- Web 和移动端不得在页面、组件或 App 文件内自行维护 `getErrorMessage` 一类本地错误提示 helper。
- 页面级业务差异通过 `apiClientMessages`、`apiClientStatusMessages`、`apiClientMessage` 或 `apiClientFallback` 传入，不要把业务文案硬编码进共享默认逻辑。
- `formatErrorMessage` 是纯格式化函数，不记录日志、不触发通知、不修改状态；日志仍由 API client、ErrorBoundary 或调用方显式处理。

## Auth Paths
- `login` 当前调用 `/auth/mobile-login`，返回 `authToken`、`expiresIn` 和转换后的 `AuthenticatedUser`
- `getCurrentUser` 调用 `/auth/me`
- `logout` 调用 `/auth/logout`
- Web 通过 `apps/web/src/api/client.ts` 将 token 写入 localStorage/sessionStorage
- Mobile 通过 `apps/mobile/src/App.tsx` 将 token 写入内存变量

## Resource Modules
- `products.ts`：商品列表、详情、条码查询、分类、创建、更新、删除
- `batches.ts`：批次列表、创建、详情、更新、状态更新、删除、标签载荷、库存操作、撤销、效期预警
- `inventory.ts`：前端库存展示模型和数量解析
- `dashboard.ts`：后端看板 DTO 到展示数据转换
- `analytics.ts`：分析汇总查询
- `qrScans.ts`：单条和批量扫码提交
- `authManagement.ts`：权限目录、角色、用户和密码重置

## Testing
当前包包含 Vitest 测试，根命令会通过 Turbo 执行：

```bash
pnpm --filter @initium-veris/api-client test
pnpm --filter @initium-veris/api-client check-types
```

## Notes
- 新增 API 时应先在共享包实现 DTO、接口函数和 query key，再由 Web/移动端消费。
- 不要在 Web 或移动端重复实现同一后端接口，除非平台行为确实不同。
