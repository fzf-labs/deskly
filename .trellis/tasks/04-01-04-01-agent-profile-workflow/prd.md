# brainstorm: agent profile + cli + skills 工作流集成

## Goal

为 Deskly 设计一套“Agent”能力：用户可以定义具备独立配置的可复用 agent，例如“内容创作专家”“数据分析报告师”“文档生成专家”。每个 agent 需要能封装底层 Agent CLI 的选择与参数、Skills 能力边界，以及在任务 / workflow 中的使用方式。当前目标不是直接实现，而是澄清核心模型、集成路径和 MVP 边界，避免在现有 `AgentToolConfig`、`WorkflowDefinition`、task/workflow 体系之外再造一套割裂系统。

## What I already know

* 用户想做一个“agent 功能”，本质上是独立配置的能力封装，而不是单次 prompt 模板。
* 用户设想的典型 agent 包括“内容创作专家”“数据分析报告师”“文档生成专家”等面向场景的角色。
* 用户当前卡住的核心问题有两个：
* `agent cli + skills` 该如何组合成一个稳定的产品模型。
* 这个 agent 模型如何集成进现有 workflow / task 使用路径。
* 仓库当前已经有 `Agent CLI` 集成能力，README 明确支持 Claude Code / Codex / Gemini CLI / OpenCode / Cursor Agent。
* 仓库当前已经有 `Skills 与 MCP` 配置能力。
* 仓库当前已经有 `conversation` / `workflow` 两类任务模式。
* 当前共享契约里已有 `AgentToolConfig`，可保存 `tool_id`、名称、描述、`config_json` 和默认配置标记。
* 当前 `WorkflowDefinitionNode` 已支持 `cliToolId`、`agentToolConfigId`、`prompt` 和 `requiresApprovalAfterRun`，说明 workflow 节点已经能绑定具体 CLI 配置。
* 主进程已经有 `AgentToolProfileService`，它本质是在现有代码里把 `agent_tool_configs` 当作 CLI profile 使用，而不是产品层的“Agent”。
* `TaskService` 当前会把 conversation task 自动转换成单节点 workflow run；也就是说 conversation 和 workflow 在运行态已经收敛到同一条执行链路。
* 这意味着“agent”如果要成立，最自然的落点更像是建立在现有 CLI 配置和 workflow 节点之上的一层“可复用能力画像 / preset / profile”，而不是完全新的执行引擎。

## Assumptions (temporary)

* 本次优先定义产品模型和集成方式，不进入具体 UI 和数据库 schema 细节实现。
* 新的 agent 能力应该尽量复用现有 `AgentToolConfig`、task、workflow 和 CLI runtime，而不是新增一条独立执行链路。
* skills 更适合作为 agent 的“能力包 / 行为约束”，而不是 workflow 节点的直接替代物。
* Deskly 的 Agent 不应直接等同于底层 CLI 自己的 profile / subagent / skill 定义，而应是 Deskly 统一后的上层概念。
* 一个 agent 可能需要同时包含：
* 默认 CLI 工具选择与参数
* 系统提示词 / role 定义
* skills 选择策略
* 可选的输入输出约定
* 对 workflow 的展示名 / 描述 / 产出类型
* workflow 中的 agent 节点未来应能引用这种 agent，而不是只能引用裸的 CLI 配置。

## Open Questions

* workflow node 在引用 Agent 时，是否还需要单独的“步骤级 prompt”作为当前节点任务说明？

## Requirements (evolving)

