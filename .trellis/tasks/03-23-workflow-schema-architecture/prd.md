# brainstorm: final workflow schema architecture

## Goal

在不考虑历史迁移包袱的前提下，为 Deskly 的任务执行系统收敛出一套最终数据库架构，重点判断 `task_nodes`、`workflow_templates`、`workflow_template_nodes` 是否还应保留，并明确统一后的建模边界：任务容器、可复用流程定义、一次执行实例、执行节点实例分别由什么表承担。

## What I already know

* 当前数据库里同时存在旧模型和新模型：`workflow_templates` / `workflow_template_nodes` 与 `workflow_definitions` / `workflow_runs` / `workflow_run_nodes` 并存。
* `TaskService` 已经把旧模板作为兼容输入桥接到新定义：`ensureWorkflowDefinitionIdForTemplate()` 会把 legacy template 转成 `workflow_definition`，然后创建 `workflow_run`，而不是再创建 legacy `task_nodes`。参见 `src/main/services/TaskService.ts`。
* 前端主路径已经基本切到新模型：Pipeline Templates 列表、编辑页、任务创建页都直接读写 `workflow_definitions`，而不是 `workflow_templates`。
* `DatabaseService.getTaskNodes()` / `getCurrentTaskNode()` 已经把 `workflow_run_nodes` 映射成通用 `TaskNode` 视图，说明上层 UI 已经开始吃“统一节点抽象”，而不是直接依赖某张物理表。
* `task_nodes` 目前主要还服务于 `conversation` 模式；`DatabaseService.createTask()` 会自动 `ensureConversationTaskNode(task.id)`。
* `workflow_run_nodes` 已经具备更完整的执行语义：DAG 节点、`node_type`、`command/prompt`、`attempt_count`、`failure_reason`、`review`、`session_id`、`resume_session_id`。
* 调度器 `WorkflowSchedulerService` 已经基于 `workflow_definition` + `workflow_run_nodes` 实现 DAG ready-node 调度。

## Assumptions (temporary)

* 最终架构应优先追求“单一执行模型”，避免 conversation 和 workflow 维护两套节点生命周期。
* `tasks` 仍然需要保留，作为用户级任务容器、工作区/Git/worktree 绑定对象，而不是把所有信息完全塞进 workflow run。
* 可复用流程编辑能力会继续存在，因此需要保留“定义层”，但不需要再保留旧的线性模板表。

## Open Questions

* `task_mode` 在最终形态里是继续保留为 UX 分类字段，还是彻底由 definition shape 推导？

## Requirements (evolving)

* 最终架构只能有一套执行节点实例模型。
* 可复用流程定义只能有一套持久化模型。
* conversation 与 workflow 需要共用统一运行时状态机、会话绑定和审批语义。
* UI 可以继续通过“当前节点 / 节点列表”的统一抽象消费执行状态。
* `workflow_templates`、`workflow_template_nodes`、`task_nodes` 最终都要移除。
* conversation 被重新定义为“单节点 workflow run”。

## Acceptance Criteria (evolving)

* [ ] 能清楚说明 `task_nodes` 是否保留，以及若删除后 conversation 如何落模。
* [ ] 能清楚说明 `workflow_templates` / `workflow_template_nodes` 是否保留，以及若删除后编辑器与创建任务如何落模。
* [ ] 能给出推荐的最终表结构分层：definition / run / run node / review / task。
* [ ] 能说明现有仓库中哪些部分已经证明该方向可行。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 旧库迁移脚本如何编写
* 线上/已有用户数据如何回填
* 本次不直接修改代码实现，只做最终架构收敛

## Technical Notes

* `src/main/services/database/DatabaseConnection.ts`：当前并存的正式 schema 定义。
* `src/main/services/TaskService.ts`：旧模板到新 definition/run 的桥接逻辑。
* `src/main/services/DatabaseService.ts`：旧 `task_nodes` 与新 `workflow_run_nodes` 的统一读模型映射层。
* `src/main/services/WorkflowRunService.ts` / `src/main/services/WorkflowSchedulerService.ts`：新执行主线。
* `src/renderer/src/pages/pipeline/WorkflowTemplateEditorPage.tsx`、`src/renderer/src/pages/pipeline/PipelineTemplatesPage.tsx`、`src/renderer/src/components/task/CreateTaskDialog.tsx`：前端已主要消费 `workflow_definitions`。

