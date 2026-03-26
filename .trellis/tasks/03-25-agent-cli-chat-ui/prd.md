# brainstorm: 优化任务详情页 agent cli 对话式展示方案

## Goal

优化任务详情页中 `agent cli` 的展示 UI，优先针对 `codex` 场景，将当前偏日志列表式的展示升级为更接近真实对话的聊天式展示。用户输入需要按一条输入对应一个用户气泡展示；AI 回复需要按一轮回复聚合为一个 AI 气泡展示；同时要能承载 Codex 回复中丰富且不稳定的格式，包括 Markdown、代码块、表格、命令执行、工具调用、系统事件、错误信息等，保证主要内容易读，过程信息可追踪。

## What I already know

* 用户希望先做 `codex` 的展示方案，不直接开始实现。
* 用户期望任务详情页中的 agent cli 呈现方式更像聊天界面：
* 用户输入是用户气泡，一条输入一个气泡。
* AI 输出是 AI 气泡，同一轮 AI 回复尽量聚合成一个气泡。
* AI 回复内容格式很多，需要针对不同内容类型做展示优化。
* 当前任务详情页的执行区域链路是 `ExecutionPanel -> CLISession -> CodexLogView`。
* 当前 `ExecutionPanel` 在 conversation task 且存在 CLI runtime 时，会优先展示 `CLISession`，而不是现有 `MessageList`。
* `CodexLogView` 当前已经能把 Codex 的 stdout JSON 行解析为语义化 entry：
* `assistant_message`
* `user_message`
* `tool_use`
* `tool_result`
* `command_run`
* `system_message`
* `error`
* 现有 `CodexLogView`、`ClaudeCodeLogView`、`CursorAgentLogView` 等 renderer 结构高度相似，当前统一偏向“可折叠日志卡片列表”，不是“按轮次聚合的聊天消息”。
* 渲染层已有 `react-markdown`、`remark-gfm`、`react-syntax-highlighter` 等依赖，可支持 Markdown、GFM 表格、代码块等富文本展示。
* 现有普通消息流组件中，用户消息已存在右侧气泡样式基础，可复用其部分视觉和交互模式。

## Assumptions (temporary)

* 本次先聚焦 `codex`，其他 agent cli 暂不要求同时切到聊天式展示。
* 本次优先解决“展示模型”和“阅读体验”，不要求同步改造底层日志存储协议。
* Codex 的 stdout 事件顺序基本可靠，可以基于时间顺序归并为“用户轮次”和“AI 轮次”。
* 工具调用、命令执行、补丁应用等过程信息更适合作为 AI 气泡的附属内容，而不是独立主消息。
* 若某些事件无法稳定归入用户或 AI 轮次，需要提供安全降级方案，而不是强行错误归并。

## Open Questions

* AI 气泡内的工具调用过程，MVP 是默认折叠展示，还是默认展开展示？

## Requirements (evolving)

* `codex` 的任务详情执行区支持聊天式消息流展示。
* 用户输入一条对应一个独立用户气泡。
* 同一轮 AI 输出尽量聚合为一个 AI 气泡，而不是拆成多条零碎日志卡片。
* AI 气泡需要优先突出最终可读内容，弱化但保留执行过程和系统事件。
* AI 内容需良好支持 Markdown 常见格式：
* 段落、标题、列表
* 行内代码、代码块
* 表格
* 链接
* 引用
* 对于工具调用、命令执行、文件改动、系统事件、错误等非正文内容，需要有统一的信息层级和视觉策略。
* 需要支持实时流式更新，避免 AI 回复过程中 UI 抖动或消息碎片化过强。
* 需要兼容历史日志回放与实时订阅两种来源。
* 当事件解析失败或格式未知时，需要有可接受的兜底展示。

## Acceptance Criteria (evolving)

* [ ] 在 Codex conversation task 中，用户发送两条输入时，界面显示两个独立用户气泡。
* [ ] 一轮连续的 Codex assistant 文本输出会被聚合到一个 AI 气泡中展示。
* [ ] AI 气泡中的 Markdown 文本在常见场景下可正确渲染，包括代码块和表格。
* [ ] 工具调用和命令执行信息不会淹没主回复内容，且仍可查看。
* [ ] 历史日志回放与实时运行中的展示结构一致，不会出现明显错位。
* [ ] 当出现未知 event 或解析失败时，界面仍能展示原始内容，不出现空白区域。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Research Notes

### What similar tools in this repo do

* 现有多个 agent cli renderer 都采用“语义化 entry + 可折叠日志卡片”的思路。
* 普通 agent 消息流组件采用“用户消息 + AI 富文本正文”的思路，但未覆盖 CLI 过程信息。
* 说明仓库里已经存在两套模式：
* 一套偏对话阅读
* 一套偏过程审计
* 当前痛点本质上是任务详情页中的 Codex 展示停留在过程审计视角，没有切到对话阅读视角。

