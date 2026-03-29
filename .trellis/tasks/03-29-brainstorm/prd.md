# brainstorm: 新建任务对话模式输入框增加斜杠命令

## Goal

在“新建任务 -> 对话模式”的输入框中增加类似 Codex / Claude Code 的命令触发体验：用户输入 `/` 时可以看到当前项目上下文下可用的 skills 和 MCP 项，快速选择并插入，再用于发起任务。目标不是单纯做一个字符串补全，而是让 Deskly 在创建 conversation task 之前，就能基于当前项目、当前 CLI 工具和本地配置，发现真正可用的能力入口，并用一致的方式暴露给用户。

## What I already know

* 用户希望在新建任务的对话模式输入框里增加 `/` 命令效果。
* 用户希望它能检测“当前项目能用的 skills 和 MCP”，并用于快捷使用。
* 用户期望体验接近 Codex / Claude Code 的 `/` 或 `$` 触发方式。
* 新建任务对话模式当前入口是 `TaskComposer -> ChatInput`，输入框是普通 `textarea`，还没有任何输入内联补全或命令菜单。
* `TaskComposer` 已经掌握当前上下文中的 `projectId / projectPath / createMode / selectedCliToolId / selectedCliConfigId`，因此 slash 菜单不需要先新增后端上下文接口才能知道“当前项目”和“当前 CLI 工具”。
* 项目里已经有 skills 的本地发现逻辑：
* `src/renderer/src/features/skills/model/skills.ts`
* 可扫描各 CLI 的默认目录，如 `project/.codex/skills`、`project/.claude/skills`
* 可读取 `SKILL.md` frontmatter 来拿到 `name / description`
* 项目里已经有 MCP 的本地发现逻辑：
* `src/renderer/src/pages/mcp/McpPage.tsx`
* `src/renderer/src/features/settings/model/mcp.ts`
* 可读取全局配置和项目配置，并解析 JSON / TOML 中的 MCP server
* 当前 conversation task 的执行模型不是“嵌入原生 CLI 交互终端”，而是把 prompt 作为一次性输入传给 CLI adapter：
* Codex: `codex exec ...`，prompt 通过 stdin 送入
* Claude Code: `claude -p ...`，prompt 作为消息发入
* Cursor Agent: prompt 直接作为命令参数
* 这意味着在 Deskly 输入框里直接键入 `/mcp`、`/help`、`/project:foo` 之类文本，默认不会自动触发 CLI 原生 TUI 命令语义；如果要有 slash command 效果，Deskly 需要自己实现触发、菜单、插入和提交前语义处理。
* 当前任务创建菜单里已经有 CLI 工具切换能力，因此 slash 菜单天然应该与“当前选中的 CLI 工具”联动，而不是跨所有 CLI 混合展示。

## Assumptions (temporary)

* 本次先聚焦“新建任务 -> 对话模式”的输入框，不要求同步扩展到任务详情页继续对话输入框。
* 本次重点是“发现 + 选择 + 快捷插入”，不要求一次覆盖每个 CLI 的全部原生命令体系。
* “当前项目可用的 skills / MCP”优先按“当前选中的 CLI 工具 + 当前 projectPath”来判断。
* 如果没有项目上下文，仍可展示全局可用项，但 project-scope 能力应自然缺失。
* MVP 不应依赖在线查询；可用项应完全来源于本地文件系统、设置和当前项目配置。

## Open Questions

* 当前无阻塞开放问题

## Requirements (evolving)

* 仅在新建任务的 `conversation` 模式输入框中支持 slash command 触发。
* 用户输入 `/` 时，系统可以打开命令菜单，而不是只能输入普通文本。
* 菜单内容需要和当前上下文联动：
* 当前选中的 CLI 工具
* 当前项目路径（如果有）
* 当前项目对应的 skills 目录
* 当前项目 / 全局 MCP 配置
* 菜单至少需要区分两类能力：
* Skills
* MCP
* 选择项后，不能只插入普通文本；需要插入 Deskly 可识别的结构化 token，并在提交前编译。
* Skills / MCP 选中后以 chip / 富 token 形态出现在输入框中，可删除，不直接暴露内部原始语法。
* Skills 需要展示足够的信息帮助选择：
* 名称
* 描述（若 `SKILL.md` 有 frontmatter）
* 来源（project / global，或具体 CLI）
* MCP 需要展示足够的信息帮助选择：
* server 名称
* transport / command / source 等基本信息
* 来源（project / global）
* 菜单项必须只展示“当前 CLI 工具上下文下相关”的内容，避免混入其他 CLI 的 skills / MCP。
* 选择项后，需要把结果插入到输入框当前光标位置，而不是只能追加到末尾。
* 输入框需要能承载“普通文本 + 结构化 token”混合编辑。
* 提交创建任务时，Deskly 需要先把输入内容编译成最终 prompt，而不是把原始 token 直接裸传给 CLI。
* 至少需要为两类 token 定义稳定语义：
* Skill token: 在最终 prompt 中编译为所选 skill 的引用，而不是直接展开 `SKILL.md` 全文
* MCP token: 在最终 prompt 中显式声明所选 MCP server
* token 需要支持基础编辑行为：
* 通过键盘或点击删除
* 与普通文本混排
* 不因内部序列化语法泄漏而影响用户直接编辑文本
* 键盘交互应可用，至少支持继续输入过滤、方向键切换、回车确认、Esc 关闭。
* 当没有可用项时，需要提供明确空状态，而不是静默无响应。
* 正常输入普通文本不能被破坏，尤其不能让任意 `/` 都强制弹出不可关闭的菜单。

