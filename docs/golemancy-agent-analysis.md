# Golemancy Agent 架构分析与 Deskly 借鉴建议

本文基于对 `/Users/fuzhifei/code/go/src/demo/golemancy` 项目的实际源码阅读整理，目标不是复述其功能宣传，而是回答两个更具体的问题：

1. `golemancy` 当前到底是如何组织 `Agent / Skill / Team / Conversation / Template` 的。
2. Deskly 当前规划中的 Agent 能力，哪些应该借，哪些不应该借，应该如何改造后落地。

相关 Deskly 上下文：

- Agent 产品 PRD：`/.trellis/tasks/04-01-04-01-agent-profile-workflow/prd.md`
- Agent 使用逻辑图：`/docs/agent-product-usage-flows.md`

## 1. 先给结论

`golemancy` 最值得借鉴的，不是它表面上的 “多 Agent 对话 UI” 或 “Team 拓扑编辑器”，而是下面三件事：

- 把 `Agent` 做成第一类产品资产，而不是把业务语义塞进 runtime profile。
- 在运行前按 Agent 动态装配能力，而不是把所有能力预先写死在节点或 CLI 配置里。
- 用模板一次性生成一组可运行资产，而不是只保存一个 prompt。

对 Deskly 来说，最应该借的是“产品层 Agent 与运行层 profile 分层 + run 时解析装配”的思路；最不应该借的是它的 `project-only` 资产边界和 `team-first` 运行模型。

## 2. Golemancy 当前模型是什么

### 2.1 顶层不是 workflow，而是 Project / Agent / Team / Memory

`golemancy` 的项目文档明确写了四个顶层抽象：

- `Project`
- `Agent`
- `Team`
- `Memory`

并且明确声明：

- 所有 Agent 都属于某个 project
- 没有 global agent / skill library
- project 可以有默认 target

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/AGENTS.md`
- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/types/project.ts`

这意味着它的产品心智是：

- 先进入一个 project
- 再在 project 里配置 agent / skill / team
- conversation 或 cron job 以 agent 或 team 作为目标

这和 Deskly 当前“global + project 资产库 + workflow/task 统一运行态”的方向并不相同。

### 2.2 Agent 是真正的产品对象，不只是 prompt

`Agent` 类型里直接包含：

- `systemPrompt`
- `modelConfig`
- `skillIds`
- `mcpServers`
- `builtinTools`
- `compactThreshold`

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/types/agent.ts`

这说明在 `golemancy` 里，Agent 不是 “一个名字 + 一段提示词”，而是一个完整的能力定义对象。

这点对 Deskly 很关键，因为 Deskly 当前的 `AgentToolConfig` 只有：

- `tool_id`
- `config_json`
- `name`
- `description`

源码证据：

- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/shared/contracts/agent-tool-config.ts`

因此 Deskly 当前已有的是 runtime profile，不是用户真正想复用的“内容创作专家 / 数据分析报告师”。

### 2.3 Team 是独立拓扑资源，不是 Agent 的一个字段

`Team` 类型中核心字段是：

- `members: TeamMember[]`
- `parentAgentId?`
- `instruction?`

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/types/team.ts`

这代表它把“谁是专家”和“多个专家如何协作”分成了两层：

- `Agent` 负责个体能力
- `Team` 负责协作拓扑

这一分层是合理的。即使 Deskly 第一版不做 Team，这个建模原则也值得保留：未来如果要做 multi-agent，不应该把协作关系直接塞进 Agent 定义。

### 2.4 Conversation 的目标是 Agent 或 Team

`Conversation` 不是直接绑定某个 workflow definition，而是存：

- `targetType`
- `targetId`

其中 `targetType` 只有两种：

- `agent`
- `team`

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/types/common.ts`
- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/types/conversation.ts`

在运行时，如果目标是 `team`，服务端会先解析 leader agent，再根据 team members 生成 delegation tools：

- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/utils/target.ts`
- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/server/src/routes/chat.ts`

这和 Deskly 当前已经成立的事实不同：Deskly 的 conversation task 已经会转换成单节点 workflow run。

源码证据：

- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/TaskService.ts`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/workflow-definition-utils.ts`

因此 Deskly 不需要照抄 `targetType = agent | team` 这条主线。

## 3. Golemancy 最值得借鉴的设计点

### 3.1 运行时装配是它最强的地方

`loadAgentTools()` 会在运行前统一装配：

- skill tool
- MCP tools
- builtin tools
- sub-agent delegation tools
- task tools
- memory tools
- team instruction

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/server/src/agent/tools.ts`

