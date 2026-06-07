# Backend API

本文档按当前 `apps/api` Django 6 + DRF 实现整理。后端统一挂载在 `/api` 下，成功响应为 `{ code: 0, message: "success", data }`，错误响应为 `{ code, message, data: null }`。

## Base

- 本地：`http://127.0.0.1:8000/api`
- 生产：`https://your-domain.example/api`，通过 `VITE_API_BASE_URL`、`EXPO_PUBLIC_API_BASE_URL` 或部署环境显式配置
- Content-Type：`application/json`
- 健康检查：`GET /api/ping`，返回纯文本 `pong`
- 首页：`GET /`，返回 `templates/index.html`

## Error Codes

| HTTP | code | message |
| --- | ---: | --- |
| `400` | `4001` | `validation_error` |
| `401` | `4011` | `unauthenticated` |
| `403` | `4031` | `forbidden` |
| `404` | `4041` | `not_found` |
| `409` | `4091` | `conflict` |

## Authentication

后端支持两条认证路径：

1. Cookie token：`POST /auth/login` 写入 HttpOnly cookie `veris_auth_token`。
2. Bearer token：`POST /auth/mobile-login` 在响应 `data.auth_token` 返回 token，Web 和移动端当前主要使用该路径。

`CookieTokenAuthentication` 会先读取 `Authorization: Bearer <token>`，没有 Bearer 时再读取 cookie。Bearer token 状态变更请求跳过 CSRF；cookie 状态变更请求需要 `X-CSRFToken`。

Token 默认 8 小时过期，`remember_me=true` 时为 3 天。数据库只保存 `sha256(token + AUTH_TOKEN_PEPPER)`。

### Auth Endpoints

| Method | Path | Auth | 说明 |
| --- | --- | --- | --- |
| `GET` | `/auth/csrf` | 否 | 获取 CSRF token，并设置可读 `csrftoken` cookie |
| `POST` | `/auth/login` | 否 | 用户名密码登录，设置 `veris_auth_token` cookie，返回 `AuthUser` |
| `POST` | `/auth/mobile-login` | 否 | 用户名密码登录，返回 `AuthUser + auth_token + expires_in`，不强制 CSRF |
| `POST` | `/auth/logout` | 是 | 吊销当前 token 并清除认证 cookie |
| `GET` | `/auth/me` | 是 | 返回当前用户 |

`POST /auth/login` 和 `POST /auth/mobile-login` 请求体：

```json
{
  "username": "operator",
  "password": "password",
  "remember_me": true
}
```

`AuthUser`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | integer | 用户 ID |
| `username` | string | 用户名 |
| `email` | string | 邮箱，可为空字符串 |
| `first_name` | string | 名，可为空字符串 |
| `last_name` | string | 姓，可为空字符串 |
| `is_staff` | boolean | 是否 staff |
| `is_superuser` | boolean | 是否超级管理员 |
| `permissions` | string[] | 有效业务权限码 |

`mobile-login` 额外字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `auth_token` | string | Bearer token 明文，只在本次响应返回 |
| `expires_in` | integer | token 剩余秒数 |

## Permission Management

以下接口需要超级管理员。

| Method | Path | 说明 |
| --- | --- | --- |
| `GET` | `/auth/permissions` | 权限目录，按 component 分组 |
| `GET` | `/auth/roles` | 角色列表 |
| `POST` | `/auth/roles` | 创建角色 |
| `GET` | `/auth/roles/{id}` | 角色详情 |
| `PATCH` | `/auth/roles/{id}` | 更新角色名称和权限 |
| `DELETE` | `/auth/roles/{id}` | 删除未分配给用户的角色 |
| `GET` | `/auth/users` | 用户列表 |
| `POST` | `/auth/users` | 创建普通或 staff 用户，不创建超级管理员 |
| `GET` | `/auth/users/{id}` | 用户详情 |
| `PATCH` | `/auth/users/{id}` | 更新用户资料、启用状态、staff、角色和直接权限 |
| `POST` | `/auth/users/{id}/password` | 重置用户密码 |

角色创建/更新字段：

```json
{
  "name": "warehouse_operator",
  "permission_codes": ["products_read", "batch_operations_add"]
}
```

用户创建字段：

```json
{
  "username": "operator",
  "password": "password",
  "email": "operator@example.com",
  "first_name": "Origin",
  "last_name": "User",
  "is_active": true,
  "is_staff": false,
  "group_ids": [1],
  "permission_codes": ["qr_scans_create"]
}
```

## Permission Codes

