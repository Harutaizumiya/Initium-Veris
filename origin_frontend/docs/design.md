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
typography:
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
  headline:
    fontFamily: Plus Jakarta Sans
    fontWeight: 700
rounded:
  xl: 12px
  2xl: 16px
  3xl: 24px
---

# Design System

## Overview

Origin 当前是一套面向食品库存管理场景的明亮中后台界面。整体风格不是传统高密度 ERP，也不是深色开发者工具，而是偏现代、柔和、卡片驱动的工作台体验。

界面基调强调清洁、留白、低压信息浏览和轻品牌感。主要页面通过固定侧边栏、顶部工具栏、统计卡片、图表容器和表格区块组成，适合仪表盘、库存状态、分析看板和商品管理等业务场景。

## Colors

- **Primary** (`#0057C2`): 品牌主色，用于关键操作、当前导航状态、重点数据、图表主序列和 hover 强调。
- **Primary Container** (`#006EF2`): 主色的高亮版本，用于更强的行动按钮、选中状态或需要更醒目的视觉反馈。
- **Surface** (`#F9F9F9`): 页面主背景，保持明亮、干净、低干扰。
- **Surface Container** (`#EEEEEE`): 容器边界、分割线、次级背景和顶部栏边框。
- **Surface Container Low** (`#F3F3F3`): 搜索框、输入框、浅色控件背景。
- **Surface Container High** (`#E8E8E8`): 更明确的分区背景、表头或局部 hover 背景。
- **Surface Container Lowest** (`#FFFFFF`): 卡片、弹窗主体、重要内容容器。
- **On Surface** (`#1B1B1B`): 主文本、关键数字、标题。
- **On Surface Variant** (`#414755`): 辅助文本、说明文字、图标默认色、次级标签。
- **Error** (`#BA1A1A`): 错误、已过期批次、破坏性操作和通知红点。

状态色应局部使用，避免大面积铺色。绿色表达健康或正向趋势，黄色表达临近保质期、紧急处理和各类效期预警，红色仅用于已过期批次、错误或破坏性操作，蓝色表达正常信息和品牌相关状态。

## Typography

- **Headlines**: `Plus Jakarta Sans`，粗体或半粗体，用于页面标题、卡片重点数字、关键模块标题。
- **Body**: `Inter`，常规字重，常用 `14px` 到 `16px`，用于正文、表格内容、说明文字。
- **Labels**: `Inter`，中等字重，常用 `10px` 到 `12px`，可配合大写英文、较宽字距或状态色用于分组标题、标签和元信息。
- **Numbers**: 关键数字优先使用标题字体，并提高字重，保证仪表盘和统计卡片的扫读效率。

标题字体负责建立品牌感，正文字体负责信息密度和可读性。不要在同一区块中混用过多字号层级。

## Components

- **Layout**: 固定左侧导航 + 顶部工具栏 + 主内容区。侧边栏使用浅灰背景、右侧大圆角和柔和阴影，顶部栏使用半透明白色与背景模糊效果。
- **Buttons**: 以圆角按钮为主。主按钮使用品牌蓝填充或品牌蓝文字，次级按钮使用白底、浅灰边框和轻 hover。图标按钮应保持紧凑，常见尺寸为 `36px` 到 `40px`。
- **Inputs**: 使用浅灰背景、无重边框或极弱边框，聚焦态使用 `primary` 的低透明度 ring。搜索框应搭配左侧图标。
- **Cards**: 卡片是核心信息容器。默认白底、`rounded-3xl`、轻边框和 `ambient-shadow`，内部使用 `p-6` 或 `p-8` 保持呼吸感。
- **Stat Cards**: 左上角图标容器、右上角趋势徽标、下方标题和大数字。hover 可轻微上移，不应产生夸张动画。
- **Tables**: 使用轻分割、浅表头、行 hover 和局部强调。避免重网格线，信息重点依靠字重、颜色和标签表达。
- **Badges**: 使用浅底色 + 状态文字/图标，不使用大面积纯色块。圆角应与整体柔和风格一致。
- **Modals**: 弹窗偏详情面板风格，使用大圆角、遮罩淡入、主体轻微缩放和位移动画。新增详情弹窗应沿用 `AnimatePresence + motion` 的节奏。
- **Operation Feedback**: 创建、更新、删除等写操作完成后，应统一使用 `src/components/common/OperationAlert.tsx` 提供反馈。成功、警告、错误均使用同一组件体系，不再各页面自定义散装提示样式。
- **Charts**: 图表放在卡片容器中。主序列优先使用品牌蓝，辅助序列使用低饱和浅色或状态色，避免过多高饱和颜色同时出现。

## Motion

- 动效应短促、自然、服务于反馈和层级变化。
- 卡片 hover 可使用轻微上移，例如 `y: -4`。
- 侧边栏展开/收起使用平滑宽度过渡，保持内容显隐同步。
- 弹窗进入可使用淡入、缩放和轻微上移，退出按相同路径反向收起。
- 不使用装饰性强、与任务无关的连续动画。

## Do's and Don'ts

- Do 使用明亮浅灰背景和白色卡片建立层级。
- Do 将 `primary` 保留给当前状态、关键操作和重要数据。
- Do 保持大圆角、轻阴影和充足留白，这是当前项目的核心视觉特征。
- Do 使用图标辅助识别，但图标尺寸应克制，避免成为视觉主体。
- Do 保持文字对比度，正文和关键数据应满足至少 4:1 的可读性要求。
- Don't 将界面改成深色主题，除非同时重做所有 surface、文字和图表 token。
- Don't 使用传统后台的重边框、重表格网格和高密度挤压布局。
- Don't 在同一视图混用尖角、小圆角和超大圆角；圆角层级要稳定。
- Don't 大面积铺设状态色或品牌蓝，状态色只用于表达风险、趋势和重点。
- Don't 添加强装饰性的渐变、光斑或复杂背景，当前风格依赖清洁分层而不是装饰。

## Implementation Notes

当前设计 token 主要定义在 `src/index.css` 的 Tailwind `@theme` 中。新增页面或组件时，应优先复用这些 token：

- 背景使用 `bg-surface`、`bg-surface-container-lowest`、`bg-surface-container-low`。
- 主文本使用 `text-on-surface`，辅助文本使用 `text-on-surface-variant`。
- 品牌强调使用 `text-primary`、`bg-primary`、`focus:ring-primary/20`。
- 常规卡片优先使用 `rounded-3xl border border-surface-container/10 bg-surface-container-lowest ambient-shadow`。
- 页面级间距优先使用 `p-8`、`gap-6`、`gap-8`，卡片内边距优先使用 `p-6`。
- 写操作反馈统一复用 `src/components/common/OperationAlert.tsx`，不要为单个页面重复实现新的通知样式。
- 调试模式下可以展示接口错误详情、状态码、异常对象或调试上下文；生产模式必须收敛为用户友好的提示文案，不向终端用户暴露内部错误细节。
- 推荐模式是：页面触发创建/更新/删除后，先给出简洁成功提示；失败时默认展示可理解的业务文案，仅在调试模式附加详情块。

一句话总结：Origin 的设计系统是一套明亮、圆润、卡片化、轻品牌化的库存管理工作台风格，重点在清晰分层、低视觉噪音和舒适的信息浏览节奏。
