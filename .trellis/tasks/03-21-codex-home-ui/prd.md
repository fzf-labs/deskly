# brainstorm: 主页面改成 Codex 风格

## Goal

将 Deskly 的主工作台整体改造成类似 Codex App 的双栏界面：左侧主要展示项目与对话列表，右侧为主展示区；当未选中对话时显示欢迎态与输入框，选中对话后显示对应任务/会话详情，并尽量复用现有任务创建、消息输入、任务详情与预览能力，降低交互回归风险。

## What I already know

* 用户希望主页面 UI 接近截图中的 Codex App 设计。
* 用户进一步明确：要改的是整体页面设计，左边栏应是已添加项目的对话，右边是展示区。
* 当前应用默认路由是 `/dashboard`，不是 `/home`。
* `/home` 已经存在一个欢迎页，文件为 `src/renderer/src/pages/Home.tsx`。
* `/dashboard` 是当前实际首页，文件为 `src/renderer/src/pages/dashboard/DashboardPage.tsx`。
* 应用主框架由 `src/renderer/src/components/layout/MainLayout.tsx` 和侧边栏组件组成，已经具备“左侧栏 + 右侧内容区”的整体结构，但左栏目前是导航，不是会话列表。
* 首页输入能力已封装在 `src/renderer/src/components/shared/ChatInput.tsx`，支持文本、附件、粘贴图片和提交创建任务。
* 任务列表能力已存在于 `src/renderer/src/components/task/TaskList.tsx`，但当前样式和信息密度偏管理面板，不像聊天应用侧栏。
* 任务详情主容器已存在于 `src/renderer/src/pages/task-detail/TaskDetailContainer.tsx`，右侧展示区有较高复用价值。
* 当前主题使用 Tailwind + `theme.css` 语义 token，适合做一轮轻量视觉重塑，不必引入新样式系统。

## Assumptions (temporary)

* 本次优先做工作台结构与视觉改造，不改动任务创建、附件上传、Agent 执行、预览能力等底层行为。
* 用户想参考的是截图中的布局语言和产品交互气质，而不是逐像素复刻 Codex App。
* 右侧展示区优先复用现有任务详情与欢迎页能力，而不是全量重写一套新页面。

## Open Questions

* 暂无

## Requirements (evolving)

* 主工作台整体视觉需向截图靠拢：浅色背景、柔和边框、较大留白、轻量侧栏、欢迎态输入框。
* 左侧栏从“导航为主”调整为“项目/对话为主”。
* 左侧栏按项目分组展示对话列表，每个项目下可浏览和切换其会话。
* 右侧区域作为主展示区，在不同状态下承载欢迎态或具体会话详情。
* 现有 `ChatInput` 交互能力应尽量复用，避免重复实现输入与附件逻辑。
* 现有任务详情页能力应尽量复用，避免重复实现会话执行区和预览区。
* 改造应优先控制在 renderer 层，不影响主进程、IPC 和任务创建接口。
* 新的双栏工作台成为默认核心入口。
* 旧的 `dashboard`、`tasks` 等入口在 MVP 中被弱化或移出主导航，不再作为主要工作流入口。

## Acceptance Criteria (evolving)

* [ ] 主工作台在桌面尺寸下呈现接近目标截图的双栏风格。
* [ ] 左侧栏可浏览与切换项目对话。
* [ ] 未选中对话时，右侧显示欢迎态或空态入口。
* [ ] 选中对话时，右侧能正常展示对应任务/会话内容。
* [ ] 输入框仍可正常创建任务并进入对应会话。
* [ ] 页面在窄宽度下不会出现明显布局错乱或遮挡。
* [ ] `npm run lint` 和 `npm run typecheck` 通过。

## Definition of Done (team quality bar)

* Tests added/updated when logic extraction introduces meaningful branching
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 不在这一轮里重做自动化、技能、MCP、设置等所有功能页的完整视觉体系。
* 不重做任务创建流程的数据模型或 IPC 协议。
* 不重做 Agent 执行逻辑、工作流逻辑或制品预览逻辑。
* 不做暗色主题的完整视觉重设计，除非实现中顺手保持基本兼容。

## Technical Notes