| code | 说明 |
| --- | --- |
| `products_read` | 商品列表、详情、条码查询和分类 |
| `products_create` | 创建商品 |
| `products_update` | 更新商品 |
| `products_delete` | 删除商品 |
| `batches_read` | 批次列表、详情和效期预警 |
| `batches_create` | 创建批次 |
| `batches_update` | 更新批次资料和状态 |
| `batches_delete` | 删除批次 |
| `batch_operations_read` | 查看库存操作 |
| `batch_operations_add` | 入库操作 |
| `batch_operations_deduct` | 出库操作 |
| `batch_operations_loss` | 报损操作 |
| `batch_operations_revert` | 撤销库存操作 |
| `label_payload_issue` | 签发二维码凭证 |
| `qr_scans_create` | 单条或批量扫码审计 |
| `dashboard_read` | 库存看板 |
| `analytics_read` | 分析汇总 |

## Common Schemas

### Product

| 字段 | 类型 |
| --- | --- |
| `id` | integer |
| `barcode` | string |
| `product_name` | string |
| `shelf_life_days` | integer |
| `location` | string \| null |
| `category` | string \| null |
| `unit` | string \| null |
| `manufacturer` | string |
| `created_at` | string |
| `updated_at` | string |

### ProductSummary

| 字段 | 类型 |
| --- | --- |
| `id` | integer |
| `barcode` | string |
| `product_name` | string |
| `unit` | string \| null |
| `manufacturer` | string |

### Batch

| 字段 | 类型 |
| --- | --- |
| `id` | integer |
| `product_id` | integer |
| `batch_code` | string |
| `quantity` | string |
| `received_at` | string |
| `manufacture_date` | string \| null |
| `expire_date` | string \| null |
| `status` | string \| null |
| `remarks` | string \| null |
| `days_until_expiry` | integer \| null |
| `expiry_progress` | number \| null |
| `expiry_status` | `expired` \| `critical` \| `warning` \| `normal` \| `unknown` |
| `product` | ProductSummary |

### BatchOperation

| 字段 | 类型 |
| --- | --- |
| `id` | integer |
| `batch_id` | integer |
| `operation_type` | `add` \| `loss` \| `deduct` |
| `quantity` | string |
| `quantity_after` | string |
| `remarks` | string \| null |
| `created_at` | string |
| `reversed_operation_id` | integer \| null |
| `is_reverted` | boolean |

### Pagination

| 字段 | 类型 |
| --- | --- |
| `page` | integer |
| `size` | integer |
| `total` | integer |