## Acceptance Criteria (evolving)

* [ ] 在新建任务的 conversation 模式下，输入框中输入 `/` 时会出现命令菜单。
* [ ] 菜单项会随着当前选中的 CLI 工具切换而变化，不会混入其他 CLI 的 skills / MCP。
* [ ] 选择带项目的任务时，能识别该项目下对应 CLI 的 project skills 目录。
* [ ] 选择带项目的任务时，能识别该项目下 `.deskly/mcp/<cli>.json` 中可用的 MCP server。
* [ ] 无项目时，菜单仍能展示全局可用项，并明确不包含 project-scope 项。
* [ ] 选择一个 skill 或 MCP 后，会在当前光标位置插入 Deskly 可识别的 chip / 富 token，而不是仅插入一段不可识别纯文本。
* [ ] 提交创建任务时，输入中的 token 会被 Deskly 编译成最终 prompt，CLI 不会直接收到原始内部 token 语法。
* [ ] MCP token 在 MVP 中只影响最终 prompt，不直接改写底层 runtime 配置。
* [ ] Skill token 在 MVP 中会编译为 skill 引用，而不是把 `SKILL.md` 内容整体展开进 prompt。
* [ ] token 支持与普通文本混排，并可通过直观交互删除。
* [ ] 键盘可以完成一次完整选择流程：触发、筛选、选中、关闭。
* [ ] 当没有 skills / MCP 可用时，菜单会展示清晰空状态或引导。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Research Notes

### What similar tools do

* Codex 官方文档中，`/` 会打开“可用命令菜单”，并支持列出命令。
* Codex 提供 `/skills`，也支持在输入时用 `$` 显式提及 skill。
* Codex 提供 `/mcp` 用于查看当前 session 可用的 MCP 工具。
* Codex 提供 `/apps`，选择后会把 `$app-slug` 插入输入框，而不是直接执行。
* Claude Code 官方文档中，slash commands 包括内建命令，也支持从 project / user 目录加载自定义 slash commands。
* 这些工具的共同点不是“把 `/` 原样发给模型”，而是“输入框内先做本地命令发现和交互，再决定插入/执行什么”。

### Constraints from our repo/project

* Deskly 当前不是直接嵌入 Codex / Claude Code 的原生交互终端，而是以 adapter 方式发起 prompt 驱动的 session。
* 因此如果不做 Deskly 自己的预处理层，仅把 `/xxx` 文本发送给 CLI，并不能稳定得到和原生 CLI 一样的 slash command 语义。
* `TaskComposer` 已经持有做上下文过滤所需的关键信息，适合作为 slash menu 的状态拥有者。
* `ChatInput` 是通用输入组件，若做 slash command UI，较合理的承载点是：
* 在 `ChatInput` 增加通用的“命令建议 / mention”能力
* 由 `TaskComposer` 提供候选项和选中后的插入策略
* skills 与 MCP 的“发现”逻辑已存在，但分散在两个 feature 中，需要抽一层共用的 query / view-model，而不是在 `TaskComposer` 里重复拼装。

### Feasible approaches here

**Approach A: Deskly-native slash palette + 结构化 token 编译层** (Selected)

* How it works:
* 输入 `/` 打开菜单。
* 菜单展示当前 CLI + 当前项目下可用的 skills / MCP。
* 选中后插入 Deskly 自己可识别的 token 或节点，再在提交前编译成真实 prompt / runtime 参数。
* Pros:
* 语义最稳定，不依赖不同 CLI 对 slash 文本的支持程度。
* 后续可以扩展为更多命令类型，不局限 skills / MCP。
* 有机会让 MCP 不只是插一句提示词，而是真进入 runtime 配置层。
* Cons:
* 需要新增“输入态 token”与“提交态编译”规则，设计成本最高。
* 需要定义 token 的可视化和序列化方式。

