# brainstorm: workflow redesign

## Goal

评估并设计 Deskly 的工作流改造方向，重点参考 `/Users/fuzhifei/code/go/src/demo/AgentCrew` 的工作流方案，明确哪些能力适合引入、现有实现的约束是什么，以及后续 MVP 应该先做哪一层。

## What I already know

* 用户希望先查看 `AgentCrew` 项目中关于工作流的方案设计，用于指导 Deskly 的工作流改造。
* Deskly 当前已经有 `workflow template` 概念，任务创建时支持 `conversation` 和 `workflow` 两种 `taskMode`。
* Deskly 当前的模板结构是线性的有序节点，而不是带依赖关系的 DAG。
* Deskly 当前的工作流模板会在创建任务时展开为 `task_nodes`，每个节点包含 `name`、`prompt`、`cli_tool_id`、`agent_tool_config_id`、`requires_approval` 等字段。
* Deskly 的 `TaskExecutionService` 目前按 `node_order` 顺序推进节点，单次只启动下一个 `todo` 节点；审批会把节点留在 `in_review`，批准后继续推进。
* Deskly 另有一个 `PipelineService`，支持 `command/manual/approval/notification` 等 stage type，但当前是按 `order` 串行执行，与 `workflow template -> task_nodes` 这条主链路看起来是分离的。
* AgentCrew 明确区分两种编排模式：
* `Pipeline` 模式：静态 DAG、显式依赖、按 wave 并发执行。
* `Agent` 模式：`Plan -> Execute -> Evaluate -> Replan` 的多轮动态执行。
* AgentCrew 的 `DAGScheduler` 会先校验 DAG，再按依赖分 wave，并在 wave 内并发执行 ready steps。
* AgentCrew 的 planner 会把自然语言需求转成结构化 pipeline JSON，再映射成 stages/steps，并根据步骤语义给默认工具分配。
* AgentCrew 还定义了 agent 运行期状态、repair strategy、mode recommendation、runtime suggestion 等上层概念。

## Assumptions (temporary)

* 当前这轮目标是做方案梳理和需求收敛，不是立刻开始改代码。
* 用户想借鉴 `AgentCrew` 的设计思想，而不是 1:1 复制它的全部能力。
* 当前已确认的大方向是：Deskly 优先做“静态 DAG 执行平台”，而不是先做动态 Agent 双模式。
* 当前已确认，任务相关的数据表允许重构，本轮不需要为了兼容旧任务模型而保留迁移包袱。

## Open Questions

* 暂无阻塞性开放问题。

## Requirements (evolving)

* 产出 Deskly 当前工作流实现的结构性分析。
* 产出 AgentCrew 工作流方案的核心机制拆解。
* 找出两者之间的概念映射关系与差距。
* 收敛出适合 Deskly 的改造路径与 MVP 边界。
* 新工作流平台定位为“静态 DAG 执行平台”。
* 系统支持基于自然语言或上下文自动生成 workflow。
* 生成后的 workflow 允许用户在执行前人工微调。
* workflow 一旦进入执行阶段，不支持动态 replan 或运行中改变拓扑结构。
* MVP 不强制引入独立 `approval` 节点；人工确认能力优先作为每个执行节点的可配置属性。
* MVP 的人工确认语义采用“执行后确认”：节点先执行，完成后由人工确认是否继续后续节点。
* MVP 需要定义清晰的节点状态机，覆盖就绪、运行、复核、成功、失败、取消等状态，以及它们对后继节点释放的影响。
* 第一版失败语义采用“局部失败、并行继续”：失败节点不释放后继节点，但其他已 ready 的并行节点允许继续跑完。
* 第一版 run 顶层状态采用简单枚举，不引入 `partial_failed`；只要存在失败节点且 run 结束，顶层状态即为 `failed`。
* 第一版支持节点级重试，不要求整条 workflow 从头重跑。
* 第一版节点重试采用覆盖模式：不保留独立 attempt 历史，只保留节点当前最新状态与 `attempt_count`。
* 第一版 `review` 只有“通过继续”，没有“拒绝”动作；若结果不满意，用户通过重试节点处理。
* `review` 状态下的主要用户动作是：`通过继续` 和 `重试节点`。
* 对于 `workflow task`，`task.status` 直接复用 `workflow_run.status`。

