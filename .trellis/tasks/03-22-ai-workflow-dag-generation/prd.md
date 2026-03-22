# brainstorm: ai workflow dag generation

## Goal

为工作流编辑器的“根据目标生成”接入真正的模型生成能力，让用户输入自然语言目标后，系统直接产出包含 `nodes + edges` 的 DAG 草稿，而不再只是基于本地规则拆句生成串行流程。

## What I already know

* 当前“根据目标生成”入口在 `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/renderer/src/components/pipeline/WorkflowTemplateDialog.tsx` 的 `handleGenerate()`，前端调用 `db.generateWorkflowDefinition({ prompt, name })`。
* 当前 renderer -> main 的调用链已经存在：
  * `adapter.ts` -> `window.api.workflow.generateDefinition(...)`
  * `workflow.ipc.ts` -> `DatabaseService.generateWorkflowDefinition(...)`
  * `WorkflowDefinitionGenerationService.generateDefinition(...)`
* 当前 `WorkflowDefinitionGenerationService` 不是模型生成，而是本地规则：
  * 拆分 prompt 为步骤
  * 猜测节点类型 `agent` / `command`
  * 默认最后一步需要确认
  * 最终总是生成线性 `1 -> 2 -> 3`
* 工作流定义层已经支持真正的 DAG：
  * `WorkflowDefinitionDocument` 原生包含 `nodes` 和 `edges`
  * `WorkflowDefinitionService.validateDocument()` 会校验节点合法性、边合法性，并保证结果必须是 DAG
* 当前仓库已经有 AI/provider 相关基础设施：
  * renderer settings 中有 `defaultProvider` / `defaultModel`
  * settings 会同步到 backend：`/providers/settings/sync`
  * 现有 CLI runtime 支持 `claude-code`、`codex`、`cursor-agent`、`gemini-cli`、`opencode`
* 现有 CLI 适配器里已经暴露了结构化输出能力：
  * `claude-code` 支持 `json_schema`
  * `codex` 支持 `output_schema`
* 当前 UI 已经按异步生成来设计：
  * `handleGenerate()` 有 `isGenerating`、错误态和 `await`
  * 因此后端从同步规则实现切换到异步模型生成，对前端交互改动不大

## Assumptions (temporary)

* 第一版的目标是“生成可编辑的 DAG 草稿”，不是让模型直接创建并保存最终模板。
* 第一版生成出的节点仍然需要进入现有编辑器，由用户手动调整名称、依赖、文案和配置。
* 第一版应优先复用当前仓库已有的 provider/runtime 配置能力，而不是单独引入第三套 AI 配置体系。

## Open Questions

* 第一版生成范围是只支持“整张图重建”，还是也支持“基于当前草稿继续扩展/重生成”？

## Requirements (evolving)

* “根据目标生成”必须能够产出真正的 `nodes + edges` DAG 草稿，而不是仅生成线性链路。
* 生成结果必须经过现有 `WorkflowDefinitionDocument` 结构校验，失败时不能污染当前编辑中的工作流。
* 生成结果必须可回填到现有 React Flow 编辑器中，供用户继续手动调整。
* 第一版模型调用路径采用现有 CLI runtime，而不是新增 direct provider client。
* 生成失败时要有明确错误反馈，并允许用户继续使用当前已有草稿。
* 第一版模型生成失败时，采用显式提示用户“是否回退到当前规则生成”的方式兜底，而不是静默回退。
* 第一版要明确模型生成时可用的上下文范围：
  * 仅用户输入目标
  * 目标 + 模板名称
  * 目标 + 当前已有节点草稿
* 第一版要明确结构化输出的约束方式，避免模型返回不可解析文本。

## Acceptance Criteria (evolving)

* [x] 明确第一版模型调用架构，并说明为何适合当前仓库
* [ ] 至少给出 2 个可行接入方案，并说明取舍
* [x] 明确第一版是否带规则回退方案
* [ ] 明确生成输出的结构约束、校验、错误处理与用户可见行为
* [ ] 明确生成范围是“全新草稿生成”还是也支持“基于当前图再生成”

## Definition of Done (team quality bar)

* 方案能映射到现有 renderer/main/IPC 结构
* 模型输出到 DAG 文档的约束与校验链清晰
* 失败场景、超时场景、无配置场景被提前考虑
* 实施后能通过 lint / typecheck，并保留手动编辑兜底路径

## Out of Scope (explicit)

* 本轮不讨论运行时执行工作流节点时的模型编排策略
* 本轮不讨论让模型自动补齐所有 CLI/tool 配置项
* 本轮不讨论多轮对话式“边聊边生成”交互
* 本轮不讨论生成后自动保存、自动发布模板

## Technical Notes