* 需要定义清晰的 Agent 概念边界，并说明它与 `AgentToolConfig`、prompt template、workflow template、skills、AGENTS 类项目说明的关系。
* MVP 中，Agent 先定义为“可复用的单节点执行型能力单元”，而不是内嵌多步子流程的高阶编排单元。
* 需要明确 `agent cli + skills` 的组合模型，至少能覆盖：
* 底层 CLI 选择
* 默认 runtime profile
* skills 显式绑定方式
* role / task 指令注入方式
* conversation / workflow 中的一致执行方式
* 第一版中，Agent prompt 固定在前，task prompt 追加在后，保证 Agent 负责稳定角色定义，task 负责当前实例需求。
* 需要明确 Agent 在 Deskly 里的主要进入点和复用路径。
* 需要明确 Agent 如何在现有 conversation task 与 workflow node 中使用。
* 需要支持 `global + project` 两种 Agent 作用域，并定义选择、展示与复用规则。
* 第一版中，workflow node / conversation task 在引用 Agent 后不覆盖 Agent 默认配置，保证 Agent 语义稳定。
* 需要明确 workflow run 如何固化 agent 的运行时快照，避免后续配置漂移影响历史记录。
* 需要给出 2-3 种可行方案，并结合当前仓库约束说明推荐路径。
* 需要收敛出 MVP 范围，并显式说明什么暂时不做。

## Acceptance Criteria (evolving)

* [ ] 能用一句话定义 Deskly 中 “Agent” 是什么，以及不是什么。
* [ ] 能说明 Agent 与 `AgentToolConfig`、skills、workflow template、项目级 instructions 的职责边界。
* [ ] 能提出 2-3 个可行方案，并给出推荐方案与取舍。
* [ ] 能明确 Agent 在 conversation 与 workflow 场景中的最小可用集成路径。
* [ ] 能收敛出一个可落地的 MVP 范围及 out-of-scope。
* [ ] 能提前识别未来扩展点和关键风险，避免一开始把模型锁死。
* [ ] 能明确第一版 Agent 不包含嵌套 mini-workflow / subgraph 能力。
* [ ] 能明确第一版 Agent 使用显式 skill 绑定，而不是仅靠弱提示或全局自动发现。
* [ ] 能明确第一版 Agent 同时支持 `global` 与 `project` 作用域。
* [ ] 能明确第一版 Agent 在 task / node 侧不允许覆盖默认配置。
* [ ] 能明确第一版 Agent 使用“Agent prompt 在前，task prompt 在后”的组合方式。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 本轮不直接实现完整 agent 功能。
* 本轮不直接敲定 UI 细节、数据库 schema 细节或迁移脚本。
* 本轮不讨论所有 CLI 工具的底层差异实现到代码层面。

## Research Notes

### What similar tools do

* OpenAI Codex 把长期背景、技能、子 agent 拆成三层：
* `AGENTS.md` 负责项目级持久指导，按目录层级叠加。
* `Skills` 负责按需激活的可复用工作流，默认只注入 `name/description` 等元数据，真正使用时才加载完整 `SKILL.md`。
* `Subagents` 负责独立上下文中的专职 agent，可单独指定模型、权限、MCP 和 skills。
* Codex 另外还有 `profiles`，用于保存一组命名配置值并通过 `--profile` 切换。这层更像 runtime profile，而不是业务语义上的 agent。
* Claude Code 也把 reusable prompt/workflow 与 subagent 分开：
* `subagent` 是隔离上下文、独立权限和特定工具面的专职执行单元。
* 文档明确建议：如果只是想复用 prompt 或 workflow，而不是隔离上下文，应优先用 Skills，而不是 subagent。
* Gemini CLI 的 `Skills` 也强调“按需能力包”而不是常驻 prompt：
* workspace / user / extension 三层发现机制。
* 会话启动时只加载 skill 的名称和描述，匹配后再激活完整 skill 内容。
* 这些工具的共同模式不是“把一切都塞进一个配置文件”，而是区分：
* 持久背景说明
* 按需激活的 skills
* 可直接运行或被调度的 specialized agent / profile

### Constraints from our repo/project