## Research Notes

### Constraints from our repo/project

* 当前上层 UI 希望拿到的是“任务 + 当前节点 + 节点列表”，而不是感知底层到底是 legacy task node 还是 workflow run node。
* 新工作流已经支持 DAG、命令节点与智能体节点混跑；旧模板表仅支持线性、agent-only 节点。
* 旧模板表的表达能力严格弱于 `workflow_definition.definition_json`。

### Feasible approaches here

**Approach A: Full Unified Execution Model** (Recommended)

* How it works:
  `tasks` 只保留任务容器；所有执行都通过 `workflow_runs` / `workflow_run_nodes` 进行，conversation 也是单节点 workflow；可复用模板统一落在 `workflow_definitions`。
* Pros:
  一套执行状态机；一套节点表；一套会话绑定；删除历史兼容层后模型最干净。
* Cons:
  需要把 conversation 创建链路也改成自动生成单节点 definition/run，心智上从“聊天任务”改成“单节点流程任务”。

**Approach B: Unified Templates, Split Runtime**

* How it works:
  删除 `workflow_templates` / `workflow_template_nodes`，统一保留 `workflow_definitions`；但 conversation 继续落 `task_nodes`，workflow 落 `workflow_run_nodes`。
* Pros:
  模板编辑层收敛了，conversation 改动较小。
* Cons:
  运行时仍是双轨；`DatabaseService` 这种映射胶水会长期存在，后续自动化/审计/节点查询都会继续分叉。

**Approach C: Keep Legacy Tables as Authoring Facade**

* How it works:
  继续保留 `workflow_templates` / `workflow_template_nodes` 作为编辑输入，runtime 走 `workflow_runs`；conversation 继续使用 `task_nodes`。
* Pros:
  改动最少。
* Cons:
  三套概念并存；定义层和运行层失配；长期维护成本最高，不符合“最终架构”目标。

## Current Recommendation

* 推荐采用 Approach A。
* 在这个方向下，`task_nodes`、`workflow_templates`、`workflow_template_nodes` 三张表最终都不应保留。
* 保留 `tasks`、`workflow_definitions`、`workflow_runs`、`workflow_run_nodes`、`workflow_run_reviews`，并让 conversation 退化为一种特殊但完全标准的 workflow。

## Decision (ADR-lite)

**Context**: 当前仓库已经形成“新 workflow runtime + 旧 template/task node 兼容层”的过渡态。用户希望跳过历史迁移约束，直接收敛到最终架构。

**Decision**: 移除 `workflow_templates`、`workflow_template_nodes`、`task_nodes`。保留 `tasks` 作为任务容器；保留 `workflow_definitions` 作为唯一可复用定义层；保留 `workflow_runs`、`workflow_run_nodes`、`workflow_run_reviews` 作为唯一运行时执行层。conversation 模式改为创建一个单节点的 workflow run。

**Consequences**:

* 定义层与运行时都收敛为单模型，服务层不再需要 legacy bridge。
* `DatabaseService` 中大量“task node / workflow run node 双读双写映射”可以移除，只保留统一视图映射。
* 如果要避免 conversation 任务生成大量可复用 definition，可以让 `workflow_runs` 直接持有 snapshot，并允许 `workflow_definition_id` 为空。
* `task_mode` 可以保留为产品展示字段，但不再决定底层 schema 分流。

## Technical Approach

* `tasks` 负责用户任务元数据、项目/worktree/workspace 绑定、聚合状态。
* `workflow_definitions` 负责全局/项目级可复用 DAG 定义。
* `workflow_runs` 负责一次任务执行实例，并持有最终执行快照。
* `workflow_run_nodes` 负责节点级执行状态、session、review 前状态、失败原因、重试次数。
* `workflow_run_reviews` 负责人工审批记录。

## Code-Spec Depth Check

### Target contracts to change

* 数据库 schema：
  删除 `workflow_templates`、`workflow_template_nodes`、`task_nodes`；
  `workflow_runs.workflow_definition_id` 改为可空；
  `automation_runs.task_node_id` 不再依赖 `task_nodes` 表。