* 当前入口：
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/renderer/src/components/pipeline/WorkflowTemplateDialog.tsx`
* 当前 renderer adapter：
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/renderer/src/data/adapter.ts`
* 当前 IPC：
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/ipc/workflow.ipc.ts`
* 当前规则生成服务：
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/WorkflowDefinitionGenerationService.ts`
* 当前工作流定义校验：
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/WorkflowDefinitionService.ts`
* 当前共享类型：
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/types/db/workflow-definition.ts`
* 当前 CLI 结构化输出能力：
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/shared/cli-config-spec.ts`
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/cli/adapters/ClaudeCodeAdapter.ts`
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/cli/adapters/CodexCliAdapter.ts`
* 当前 provider/default model 配置与同步：
  * `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/renderer/src/data/settings/general.ts`

## Research Notes

### What similar tools do

* 真正的流程生成通常不会让模型自由输出自然语言后再二次猜测，而是要求它直接返回结构化 JSON。
* 首版通常会把模型生成限定为“草稿生成”，然后交给可视编辑器继续调整，而不是直接保存上线。
* 稳定做法通常包括三层保护：
  * 结构化输出约束
  * 服务端校验/修正
  * UI 侧失败不覆盖当前草稿

### Constraints from our repo/project

* 现有工作流文档已经能表达 DAG，所以关键问题不是 schema 不够，而是生成能力不够。
* 现有 `generateWorkflowDefinition` 名字和前端调用方式已经天然适合替换底层实现。
* 现有 main 服务当前是同步返回；如果接模型，服务实现需要异步化。
* 现有 CLI runtime 已经能统一接入模型，并且部分工具有 schema 约束能力，这意味着“复用 CLI 栈”是现实选项。
* 现有 settings 里已经有 default provider / model，同样意味着“新增直接 provider client”也不是从零开始。

### Feasible approaches here

**Approach A: 复用现有 CLI runtime 做结构化 DAG 生成** (Selected)

* How it works:
  * `WorkflowDefinitionGenerationService` 内部不再做本地拆句，而是启动一次短生命周期 CLI session
  * 给模型一段系统提示和 workflow JSON schema，要求返回完整 DAG 草稿
  * 再用现有 `WorkflowDefinitionService` 校验并回填编辑器
* Pros:
  * 最大化复用现有 agent runtime、provider 配置、模型选择能力
  * 与项目已有“AI 调用通过 CLI 工具完成”的路径更一致
  * 后续可切换 Claude/Codex 等工具而不必重写业务层
* Cons:
  * 启动 CLI session 的开销和延迟更高
  * 输出解析、超时和失败诊断相对更复杂
  * 不同 CLI 对结构化输出能力的一致性不完全相同

**Approach B: 新增一个直接面向 provider 的结构化生成 client**

* How it works:
  * 在 main 层新增专门的 workflow generation client
  * 读取当前默认 provider / model / key / baseUrl
  * 直接向 provider 发结构化生成请求，返回 JSON DAG
* Pros:
  * 请求链更短，生成体验通常更快
  * 更适合严格控制 schema、超时、重试和错误类型
  * 这个能力天然适合后续扩展到“局部重生成”“解释 DAG”等纯结构化场景
* Cons:
  * 会形成一条区别于现有 CLI runtime 的第二套模型调用链
  * 需要自己处理 provider 兼容性，而不是让 CLI 封装掉差异
  * 需要额外处理配置同步、认证和测试桩

**Approach C: 混合模式，模型生成为主，规则生成为兜底** (Recommended)

* How it works:
  * 对用户仍然只有一个“根据目标生成”入口
  * 优先调用真实模型，要求返回结构化 DAG
  * 如果没有模型配置、超时、结构校验失败，则显式回退到当前规则生成或提示用户选择回退
* Pros:
  * 用户体验最稳，不会因为模型不可用导致入口完全失效
  * 便于渐进上线，能在保留可用性的同时验证模型方案质量
  * 对现有编辑器风险最小
* Cons:
  * 需要维护两条生成路径
  * 需要设计好“这是 AI 生成还是规则回退”的用户反馈
  * 如果回退过于隐蔽，用户会对结果来源产生误判

## Decision (ADR-lite)

**Context**: 工作流生成需要从现有本地规则方案升级为真正的模型生成，同时希望尽量复用项目已有的 AI/runtime 基础设施，避免为首版再引入一条完全独立的 provider 调用链。

**Decision**: 第一版采用现有 CLI runtime 来执行工作流 DAG 生成。`WorkflowDefinitionGenerationService` 将从本地规则生成改为发起一次短生命周期的结构化生成会话，通过现有 Claude/Codex 等 CLI 适配器请求模型返回 DAG JSON，再走现有工作流文档校验链。

**Consequences**:

* 优点：
  * 最大化复用现有 runtime、模型配置和 CLI 适配能力
  * 与当前项目 AI 能力的接入方式保持一致
  * 首版不需要单独实现 provider API 兼容层
* 代价：
  * 生成链路更重，启动和解析复杂度更高
  * 需要额外处理结构化结果提取、超时和失败诊断
  * 后续若要扩展到纯结构化批量生成，可能仍会再评估 direct provider client
  * 当模型不可用或输出非法时，第一版将由 UI 显式提示用户是否回退到当前规则生成，避免静默降级带来的结果误判
