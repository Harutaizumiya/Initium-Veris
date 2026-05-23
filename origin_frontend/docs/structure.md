# Project Structure

## Overview
这是一个基于 React 19、TypeScript、Vite、Tailwind CSS 4、React Router 和 React Query 的食品库存管理前端。应用采用“入口与路由 -> 全局 Provider -> 布局壳 -> 页面模块 -> API/数据适配层”的结构，主要覆盖总览、货物管理、库存状态、报损、分析和设置等后台页面；部分页面已经接入 Django 风格后端接口，Dashboard 仍通过本地 mock 数据 adapter 暴露为可缓存查询。

## Modules
- 应用入口：`src/main.tsx` 挂载 React 根节点，引入全局样式，并用 `QueryProvider` 包裹 `App`
- 路由层：`src/App.tsx` 注册 `/`、`/products`、`/inventory-status`、`/loss-report`、`/analysis`、`/settings` 路由，使用懒加载、`Suspense` 和 `ErrorBoundary`
- 数据请求层：`src/api` 封装 HTTP client、products、batches、inventory 派生计算、dashboard adapter、query keys 和通用 API 类型
- 服务状态层：`src/providers/QueryProvider.tsx` 配置 React Query 默认缓存、重试和窗口聚焦策略
- 布局层：`src/components/layout` 提供 `MainLayout`、`Sidebar`、`Header` 和拆分后的布局上下文，负责侧栏开合、主内容偏移和图表动画状态传递
- 通用组件层：`src/components/common` 提供 Error Boundary、分页、状态徽标、位置徽标、趋势徽标和操作提示等跨页面基础 UI
- 导航与操作层：`src/components/navigation` 和 `src/components/actions` 提供侧栏菜单、用户资料区、浮动操作按钮和效期预警入口
- Dashboard 模块：`DashboardPage` 组合统计卡、图表和预警表；数据通过 `src/api/dashboard.ts` 进入 React Query 后下发给展示组件
- 库存状态模块：`InventoryStatusPage` 管理批次列表、新建批次、详情弹窗、视图切换和分页；通过预计算 view model 复用效期、日期和数量派生结果
- 货物管理模块：`ProductManagementPage` 管理货物列表、筛选、分页、新增、编辑和删除，并调用 products API 与 React Query 缓存失效
- 报损模块：`LossReportPage` 读取 products、batches 和操作记录，提供报损相关页面流程和弹窗
- 分析模块：`AnalyticsPage` 展示库存价值、损耗趋势、品类吞吐量和效率排行，图表在侧栏动画期间使用 skeleton 兜底
- 类型与工具层：`src/types` 存放跨模块展示类型，页面私有类型保留在页面目录，`src/lib/utils.ts` 提供 className 合并工具
- 样式与静态数据层：`src/index.css` 定义主题 token、字体和全局样式，`src/constants/mockData.ts` 保留 Dashboard 当前 mock 数据源

## Data Flow
应用从 `main.tsx` 进入后创建 React Query 客户端，再由 `App` 根据路由懒加载页面并放入 `MainLayout`。页面组件通过 `useQuery` 调用 `src/api` 中的接口或 adapter，API 层负责请求、响应类型和领域派生计算，页面层再把结果转换为展示模型后传给 memo 化的展示组件。用户在页面中执行新增、编辑、删除或新建批次等操作时，页面调用对应 mutation API，成功后通过 `queryKeys` 精确失效相关缓存并驱动页面刷新。布局状态从 `MainLayout` 进入拆分后的 context，图表组件只订阅侧栏动画状态，弹窗和浮动操作仍以页面局部状态控制。

## Next Steps
- 将 Dashboard 的 mock adapter 替换为真实后端接口时，保持当前 `getDashboardData` 输出结构不变
- 继续拆分较大的页面模块，优先把 `InventoryStatusPage`、`ProductManagementPage`、`LossReportPage` 的弹窗和 view model 逻辑移到独立文件
- 为 API 层补充单元测试或集成测试，覆盖错误映射、缓存失效和库存效期计算
- 统一页面私有类型与共享类型的边界，避免 `src/types` 和页面目录类型重复扩散
- 复查 Windows 环境脚本兼容性，尤其是 `clean` 脚本中的 `rm -rf dist`
