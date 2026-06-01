# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev                  # From repo root: start Django + Vite through Turborepo
pnpm --filter web dev     # Start Vite dev server only (port 3000)
pnpm --filter web dev:debug
pnpm --filter web build
pnpm --filter web lint
pnpm --filter web check-types
pnpm --filter web test
pnpm --filter web preview
pnpm --filter web clean
```

联调入口已经迁移到仓库根目录的 `pnpm dev`，由 Turborepo 并发启动 `apps/api` 和 `apps/web`。前端工作区不再负责拉起仓库外部的 Django 实例。

## Architecture

**Stack**: React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4 (via `@tailwindcss/vite`), React Router 7, TanStack React Query 5, Recharts 3, Motion 12 (Framer Motion successor), Lucide React

**Backend**: Django REST API at `http://127.0.0.1:8000/api`. All API calls flow through `requestJson<T>()` (`src/api/client.ts`), which expects `{ code: 0, message: "...", data: ... }` response shape and unwraps `data`.

**Auth**: Cookie-based session auth via Django sessions. `client.ts` manages CSRF tokens (`/auth/csrf`, `X-CSRFToken` header on state-changing requests, `credentials: "include"`). `AuthProvider` initializes session on mount via `GET /auth/me`, handles 401 auto-logout, and exposes `hasPermission()` for route guards.

**State management**: TanStack React Query for server state (5min staleTime, 30min gcTime). React context for auth (`AuthProvider`) and layout (`LayoutContext`). No global state library.

### Routing

React Router 7 with `BrowserRouter`. All pages sit inside `MainLayout` (sidebar + header + content). Routes are lazy-loaded via `React.lazy()`.

| Path | Page | Permission |
|------|------|------------|
| `/` | DashboardPage | `dashboard_read` |
| `/products` | ProductManagementPage | `products_read` |
| `/inventory-status` | InventoryStatusPage | `batches_read` |
| `/loss-report` | LossReportPage | `products_read` + `batches_read` (all) |
| `/qr-scan` | QrScanPage | `qr_scans_create` |
| `/analysis` | AnalyticsPage | `analytics_read` |
| `/settings/profile` | SettingsPage (profile tab) | authenticated |
| `/settings/users` | SettingsPage (user mgmt tab) | superuser |
| `/settings/roles` | SettingsPage (role mgmt tab) | superuser |
| `/settings/permissions` | SettingsPage (permission dir tab) | superuser |

Route guard components in `src/components/auth/ProtectedRoute.tsx`:
- `ProtectedRoute` — redirects unauthenticated users to `/login`
- `PublicOnlyRoute` — redirects authenticated users away from `/login`
- `RouteAccessGuard` — checks `requiredPermissions` (mode: `"any"` or `"all"`) and `requiresSuperuser`

### API layer (`src/api/`)

Each file exports DTO types and functions that call `requestJson<T>()`. Barrel re-exported via `index.ts`.

- **`client.ts`** — `requestJson<T>(path, options)` builds URL from `VITE_API_BASE_URL`, manages CSRF token lifecycle, sends `credentials: "include"`, handles JSON serialization, throws `ApiClientError` on non-ok responses. On 401 fires `unauthorizedHandler`. Integrated with `logger.ts`.
- **`types.ts`** — `ApiSuccessResponse`, `ApiErrorResponse`, `ApiPagination`, `ApiClientError` class.
- **`queryKeys.ts`** — TanStack Query key factory (`dashboard`, `analytics`, `products`, `batches`, `operations`, `authManagement`).
- **`auth.ts`** — `login()` (with `remember_me`), `logout()`, `getCurrentUser()`. DTO → `AuthenticatedUser` type (id, username, email, permissions[], isStaff, isSuperuser, displayName, roleLabel).
- **`authManagement.ts`** — Admin CRUD for users, roles, permissions against `/auth/users`, `/auth/roles`, `/auth/permissions`.
- **`products.ts`** — Full CRUD for products + category listing. `toProduct()` converts DTO → UI `Product`.
- **`batches.ts`** — Batch listing/creation, per-product batches, batch operations (add/deduct/loss/revert), label payload. Types: `BatchDto`, `BatchOperationDto`, `BatchLabelPayloadDto`.
- **`inventory.ts`** — Pure functions transforming `BatchDto` → UI types (`InventoryRecord`, `InventoryBatchDetail`, `InventoryRelatedBatch`). Shelf-life math (`getShelfLifeMetricsFromDates/Batch`). Temperature metadata derived from Chinese location keywords (冻=-18°C, 冷=4°C, else 22°C).
- **`dashboard.ts`** — `GET /dashboard/overview` → `DashboardStat[]`, `TrendDataPoint[]`, `Category[]`, `UrgentItem[]`.
- **`analytics.ts`** — `GET /analytics/summary?range=` (1m/3m/6m/12m) → stock loss trend, category operations, risk ranking.
- **`qrScans.ts`** — `POST /qr-scans` (single + bulk). QR source types: `web_camera | mobile_camera | handheld`. Statuses: `valid | near_expiry | expired | invalid | revoked | not_found`.