这背后的设计价值不是“工具很多”，而是：

- Agent 资产层只描述能力边界
- 真正执行时才把能力解析成 runtime

这非常适合 Deskly 借成一个新的运行前解析步骤，例如：

- 输入：`agentDefinitionId`
- 输出：`cli_tool_id + agent_tool_config_id + composed prompt + skills snapshot + 其他运行时约束`

也就是在 run snapshot 创建前新增一个 “Agent 编译器 / 解析器”。

### 3.2 Skill 绑定是可执行语义，不是文案标签

`loadAgentSkillTools()` 的做法不是“把 skill 名字塞到 prompt 里”，而是：

1. 为当前 agent 的 `skillIds` 建一个临时目录视图
2. 只把这些 skill 暴露给 `experimental_createSkillTool`
3. 运行时真正只允许 agent 使用这组 skills

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/server/src/agent/skills.ts`

这是 `golemancy` 对 Deskly 最有价值的启发之一。因为 Deskly 当前 Agent PRD 已经明确要求：

- skill 绑定必须是可执行语义
- 不是纯元数据提示
- run snapshot 需要固化 skill revision / hash / 内容快照

相关 Deskly 约束：

- `/.trellis/tasks/04-01-04-01-agent-profile-workflow/prd.md`

也就是说，Deskly 不应该做成：

- “Agent 上挂几个 skill tag”

而应该做成：

- “Agent 解析后得到一组运行时 skill allowlist”

### 3.3 Agent 与 Team 解耦，这个分层是对的

在 `golemancy` 中：

- Agent 本身没有 `subAgents` 字段
- sub-agent delegation tool 是根据 Team 运行时动态生成的

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/server/src/agent/sub-agent.ts`
- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/server/src/agent/tools.ts`

这说明它没有把“单 Agent 能力”与“协作拓扑”混成一个模型。

对 Deskly 的启发是：

- 第一版 Agent 只做“单节点执行型能力资产”是对的
- 以后即使做 multi-agent，也应该把 Team / Topology 做成独立资源
- 不要过早把“子 Agent 编排”塞进 Agent MVP

这与 Deskly 当前 PRD 里明确排除 “嵌套 mini-workflow / subgraph” 是一致的。

### 3.4 模板是资产包，而不是 prompt 模板

`ProjectTemplate` 里可以一次定义：

- `skills`
- `agents`
- `teams`
- `mcpServers`
- `cronJobs`
- `defaultTarget`

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/types/template.ts`

模板实例化时，这些对象会被全部创建出来，而不是只生成一条文本：

- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/server/src/storage/template-instantiate.ts`

具体例子：

- 写作模板默认创建一个 `Writer` agent
- 数据分析模板则直接创建 `Data Analyst + Data Engineer + Team`

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/templates/projects/writing-assistant.ts`
- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/templates/projects/data-analytics.ts`

这个思路很适合 Deskly 后续做：

- `内容创作专家包`
- `数据分析包`
- `文档生成包`

但这更像 Agent 体系稳定后的 V2/V3，不应该和第一版 Agent 核心模型绑死一起上线。

## 4. 不应该照抄的地方

### 4.1 不要照抄 project-only 范围

`golemancy` 的设计前提是：

- 所有 Agent / Skill 都归属于 Project
- 没有 global library

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/AGENTS.md`
- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/types/agent.ts`
- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/types/skill.ts`

Deskly 当前这版已经明确了：

- `global + project` 两种 scope
- 不同上下文下有明确引用矩阵

相关文档：

- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/docs/agent-product-usage-flows.md`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/.trellis/tasks/04-01-04-01-agent-profile-workflow/prd.md`

所以 Deskly 不能被 `golemancy` 的 project-only 模型带偏。

### 4.2 不要照抄 team-first 的主运行模型

`golemancy` 的主运行入口是 conversation targeting：

- 对 agent 说话
- 对 team 说话

而 Deskly 当前的主运行抽象已经是 workflow run：

- conversation task 只是单节点 workflow 的一种创建方式
- workflow node 才是运行态真正稳定的执行单位

源码证据：

- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/TaskService.ts`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/WorkflowRunService.ts`

因此对 Deskly 来说，正确路径是：

- Agent 是被 `conversation task` 与 `workflow node` 引用的资产
- 不是新的顶层 runtime