* 默认首页路由定义在 `src/renderer/src/router.tsx`，当前 index 重定向到 `/dashboard`。
* 欢迎页实现位于 `src/renderer/src/pages/Home.tsx`，但当前默认入口未使用该页。
* `src/renderer/src/components/shared/ChatInput.tsx` 的 `home` variant 已接近欢迎态输入框用途，可作为本次改造基础。
* `src/renderer/src/components/layout/app-sidebar.tsx`、`left-sidebar.tsx`、`project-rail.tsx` 共同决定左侧栏观感，目前更偏“项目 rail + 功能导航”。
* `src/renderer/src/components/task/TaskList.tsx` 可作为会话列表数据与交互的起点，但样式与分组方式需要重构。
* `src/renderer/src/pages/task-detail/TaskDetailContainer.tsx` 已整合消息、执行、回复、预览等右侧主展示能力，可考虑抽出为可嵌入的详情区域。
* 主题 token 位于 `src/renderer/src/config/style/theme.css`，全局样式位于 `src/renderer/src/config/style/global.css`。
* 默认路由、导航配置、左侧栏入口需要同步调整，避免出现“新工作台是首页但旧导航仍指向旧结构”的割裂体验。

## Research Notes

### What similar tools do

* 类 Codex / 聊天式工作台通常把“会话列表”放在左边，把“当前会话内容”放在右边。
* 未选中会话时，右侧往往显示一个极简欢迎态，让输入框成为最重要的主操作。
* 左栏通常弱化功能导航，强化会话历史、项目上下文、创建新会话入口。

### Constraints from our repo/project

* 当前默认首页是 `/dashboard`，而不是聊天式工作台。
* 当前左栏结构偏“项目 rail + 功能导航”，不是对话信息架构。
* 输入框逻辑和任务详情逻辑都已存在，适合复用；真正需要重构的是壳层布局与列表组织方式。

### Feasible approaches here

**Approach A: 当前项目单列会话模式** (Recommended for MVP)

* How it works: 顶部或左栏先确定当前项目，左侧只显示该项目下的会话列表，右侧显示欢迎态或当前会话详情。
* Pros: 信息架构最清晰，实现成本最低，适合先完成像 Codex 的主工作台体验。
* Cons: 跨项目切换效率一般，需要额外保留项目切换入口。

**Approach B: 项目分组会话模式**

* How it works: 左栏按项目分组，每个项目下展示其会话列表，可展开/折叠。
* Pros: 更符合“左边栏是添加的项目的对话”这句话，也更直观展示全局结构。
* Cons: 左栏信息密度更高，UI 设计和交互状态更多，首版复杂度较高。

**Approach C: 全部会话平铺模式**

* How it works: 左栏直接按时间展示全部会话，只用小标签标识所属项目。
* Pros: 浏览效率高，接近部分聊天工具的历史列表模式。
* Cons: 项目边界弱，不太符合“项目的对话”这一表述。

## Decision (ADR-lite)

**Context**: 需要确定左侧栏“项目”和“对话”的组织方式，以便让整体工作台更接近类 Codex 的双栏体验，同时符合用户对“左边栏是添加的项目的对话”的描述。

**Decision**: 左侧栏采用“按项目分组展示对话”的模式。

**Consequences**: 视觉和信息架构会更贴近目标产品形态，但实现上需要处理项目分组、展开折叠、空态和当前会话选中态等更多 UI 状态；作为回报，后续扩展搜索、固定、最近会话等功能也会更自然。

**Context**: 需要确定 MVP 是否仅新增一个工作台页面，还是让新工作台直接替代旧的默认首页和主要导航入口。

**Decision**: 新的双栏工作台成为默认核心入口，旧的 `dashboard`、`tasks` 等页面在主导航中被弱化或移出。

**Consequences**: 首次打开应用即可进入目标体验，产品心智会更统一；同时需要处理路由重定向、导航项裁剪和原有页面可达性的兼容策略。

## Technical Approach

优先通过“重做主布局壳层 + 复用现有输入与详情能力”的方式实现：

* 新建或重构一个核心工作台页面，承载左侧项目分组会话栏和右侧主展示区。
* 左侧栏基于现有项目与任务数据组装为“项目分组 + 会话项”的结构，补上选中态、空态和新建入口。
* 右侧未选中会话时显示欢迎态，底部使用 `ChatInput` 的 home 风格输入框。
* 右侧选中会话时，尽量复用现有任务详情展示能力，而不是重写消息流、执行流和预览区。
* 调整默认路由和主导航，让新工作台成为进入应用后的主路径。

## Expansion Sweep

### Future evolution

* 后续可能会加入搜索会话、固定会话、按时间分组等能力，左栏结构最好能容纳这些扩展。
* 如果未来支持更多 Agent / workflow 模式，欢迎态和会话列表应保留轻量扩展位。

### Related scenarios

* 新建任务入口、切换项目入口、删除任务入口都要和新的左栏结构保持一致。
* 现有独立任务详情页与新的工作台内嵌详情区之间，最好共享核心展示组件，避免双份 UI 漂移。

### Failure & edge cases

* 当前项目没有任何对话时，左栏和右侧都需要有清晰空态。
* 项目路径失效、任务被删除、会话加载失败时，右侧不能留白卡死。
