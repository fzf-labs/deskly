# brainstorm: workflow DAG ui

## Goal

评估 Deskly 是否应该在任务详情页引入 DAG 形式的工作流展示组件，并收敛出一个适合当前代码结构的 MVP 方案。目标不是立刻做可编辑的流程画布，而是先把已经存在的 DAG 工作流定义，准确、清晰地展示给用户。

## What I already know

* 用户观察到当前工作流展示仍然是线性 UI，不符合 DAG 形态。
* 任务详情页当前使用 `WorkflowCard` 按 `nodes.map(...)` 串行渲染节点，并只画相邻节点之间的连接线。
* 任务详情页当前的 workflow 状态来源于 `db.getTaskNodes(taskId)`，并按 `node_order` 排序后作为展示数据。
* 工作流模板编辑与定义层已经支持 DAG 依赖关系：`WorkflowTemplateDialog` 中存在 `dependsOnIds`，`workflow-definition-form.ts` 会构造 `definition.edges`。
* 现有仓库还没有引入 `reactflow` / `@xyflow/react` 之类的图组件依赖。
* 当前渲染端技术栈是 React 19、Vite 7、Tailwind CSS 4。
* 官方文档显示 React Flow 当前包名为 `@xyflow/react`，并提供现成的 nodes / edges / viewport / controls 能力。
* React Flow 官方文档与更新说明表明其已覆盖 React 19 / Tailwind 4 场景；在 Tailwind 4 下需要把 React Flow 的样式放到全局 CSS，并位于 `tailwindcss` 导入之后。

## Assumptions (temporary)

* 本轮重点是任务详情页的 DAG 展示，不是工作流编辑器重做。
* 第一版可以只做“只读 DAG 视图”，保留现有节点选中、状态高亮和 review 操作。
* 第一版可以接受自动布局较简单，只要能正确表达依赖关系即可。
* 当前 workflow runtime 已经具备足够的数据来映射节点状态；若任务详情页缺少 edges，需要从 workflow definition / snapshot 补齐，而不是继续依赖 `node_order`。

## Open Questions

* 暂无阻塞性开放问题。

## Requirements (evolving)

* 明确当前线性展示的限制以及它与现有 DAG 数据模型之间的错位。
* 评估是否适合引入 `@xyflow/react` 作为 DAG 展示层。
* 给出 2-3 个可行方案，并说明集成复杂度、可维护性、扩展性与 UI 风险。
* 推荐一个 MVP 方案，能尽量复用现有工作流数据和交互。
* 明确第一版是否替换现有线性视图，还是采用双视图/渐进式切换。
* 明确 DAG 节点内承载多少交互，避免首版把图节点做得过重。
* 明确 DAG 视图的默认交互密度与视口策略。

## Acceptance Criteria (evolving)

* [x] 确认当前任务详情页 workflow UI 是线性展示，而不是边驱动的 DAG 展示。
* [x] 确认 workflow definition 层已具备 DAG 数据结构。
* [x] 确认仓库当前未引入图可视化依赖。
* [x] 确认 `@xyflow/react` 与当前 React 19 / Tailwind 4 技术栈兼容。
* [x] 给出至少 2 个可行方向，并明确推荐方案。
* [x] 明确最终产品决策：直接替换当前线性卡片，采用 DAG 视图作为默认展示。
* [x] 明确节点交互承载方式：节点主要负责展示与选中，审批/详情保留在图外部区域。
* [x] 明确 DAG 视图默认采用紧凑概览模式：固定区域高度、默认 fitView、支持基础缩放和平移但不强调自由画布心智。

## Definition of Done (team quality bar)

* 方案能映射到现有代码结构与页面入口
* 依赖引入和样式接入风险被提前说明
* MVP 与后续演进边界清晰

## Out of Scope (explicit)

* 本轮不讨论完整可编辑 Workflow Canvas 重构。
* 本轮不讨论运行时动态拖拽改拓扑、在线编辑依赖或节点增删。
* 本轮不强求第一版就引入复杂自动布局算法或缩略图/分组/子流等高级能力。

## Technical Notes