### Component conventions

- **UI = Chinese**: All user-facing strings, labels, placeholders, aria-labels, and error messages are in Chinese.
- **Styling**: Tailwind utility classes via `cn()` helper (`src/lib/utils.ts` — clsx + tailwind-merge). Custom theme tokens (colors, fonts) in `src/index.css` via `@theme` directive. `.ambient-shadow` for card/section elevations, `.glass-header` for header backdrop.
- **Sidebar**: Fixed-position with animated width (80px collapsed / 256px expanded). Content area animates `margin-left` in sync via `LayoutContext`. Uses `cubic-bezier(0.22, 1, 0.36, 1)` easing (500ms). `LayoutContext` provides `sidebarCollapsed` and `isSidebarAnimating` via two separate contexts (`SidebarCollapsedContext`, `SidebarAnimatingContext`) to minimize re-renders.
- **Modals**: Pattern is `AnimatePresence` + Motion backdrop + Motion panel, with `pointer-events-none` outer and `pointer-events-auto` inner for click-outside-to-close. Submitting state disables close.
- **Data loading**: Pages fetch on mount with an `isLoading` flag → centered spinner. Errors caught and displayed as red banners with Chinese messages via the shared `formatErrorMessage()` helper. Empty states shown when no data.
- **Auth wiring**: Pages use `useAuth()` for permission checks. API calls that 401 trigger automatic logout via global `unauthorizedHandler`.

### Product ↔ Inventory relationship

Products are master data (barcode, name, manufacturer, shelf life). Batches belong to products and track individual received lots with quantities, manufacture/expiry dates. The inventory page merges batch data with product metadata via `mergeInventoryRecord()` to enrich category/location info. Batch operations track inventory movements (入库/出库/报损) with revert capability.

### Key libraries (`src/lib/`)

- **`logger.ts`** — Structured client-side logger with scopes, levels (debug/info/warn/error), localStorage persistence (200 entries), subscription mechanism. Configurable via `VITE_LOG_ENABLED`, `VITE_LOG_LEVEL`, `VITE_LOG_MAX_ENTRIES`. Sensitive key redaction. Used by `client.ts`, `AuthProvider`, and Header's log viewer.
- **`labelPrinter.ts`** — Multi-protocol label printing (TSPL/ZPL/ESC/POS) with WebUSB/WebSerial/Browser transports. QR code generation via `qrcode` library. Chinese font size calculation.
- **`qrScan.ts`** — Client-side scan ID generation for idempotency. Status metadata mapping (backend code → Chinese label + color).

### Providers (`src/providers/`)

- **`AuthProvider.tsx`** — Auth context: `user`, `loading`, `isAuthenticated`, `login()`, `logout()`, `hasPermission()`, `hasAnyPermission()`. Sets global 401 handler. Logs all auth events.
- **`QueryProvider.tsx`** — TanStack QueryClient: staleTime=5min, gcTime=30min, refetchOnWindowFocus=false, retry=1.
