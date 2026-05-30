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

如果需要前端 debug 模式：

```bash
pnpm dev:debug
```

等价于：

```bash
pnpm --filter web dev:debug
```

debug 模式会以 `vite --mode debug` 启动，前端日志默认开启，便于在页面右上角日志面板和浏览器控制台排查接口、认证和交互问题。

## 环境变量

参考 [.env.example](.env.example)：

- `VITE_API_BASE_URL`：Django API 地址，默认连接 `https://veris.haruta.top/api`；本地开发可用 `.env.local` 覆盖为 `http://localhost:8000/api`
- `GEMINI_API_KEY`：保留给现有 AI 能力
- `VITE_LOG_*`：前端本地日志开关