## Acceptance Criteria (evolving)

* [ ] 明确 Deskly 当前 workflow 的数据模型、执行模型与 UI 入口。
* [ ] 明确 AgentCrew 的 Pipeline / Agent 双模式、调度和规划机制。
* [ ] 明确两者最关键的设计差异及对 Deskly 改造的影响。
* [ ] 给出 2-3 个适合 Deskly 的改造方向选项，并说明权衡。
* [ ] 明确“生成后可微调、执行中冻结”的产品规则。
* [ ] 明确节点级人工确认的时机与状态流转。
* [ ] 明确失败节点对并行分支、后继节点和 task/run 聚合状态的影响。
* [ ] 明确 run 顶层状态枚举并避免过度设计。
* [ ] 明确节点重试后的状态恢复与历史记录策略。
* [ ] 明确 review 状态下的用户动作与交互规则。

## Definition of Done (team quality bar)

* 流程设计结论能映射回现有代码结构
* 方案边界清晰，MVP 与 out-of-scope 明确
* 后续实施前有可执行的技术拆分

## Technical Approach

第一版以“静态 DAG + 节点运行记录”为核心：

* workflow definition 定义节点、边、依赖和节点配置。
* execution runtime 负责根据依赖关系找出 ready nodes，并发调度可执行节点。
* 每个节点执行后进入终态或 review 态，再由运行时决定是否释放后继节点。

推荐的精简节点状态机：

* `waiting`
  * 节点尚未开始执行。
  * 统一覆盖“等待前置依赖”和“已经 ready、等待调度”两种情况。
* `running`
  * 节点正在执行。
* `review`
  * 节点执行完成，但开启了“执行后确认”，等待人工批准是否继续后续节点。
* `done`
  * 节点执行成功，且已满足继续执行后继节点的条件。
* `failed`
  * 节点未通过，包括执行失败或用户主动停止。

派生状态（不一定需要落库）：

* `ready`
  * `waiting` 且前置依赖全部 `done`。
* `blocked`
  * `waiting` 且某个前置依赖已 `failed`。
* `cancelled`
  * 可作为 `failed` 的失败原因，而不是独立主状态。

状态流转建议：

* `waiting -> running`
  * 节点进入可调度状态后，被执行器选中。
* `running -> review`
  * 节点执行完成，且配置了执行后确认。
* `running -> done`
  * 节点执行完成，且无需人工确认。
* `running -> failed`
  * 节点执行失败或被手动停止。
* `review -> done`
  * 人工确认通过，放行后继节点。

后继节点释放规则建议：

* 只有前驱节点进入 `done`，才释放依赖它的后继节点。
* `review` 不释放后继节点。
* `failed` 默认不释放后继节点。
* `ready / blocked / cancelled` 优先作为运行时派生视图，而不是持久化主状态。
* 若某节点 `failed`，仅阻断依赖它的后继链路；同一轮或后续轮中其他已满足依赖的分支仍可继续执行。

### Data model draft

建议把“工作流定义”和“工作流运行态”分开建模，但都存数据库。

#### Workflow definition

`workflow_definitions`

* `id`
* `scope`
* `project_id`
* `name`
* `description`
* `definition_json`
* `created_at`
* `updated_at`

`definition_json` 直接存整张 DAG，例如：

* `nodes`
* `edges`
* 节点类型、prompt、command、tool 配置
* `requiresApprovalAfterRun`
* 布局信息（position）

#### Workflow execution

推荐使用独立运行表，而不是沿用旧 `task_nodes` 心智。

`workflow_runs`

* `id`
* `task_id`
* `workflow_definition_id`
* `status` (`waiting` | `running` | `review` | `done` | `failed`)
* `definition_snapshot_json`
* `current_wave`
* `started_at`
* `completed_at`
* `created_at`
* `updated_at`

`workflow_run_nodes`

