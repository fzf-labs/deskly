# brainstorm: optimize task detail workflow presentation

## Goal

优化任务详情页中的工作流展示层级，减少它对主执行区域的视觉挤占，同时保留用户对当前节点、整体进度和审批状态的感知能力。

## What I already know

* 用户反馈：任务详情页中的工作流展示在视觉上占用过大，希望探索优化方案。
* 当前页面结构中，`WorkflowCard` 位于 `TaskCard` 与 `ExecutionPanel` 之间，会直接占用主内容列的垂直空间。
* 当前 `WorkflowCard` 默认整图展开，最小画布高度约为 `220px`，最小宽度约为 `620px`，节点尺寸约为 `196x74`。
* `ExecutionPanel` 才是任务详情页的主操作区，但工作流卡片当前没有摘要态或折叠态，因此与执行区同级竞争注意力。
* 当前工作流卡片还承担两个职责：
  1. 展示整体节点图
  2. 在有 review 节点时展示确认入口

## Assumptions (temporary)

* 这次优先解决“展示层级和空间占用”问题，不改变 workflow runtime 语义。
* 用户更在意任务详情页的阅读/执行效率，而不是始终完整可见的 DAG 画布。
* MVP 可以先做交互层和布局层优化，不需要一次性重做节点图组件。

## Open Questions

* 无

## Requirements (evolving)

* 工作流信息仍然需要在任务详情页可见。
* 当前节点、整体进度、待审核状态需要保留可见性。
* 工作流区域不应继续与主执行面板争夺主要视觉空间。
* 方案应尽量复用现有 `WorkflowCard` / `workflowGraph` / `currentTaskNode` 数据。
* 默认采用“摘要优先，按需展开完整图”。
* 摘要态下直接提供待审核节点的操作入口，不要求先展开图。

## Acceptance Criteria (evolving)

* [ ] 任务详情页默认进入时，工作流区域的视觉占用显著小于当前版本。
* [ ] 用户仍然可以快速看到当前节点、节点总数/进度、是否待审核。
* [ ] 用户在需要时仍可进入完整工作流图查看和节点选择。
* [ ] 方案在桌面端和窄宽度下都不造成主要内容区挤压。
* [ ] 存在 review 节点时，用户可在摘要态直接完成审核动作。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 重做 workflow DAG 数据模型
* 改变 workflow scheduler / runtime 行为
* 一次性重做整个任务详情页信息架构

## Technical Notes

* 主要涉及文件：
  * `src/renderer/src/pages/task-detail/TaskDetailContainer.tsx`
  * `src/renderer/src/pages/task-detail/components/WorkflowCard.tsx`
  * `src/renderer/src/pages/task-detail/useTaskDetail.tsx`
  * 可能涉及 `ExecutionPanel.tsx` 以调整主次关系
* 当前结构特点：
  * `WorkflowCard` 独占一整块卡片
  * 默认展示完整 DAG 画布
  * review 操作入口也附着在卡片内部

## Research Notes

### Constraints from our repo/project

* 工作流图已经有稳定数据来源：`workflowGraph`、`currentTaskNode`、`selectedWorkflowNodeId`
* 当前任务详情页是单列主内容流，插入一个固定高度图卡会直接推挤执行区
* 现有代码最适合做“信息分层”优化，而不是完全换组件体系

### Feasible approaches here

**Approach A: Summary-first card + expand to full graph** (Recommended)

* How it works:
  * 默认只展示一行到两行的工作流摘要：当前节点、总节点数、状态分布、待审核提示
  * 提供“展开工作流”按钮，展开后才显示现有 DAG 画布
* Pros:
  * 改动相对集中，复用现有 `WorkflowCard`
  * 默认状态最省空间，最符合任务详情页的主次关系
  * 完整图仍在原位，用户心智成本低
* Cons:
  * 增加一个展开/收起交互状态
  * 审批入口要决定放在摘要态还是展开态

**Approach B: Collapsed vertical stepper instead of full DAG by default**

* How it works:
  * 默认显示一个压缩的纵向步骤列表，只突出当前节点与状态
  * 完整 DAG 作为“切换到图视图”进入
* Pros:
  * 对线性工作流尤其友好，可读性高
  * 在窄屏和高度有限场景下更稳
* Cons:
  * 对真正的分支 DAG 表达力变弱
  * 需要维护两种展示形态（stepper + graph）

**Approach C: Move full workflow graph to side panel / modal**

* How it works:
  * 主详情页只保留工作流摘要条
  * 完整 DAG 放到右侧面板或弹层中查看
* Pros:
  * 主内容区最干净，执行体验最好
  * 完整图和执行区不再相互挤压
* Cons:
  * 信息跳转更强，来回切换成本更高
  * 与当前页面结构耦合更深，改动面更大

## Decision (ADR-lite)

**Context**: 任务详情页中的工作流图默认整块展开，占用了过多主内容空间。  
**Decision**: 采用 `Approach A`，即“摘要优先，按需展开完整图”。  
**Consequences**: 默认态显著减小垂直占用，同时保留完整 DAG 作为次级视图；后续仍可继续演进到 stepper 或侧边面板。

## Technical Approach

建议把工作流区域拆成两层：

* **摘要态（默认）**
  * 一行标题 + 当前节点名称
  * 一组紧凑状态 pill：总节点数、已完成数、运行中/待审核
  * 一个主操作：`展开工作流`
  * 如果存在 review 节点，直接保留一个明显但紧凑的 `确认完成` / `去审核` 入口

* **展开态**
  * 复用当前 DAG `WorkflowCard` 画布
  * 支持收起
  * 保留节点选择与当前 review 区

推荐的视觉形态：

* 摘要态高度控制在当前版本的约 `72px - 104px`
* 默认不展示完整 SVG 画布
* 将“工作流”从大卡片改成更像一条状态条或紧凑信息卡
* 让 `ExecutionPanel` 继续作为页面中最高权重的主体区域
