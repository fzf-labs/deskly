# brainstorm: cli tools settings tab

## Goal

为 Deskly 的设置页设计一个独立的 `CLI Tools` 管理入口，用于管理系统级 CLI 工具能力；同时保留并单独整理现有 `Agent CLI` 配置域，避免两者在产品和实现层面混淆。

## What I already know

* 用户希望“在设置中增加一个 cli 工具 Tab 并完善其功能”。
* 用户提供了参考项目 `/Users/fuzhifei/code/go/src/demo/CodePilot` 和文档 `https://www.codepilot.sh/zh/docs/cli-tools`。
* 用户已明确纠正：这里的 `cli 工具` 和 `agent cli` 是两回事，`agent cli` 需要单独拿出来处理。
* 当前仓库已经存在设置页、`CLISettings` 组件，以及主进程 `SettingsService`、`CliSessionService`、`WorkflowDefinitionGenerationService` 中的 CLI tool 开关逻辑。
* 当前仓库有未提交修改，且其中包含 `src/renderer/src/components/settings/tabs/CLISettings.tsx` 等相关文件，后续需要避免覆盖用户已有改动。
* 当前设置侧边栏已经有 `cli` 分类，文案是 “Agent CLI”，图标为终端图标；它目前承载的是代理运行时，不是通用 CLI tools。
* 当前 `CLISettings` 已支持：
  * 读取 `window.api.cliTools` 的检测快照并触发刷新
  * 展示安装状态、版本、路径
  * 为工具启用/禁用、设置默认 CLI
  * 按工具维护多份 `AgentToolConfig` 配置 profile
  * 基于 `src/shared/cli-config-spec.ts` 动态渲染基础/高级参数表单
* 当前主进程已具备：
  * `CLIToolDetectorService`：5 个 agent CLI 的检测、缓存、版本解析
  * `CLIToolConfigService`：读取各 CLI 的本地默认配置文件
  * `CliSessionService`：启动会话前校验启用状态并合并 profile 配置
  * `WorkflowDefinitionGenerationService`：按启用状态和安装/配置状态选择可用 CLI
* CodePilot 的 “CLI 工具” 更偏向“工具目录 + 安装引导 + AI 感知”，而 Deskly 当前 `cli` 页更偏向“Agent runtime 管理 + profile 配置”。
* 仓库内目前没有通用系统 CLI 工具 catalog、工具详情、安装引导、聊天上下文注入这类能力。

## Assumptions (temporary)

* 这次需求至少包含方案设计，可能进一步落到前后端实现，但需要先明确 MVP 范围。
* 新的 `CLI Tools` 不应复用当前 `Agent CLI` 的数据结构和文案语义，最多只共享底层检测框架。
* 参考项目 CodePilot 的页面结构和文档会作为 `CLI Tools` 的信息架构参考。
* `Agent CLI` 仍需保留，并继续服务 task create、workflow generation、task detail、skills/MCP 等现有链路。

## Open Questions

* 本次 MVP 的 `CLI Tools` 是否只做 settings 内的管理页，还是还要同步接入聊天/提示词/上下文注入。
* `Agent CLI` 是否保留在 settings 侧边栏中作为单独 tab，还是迁移到 `CLI Tools` 页内的二级分组。

## Requirements (evolving)

* 在 settings 中提供一个明确、可发现、可理解的 `CLI Tools` 管理入口。
* `CLI Tools` 与 `Agent CLI` 必须在信息架构、文案和状态模型上区分清楚。
* 方案需要基于当前 Deskly 架构，而不是直接照搬 CodePilot。
* 方案需要保留当前已有的 `Agent CLI` profile 配置能力。
* `CLI Tools` 方案需要给出工具发现、分类、详情、安装引导或使用建议。
* `Agent CLI` 方案需要继续给出安装缺失、未设默认、无 profile、配置缺失等状态的引导策略。

## Acceptance Criteria (evolving)

* [ ] 能清晰说明 CLI tools tab 在 Deskly settings 中的定位、信息架构和主要交互。
* [ ] 能清晰说明 CLI Tools 与 Agent CLI 的职责边界。
* [ ] 能列出需要改动的主要模块、数据流和状态模型。
* [ ] 能说明与现有 CLI 使用入口如何保持一致。
* [ ] 能给出可拆分的实现阶段或 MVP 边界。
* [ ] 能说明为什么 Deskly 不应直接复制 CodePilot 的通用 CLI catalog 模式。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 暂不假设首期一定要接入聊天 system prompt 自动注入系统工具上下文。
* 暂不假设需要重写整个 settings 架构。
* 暂不把 CodePilot 的“推荐安装 catalog、SSE 安装日志、聊天 system prompt 自动注入系统工具”全部纳入首期。

## Research Notes

### Deskly 当前实现的真实定位