### Constraints from our repo/project

* `ExecutionPanel` 当前直接挂载 `CLISession`，因此最小改造点大概率在 `CLISession` 的 renderer 选择或 `CodexLogView` 的内部展示模型。
* `CodexLogView` 已具备 JSON line -> normalized entry 的解析能力，因此无需先改主进程协议即可尝试前端聚合。
* 当前日志来源有两种：`session` 实时流和 `file` 历史文件；新的展示模型必须同时兼容。
* 不能假设所有 stdout 都是完整 JSON，当前实现已经对非 JSON 行做了原样兜底。

### Feasible approaches here

**Approach A: 轮次气泡 + 过程折叠区** (Recommended)

* How it works:
* 基于现有 `NormalizedEntry` 先做一次“conversation turn grouping”。
* `user_message` 直接生成用户气泡。
* 相邻的 `assistant_message`、`tool_use`、`tool_result`、`command_run`、相关 `system_message` 归并进同一个 AI 轮次。
* AI 气泡顶部展示最终正文，底部提供“过程”折叠区展示工具调用、命令、系统事件、错误。
* Pros:
* 最符合用户对“像聊天”的预期。
* 主信息和过程信息分层明确，可读性最好。
* 可以最大化复用现有 parser，仅新增聚合层和新渲染组件。
* 后续扩展到其他 CLI 也有清晰模型。
* Cons:
* 需要定义稳定的轮次归并规则。
* 流式更新时需要处理“当前 AI 气泡持续增长”的状态。

**Approach B: 双栏混合模式**

* How it works:
* 主区域展示用户/AI 气泡。
* 侧边或气泡内次级区域持续显示原始过程时间线。
* Pros:
* 对排障友好，聊天阅读和过程审计都保留。
* 归并规则可以相对宽松。
* Cons:
* 页面信息密度高，任务详情页现有布局可能更拥挤。
* 对这次“先做 Codex、先像对话”目标来说偏重。

**Approach C: 仅做视觉气泡化，不做深度归并**

* How it works:
* 仍按单条 entry 渲染，但把 `assistant_message` / `user_message` 改成气泡样式。
* tool/system/error 仍作为独立卡片插在时间线里。
* Pros:
* 改动最小，上线快。
* 风险低。
* Cons:
* 无法真正解决 Codex 输出碎片化的问题。
* AI 一轮回复仍可能被拆散，达不到“像对话”的核心体验。

## Decision (ADR-lite)

**Context**: 需要在“聊天可读性”和“执行过程可追踪性”之间找到平衡，并尽量复用现有 Codex JSON 解析能力。

**Decision**: 暂定优先推进 `Approach A: 轮次气泡 + 过程折叠区`，作为 Codex 的 MVP 方案候选。

**Consequences**:

* 需要新增“entry -> turn” 的聚合层。
* 需要定义 AI 主正文与过程信息的分离规则。
* 需要处理 streaming 状态下最后一个 AI 气泡的增量更新。
* 若聚合规则设计合理，后续可以横向复用到其他 CLI。

## Out of Scope (explicit)

* 本轮不要求同时统一所有 agent cli 的展示风格。
* 本轮不要求改造底层日志协议或数据库结构。
* 本轮不要求重新设计任务详情页整体布局。
* 本轮不要求覆盖 workflow 模式下所有节点的复杂差异交互。

## Technical Notes

* 已检查文件：
* `src/renderer/src/pages/task-detail/components/ExecutionPanel.tsx`
* `src/renderer/src/pages/task-detail/useTaskDetail.tsx`
* `src/renderer/src/components/cli/CLISession.tsx`
* `src/renderer/src/components/cli/renderers/CodexLogView.tsx`
* `src/renderer/src/hooks/useLogStream.ts`
* `src/renderer/src/components/task/MessageItem.tsx`
* `src/renderer/src/components/task/UserMessage.tsx`
* `src/renderer/src/components/home/AgentMessages.tsx`
* `src/renderer/src/components/cli/renderers/ClaudeCodeLogView.tsx`
* `src/renderer/src/components/cli/renderers/CursorAgentLogView.tsx`
* 当前 `CodexLogView` 的关键优势：
* 已能解析 `exec_command_begin/end`、`patch_apply_begin/end`、`item_*`、`turn_*` 等事件。
* 已能从 stdout 文本中恢复 `assistant_message` / `user_message`。
* 当前主要缺口：
* 没有“轮次聚合”层。
* 没有“正文 vs 过程”分层。
* 没有针对富文本 AI 回复的聊天气泡容器。