* 主进程服务契约：
  `TaskService.createTask()` 不再接受 legacy template 作为主路径；
  conversation 创建时直接生成单节点 workflow run；
  `DatabaseService` 的 task-node 读取与执行 API 统一基于 `workflow_run_nodes`。
* IPC / preload 契约：
  移除 legacy workflow template CRUD IPC；
  `task.create` 去掉 `workflowTemplateId` 输入，仅保留 `workflowDefinitionId`。

### Validation and error matrix

* Good:
  conversation task 创建成功后，应自动存在一个单节点 `workflow_run` 和一个 `workflow_run_node`。
* Good:
  workflow task 使用 `workflowDefinitionId` 创建后，应生成对应 run/node 快照。
* Base:
  `workflowDefinitionId` 为空时，只有 `conversation` 允许继续，`workflow` 必须报错。
* Bad:
  `workflowDefinitionId` 不存在时，创建 workflow task 必须抛错。
* Bad:
  conversation workflow 节点缺少 CLI tool 时，执行前必须进入明确错误路径，而不是 silent fail。
* Bad:
  自动化运行记录不能再引用已删除的 `task_nodes` 表。

## Relevant Specs

* `.trellis/spec/frontend/type-safety.md`: IPC / renderer 类型边界需要收紧，不能继续扩散 legacy `unknown` / `any`。
* `.trellis/spec/frontend/quality-guidelines.md`: 需要在完成前跑 lint/typecheck，并保持 renderer IPC 读取有 defensive handling。
* `.trellis/spec/guides/cross-layer-thinking-guide.md`: 本次涉及 database/service/ipc/preload/renderer 多层契约收敛。
* `.trellis/spec/guides/code-reuse-thinking-guide.md`: 要避免保留两套并行 node/template 机制。

## Code Patterns Found

* 统一视图模式：
  `src/main/services/DatabaseService.ts` 已将 `workflow_run_nodes` 映射为通用 `TaskNode` 供上层消费。
* 基于 definition snapshot 的运行时模式：
  `src/main/services/WorkflowRunService.ts` 负责从 definition 生成 run nodes。
* DAG 调度模式：
  `src/main/services/WorkflowSchedulerService.ts` 基于 `workflow-graph.ts` 的 ready-node 计算执行节点。
* renderer 直接使用 definitions：
  `src/renderer/src/pages/pipeline/PipelineTemplatesPage.tsx`
  `src/renderer/src/pages/pipeline/WorkflowTemplateEditorPage.tsx`
  `src/renderer/src/components/task/CreateTaskDialog.tsx`

## Files to Modify

* `src/main/services/database/DatabaseConnection.ts`: 删除旧表、调整 run schema 与 automation FK。
* `src/main/services/TaskService.ts`: conversation 改为创建单节点 workflow run，移除 legacy template bridge。
* `src/main/services/DatabaseService.ts`: 去掉对 `task_nodes` / `WorkflowRepository` 的依赖，统一基于 workflow run nodes。
* `src/main/services/WorkflowRunService.ts`: 支持直接用 snapshot 创建 run。
* `src/main/services/database/WorkflowRunRepository.ts`: 支持 nullable `workflow_definition_id`。
* `src/main/services/TaskExecutionService.ts`: conversation 执行入口需要改为走 workflow run。
* `src/main/ipc/database.ipc.ts`: 移除 legacy workflow template IPC。
* `src/main/ipc/task.ipc.ts`: 去掉 `workflowTemplateId` 输入。
* `src/main/ipc/channels.ts`: 移除 legacy channel 定义。
* `src/preload/index.ts`, `src/preload/index.d.ts`: 移除 legacy template API 暴露。
* `src/renderer/src/data/adapter.ts`: 删除 legacy template 适配层。
* `src/main/types/domain/task.ts`, `src/preload/index.d.ts`: 去掉 `workflowTemplateId` 输入类型。
* `src/main/types/db/workflow.ts`, `src/main/types/workflow.ts`, `src/main/types/domain/workflow.ts`: 删除 legacy template 类型。
* `src/main/services/database/WorkflowRepository.ts`: 删除 legacy repository。
* `tests/main/services/TaskService.test.ts`, `tests/main/task-service.test.ts`, `tests/main/task-nodes-schema.test.ts`: 更新为新执行模型。