* `id`
* `workflow_run_id`
* `definition_node_id`
* `node_key`
* `name`
* `node_type`
* `prompt`
* `command`
* `cli_tool_id`
* `agent_tool_config_id`
* `requires_approval_after_run`
* `status` (`waiting` | `running` | `review` | `done` | `failed`)
* `failure_reason` (`execution_error` | `cancelled` | null)
* `session_id`
* `resume_session_id`
* `result_summary`
* `error_message`
* `cost`
* `duration`
* `attempt_count`
* `started_at`
* `completed_at`
* `created_at`
* `updated_at`

`workflow_run_reviews`

* `id`
* `workflow_run_id`
* `workflow_run_node_id`
* `decision` (`approved`)
* `comment`
* `reviewed_by`
* `reviewed_at`
* `created_at`

> `workflow_runs.definition_snapshot_json` 用于冻结执行时的 DAG；因此第一版不需要额外的 `workflow_run_edges` 表。

### SQL draft

建议的 SQLite 草案如下。

```sql
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'project')),
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  definition_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_workflow_definitions_global_name
  ON workflow_definitions(name)
  WHERE scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_workflow_definitions_project_name
  ON workflow_definitions(project_id, name)
  WHERE scope = 'project';

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_scope_project
  ON workflow_definitions(scope, project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  workflow_definition_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'running', 'review', 'done', 'failed')),
  definition_snapshot_json TEXT NOT NULL,
  current_wave INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
  ON workflow_runs(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS workflow_run_nodes (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL,
  definition_node_id TEXT NOT NULL,
  node_key TEXT NOT NULL,
  name TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('agent', 'command')),
  prompt TEXT,
  command TEXT,
  cli_tool_id TEXT,
  agent_tool_config_id TEXT,
  requires_approval_after_run INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval_after_run IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('waiting', 'running', 'review', 'done', 'failed')),
  failure_reason TEXT CHECK (failure_reason IN ('execution_error', 'cancelled') OR failure_reason IS NULL),
  session_id TEXT,
  resume_session_id TEXT,
  result_summary TEXT,
  error_message TEXT,
  cost REAL,
  duration REAL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_tool_config_id) REFERENCES agent_tool_configs(id) ON DELETE SET NULL,
  UNIQUE (workflow_run_id, definition_node_id),
  UNIQUE (workflow_run_id, node_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_nodes_run_status
  ON workflow_run_nodes(workflow_run_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_run_nodes_session_id
  ON workflow_run_nodes(session_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_workflow_run_nodes_single_running
  ON workflow_run_nodes(workflow_run_id)
  WHERE status = 'running';

CREATE TABLE IF NOT EXISTS workflow_run_reviews (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL,
  workflow_run_node_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved')),
  comment TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_run_node_id) REFERENCES workflow_run_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_reviews_node
  ON workflow_run_reviews(workflow_run_node_id, reviewed_at DESC);
```

### JSON shape draft

`workflow_definitions.definition_json` 建议显式版本化，避免后续结构演进困难。

```json
{
  "version": 1,
  "nodes": [
    {
      "id": "node_impl",
      "key": "implement",
      "type": "agent",
      "name": "Implement feature",
      "prompt": "Implement the feature described in the task.",
      "cliToolId": "codex",
      "agentToolConfigId": null,
      "requiresApprovalAfterRun": false,
      "position": { "x": 160, "y": 120 }
    },
    {
      "id": "node_test",
      "key": "test",
      "type": "command",
      "name": "Run tests",
      "command": "npm test",
      "requiresApprovalAfterRun": true,
      "position": { "x": 460, "y": 120 }
    }
  ],
  "edges": [
    {
      "from": "node_impl",
      "to": "node_test"
    }
  ]
}
```

### Module split proposal

为了贴合当前代码结构，建议不要把所有逻辑继续堆进 `DatabaseService`。

#### Main process

新增或重构这些模块：

* `src/main/services/database/WorkflowDefinitionRepository.ts`
  * CRUD `workflow_definitions`
  * 负责全局/项目级查找规则
* `src/main/services/database/WorkflowRunRepository.ts`
  * CRUD `workflow_runs`
* `src/main/services/database/WorkflowRunNodeRepository.ts`
  * 节点状态更新、ready candidates 查询、retry/reset