### 4.3 不要把 Deskly 的产品 Agent 直接映射成某家 CLI 原生 agent

Deskly 当前 adapter 已经允许某些 CLI 透传 vendor-specific 参数，比如：

- Claude Code: `--agent` / `--agents`
- OpenCode: `--agent`

源码证据：

- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/cli/adapters/ClaudeCodeAdapter.ts`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/cli/adapters/OpencodeAdapter.ts`

这说明底层 CLI 自己的 agent/profile/skills 只是 vendor-specific runtime 参数。

Deskly 的产品级 Agent 不能直接等于：

- Claude 的 `--agent`
- OpenCode 的 `--agent`
- 某家 CLI 的 profile 文件

否则会立刻失去跨 CLI 的统一抽象能力。

## 5. Golemancy 自身存在的逻辑问题

这部分很重要，因为不是所有“看起来先进”的东西都应该直接借。

### 5.1 文档与代码存在漂移

`AGENTS.md` 中有几处描述与当前源码并不完全一致：

- 文档里说 `TeamMember` 有 `role`
- 文档里说 conversation 通过 `conversation.teamId` 激活 team

但当前代码里：

- `TeamMember` 只有 `agentId / parentAgentId`
- `Conversation` 使用的是 `targetType / targetId`

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/AGENTS.md`
- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/types/team.ts`
- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/types/conversation.ts`

这说明 `golemancy` 当前模型仍在迭代中。对于 Deskly 来说，借鉴时必须以源码为准，不能只按 README 和项目说明来抽象。

### 5.2 Skill 注入的文档表述不够准确

文档里说：

- `skillIds` 会注入 system prompt

但当前实现里，`loadAgentSkillTools()` 返回的是：

- 一个 `skill` selector tool
- `instructions` 为空字符串

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/AGENTS.md`
- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/server/src/agent/skills.ts`

也就是说，它真正成立的不是“skill 内容已经稳定注入 prompt”，而是“运行时只暴露一组允许加载的 skill”。

这个差异对 Deskly 很关键。Deskly 第一版如果要强调可复现与会话稳定性，就不能只说“绑定了 skill”，而要明确：

- skill 如何被 runtime 发现
- skill 何时被激活
- run snapshot 如何冻结 skill 版本

### 5.3 Team 拓扑合法性约束不强

目前我没有看到 Team 路由在创建/更新时做强校验，例如：

- 是否恰好只有一个 leader
- 是否存在环
- 是否重复成员
- `parentAgentId` 是否引用了 team 之外的节点

相反，目前 `resolveAgentId()` 的逻辑只是：

- 找到第一个没有 `parentAgentId` 的成员作为 leader

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/server/src/routes/teams.ts`
- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/utils/target.ts`

这意味着如果拓扑不严谨，运行时就会出现隐式行为。

Deskly 将来如果引入 Team，不应重蹈这个坑，应该在模型层和保存层都做拓扑约束。

### 5.4 运行可复现性没有做到 Deskly 需要的强度

`golemancy` 的 skill 绑定虽然是可执行语义，但并没有看到 run 级别的：

- skill revision
- skill hash
- skill content snapshot

它运行时主要依赖：

- 当前 agent 的 `skillIds`
- 当前 project 目录里的 skill 文件

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/server/src/agent/skills.ts`
- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/server/src/storage/skills.ts`

这会带来一个问题：

- 历史会话 / 历史运行的能力边界，可能随着 skill 文件后续变更而发生漂移

而 Deskly 当前 PRD 已明确要求：

- run snapshot 必须固化 skill revision / hash / 内容快照

因此在“可执行 skill 绑定”这一点上，Deskly 应该借它的方向，但不能照它的可复现强度。

### 5.5 Agent 上存在轻微的“双重真相”风险

`Agent` 类型里持久化了一个 `tools: ToolCallSchema[]` 字段，但实际运行时真正用的工具集合，是 `loadAgentTools()` 动态返回的 `tools`。

源码证据：

- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/shared/src/types/agent.ts`
- `/Users/fuzhifei/code/go/src/demo/golemancy/packages/server/src/agent/tools.ts`

这说明：

- 持久化层有一份 “声明型 tools”
- 运行时又有一份 “真实 tools”

如果两者不一致，会产生概念噪音。

Deskly 在设计 Agent 时应该尽量避免类似字段，优先只保留：

- 可声明的输入资源
- 运行时解析后的结果

中间不要再持久化一份容易过时的 “工具清单”。

