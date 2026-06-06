# Initium-Veris Demo

<p align="center">
  <img src="docs/images/logo.png" width="112" alt="Initium-Veris logo" />
</p>

<p align="center">
  <strong>面向食品库存、批次、效期和扫码审计的现代化库存管理系统演示版。</strong>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" /></a>
  <img alt="Branch" src="https://img.shields.io/badge/branch-demo-orange.svg" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-22%2B-339933.svg" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB.svg" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF.svg" />
  <img alt="Turborepo" src="https://img.shields.io/badge/Turborepo-2-EF4444.svg" />
</p>

> **重要说明：当前 `demo` 分支只用于产品演示和界面预览。**
>
> Web 管理端默认使用前端内存 demo 数据，不连接真实后端、不需要数据库、不会持久化业务数据。这里保留 monorepo 中的后端与移动端代码，是为了展示完整项目结构；本 README 只说明 demo 分支的前端演示部署方式。

Initium-Veris Demo 展示食品库存管理系统的核心交互：库存看板、商品与批次、库存状态、盘点、报损、扫码审计、角色权限和系统设置。它适合用于项目展示、UI 评审、交互走查和静态站点部署。

## 截图展示

| 库存看板 | 库存状态 |
| --- | --- |
| ![库存看板](docs/images/screenshot-dashboard.png) | ![库存状态](docs/images/screenshot-status.png) |

| 角色与权限 | 库存盘点 |
| --- | --- |
| ![角色与权限](docs/images/screenshot-roles.png) | ![库存盘点](docs/images/screenshot-stocktakes.png) |

## Demo 功能

- **库存看板**：展示库存概览、效期风险、趋势图表和关键提醒。
- **库存状态**：按商品、批次、位置和效期状态浏览库存数据。
- **商品与批次管理**：演示商品主数据、批次信息和库存操作入口。
- **库存盘点**：展示盘点任务、差异处理和状态流转。
- **报损与扫码审计**：演示报损记录、二维码扫码结果和审计列表。
- **角色与权限**：展示用户、角色和组件级权限管理界面。
- **设置与日志**：保留前端调试日志入口，便于演示交互问题。

## Demo 边界

- 不提供真实登录认证；账号状态由前端 demo store 模拟。
- 不连接 Django API；非测试模式下请求会被 `apps/web/src/api/demoStore.ts` 接管。
- 不需要 PostgreSQL、Redis、Docker、systemd 或后端环境变量。
- 刷新页面或重新部署后，演示数据会回到前端内置状态。
- 移动端和后端部署不属于本分支 README 的目标范围。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| Web Demo | React 19、TypeScript、Vite、Tailwind CSS 4、React Router、React Query、Vitest |
| 共享包 | `@initium-veris/api-client`、DTO 类型、接口函数、查询键 |
| 工程化 | pnpm workspace、Turborepo、Cloudflare Workers Assets 配置 |

## 仓库结构

```text
Initium-Veris/
├── apps/
│   ├── web/                 # 当前 demo 分支的主要演示应用
│   ├── mobile/              # 移动端代码，demo README 不覆盖部署
│   └── api/                 # Django API 代码，demo 部署不需要启动
├── packages/
│   └── api-client/          # 共享 TypeScript API client
├── docs/
│   └── images/              # README 截图资源
├── wrangler.jsonc           # Cloudflare 静态资源部署配置
├── package.json             # 根任务入口
├── pnpm-workspace.yaml      # workspace 配置
└── turbo.json               # Turbo 任务编排
```

更多完整结构说明见 [docs/structure.md](docs/structure.md)。

## 本地预览

环境要求：

- Node.js 22+
- pnpm 10+

安装依赖：

```bash
corepack enable
pnpm install
```

启动 Web demo：

```bash
pnpm --filter web dev
```

访问：

```text
http://localhost:3000
```

如需打开前端调试日志，可使用：

```bash
pnpm dev:debug
```

## Demo 部署

### 方式一：Cloudflare Workers Assets

项目根目录已提供 [wrangler.jsonc](wrangler.jsonc)，静态资源目录指向 `apps/web/dist`。

构建：

```bash
pnpm install
pnpm --filter web build
```

部署：

```bash
npx wrangler deploy
```

`wrangler.jsonc` 已配置 SPA fallback：

```jsonc
{
  "assets": {
    "directory": "apps/web/dist",
    "not_found_handling": "single-page-application"
  }
}
```

### 方式二：任意静态站点托管

构建 Web demo：

```bash
pnpm --filter web build
```

将以下目录上传到静态托管平台：

```text
apps/web/dist
```

部署平台需要开启 SPA 回退，把未知路径回退到 `index.html`。适用平台包括 Cloudflare Pages、Vercel、Netlify、GitHub Pages 或 Nginx 静态站点。

Nginx 示例：

```nginx
server {
  listen 80;
  server_name demo.example.com;
  root /var/www/initium-veris-demo;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm --filter web dev` | 启动 Web demo |
| `pnpm dev:debug` | 启动 Web debug 模式 |
| `pnpm --filter web build` | 构建静态演示站点 |
| `pnpm --filter web preview` | 本地预览构建产物 |
| `pnpm --filter web test` | 运行 Web 测试 |
| `pnpm --filter web check-types` | 检查 Web TypeScript 类型 |

## 文档

- [项目结构](docs/structure.md)
- [Web 结构](docs/frontend/structure.md)
- [Web 设计系统](docs/frontend/design.md)
- [Web 日志与 debug](docs/frontend/logging.md)
- [共享 API client](docs/shared/api-client.md)

## 开源协议

本项目基于 [Apache License 2.0](LICENSE) 开源。