* `src/main/services/database/WorkflowRunReviewRepository.ts`
  * review 通过记录
* `src/main/services/WorkflowDefinitionService.ts`
  * 负责 AI 生成后的 definition 校验、保存、复制到项目级
* `src/main/services/WorkflowRunService.ts`
  * 创建 run、冻结 snapshot、汇总 run status
* `src/main/services/WorkflowSchedulerService.ts`
  * 负责 DAG 调度、ready set 计算、并行推进、失败阻断与 review 停顿

现有模块建议这样调整：

* `TaskService`
  * 保留 task 创建与 worktree 准备
  * `workflow task` 创建时不再生成线性 `task_nodes`
  * 改为创建 `workflow_run`
* `CliSessionService`
  * 从“面向 task node”改成“面向 workflow_run_node”
* `DatabaseService`
  * 收敛为 façade，组合新 repositories/services
* `PipelineService`
  * 建议评估废弃或并入 `WorkflowSchedulerService`
  * 当前串行 stage 模型不要继续与新 DAG 双轨并行

#### IPC layer

建议拆出新的 workflow IPC，而不是把新接口继续全部塞进 `database.ipc.ts`。

新增：

* `src/main/ipc/workflow.ipc.ts`

建议提供的接口：

* definition
  * `workflow:listDefinitions`
  * `workflow:getDefinition`
  * `workflow:createDefinition`
  * `workflow:updateDefinition`
  * `workflow:deleteDefinition`
  * `workflow:generateDefinition`
* run
  * `workflow:getRunByTask`
  * `workflow:startRun`
  * `workflow:retryNode`
  * `workflow:approveNode`
  * `workflow:stopRun`

#### Renderer

建议新增这些类型与页面分层：

* `src/renderer/src/data/types.ts`
  * 新增 `WorkflowDefinition`, `WorkflowRun`, `WorkflowRunNode`, `WorkflowReview`
* `src/renderer/src/data/adapter.ts`
  * 新增 workflow API adapter
* `src/renderer/src/pages/task-detail/useTaskDetail.tsx`
  * 从当前线性 workflow 读取逻辑切换到 `workflow_run`
* `src/renderer/src/components/workflow/`
  * `WorkflowGraph.tsx`
  * `WorkflowNodeCard.tsx`
  * `WorkflowReviewPanel.tsx`
  * `WorkflowRunSummary.tsx`
* `src/renderer/src/pages/pipeline/` 或重命名为 `pages/workflows/`
  * 配置页和模板页从“Pipeline Templates” 演进为 “Workflow Definitions”

### Implementation plan

推荐按 4 个小阶段推进：

1. Schema + types
* 新增 4 张表
* 新增主进程/渲染进程类型
* 新增 repositories

2. Definition CRUD + generation
* 完成 `workflow_definitions` CRUD
* 完成 AI 生成 definition 的入口
* 完成 definition 校验（节点唯一、边合法、无环）

3. Run engine
* 创建 `workflow_run`
* 冻结 snapshot
* 计算 ready set
* 执行 agent/command 节点
* 支持 review / retry / partial branch continue

4. Task detail UI refactor
* 任务详情页切换到 run 模型
* 提供 review 操作和 retry 操作
* 用图视图或轻量节点图替代当前线性 stage 展示

### TypeScript draft

建议新增或重构这些类型：

