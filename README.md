# Origin

Origin 是一个前后端分离的食品库存管理项目，当前仓库包含：

- `origin_frontend`：基于 React 19、TypeScript、Vite、Tailwind CSS 4 的管理端前端
- `origin_django`：基于 Django 6 和 Django REST Framework 的后端 API

## 仓库结构

```text
origin/
├── origin_frontend/   # 前端应用
├── origin_django/     # 后端服务
├── docs/              # 根目录总览文档
└── .gitignore
```

## 文档入口

- 项目总览：[docs/structure.md](docs/structure.md)
- 前端结构说明：`origin_frontend/docs/structure.md`
- 后端 API 契约：`origin_django/docs/api.md`

## 前端

- 技术栈：React 19、TypeScript、Vite、Tailwind CSS 4、React Router、React Query
- 主要页面：Dashboard、货物管理、库存状态、报损、分析、设置、登录、扫码

常用命令：

```bash
cd origin_frontend
npm install
npm run dev
```

## 后端

- 技术栈：Django 6、Django REST Framework、PostgreSQL 驱动 `psycopg`
- 主要模块：`accounts`、`inventory`、`common`、`config`

常用命令：

```bash
cd origin_django
python manage.py runserver
```

## 当前整合方式

本次整合没有改动前端和后端源码结构，重点是把两个独立子项目收敛到同一个根目录仓库下，并补充统一入口文档，方便后续统一版本管理和公开发布。