* 现有 repo 已经有三块可复用基础设施：
* `AgentToolConfig` / `AgentToolProfileService`：底层 CLI runtime profile。
* `SkillsSettings` 与 project/user/app skill 目录：skills 发现与管理。
* `TaskService` + `WorkflowRunService`：统一的 task / workflow 执行链路。
* `TaskService` 当前已经把 conversation task 变成单节点 workflow，因此如果 Agent 最终能解析成一个节点，conversation 与 workflow 都可以复用同一条运行链路。
* 当前 `WorkflowDefinitionNode` 只有 `cliToolId` 和 `agentToolConfigId`，没有更高层的 `agentDefinitionId`。如果产品要引入 Agent，一种自然路径是在节点层增加对 Agent 的引用，并在 run snapshot 阶段下沉解析。
* 当前 `AgentToolConfig` 的命名容易混淆：在实现里它其实更接近 CLI profile，不是用户想要的“内容创作专家”这类业务 Agent。
* 当前 skills 已经存在 app / user / CLI / project 目录的概念，因此 Deskly 新 Agent 没必要重新定义 skill 文件格式，应该做“选择和装配”，而不是“重造 skill 生态”。

### Feasible approaches here

**Approach A: Agent = CLI Profile 的语义化包装**

* How it works:
* 新增一个 Agent 实体，主要引用一个 `cliToolId + agentToolConfigId + prompt template + skill selection`。
* conversation task 和 workflow node 都只是在运行前把 Agent 展开成现有 `cliToolId/agentToolConfigId/prompt`。
* Pros:
* 改动最小，最贴合现有运行链路。
* conversation 和 workflow 天然统一。
* 先把“内容创作专家”这类角色落地最快。
* Cons:
* Agent 仍然偏“单节点 persona/preset”，表达力有限。
* 后续如果想支持 typed output、多步内建流程，会遇到模型升级成本。

**Approach B: Agent = 可被引用的单节点能力单元** (Recommended)

* How it works:
* Agent 成为第一类资源，包含：
* 身份信息：name / description / category
* 执行信息：默认 CLI、默认 runtime profile、默认 prompt/system prompt
* 能力信息：skills policy、可选 MCP / tool 约束
* 产出信息：可选 output contract / result style
* conversation task 可“选择一个 Agent 开始对话”。
* workflow node 可引用 `agentDefinitionId`，在 run snapshot 时解析为具体运行参数。
* Pros:
* 概念边界清楚，能把“业务 Agent”与“底层 CLI profile”分离。
* 既兼容现有单节点执行链路，又为后续 typed output、agent library、workflow generation 选择 Agent 留出扩展位。
* 可以把 Deskly 的核心价值沉淀在 Agent 层，而不是把所有价值寄托给底层 CLI 配置。
* Cons:
* 需要新增一层模型和解析逻辑。
* 要解决 snapshot 固化、配置继承和 UI 管理边界。

**Approach C: Agent = 可嵌套的 mini-workflow / subgraph**

* How it works:
* 一个 Agent 不再对应单个执行节点，而是内部可包含多步 skill / prompt / review 流程，本质接近 workflow template 或 subworkflow。
* workflow 中引用 Agent 时，运行前把它展开成子图。
* Pros:
* 表达力最强，贴近“数据分析报告师”这类复杂复合流程。
* 长期最利于做 multi-agent orchestration。
* Cons:
* 与现有 `WorkflowDefinition`、run snapshot、节点状态、审批链强耦合。
* 这是“嵌套工作流”问题，不适合作为第一版 Agent MVP。

## Expansion Sweep

### Future evolution

* Agent 未来大概率会演进为团队共享资产，需要版本化、项目作用域和导入导出能力。
* workflow 自动生成、automation 定时任务、marketplace/模板库 后续都可能直接消费 Agent，而不再只消费裸 prompt。

### Related scenarios

* 新建 conversation task 时按 Agent 启动。
* 在 workflow editor 中直接选 Agent，而不是先手配 CLI + config + prompt。
* automation / scheduler 未来也应能直接运行 Agent。
* 通用 Agent 需要跨项目复用，项目专属 Agent 需要只在当前项目下可见。

