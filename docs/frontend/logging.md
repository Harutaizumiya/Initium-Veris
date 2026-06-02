# Frontend Logging

## Overview
Web 端统一使用 `apps/web/src/lib/logger.ts` 记录浏览器本地运行日志。该 logger 是当前前端 debug 的统一入口，负责结构化记录、级别过滤、本地持久化、敏感字段脱敏和 Header 日志面板订阅。

移动端当前没有接入同一套本地日志面板；移动端需要 debug 时应先使用 React Native/Expo 调试工具，不要在 `apps/mobile/src/App.tsx` 内另起一套与 Web 同名但行为不同的 logger。

## Unified Entry
业务代码需要记录前端运行信息时，统一导入：

```ts
import { logger } from "../lib/logger";
```

根据文件位置调整相对路径。不要直接写入 `localStorage`，也不要在页面内维护本地日志数组。

常用调用：

```ts
logger.debug("inventory.page", "Batch filters changed", {
  event: "batch_filters_changed",
  query,
});

logger.info("qr.scan", "QR scan submitted", {
  event: "qr_scan_submitted",
  source,
  auditId,
});

logger.warn("auth", "Stored session is unauthorized", {
  event: "auth_stored_session_unauthorized",
  status: 401,
});

logger.error("api.client", "API request failed", {
  event: "api_request_failed",
  path,
  method,
  status,
  code,
  error,
});
```

## Log Entry Shape
每条日志包含：

- `id`
- `timestamp`
- `level`: `debug | info | warn | error`
- `scope`
- `event`
- `message`
- `details`
- `error`: 标准化后的 `{ name, message, stack }`

`scope` 表示来源模块，例如 `api.client`、`auth`、`qr.scan`、`error_boundary`。`event` 表示机器可读事件名，建议使用小写 snake_case。

## Configuration
配置项位于 `apps/web/.env.example`：

```env
VITE_LOG_ENABLED=false
VITE_LOG_LEVEL=info
VITE_LOG_MAX_ENTRIES=200
```

- `VITE_LOG_ENABLED=true`：显式开启日志。
- `VITE_LOG_ENABLED=false`：显式关闭日志。
- 未配置 `VITE_LOG_ENABLED` 且使用 `vite --mode debug` 时，日志默认开启。
- `VITE_LOG_LEVEL` 控制最低记录级别。
- `VITE_LOG_MAX_ENTRIES` 控制 `localStorage` 中最多保留的日志数量，默认 200。

## Debug Mode
推荐使用根命令启动前端 debug 模式：

```bash
pnpm dev:debug
```

等价于：

```bash
pnpm --filter web dev:debug
```

debug 模式会让未显式关闭的日志默认开启。运行后，点击页面右上角铃铛，切换到“运行日志”tab 查看日志。

## Viewer
Header 日志面板支持：

- 显示当前浏览器本地日志。
- 按 `debug`、`info`、`warn`、`error` 过滤。
- 展开查看 `event`、`details` 和 `error`。
- 清空本地日志。
- 当存在 `warn` 或 `error` 时，在铃铛上显示红点。

## Redaction
logger 会递归脱敏以下 key：

- `authorization`
- `cookie`
- `password`
- `qr`
- `rawqr`
- `token`

新增日志字段时仍应遵循最小必要原则：不要把完整请求体、完整二维码、密码、token、cookie 或用户隐私字段写入 `details`。

## Current Sources
当前已接入的主要来源：

- `apps/web/src/api/client.ts` 注入共享 API client logger。
- `packages/api-client/src/client.ts` 记录网络失败、非 2xx 响应和响应结构异常。
- `apps/web/src/providers/AuthProvider.tsx` 记录认证初始化、登录、退出和会话失效。
- `apps/web/src/components/common/ErrorBoundary.tsx` 记录 React 运行时异常。
- `apps/web/src/api/qrScans.ts` 记录扫码提交和批量扫码结果。

## Rules
- 用户可见错误文案走 `formatErrorMessage()`；运行诊断信息走 `logger`。二者不要合并成一个带副作用的函数。
- 在 React render 阶段不要调用 `logger`，避免重复写日志。
- API 请求失败通常已经由 API client 记录。页面层只有在需要补充用户操作上下文时再记录，并避免重复记录同一错误。
- 日志系统是本地 debug 工具，不是后端审计系统。扫码审计、库存审计等业务审计仍以后端接口和数据库为准。
