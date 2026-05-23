# Origin 项目总览

## 概览

当前仓库由一个前端应用和一个 Django 后端组成，属于典型的前后端分离架构：

- 前端目录：`origin_frontend`
- 后端目录：`origin_django`
- 根目录职责：统一托管源码、文档和版本管理

前端负责页面渲染、用户交互、权限感知路由和 API 调用；后端负责认证、权限、商品、批次、库存操作、分析统计和二维码扫码能力。

## 顶层结构

```text
origin/
├── docs/
│   └── structure.md
├── origin_frontend/
│   ├── docs/structure.md
│   ├── src/
│   └── package.json
└── origin_django/
    ├── docs/api.md
    ├── config/
    ├── accounts/
    ├── inventory/
    └── manage.py
```

## 前端结构摘要

前端采用“入口与路由 -> Provider -> 布局壳 -> 页面模块 -> API 适配层”的组织方式。

- `src/main.tsx`：应用入口，挂载 React 根节点并注入全局 Provider
- `src/App.tsx` / `src/routes`：路由注册、懒加载、路由权限控制
- `src/providers`：认证和 React Query 全局状态
- `src/components/layout`：主布局、侧栏、头部、布局上下文
- `src/components/pages`：Dashboard、商品、库存、报损、分析、设置、登录、扫码页面
- `src/api`：认证、商品、批次、分析、扫码等请求封装与查询键管理
- `src/lib` / `src/types`：工具函数、打印、扫码和共享类型

前端详细结构说明见：`origin_frontend/docs/structure.md`

## 后端结构摘要

后端以 Django 项目结构组织，按领域拆分模块：

- `config`：项目配置、URL 汇总、ASGI/WGI 入口
- `accounts`：认证、权限、角色、用户、token/cookie 相关逻辑
- `inventory`：商品、批次、库存操作、效期计算、扫码、业务服务与测试
- `common`：统一响应、异常、环境读取和通用视图能力

后端对外以 `/api` 为统一前缀，核心 API 包括：

- 认证：`/auth/csrf`、`/auth/login`、`/auth/logout`、`/auth/me`
- 权限管理：`/auth/permissions`、`/auth/roles`、`/auth/users`
- 看板与分析：`/dashboard/overview`、`/analytics/summary`
- 商品：`/products`、`/products/{id}`、`/products/categories`
- 批次与库存：`/batches`、`/batches/{id}`、`/batches/{id}/operations`
- 标签与扫码：`/batches/{id}/label-payload`、`/qr-scans`、`/qr-scans/bulk`

后端完整 API 契约见：`origin_django/docs/api.md`

## 前后端协作关系

### 认证

- 前端通过 `credentials: "include"` 携带 cookie
- 后端通过 HttpOnly `origin_auth_token` cookie 维护登录状态
- 所有写请求必须带 `X-CSRFToken`

### 业务数据

- 前端 `src/api` 与 Django `/api` 契约对齐
- React Query 负责缓存、重试和失效
- 后端统一返回 `{ code, message, data }` 结构

### 权限控制

- 后端以权限码作为最终准入规则
- 前端可根据用户权限做路由和页面级能力裁剪

## 整合结论

这两个子项目已经具备被同一个 Git 仓库托管的条件：

- 目录边界清晰
- 文档边界清晰
- API 契约明确
- 前后端职责分离明确

本次整合保持子项目内部结构不变，只新增根目录级说明，避免过度调整已有代码。