```ts
export type WorkflowDefinitionScope = 'global' | 'project'

export type WorkflowNodeType = 'agent' | 'command'

export type WorkflowRunStatus = 'waiting' | 'running' | 'review' | 'done' | 'failed'

export type WorkflowRunNodeStatus = WorkflowRunStatus

export type WorkflowRunNodeFailureReason = 'execution_error' | 'cancelled'

export interface WorkflowDefinitionNodePosition {
  x: number
  y: number
}

export interface WorkflowDefinitionNode {
  id: string
  key: string
  type: WorkflowNodeType
  name: string
  prompt?: string | null
  command?: string | null
  cliToolId?: string | null
  agentToolConfigId?: string | null
  requiresApprovalAfterRun: boolean
  position?: WorkflowDefinitionNodePosition | null
}

export interface WorkflowDefinitionEdge {
  from: string
  to: string
}

export interface WorkflowDefinitionDocument {
  version: 1
  nodes: WorkflowDefinitionNode[]
  edges: WorkflowDefinitionEdge[]
}

export interface DbWorkflowDefinition {
  id: string
  scope: WorkflowDefinitionScope
  project_id: string | null
  name: string
  description: string | null
  definition_json: string
  created_at: string
  updated_at: string
}

export interface WorkflowDefinition extends Omit<DbWorkflowDefinition, 'definition_json'> {
  definition: WorkflowDefinitionDocument
}

export interface DbWorkflowRun {
  id: string
  task_id: string
  workflow_definition_id: string
  status: WorkflowRunStatus
  definition_snapshot_json: string
  current_wave: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowRun extends Omit<DbWorkflowRun, 'definition_snapshot_json'> {
  definition_snapshot: WorkflowDefinitionDocument
}

export interface DbWorkflowRunNode {
  id: string
  workflow_run_id: string
  definition_node_id: string
  node_key: string
  name: string
  node_type: WorkflowNodeType
  prompt: string | null
  command: string | null
  cli_tool_id: string | null
  agent_tool_config_id: string | null
  requires_approval_after_run: number
  status: WorkflowRunNodeStatus
  failure_reason: WorkflowRunNodeFailureReason | null
  session_id: string | null
  resume_session_id: string | null
  result_summary: string | null
  error_message: string | null
  cost: number | null
  duration: number | null
  attempt_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface DbWorkflowRunReview {
  id: string
  workflow_run_id: string
  workflow_run_node_id: string
  decision: 'approved'
  comment: string | null
  reviewed_by: string | null
  reviewed_at: string
  created_at: string
}
```

### Validation rules

`workflow_definitions.definition_json` 在保存或生成后，建议统一经过校验：

* `version` 必填，当前仅允许 `1`
* `nodes` 至少 1 个
* 每个 node 的 `id` 全局唯一
* 每个 node 的 `key` 在单个 definition 内唯一
* `agent` 节点至少提供 `prompt`
* `command` 节点至少提供 `command`
* `edges.from` / `edges.to` 必须引用已存在的 node id
* 不允许自环
* 不允许重复边
* 必须通过 DAG 无环校验
* 可选：至少有 1 个 root node
* 可选：孤立节点允许存在，但生成器默认不应产生

### API contract draft

建议新增 workflow IPC channel，而不是复用旧 `db:*` workflow template 接口。

推荐 channel 设计：

```ts
export const IPC_CHANNELS = {
  workflow: {
    listDefinitions: 'workflow:listDefinitions',
    getDefinition: 'workflow:getDefinition',
    createDefinition: 'workflow:createDefinition',
    updateDefinition: 'workflow:updateDefinition',
    deleteDefinition: 'workflow:deleteDefinition',
    generateDefinition: 'workflow:generateDefinition',
    createRunForTask: 'workflow:createRunForTask',
    getRunByTask: 'workflow:getRunByTask',
    listRunNodes: 'workflow:listRunNodes',
    approveNode: 'workflow:approveNode',
    retryNode: 'workflow:retryNode',
    startRun: 'workflow:startRun',
    stopRun: 'workflow:stopRun'
  }
} as const
```

核心请求体建议：

```ts
export interface CreateWorkflowDefinitionInput {
  scope: 'global' | 'project'
  projectId?: string | null
  name: string
  description?: string | null
  definition: WorkflowDefinitionDocument
}

export interface UpdateWorkflowDefinitionInput extends CreateWorkflowDefinitionInput {
  id: string
}

export interface GenerateWorkflowDefinitionInput {
  scope: 'global' | 'project'
  projectId?: string | null
  sourcePrompt: string
  taskTitle?: string | null
  projectPath?: string | null
}

export interface CreateWorkflowRunForTaskInput {
  taskId: string
  workflowDefinitionId: string
}
```

### Service responsibilities

为了避免 `WorkflowRunService` 和 `WorkflowSchedulerService` 职责混在一起，建议边界如下：

* `WorkflowDefinitionService`
  * definition CRUD
  * definition_json 解析与校验
  * AI 生成 workflow definition
