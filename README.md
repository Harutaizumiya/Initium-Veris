# Initium-Veris

Food Inventory & Expiration Management System

<p align="center">
  <img src="docs/images/logo.png" width="112" alt="Initium-Veris logo" />
</p>

<p align="center">
  <strong>面向食品库存、批次追踪、效期管理和扫码审计的现代化库存管理系统。</strong>
</p>

<p align="center">
  <a href="https://github.com/Harutaizumiya/Initium-Veris/actions/workflows/ci.yml"><img alt="Build Status" src="https://github.com/Harutaizumiya/Initium-Veris/actions/workflows/ci.yml/badge.svg" /></a>
  <img alt="Last Commit" src="https://img.shields.io/github/last-commit/Harutaizumiya/Initium-Veris?label=last%20commit" />
  <img alt="Coverage" src="https://img.shields.io/badge/coverage-not%20configured-lightgrey.svg" />
  <a href="https://www.apache.org/licenses/LICENSE-2.0"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" /></a>
</p>

Initium-Veris 是一个基于 Turborepo 的食品库存管理 monorepo。主链路由 React Web 管理端、Expo/React Native 移动端、共享 TypeScript API client 和 Django 6 / DRF 后端组成，面向餐饮、零售、仓储和中央厨房等需要严格管理批次、效期和库存损耗的场景。

## 截图展示

| 库存看板 | 库存状态 |
| --- | --- |
| ![库存看板](docs/images/screenshot-dashboard.png) | ![库存状态](docs/images/screenshot-status.png) |

| 角色与权限 | 库存盘点 |
| --- | --- |
| ![角色与权限](docs/images/screenshot-roles.png) | ![库存盘点](docs/images/screenshot-stocktakes.png) |

## 为什么存在

传统表格或普通进销存系统管理需要强人工介入，管理起来相对费时费力，人为原因容易造成管理混乱，过期品处理不及时，产生预期外的损耗和食品安全问题。

Initium-Veris 通过批次级库存、效期预警、二维码追溯和扫码审计，把库存从静态数量变成可追踪、可预警、可复盘的业务链路，帮助团队降低食品损耗、提升周转效率，并为后续智能补货和销量预测保留数据基础。

## 核心特色

- **批次级库存管理**：每个商品批次独立记录数量、位置、效期和操作历史。
- **效期预警**：按批次到期时间识别正常、临期、过期和高风险库存。
- **二维码追溯**：为批次生成二维码凭证，支持标签打印和移动端扫码核验。
- **扫码审计**：记录扫码来源、处理结果和风险状态，形成可追溯审计记录。
- **多端协同**：Web 管理端负责运营视图，移动端负责现场扫码、盘点和库存操作。
- **权限治理**：通过账号、角色和组件级权限控制不同岗位可见和可操作范围。
- **智能化演进空间**：Roadmap 规划智能补货、销量预测和损耗趋势分析。

## 系统架构

```mermaid
flowchart LR
  Web["React Web\n管理端"] --> Client["Shared TypeScript\nAPI Client"]
  Mobile["Expo Mobile\n现场工作台"] --> Client
  Client --> API["Django REST API\n认证 / 权限 / 库存"]
  API --> Postgres[("PostgreSQL\n业务数据")]
  API --> Redis[("Redis\n可选缓存")]
  API --> Labels["QR Labels\n二维码凭证"]
```

## 数据库 ER 图

```mermaid
erDiagram
  PRODUCT ||--o{ BATCH : has
  PRODUCT ||--o{ INVENTORY : aggregates
  BATCH ||--o{ INVENTORY : stores
  BATCH ||--o{ STOCK_OPERATION : records

  PRODUCT {
    bigint id PK
    string name
    string category
    string unit
    boolean is_active
  }

  BATCH {
    bigint id PK
    bigint product_id FK
    string batch_number
    datetime production_date
    datetime expire_date
    string qr_token
  }

  INVENTORY {
    bigint id PK
    bigint product_id FK
    bigint batch_id FK
    decimal quantity
    string location
    string status
  }

  STOCK_OPERATION {
    bigint id PK
    bigint batch_id FK
    string operation_type
    decimal quantity
    string actor
    datetime created_at
  }
```

## 在线 Demo

- 演示地址：[https://www.veris.haruta.top](https://www.veris.haruta.top)
- Demo 分支：`demo`
- Demo 说明：`demo` 分支用于无后端、无数据库的静态界面演示；`main` 分支保留完整应用代码与部署流程。

## 快速开始

环境要求：

- Node.js 22+
- pnpm 10+
- Python 3.12+
- uv
- PostgreSQL 14+

安装依赖：

```bash
corepack enable
pnpm install
cd apps/api
uv sync
cd ../..
```

创建 `apps/api/.env`：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/initium_veris
DJANGO_DEBUG=1
DJANGO_SECRET_KEY=local-django-secret-key
AUTH_TOKEN_PEPPER=dev-auth-token-pepper
QR_TOKEN_PEPPER=dev-qr-token-pepper
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

初始化数据库并启动应用：

```bash
cd apps/api
uv run python manage.py migrate
cd ../..
pnpm dev
```

默认地址：

- Web：`http://localhost:3000`
- API：`http://127.0.0.1:8000`
- 健康检查：`http://127.0.0.1:8000/api/ping`

移动端本地开发：

```bash
pnpm dev:mobile
```

## 技术栈

| 模块 | 技术 |
| --- | --- |
| Web 管理端 | React 19、TypeScript、Vite、Tailwind CSS 4、React Router、React Query、Vitest |
| 移动端 | Expo、React Native、TypeScript、React Query、Expo Camera |
| API 服务 | Django 6、Django REST Framework、PostgreSQL、Redis cache 可选、Gunicorn |
| 共享包 | TypeScript API client、DTO 类型、接口函数、查询键 |
| 工程化 | pnpm workspace、Turborepo、uv、Docker、GitHub Actions |

## Roadmap

**已完成**

- Web 管理端：看板、商品、库存、报损、扫码审计、分析和设置页面
- Django API：认证、角色权限、库存领域接口、二维码凭证和审计记录
- 共享 API client：请求封装、Bearer token、CSRF、DTO 类型和查询键
- 部署基础：后端 Dockerfile、GitHub Actions 后端部署和 `/api/ping` 健康检查

**开发中**

- [ ] 移动端体验优化
- [ ] 库存盘点和差异处理体验优化
- [ ] 权限管理的审计视图与批量配置
- [ ] 生产部署文档和环境校验脚本完善

**长期规划**

- 智能补货建议
- 智能损耗分析算法
- 损耗趋势分析
- 临期处理策略推荐（调拨）
- 多仓、多门店和供应商协同
- 更完整的 BI 报表与告警中心

## 文档

- [项目结构](docs/structure.md)
- [共享 API client](docs/shared/api-client.md)
- [Web 结构](docs/frontend/structure.md)
- [Web 设计系统](docs/frontend/design.md)
- [Web 日志与 debug](docs/frontend/logging.md)
- [移动端结构](docs/mobile/structure.md)
- [后端 API 契约](docs/backend/api.md)
- [后端数据库结构](docs/backend/db.md)
- [后端迁移计划](docs/backend/plan.md)
- [生产部署流程](docs/deployment/production.md)
- [GitHub Actions 部署](docs/deployment/github-actions.md)

## 贡献

提交前建议至少运行：

```bash
pnpm lint
pnpm test
pnpm check-types
```

如果改动涉及数据库结构，请先对照 [docs/backend/db.md](docs/backend/db.md)。当前后端部分业务表由 Django model 映射既有生产表，变更前需要确认迁移边界。

## License

Apache License 2.0
