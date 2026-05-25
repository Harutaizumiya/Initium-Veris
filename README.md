# Initium-Veris

Initium-Veris 是一个前后端分离的食品库存管理项目，现已整合为 Turborepo monorepo：

- `apps/web`：基于 React 19、TypeScript、Vite、Tailwind CSS 4 的管理端前端
- `apps/api`：基于 Django 6 和 Django REST Framework 的后端 API

## 仓库结构

```text
Initium-Veris/
├── apps/
│   ├── web/           # 前端应用
│   └── api/           # Django API
├── docs/              # 根目录结构文档
├── package.json       # 根任务入口
├── pnpm-workspace.yaml
└── turbo.json
```

## 文档入口

- 项目总览：[docs/structure.md](docs/structure.md)
- 前端结构说明：`docs/frontend/structure.md`
- 前端设计系统：`docs/frontend/design.md`
- 后端 API 契约：`docs/backend/api.md`
- 后端数据库结构：`docs/backend/db.md`
- 后端迁移计划：`docs/backend/plan.md`

## 环境要求

- Node.js 22+
- pnpm 10+
- Python 3.12+
- uv

## 安装

```bash
pnpm install
cd apps/api
uv sync
```

## 常用命令

```bash
pnpm dev
pnpm dev:debug
pnpm build
pnpm test
pnpm lint
pnpm check-types
```

说明：

- `pnpm dev` 通过 Turborepo 同时启动 `apps/web` 和 `apps/api`
- `pnpm dev:debug` 只启动前端 debug 模式，相当于 `pnpm --filter web dev:debug`
- `pnpm --filter api dev` 会为本地 Django 显式设置 `DJANGO_DEBUG=1`；生产环境默认关闭 Django Debug
- `pnpm build` 当前主要构建前端；后端保留占位构建任务以纳入统一编排
- `apps/api` 的 Python 依赖由 `uv` 管理，真实依赖源仍是 `pyproject.toml`

## 技术栈

- 前端：React 19、TypeScript、Vite、Tailwind CSS 4、React Router、React Query、Vitest
- 后端：Django 6、Django REST Framework、PostgreSQL 驱动 `psycopg`

## 后续扩展

当前仓库先以 `apps/*` 组织前后端应用，暂未拆分 `packages/*`。后续如需共享 UI、类型定义或构建配置，可在 `packages/` 下继续扩展。