* `WorkflowRunService`
  * 为 task 创建 run
  * 冻结 definition snapshot
  * 创建 run nodes
  * 汇总 run status
  * approve / retry 的事务编排
* `WorkflowSchedulerService`
  * 读取当前 run snapshot
  * 计算 ready nodes
  * 启动 agent/command 节点
  * 处理节点结束后的状态推进
  * 判断 run 何时终结

### Suggested file map

建议新增这些文件：

* `src/main/types/db/workflow-definition.ts`
* `src/main/types/db/workflow-run.ts`
* `src/main/types/db/workflow-run-node.ts`
* `src/main/types/db/workflow-run-review.ts`
* `src/main/types/workflow-definition.ts`
* `src/main/types/workflow-run.ts`
* `src/main/services/database/WorkflowDefinitionRepository.ts`
* `src/main/services/database/WorkflowRunRepository.ts`
* `src/main/services/database/WorkflowRunNodeRepository.ts`
* `src/main/services/database/WorkflowRunReviewRepository.ts`
* `src/main/services/WorkflowDefinitionService.ts`
* `src/main/services/WorkflowRunService.ts`
* `src/main/services/WorkflowSchedulerService.ts`
* `src/main/ipc/workflow.ipc.ts`
* `src/renderer/src/components/workflow/WorkflowGraph.tsx`
* `src/renderer/src/components/workflow/WorkflowReviewPanel.tsx`
* `src/renderer/src/components/workflow/WorkflowRunSummary.tsx`

### Compatibility / migration strategy

当前已确认：任务相关表允许整体重构，因此不以兼容旧表结构为前提。
当前已确认：`task` 与 `workflow_run` 采用一对一关系。

推荐直接按 clean-slate 方案设计：

* workflow definition 用单表 + `definition_json` 表达静态 DAG。
* workflow run 使用独立 run records 和 run node records。
* 状态枚举、运行日志、审批记录、失败原因直接按新语义设计，不保留旧 `todo / in_progress / in_review / done` 包袱。

这意味着可以优先优化模型正确性，而不是做映射层。

### Clean-slate recommendation

如果不考虑迁移，建议优先采用下面的对象边界：

* `workflow_definitions`
  * 用户保存/编辑的 workflow 模板
* `workflow_runs`
  * 某次执行实例
* `workflow_run_nodes`
  * 某次执行中的节点实例与状态
* `workflow_run_reviews`
  * 人工确认记录

如果产品上仍然保留 “Task/Thread” 概念，那么更推荐：

* `task`
  * 代表用户发起的一次工作项 / 会话
* `workflow_run`
  * 代表这个 task 上挂载的一次 workflow 执行

当前已确认：

* 一个 `task` 最多对应一个 `workflow_run`。
* `conversation task` 可以没有 `workflow_run`。
* `workflow task` 则固定绑定一个 `workflow_run`。

### Storage recommendation

当前已确认：选择全数据库方案 B。

推荐的最终表数量：

* `workflow_definitions`
* `workflow_runs`
* `workflow_run_nodes`
* `workflow_run_reviews`

其中：

* `workflow_definitions` 用 `definition_json` 存整张 DAG。
* `workflow_runs` 用 `definition_snapshot_json` 冻结执行时的版本。
* `workflow_run_nodes` 负责高频节点状态更新。
* `workflow_run_reviews` 单独记录执行后确认历史。

### Scheduler semantics

第一版调度器建议采用“宽容的 DAG 执行”：

* 每轮先计算当前所有 `waiting` 节点中的 ready set。
* ready set 内的节点可以并行执行。
* 某个节点失败时：
* 它自身进入 `failed`
* 依赖它的后继节点保持 `waiting`，并在运行时被视为 `blocked`
* 不影响同轮已 ready 的其他节点完成
* 也不影响后续因其他分支满足依赖而变为 ready 的节点
* 最终当没有可继续执行的 ready 节点时，run 结束。
* 若存在任意 `failed` 节点，则整个 `workflow_run` 聚合状态应为 `failed`，即使其他分支成功完成。
* 不新增 `partial_failed` / `completed_with_errors` 一类顶层状态。
* 节点重试时：
* 仅允许对 `failed` 节点，或当前处于 `review` 且用户希望重新执行的节点发起重试。
* 重试节点回到 `waiting` 或直接进入 `running`，并重新参与 DAG 调度。
* 其下游先前因它失败而处于阻断视图的节点，可在该节点 `done` 后重新被释放。
* 第一版不保留 attempt 级独立历史表；`workflow_run_nodes` 只保留最新状态，`attempt_count` 仅用于展示重试次数。
* `review` 节点只支持两个用户动作：
* `approve`
  * 节点转为 `done`，释放后继节点