* 当前线性展示入口：
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/renderer/src/pages/task-detail/components/WorkflowCard.tsx`
* 当前任务详情 workflow 状态加载：
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/renderer/src/pages/task-detail/useTaskDetail.tsx`
* DAG 定义与依赖关系构造：
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/renderer/src/components/pipeline/WorkflowTemplateDialog.tsx`
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/renderer/src/components/pipeline/workflow-definition-form.ts`
* 全局样式入口：
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/renderer/src/main.tsx`
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/renderer/src/config/style/global.css`
* 依赖清单：
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/package.json`

## Research Notes

### What similar tools do

* React Flow 官方推荐用 `@xyflow/react` 作为 React 项目中的 node-based UI 基础库，内置节点、边、缩放、平移、选中等基础能力。
* 官方 Quick Start 明确要求：容器必须有明确宽高，并导入 React Flow 样式。
* React Flow 官方近期更新已覆盖 React 19 与 Tailwind CSS 4 场景。
* 在 Tailwind 4 下，官方建议把 `@xyflow/react/dist/style.css` 放到 `global.css` 中，并位于 `@import "tailwindcss";` 之后。

### Constraints from our repo/project

* 当前任务详情页已经有“选中节点、展示状态、审批当前节点”的交互，不适合一上来重写成完全不同的页面心智。
* 当前任务详情展示数据仍然以 `task_nodes + node_order` 为核心，若要做 DAG，需要补足 edges 映射来源。
* 现有工作流定义层已经有 `definition.nodes` 和 `definition.edges`，说明“数据不存在”不是主要风险，“详情页没有接上 DAG 结构”才是主要问题。
* 目前没有图布局相关依赖；若直接上 React Flow，最好先用 definition 中已有 position 或简单自动布局，避免第一版同时引入第二个 layout 库。

### Feasible approaches here

**Approach A: 在任务详情页直接引入 `@xyflow/react`，替换当前线性 WorkflowCard** (Selected)

* How it works:
  * 任务详情直接渲染 React Flow，把当前线性卡片彻底替换成 DAG 画布。
* Pros:
  * 用户心智统一，页面上只保留一种 workflow 展示。
  * 后续扩展到更丰富的节点卡片、边样式、缩放/定位更自然。
* Cons:
  * 风险较高，当前小而稳定的 workflow 卡片会一次性被替换。
  * 首版就要处理更多细节：空态、超小屏适配、状态说明、审批入口位置。
  * 如果 DAG 数据有缺口，回退空间较小。

**Approach B: 保留当前线性卡片，同时新增 DAG 视图（推荐）**

* How it works:
  * 在线性 `WorkflowCard` 附近新增一个 DAG 视图区域或切换 Tab。
  * DAG 视图基于 `@xyflow/react` 只读展示节点与边，复用现有状态色、当前节点选中、review 高亮。
* Pros:
  * 上线风险低，现有交互可以原样保留。
  * 能快速验证 DAG 展示是否真的提升理解成本。
  * 后续如果效果好，再逐步让 DAG 视图转正替代线性卡片。
* Cons:
  * 页面会短期存在两套表达，信息密度更高。
  * 需要额外设计“默认看哪个视图”与同步选中状态。

**Approach C: 自绘轻量 DAG（SVG / CSS）而不是引 React Flow**

* How it works:
  * 自己把节点和边渲染成简单的 SVG 图，不引新依赖。
* Pros:
  * 包体更轻，定制更自由。
  * 只做静态展示时，理论上依赖更少。
* Cons:
  * 需要自己处理布局、拖拽/缩放留白、命中测试和后续演进。
  * 一旦未来想复用到编辑器或更多图视图，重做概率高。
  * 实际长期维护成本往往高于直接采用成熟库。

### Recommendation

当前已确认采用 **Approach A**：

* 任务详情页直接以 `@xyflow/react` DAG 视图替换当前线性 `WorkflowCard`。
* 第一版仍然保持“只读 DAG + 可选中节点 + review 操作”。
* 数据层重点放在“把 workflow definition / snapshot 的 edges 正确映射到详情页”，而不是先做重型布局与编辑能力。
* 为了控制替换风险，首版不把所有操作塞进图节点本身，优先复用现有图外动作区。
* 详情页优先改为使用 workflow run snapshot 作为图结构来源，而不是继续从 `task_nodes + node_order` 反推线性模板。
* 视图形态采用“紧凑概览”而不是“自由画布”，保证它仍然符合任务详情页中的信息模块定位。

## Initial MVP Notes

* 仅展示 node status、当前节点、依赖边、失败/审批高亮。
* 不开放拖拽改图，不开放连边编辑。
* 先用已有 `position` 或简单自动布局；不要在第一版同时引入 `dagre` / `elkjs`。
* 直接替换当前线性卡片，而不是双视图共存。
* 保留现有“Confirm complete”动作，并继续放在图外部区域。
* 默认采用固定高度图区域与 `fitView` 初始视口，允许用户基础缩放/平移，但不鼓励把它当成全屏设计器。
