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

debug 模式会以 `vite --mode debug` 启动，前端日志默认开启，便于在页面右上角日志面板和浏览器控制台排查认证和交互问题。

日志系统说明见仓库文档：[docs/frontend/logging.md](../../docs/frontend/logging.md)。

## 环境变量

参考 [.env.example](.env.example)：

- `GEMINI_API_KEY`：保留给现有 AI 能力
- `VITE_LOG_*`：前端本地日志开关

当前 Web 工作区运行为独立 demo：业务数据来自前端内存 mock store，不需要配置 API 地址，也不会持久化商品、批次、盘点或登录数据。
