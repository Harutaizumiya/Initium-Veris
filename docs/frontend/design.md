---
name: Origin Light Workspace
colors:
  primary: "#0057C2"
  primary-container: "#006EF2"
  surface: "#F9F9F9"
  surface-container: "#EEEEEE"
  surface-container-low: "#F3F3F3"
  surface-container-high: "#E8E8E8"
  surface-container-lowest: "#FFFFFF"
  on-surface: "#1B1B1B"
  on-surface-variant: "#414755"
  error: "#BA1A1A"
---

# Design System

## Overview
Origin 当前是一套明亮、圆润、卡片化的食品库存工作台设计。Web 管理端和移动端共用同一组核心视觉 token：品牌蓝、浅灰页面背景、白色内容容器、低噪音边框、柔和阴影和高可读文本。

## Colors
- `primary #0057C2`：主操作、当前导航、重点数字、图表主序列和可点击强调。
- `primary-container #006EF2`：更强的选中态或关键按钮。
- `surface #F9F9F9`：页面背景。
- `surface-container #EEEEEE`：边框、分隔线和次级容器。
- `surface-container-low #F3F3F3`：输入框、搜索框和浅控件背景。
- `surface-container-high #E8E8E8`：表头、hover 和更明确的分区。
- `surface-container-lowest #FFFFFF`：卡片、弹窗、表格和重要内容容器。
- `on-surface #1B1B1B`：主文本、标题、关键数字。
- `on-surface-variant #414755`：辅助文本、图标默认色和元信息。
- `error #BA1A1A`：错误、已过期、删除和高风险状态。

状态色只做局部表达：绿色表示成功或健康，黄色表示临期或警告，红色表示过期、错误或破坏性操作。

## Typography
- Web 标题优先使用 `Plus Jakarta Sans`，正文使用 `Inter`。
- 移动端使用系统字体，但字号、字重和层级应对齐 Web 的语义。
- 页面标题可使用 28px 到 34px，卡片标题使用 17px 到 20px，正文和表格使用 13px 到 16px。
- 关键数字加粗，避免在同一区块内引入过多字号层级。

## Components
- Layout：Web 使用固定侧边栏、顶部栏和主内容区；移动端使用顶部标题、二级横向菜单和底部导航。
- Buttons：主按钮使用品牌蓝填充，次级按钮使用白底浅边框，危险按钮使用浅红底和红色文本。
- Inputs：浅灰背景、弱边框、清晰聚焦态；搜索框搭配图标。
- Cards：白底、轻边框、柔和阴影；Web 常用 `rounded-3xl`，移动端常用 20px 到 24px 圆角。
- Tables：轻分割、浅表头、行 hover，避免重网格。
- Badges：浅底色加文字/图标，不使用大面积纯色块。
- Modals/Sheets：Web 使用居中弹窗，移动端使用底部 sheet；二者都保留遮罩和清晰关闭入口。
- Operation Feedback：Web 统一通过 `NotificationProvider + useNotification()` 分发全局浮动通知，单条视觉复用 `OperationAlert`；移动端复用本地 toast/inline alert 语义，成功、警告、错误风格保持一致。
- Charts：图表置于卡片或移动端 section 内，主序列使用品牌蓝，辅助序列使用低饱和状态色。

## Motion
- 动效服务于反馈和层级变化，不做装饰性循环动画。
- 卡片 hover 可轻微上移。
- 弹窗进入使用淡入、缩放或底部上滑，退出按相同路径反向收起。
- 侧栏宽度变化期间，图表可使用 skeleton 或延迟渲染减少抖动。

## Implementation Notes
- Web token 主要定义在 `apps/web/src/index.css` 的 Tailwind `@theme`。
- 移动端 token 当前定义在 `apps/mobile/src/App.tsx` 的 `tokens` 常量。
- 新增 Web 组件优先复用 `bg-surface`、`bg-surface-container-lowest`、`text-on-surface`、`text-primary` 等 token。
- 新增移动端组件应使用同名 token 值，避免另起一套颜色体系。
- 调试模式可以展示接口状态码和错误详情；生产界面只展示用户可理解的业务文案。

## Notification Rules
- Web 全局浮动通知的唯一入口是 `apps/web/src/providers/NotificationProvider.tsx` 提供的 `useNotification()`。
- 业务代码触发成功、失败、警告、信息类弹出通知时，必须调用 `notify.success()`、`notify.error()`、`notify.warning()`、`notify.info()` 或 `notify()`，不得在页面内自行维护 `toastOpen`、`feedback`、`timer`、`fixed top-*` 一类本地浮动通知实现。
- `OperationAlert` 只负责单条提示的视觉表达，不作为业务页面直接拼装全局 toast 容器。
- 页面内联提示、表单区块错误、静态说明类提示可以继续直接使用 `OperationAlert`，因为它们属于内容区反馈，不属于全局浮动通知。
- 需要调试信息时，通过统一通知入口传入 `debugDetail`；生产态只展示业务可读文案。

## Do's and Don'ts
- Do 保持明亮背景、白色卡片、清晰边界和舒适留白。
- Do 将品牌蓝保留给当前状态、关键操作和重点数据。
- Do 使用图标辅助识别，但图标尺寸保持克制。
- Do 在 Web 和移动端保持同一套状态语义。
- Don't 切换为深色主题，除非同步重做所有 surface、文本和图表 token。
- Don't 大面积铺设品牌蓝或状态色。
- Don't 使用复杂背景、装饰性渐变、光斑或高噪音视觉元素。