### Failure & edge cases

* Agent 引用的 skill、CLI profile、MCP 或底层 CLI 在当前机器不存在时如何降级或报错。
* workflow run 必须固化 agent snapshot，否则历史运行结果会随着 agent 后续编辑发生不可重现。
* 不同 CLI 对 skills / subagents / profile 的支持差异很大，Deskly 不能把 Agent 定义直接映射为某一家的原生格式。

## Decision (ADR-lite)

**Context**: 需要在“最小可落地”“不重造执行引擎”“后续能扩展到 workflow/automation/模板库”之间找到平衡。

**Decision**: 已确认 MVP 选择“执行型 Agent”。产品层先采用 `Approach B: Agent = 可被引用的单节点能力单元`；运行时继续复用现有 CLI session / workflow node 链路，不在第一版引入嵌套子流程。

**Consequences**:

* 需要把现有 `AgentToolConfig` 明确降级为 runtime profile 概念。
* 需要新增 product-level agent definition，而不是继续把业务语义塞进 `config_json`。
* Agent 第一版将显式绑定 skill 列表，而不是只做 prompt 层面的推荐说明。
* Agent 第一版支持 `global + project` 两种作用域，思路与现有 workflow definition scope 保持一致。
* workflow 节点 / conversation task 在第一版不覆盖 Agent 默认值，因此 Agent 是强语义能力单元，而不是可随意改写的初始化模板。
* prompt 组合规则固定为“Agent prompt 在前，task prompt 在后”，避免角色定义被实例需求覆盖。
* workflow 节点后续可能需要新增 `agentDefinitionId`，并在 run snapshot 时解析为具体的 `cliToolId + agentToolConfigId + prompt + bound skills`。
* 复杂的 multi-step agent 暂时不做，但可以在这个模型上继续演化。

## Technical Notes

* 已检查：
* `README.md`
* `.trellis/workflow.md`
* `.trellis/tasks/03-25-agent-cli-chat-ui/prd.md`
* `src/shared/contracts/agent-tool-config.ts`
* `src/shared/contracts/workflow.ts`
* `src/main/services/AgentToolProfileService.ts`
* `src/main/services/TaskService.ts`
* `src/main/services/WorkflowRunService.ts`
* `src/main/services/workflow-definition-utils.ts`
* `src/main/services/cli/CliSessionService.ts`
* `src/shared/agent-cli-config-spec.ts`
* `src/main/services/cli/adapters/CodexCliAdapter.ts`
* `src/main/services/cli/adapters/ClaudeCodeAdapter.ts`
* `src/renderer/src/features/settings/tabs/SkillsSettings.tsx`
* `src/renderer/src/features/settings/tabs/AgentCLISettings.tsx`
* `src/renderer/src/features/pipeline/ui/workflow-definition-form.ts`
* 关键本地结论：
* 当前 repo 已有 `AgentToolConfig` 和 `WorkflowDefinitionNode.agentToolConfigId`，适合承载 runtime profile。
* 当前 conversation task 已经统一成单节点 workflow run，这是 Agent 集成的最好落点。
* 当前 repo 缺少的是 product-level agent definition，而不是 CLI session 能力。
* 当前 repo 的 skills 更接近“全局发现 + prompt token 提示”模型，尚未存在“按 Agent 显式绑定 skill 清单”的运行时抽象。
* 外部参考：
* OpenAI Codex profiles: https://developers.openai.com/codex/config-advanced
* OpenAI Codex skills: https://developers.openai.com/codex/skills
* OpenAI Codex subagents: https://developers.openai.com/codex/subagents
* OpenAI Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
* Claude Code subagents: https://code.claude.com/docs/en/sub-agents
* Gemini CLI skills: https://geminicli.com/docs/cli/skills/