* 现在的 `CLISettings` 已经不是空白页，而是“agent CLI 检测 + 开关 + 默认工具 + 配置 profile 管理”的混合页。
* `enabledCliTools` 和 `defaultCliToolId` 已经是跨层主合同：
  * renderer settings
  * main `SettingsService`
  * `TaskService`
  * `CliSessionService`
  * `WorkflowDefinitionGenerationService`
* 当前 5 个受支持工具是固定 allowlist：
  * `claude-code`
  * `codex`
  * `cursor-agent`
  * `gemini-cli`
  * `opencode`
* 配置层也已经很完整：`src/shared/cli-config-spec.ts` 为每个工具定义了字段 schema，UI 已能动态渲染表单。
* 这些能力显然属于 `Agent CLI`，不应被重新命名成通用 `CLI Tools`。

### CodePilot 提供的可借鉴点

* 把 CLI 能力设计成用户可理解的“工具管理中心”，而不是只暴露底层 JSON / 参数。
* 页面结构清晰：
  * 已安装
  * 推荐安装
  * 工具详情
  * 安装引导
* 文档强调的用户价值是：
  * 检测
  * 推荐
  * 感知
* 对用户而言，最有效的不是参数本身，而是“现在能不能用、能做什么、缺什么、下一步做什么”。

### Deskly 的约束与差异

* Deskly 是 Electron 本地代理工作台，不是面向任意系统工具的聊天产品。
* Deskly 现有的 CLI 链路直接驱动任务创建、任务节点执行、工作流 AI 生成，因此它们应该明确归类为 `Agent CLI`。
* 新增的 `CLI Tools` 应该是第二条能力线，用来管理 FFmpeg、jq、ripgrep 等系统工具，而不是替代 Agent CLI。
* 如果直接把现有 Agent CLI 页改名成 `CLI Tools`，会造成产品语义错误和实现层混乱。

### Feasible approaches here

**Approach A: 新增独立 CLI Tools Tab，并保留 Agent CLI Tab** (Recommended)

* How it works:
  * settings 新增 `cliTools` 分类，用于系统 CLI 工具管理
  * 当前 `cli` 分类保留并明确命名为 `Agent CLI`
  * `CLI Tools` 参考 CodePilot 做工具目录、详情、推荐与引导
  * `Agent CLI` 继续承载默认 agent、启用开关、profile 配置
* Pros:
  * 语义清晰
  * 不破坏现有任务执行链路
  * 为后续系统工具能力预留空间
* Cons:
  * 需要新增一组 settings 分类、状态模型和 UI 结构

**Approach B: settings 中只放 CLI Tools 入口卡片，详细管理放独立页面**

* How it works:
  * settings 新增简版 `CLI Tools`
  * 完整目录和工具详情放独立页面
* Pros:
  * 容量更大，未来能承载 catalog / 安装向导
* Cons:
  * 现阶段信息分散
  * 不符合“在设置中增加一个 cli 工具 Tab”的直觉

**Approach C: 把 Agent CLI 吞并进 CLI Tools，做一个大而全的统一页**

* How it works:
  * 把系统工具和 agent runtime 全放在一个页面
* Pros:
  * 页面入口少
* Cons:
  * 用户心智混乱
  * 状态模型耦合严重
  * 实现和维护成本都高

## Technical Approach

推荐采用 Approach A：

* 新增 `CLI Tools` tab：
  * 目标对象是系统级工具，如 `ffmpeg`、`jq`、`ripgrep`
  * 聚焦“工具目录、安装状态、用途说明、安装引导、示例用法”
* 保留并整理 `Agent CLI` tab：
  * 目标对象是 `claude-code`、`codex`、`cursor-agent`、`gemini-cli`、`opencode`
  * 聚焦“启用状态、默认 agent、profile 配置、运行时诊断”
* 两者之间只做弱联动：
  * `CLI Tools` 可作为 agent 提示、模板能力、MCP/技能说明的辅助信息源
  * `Agent CLI` 仍是任务执行链路的唯一选择入口

## Technical Notes

* 需要重点查看：
  * `src/renderer/src/components/settings/*`
  * `src/renderer/src/data/settings*`
  * `src/main/services/SettingsService.ts`
  * `src/main/services/cli/*`
  * `src/main/services/CLIToolDetectorService.ts`
  * `src/shared/cli-tool-enablement.ts`
  * `src/shared/cli-config-spec.ts`
* 需要对比参考项目：
  * `CodePilot/src/components/cli-tools/*`
  * `CodePilot/src/components/settings/CliSettingsSection.tsx`
  * `CodePilot/src/app/cli-tools/page.tsx`
  * `CodePilot/docs/handover/cli-tools.md`
  * `CodePilot/apps/site/content/docs/zh/cli-tools.mdx`
* 需要阅读参考文档：
  * `https://www.codepilot.sh/zh/docs/cli-tools`
