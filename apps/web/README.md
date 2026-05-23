# Web App

这是 Initium-Veris 的前端管理端工作区，基于 React 19、TypeScript、Vite 和 Tailwind CSS 4。

## 本地开发

在仓库根目录执行：

```bash
pnpm install
pnpm dev
```

如果只启动前端：

```bash
pnpm --filter web dev
```

## 环境变量

参考 [.env.example](.env.example)：

- `VITE_API_BASE_URL`：Django API 地址，默认 `http://localhost:8000/api`
- `GEMINI_API_KEY`：保留给现有 AI 能力
- `VITE_LOG_*`：前端本地日志开关