* `retry`
  * 节点重新进入调度，不存在单独的“拒绝”分支

### Scope resolution proposal

推荐的查找与保存规则：

* 查找顺序：
* 若当前 task 绑定 project，则先查 `project_id = 当前项目`
* 再查 `scope = global`
* 保存行为：
* 用户在项目上下文中创建/生成 workflow 时，默认保存为 `scope = project`
* 用户显式选择“保存为全局模板”时，再保存为 `scope = global`
* 同名冲突：
* 以 `id` 为主键，而不是 `name`
* 若项目级与全局存在同名不同 id，允许并存
* 若项目级引用了一个全局 workflow 并进行编辑，推荐“另存为项目级副本”而不是原地覆盖全局

## Out of Scope (explicit)

* 本轮不直接实现工作流改造代码
* 本轮不完整复刻 AgentCrew 的全部 UI、统计面板或通知体系
* 本轮不讨论与工作流无关的通用界面优化

## Technical Notes

* Deskly 现状关键文件：
* `src/main/services/TaskService.ts`：创建 workflow 任务时按模板生成 task nodes。
* `src/main/services/DatabaseService.ts`：`createTaskNodesFromTemplate()` 将模板节点复制到任务节点。
* `src/main/services/TaskExecutionService.ts`：顺序执行下一个 todo node，没有依赖图调度。
* `src/main/services/database/WorkflowRepository.ts`：模板节点仅按 `node_order` 存储。
* `src/renderer/src/components/pipeline/WorkflowTemplateDialog.tsx`：前端模板编辑器目前只支持线性节点列表。
* `src/renderer/src/pages/tasks/TasksPage.tsx`：创建任务时 `workflow` 模式只要求选择模板。
* `src/main/services/PipelineService.ts`：存在另一套串行 stage 执行器，但当前与 task-node 主链路分离。
* AgentCrew 参考文件：
* `README.md`：双引擎模式、wave 并发、auto-planner、mode recommendation 总览。
* `Sources/AgentCrew/Models/PipelineModels.swift`：step/stage/pipeline 数据结构，支持 step 依赖。
* `Sources/AgentCrew/Services/DAGScheduler.swift`：DAG 校验、wave 调度、并发执行。
* `Sources/AgentCrew/Models/AutoPlannerModels.swift`：自然语言转 pipeline 的 JSON 结构。
* `Sources/AgentCrew/Services/AIPlanner.swift`：planner prompt 与结构化输出解析。
* `Sources/AgentCrew/Models/AgentModels.swift`：agent session、repair strategy、mode recommendation 等高层编排语义。

## Research Notes

### What similar tools do

* AgentCrew 把“静态可预测流程”和“动态智能闭环流程”拆成两套编排模式，而不是强行混成一套。
* 静态模式下，步骤依赖被显式建模到 step 层，并通过 DAG + wave 获得并发能力。
* 动态模式下，planner 生成的不是最终不可变计划，而是可被 evaluate/replan 改写的轮次计划。
* 结合可访问的工作流/agent 资料，当前行业里常见的五种控制模式大体是：
* Prompt Chaining：固定顺序串行步骤，前一步输出作为后一步输入。
* Routing：先分类，再把请求送到不同处理分支。
* Parallelization：把可独立子任务并发执行，再聚合结果。
* Orchestrator-Workers：由中心编排器动态拆分任务并委派给多个 worker。
* Evaluator-Optimizer：生成 -> 评估 -> 修正 的闭环迭代。

### Constraints from our repo/project