## 6. 对 Deskly 的直接启发

### 6.1 你们当前的方向总体是对的

Deskly 当前 PRD 已经明确：

- Agent 是产品层资产，不是底层 CLI profile
- `AgentToolConfig` 继续作为 runtime profile
- Agent 同时服务于 `conversation task` 与 `workflow node`
- skill 绑定必须是可执行语义
- run snapshot 负责冻结最终运行形态

相关文档：

- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/.trellis/tasks/04-01-04-01-agent-profile-workflow/prd.md`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/docs/agent-product-usage-flows.md`

这条路线和 `golemancy` 最有价值的设计点是对齐的。

### 6.2 Deskly 真正缺的不是“Agent 运行器”，而是“Agent 解析器”

Deskly 现状是：

- `TaskService` 会把 conversation task 转成单节点 workflow run
- `WorkflowRunService` 会把 definition snapshot 展开成 run nodes
- `CliSessionService` 会根据 `cli_tool_id + agent_tool_config_id` 启动具体 CLI

源码证据：

- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/TaskService.ts`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/WorkflowRunService.ts`
- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/cli/CliSessionService.ts`

所以 Deskly 不需要新增第二套 runtime。

真正需要新增的是一层：

- `agentDefinitionId -> resolved run snapshot`

这层应该在创建 run 之前完成解析，把 Agent 展开为：

- `cli_tool_id`
- `agent_tool_config_id`
- `agent prompt`
- `workflow node step prompt`
- `task prompt`
- `skills snapshot`
- 未来可扩展的 tool / MCP / output contract 约束

### 6.3 Prompt 组合和会话稳定性必须补实现

Deskly 当前 `WorkflowRunService` 里的 prompt 组合还是：

- `taskPrompt + nodePrompt`

源码证据：

- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/WorkflowRunService.ts`

而 `CliSessionService` 是：

- 会话启动时发送一次初始 prompt
- 后续 `sendInput()` 直接透传用户输入

源码证据：

- `/Users/fuzhifei/code/go/src/github.com/fzf-labs/deskly/src/main/services/cli/CliSessionService.ts`

这意味着如果 Deskly 第一版要保证 Agent 身份稳定，就必须在 run 创建时明确区分：

- `Agent prompt`
- `Step prompt`
- `Task prompt`

并尽量把稳定角色约束落到 session-level 配置或 system prompt 能力上，而不是只拼在首条输入里。

这一点恰好是 `golemancy` 的经验可以帮助 Deskly 看清的问题。

### 6.4 Team 应该是后续能力，不是第一版 Agent 的一部分

`golemancy` 的 Team 设计值得借，但不值得现在就借进 Deskly MVP。

原因有三点：

- Deskly 当前第一版 Agent 明确是“单节点执行型能力资产”
- 当前核心运行链路是 workflow，不是 team conversation
- 现在先把 Agent / Profile / Skill / Snapshot 四层关系理顺，收益最大

因此推荐阶段性策略：

- 第一版：Agent 资产 + 引用 + snapshot + skill allowlist
- 第二版：Agent starter kits / asset bundles
- 第三版：Team / 多 Agent 协作 / automation 直接运行 Agent

## 7. 最终建议

### 7.1 应该借的

- `Agent` 作为第一类产品资产
- runtime 装配思路
- skill allowlist 的可执行绑定
- Agent 与 Team 解耦
- 模板生成为资产包

### 7.2 不应该借的

- project-only 作用域
- team-first 的主运行模型
- 直接映射到底层 CLI 的原生 agent 概念
- 依赖当前文件状态而非 run snapshot 的弱可复现方案

### 7.3 对 Deskly 的推荐落地形式

Deskly 第一版最合理的做法仍然是：

- `Agent = 可被 conversation task / workflow node 引用的单节点能力资产`
- `AgentToolConfig = runtime profile`
- `run snapshot = 真正的运行真相`

也就是说：

- 用户界面上选择的是 `Agent`
- 运行时解析出来的仍然是现有 workflow / cli session 能执行的结构化参数

这条路既吸收了 `golemancy` 最值钱的设计经验，又不会破坏 Deskly 当前已经成立的 workflow runtime 架构。

## 8. 一句话判断

如果用一句话概括这次分析：

`golemancy` 值得 Deskly 学的，是“Agent 作为资产、能力在 run 时装配、模板一次生成资产包”；不值得学的，是“把一切都收在 project 里、把 team conversation 当成主运行模型”。