**Approach B: Deskly-native slash palette + 可见文本插入**

* How it works:
* 输入 `/` 打开菜单。
* 选择 skill / MCP 后，直接把对应 token 或提示片段插入输入框文本，例如 `$brainstorm` 或“使用 github MCP”。
* Pros:
* 改动最小，输入框只需要补全和插入能力。
* 对 Codex skill 类场景比较贴近现有心智模型。
* Cons:
* 对 MCP 语义不稳定，因为不同 CLI 并没有统一的文本触发格式。
* 对 Claude Code 等工具也未必能保证插入文本被原生解释为 slash command。

**Approach C: 只做发现面板，不做真正输入内联语义**

* How it works:
* 输入 `/` 打开一个只读选择器，用户选中后插入一段建议文本或仅复制名字。
* Pros:
* 最容易落地，风险最低。
* 先验证“发现什么”和“用户是否会用”。
* Cons:
* 与 Codex / Claude Code 的体验差距较大。
* 快捷使用价值有限，后续大概率还要重做。

## Decision (ADR-lite)

**Context**: 需要在“类似 Codex / Claude Code 的 slash 体验”和“Deskly 当前并非原生交互 CLI”的现实约束之间找到可落地方案。

**Decision**: 选择 `Approach A: Deskly-native slash palette + 结构化 token 编译层` 作为 MVP 方向。

**Consequences**:

* 需要把 skills 和 MCP 的本地发现逻辑抽象成输入框可复用的数据源。
* 需要定义 slash 菜单的过滤、分组、插入和关闭行为。
* 需要新增提交前的 token 编译层。
* 采用 chip / 富 token 形态，需要明确其序列化方式、光标/删除行为。
* MCP token 在 MVP 中只编译到 prompt，不触碰 CLI runtime 配置注入逻辑。
* Skill token 在 MVP 中编译为 skill 引用，不直接内联完整 skill 内容，从而控制 prompt 长度和重复注入风险。
* 相比纯文本插入，前端实现会更重，但可避免不同 CLI 对 slash 文本解释不一致的问题。

## Technical Approach

* 在 `TaskComposer` 层组装当前 CLI 工具 + 当前项目的 slash candidate 数据源，来源包括：
* skills 目录扫描结果
* project / global MCP 配置扫描结果
* 在 `ChatInput` 增加可复用的 slash palette 能力，以及“普通文本 + chip token”混合编辑模型。
* slash palette 只在 `conversation` 模式启用，并且只展示当前 CLI 工具相关的 skills / MCP。
* 用户选中项后，在当前光标位置插入 chip token。
* 提交创建任务前，将混合输入模型编译为最终 prompt：
* 普通文本原样保留
* skill chip 编译为 skill 引用
* MCP chip 编译为对所选 MCP server 的显式 prompt 提示
* MVP 不直接修改 CLI adapter runtime 配置，不改 task/create IPC 合同。

## Out of Scope (explicit)

* 本轮不要求覆盖任务详情页的继续对话输入框。
* 本轮不要求完整复刻 Codex / Claude Code 所有原生命令。
* 本轮不要求实现在线安装 / 管理 skills 或 MCP。
* 本轮不要求统一所有 CLI 的底层 runtime 协议。
* 本轮不要求把任意自由输入的 `/xxx` 文本都自动映射为 CLI 原生命令。
* 本轮不要求通过 MCP token 直接修改 CLI adapter 的 runtime 配置。

## Technical Notes

* 已检查文件：
* `src/renderer/src/features/tasks/ui/TaskComposer.tsx`
* `src/renderer/src/features/tasks/hooks/useTaskComposer.ts`
* `src/renderer/src/components/shared/ChatInput.tsx`
* `src/renderer/src/features/tasks/ui/TaskCreateMenu.tsx`
* `src/renderer/src/features/skills/model/skills.ts`
* `src/renderer/src/features/skills/SkillsPage.tsx`
* `src/renderer/src/pages/mcp/McpPage.tsx`
* `src/renderer/src/features/settings/model/mcp.ts`
* `src/main/services/TaskService.ts`
* `src/main/services/cli/CliSessionService.ts`
* `src/main/services/cli/adapters/CodexCliAdapter.ts`
* `src/main/services/cli/adapters/ClaudeCodeAdapter.ts`
* `src/main/services/cli/adapters/CursorAgentAdapter.ts`
* `src/main/services/cli/adapters/GeminiCliAdapter.ts`
* 外部参考：
* Codex slash commands: `https://developers.openai.com/codex/cli/slash-commands`
* Codex skills: `https://developers.openai.com/codex/skills`
* Claude Code slash commands: `https://docs.anthropic.com/en/docs/claude-code/slash-commands`