列表响应统一为：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "size": 20,
    "total": 0
  }
}
```

## Products

| Method | Path | Permission | 说明 |
| --- | --- | --- | --- |
| `GET` | `/products` | `products_read` | 商品列表，支持 `search,page,size` |
| `POST` | `/products` | `products_create` | 创建商品 |
| `GET` | `/products/{product_id}` | `products_read` | 商品详情 |
| `PATCH` | `/products/{product_id}` | `products_update` | 更新商品 |
| `DELETE` | `/products/{product_id}` | `products_delete` | 删除商品 |
| `GET` | `/products/barcode/{barcode}` | `products_read` | 按条码查询 |
| `GET` | `/products/categories` | `products_read` | 分类列表，支持 `search` |
| `GET` | `/products/{product_id}/batches` | `batches_read` | 商品下批次列表 |

创建商品请求体：

```json
{
  "barcode": "6901234567890",
  "product_name": "示例商品",
  "shelf_life_days": 30,
  "location": "A-01",
  "category": "饮料",
  "unit": "瓶",
  "manufacturer": "示例厂商"
}
```

## Batches

| Method | Path | Permission | 说明 |
| --- | --- | --- | --- |
| `GET` | `/batches` | `batches_read` | 批次列表，支持 `product_id,status,expired_only,active_only,page,size` |
| `POST` | `/batches` | `batches_create` | 创建批次主数据，初始 `quantity=0.00` |
| `GET` | `/batches/expiry-alerts` | `batches_read` | 效期预警列表 |
| `GET` | `/batches/{batch_id}` | `batches_read` | 批次详情 |
| `PATCH` | `/batches/{batch_id}` | `batches_update` | 更新批次主数据，不能直接改数量 |
| `PATCH` | `/batches/{batch_id}/status` | `batches_update` | 更新非 `used_up` 状态 |
| `DELETE` | `/batches/{batch_id}` | `batches_delete` | 删除批次 |
| `GET` | `/batches/{batch_id}/label-payload` | `label_payload_issue` | 签发并返回可打印二维码载荷 |

创建批次请求体：

```json
{
  "product_id": 14,
  "batch_code": "BATCH-20260525-00000001",
  "manufacture_date": "2026-05-01",
  "expire_date": "2026-06-01",
  "status": "unopened",
  "remarks": "示例批次"
}
```

`batch_code` 可省略，由服务端生成；`expire_date` 可省略，由 `manufacture_date + product.shelf_life_days` 推导。数量只能通过库存操作变更。

批次列表查询参数：

- `product_id`
- `status`
- `expired_only`，默认 `false`
- `active_only`，默认 `false`；为 `true` 时仅返回 `quantity > 0` 且 `status != used_up` 的有效库存批次
- `page`，默认 `1`
- `size`，默认 `20`，最大 `100`

效期预警查询参数：

- `product_id`
- `status`
- `category`
- `location`
- `expiry_status`
- `days_lte`，默认 `30`
- `include_expired`，默认 `true`
- `page`，默认 `1`
- `size`，默认 `20`，最大 `100`

## Batch Operations

| Method | Path | Permission | 说明 |
| --- | --- | --- | --- |
| `GET` | `/batches/{batch_id}/operations` | `batch_operations_read` | 操作历史，支持 `operation_type,page,size` |
| `POST` | `/batches/{batch_id}/operations` | 按操作类型映射 | 创建入库、出库或报损 |
| `POST` | `/batches/{batch_id}/operations/{operation_id}/revert` | `batch_operations_revert` | 创建反向操作撤销原操作 |

操作请求体：

```json
{
  "operation_type": "loss",
  "quantity": "2.00",
  "remarks": "包装破损"
}
```

权限映射：

- `add`：`batch_operations_add`
- `deduct`：`batch_operations_deduct`
- `loss`：`batch_operations_loss`

业务规则：

- `quantity` 必须大于 `0`
- `add` 增加批次数量
- `deduct` 和 `loss` 扣减批次数量
- 扣减后不能小于 `0`
- 数量归零时自动将批次状态置为 `used_up`
- 对 `used_up` 批次重新入库后自动清空状态
- 每条原操作最多撤销一次，撤销通过新建反向操作实现

## QR Label And Scan

### Label Payload

`GET /batches/{batch_id}/label-payload` 返回：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `batchCode` | string | 批次号 |
| `productName` | string | 商品名 |
| `barcode` | string | 商品条码 |
| `quantity` | string \| null | 当前数量 |
| `location` | string \| null | 位置 |
| `expireDate` | string \| null | 到期日 |
| `qrCode` | string | `OB1\|{batchCode}\|{token}` |

读取该接口会签发新的二维码凭证。数据库只保存 token hash，明文 token 只在本次响应返回。

### Scan

| Method | Path | Permission | 说明 |
| --- | --- | --- | --- |
| `POST` | `/qr-scans` | `qr_scans_create` | 单条扫码审计 |
| `POST` | `/qr-scans/bulk` | `qr_scans_create` | 批量扫码审计 |

请求体：

```json
{
  "qr": "OB1|BATCH-20260525-00000001|token",
  "source": "mobile_camera",
  "deviceId": "device-001",
  "clientScanId": "scan-001",
  "scannedAt": "2026-05-25T10:30:00+08:00"
}
```

`source` 可选值：`web_camera`、`mobile_camera`、`handheld`。

扫码状态：

| status | 说明 |
| --- | --- |
| `valid` | 有效 |
| `near_expiry` | 临期 |
| `expired` | 已过期 |
| `invalid` | 格式错误或 token 错误 |
| `revoked` | 凭证已吊销 |
| `not_found` | 凭证指向的批次不存在 |

## Dashboard And Analytics

| Method | Path | Permission | 说明 |
| --- | --- | --- | --- |
| `GET` | `/dashboard/overview` | `dashboard_read` | 库存总览、30 天到期趋势、品类分布、Top 临期批次 |
| `GET` | `/analytics/summary` | `analytics_read` | 分析汇总，支持 `range=1m|3m|6m|12m`，默认 `6m` |

`dashboard/overview` 口径：

- 只统计 `quantity > 0` 且 `status != used_up` 的批次
- 临期：`0 <= days_until_expiry <= 7`
- 已过期：`days_until_expiry < 0` 或 `expiry_status = expired`
- 30 天趋势包含今日和第 30 天

`analytics/summary` 返回：

- `range`
- `period`
- `inventory_change_count`
- `current_month_loss_quantity`
- `average_stock_age_days`
- `monthly_inventory_loss_trend`
- `category_operation_summary`
- `high_risk_inventory_ranking`