* Deskly 当前的 workflow 模型是 `task -> ordered nodes`，审批和状态流转都建立在这个线性模型上。
* Deskly 当前有两套“流程”概念并存：`workflow template / task nodes` 与 `PipelineService stages`，说明改造时需要先做模型收敛，否则容易继续双轨并行。
* Deskly 的前端创建与编辑入口也默认假设 workflow 是线性的节点表单。

### Feasible approaches here

**Approach A: 先升级静态 workflow 为 DAG 引擎** (Recommended)

* How it works:
* 保留 Deskly 现有 workflow 模板入口，但把节点模型扩展为支持依赖关系、执行模式和更明确的节点类型。
* 统一 `workflow template / task nodes / PipelineService` 为一套执行模型，先实现静态 DAG + 审批 + 局部重跑。
* 支持 AI 先生成 DAG，再由用户确认后执行；执行中不允许改拓扑。
* Pros:
* 风险最低，最容易复用当前任务详情页和节点状态体系。
* 能先解决线性模型的表达力不足问题，为后续 planner/agent 打地基。
* Cons:
* 短期内不会获得 AgentCrew 那种动态 replan 闭环能力。

**Approach B: 先加 Auto-Planner，底层仍用线性节点**

* How it works:
* 先让 AI 把自然语言拆成 Deskly 当前能承载的线性节点模板，执行模型暂时不改。
* Pros:
* 用户感知最强，最容易快速展示“AI 生成 workflow”。
* Cons:
* 底层能力没升级，复杂依赖、并行、重规划都做不漂亮，后续可能返工。

**Approach C: 直接引入双模式，静态 DAG + Agent 模式一起设计**

* How it works:
* 一次性引入静态 pipeline 与动态 agent orchestration 两层抽象，任务创建时支持模式选择。
* Pros:
* 更接近 AgentCrew 的完整产品心智。
* Cons:
* 范围最大，需要同时重做数据模型、执行引擎、UI 入口和运行态管理，风险高。

### Mapping to Deskly

* Deskly 现有 workflow 最接近 Prompt Chaining，只是额外带有审批节点。
* Deskly 还没有一等公民的 Routing；如果要做“根据任务类型选择执行路径/模板/工具”，需要新增分支条件或 planner 决策层。
* Deskly 没有真正的 Parallelization；当前节点队列默认单线程推进。
* Deskly 也没有 Orchestrator-Workers；任务拆分目前来自人工模板，而不是运行时动态生成子任务。
* Deskly 的 conversation 模式中有一点点“人 + Agent 迭代修正”味道，但 workflow 模式本身还不是 Evaluator-Optimizer 闭环。

### Approval modeling note

* Deskly 当前已有 `requires_approval` 字段，但其现状更接近“节点执行完成后进入 review，再由人工批准继续后续节点”。
* 如果按用户当前偏好推进，MVP 可以不做独立 `approval` 节点，而是让每个可执行节点都有一个“人工确认”配置。
* 当前已确认，MVP 默认采用“执行后确认”，因此短期内保留布尔开关也可行；后续若要扩展“执行前确认”，再升级为枚举配置。

### Recommended sequencing

* 第一阶段先把 Prompt Chaining 升级为“可表达 DAG / routing / approval / retry 的静态 workflow”。
* 第二阶段再接 Auto-Planner，让 AI 帮助生成静态 workflow。
* 第三阶段再引入 Evaluator-Optimizer 或 Agent 模式，做动态 replan / patch / verify。

## Decision (ADR-lite)

**Context**: Deskly 需要升级当前线性 workflow，但不希望一开始就引入高复杂度的动态 Agent 闭环。

**Decision**: 优先建设“静态 DAG 执行平台”。系统可以自动生成 workflow，用户可在执行前人工微调；一旦执行开始，workflow 结构冻结，不再动态变更。

**Consequences**:

* 先聚焦 workflow definition、DAG 调度、运行态与可视化。
* planner 的输出目标是静态 DAG，而不是多轮 replan session。
* 后续如果需要 Agent 模式，可建立在同一 workflow definition / execution record 之上扩展。
* 人工确认在 MVP 中作为节点属性建模，且默认是“执行后确认”，因此状态机会自然延续 Deskly 当前 `in_review` 的思路。
