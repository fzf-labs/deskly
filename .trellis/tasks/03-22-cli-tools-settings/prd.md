# cli tools settings tab

## Goal

为 Deskly 设置页落地一个独立的 `CLI Tools` Tab，用于管理系统级 CLI 工具；同时把现有的代理运行时配置明确收口为 `Agent CLI`，在产品语义、代码命名、IPC 通道和状态模型上彻底分离。

## Final Product Decision

* `CLI Tools` 和 `Agent CLI` 是两条独立能力线，不合并。
* 设置页新增 `cliTools` 分类，面向系统工具目录与安装引导。
* 现有 `cli` 分类保留，继续承载 agent runtime 的启用、默认工具和 profile 配置。
* 原先含糊的 `CLISettings` / `CLIToolDetectorService` / `CLIToolConfigService` 已按职责重命名为 `AgentCLI*` 相关命名，避免后续继续混淆。

## Problem Context

* Deskly 原有 `cli` 设置页实际承载的是 agent runtime 管理，不是通用 CLI tools。
* 该链路已经深度参与任务创建、任务执行、工作流生成、技能/MCP 等逻辑，不能被误改成“通用工具中心”。
* 用户明确要求把系统 CLI 工具能力单独拿出来处理，并指出现有命名已经让人误解。
* 参考 CodePilot 可以借鉴的是“工具目录 + 检测 + 安装引导”的信息架构，而不是直接照搬其整套产品模型。

## Reference Analysis

### What CodePilot actually ships

CodePilot 的 `CLI Tools` 不是单一设置项，而是一条完整能力链：

* 独立导航页面，不只是设置页子项。
* 精选系统工具 catalog，包含摘要、分类、安装方式、详情介绍、上手步骤、示例 prompt。
* 运行时检测与版本提取，带缓存。
* 受控的一键安装与 SSE 安装日志。
* AI 自动生成工具简介。
* 聊天 system prompt 自动注入已安装工具上下文。
* 聊天输入框中的 CLI 工具选择器与 badge。

### What Deskly should adopt

建议吸收的部分：

* 精选 catalog + 检测 + 安装引导的信息架构。
* 详情内容结构：
  * 介绍
  * 适用场景
  * 上手步骤
  * 示例用法
* `EXTRA_WELL_KNOWN_BINS` 这种“额外已检测工具”的思路。
* 安装命令白名单与安装日志流设计。
* 将系统 CLI 能力作为 AI 上下文辅助信息源。

不建议直接照搬的部分：

* 把系统 `CLI Tools` 与 `Agent CLI` 混成一个设置域。
* 首期就完整复制聊天选择器和聊天全局注入。
* 把本项目的主交互重心从 task / workflow / agent runtime 改成聊天驱动。
* 用临时本地存储承载未来可能影响执行质量的核心工具元数据。

## Scope

### In Scope

* 新增设置页 `CLI Tools` Tab。
* 提供一组系统 CLI 工具 catalog：
  * `ffmpeg`
  * `jq`
  * `ripgrep`
  * `yt-dlp`
  * `pandoc`
* 展示每个工具的：
  * 安装状态
  * 版本
  * 可执行路径
  * 使用场景
  * 平台化安装命令
  * 文档/官网链接
* 新增主进程检测服务、独立 IPC、preload bridge、renderer 归一化工具。
* 对既有 agent CLI 相关代码做清晰命名整理，但不改变其运行时行为。

### Out of Scope

* 不在首期执行工具安装命令。
* 不在首期接入聊天 prompt / AI context 自动注入系统 CLI 工具信息。
* 不重做整个 settings 架构。
* 不把系统 CLI tools 与 agent runtime 放进一个统一状态模型。

## Delivery Status

### Already Delivered

* `CLI Tools` 独立设置分类已接入。
* 系统工具 catalog 与检测链路已落地：
  * `ffmpeg`
  * `jq`
  * `ripgrep`
  * `yt-dlp`
  * `pandoc`
* 设置页已支持：
  * 概览统计
  * 已安装 / 推荐分组
  * 版本与路径展示
  * 使用场景
  * 平台安装命令
  * 文档与官网链接
  * 搜索、分类筛选、仅看已安装
  * 详情弹窗
  * guide steps 与 example prompts
  * 复制安装命令与示例用法
* `Agent CLI` 相关代码命名已完成职责化清理。

### Not Yet Delivered

* 详情面板 / 详情弹窗。
* 搜索、分类筛选、只看已安装。
* 额外常见系统工具检测。
* 一键安装与安装日志。
* AI 自动描述。
* Agent 感知 / prompt 注入。

## User Experience

### CLI Tools Tab

* 用户在设置页可以看到新的 `CLI Tools` 分类入口。
* 进入后能看到：
  * 顶部概览卡片：已安装、缺失、目录总数
  * 已安装工具列表
  * 推荐安装工具列表
* 每张工具卡展示：
  * 工具名称与分类
  * 当前安装状态
  * 版本与路径
  * 典型用途
  * 当前平台可用的安装命令
  * 文档与官网入口
* 页面加载时优先显示缓存快照，再异步刷新，降低等待感。

### Agent CLI Tab

* 现有设置页仍以 `Agent CLI` 名义保留。
* 继续提供：
  * 检测状态
  * 启用/禁用
  * 默认 agent CLI
  * 各 agent CLI 的 profile 配置
* 现有任务执行链路、工作流生成链路保持不变。

## Architecture

### Separation Principle

* `Agent CLI` 继续使用原有 agent runtime 数据链路。
* `CLI Tools` 使用新的系统工具数据链路。
* 新旧两套能力只共享“检测系统二进制”这一类底层思想，不共享 IPC 命名、preload API、设置页组件语义。

### Implemented Modules

* Shared
  * `src/shared/system-cli-tools.ts`
  * `src/shared/agent-cli-config-spec.ts`
  * `src/shared/agent-cli-tool-enablement.ts`
* Main
  * `src/main/services/SystemCliToolService.ts`
  * `src/main/ipc/system-cli-tools.ipc.ts`
  * `src/main/ipc/agent-cli-tools.ipc.ts`
* Preload
  * `window.api.systemCliTools`
* Renderer
  * `src/renderer/src/components/settings/tabs/CLIToolsSettings.tsx`
  * `src/renderer/src/components/settings/tabs/AgentCLISettings.tsx`
  * `src/renderer/src/lib/system-cli-tools.ts`
  * `src/renderer/src/lib/agent-cli-tools.ts`
  * `src/renderer/src/lib/agent-cli-tool-enablement.ts`

### IPC / API Boundary

* 旧 agent runtime API 继续保留：
  * `window.api.cliTools`
  * `window.api.cliToolConfig`
* 新系统工具 API 独立新增：
  * `window.api.systemCliTools.getAll`
  * `window.api.systemCliTools.getSnapshot`
  * `window.api.systemCliTools.refresh`
  * `window.api.systemCliTools.detect`
  * `window.api.systemCliTools.detectAll`
  * `window.api.systemCliTools.onUpdated`

### Planned Follow-up Modules

后续阶段建议新增：

* Main
  * `src/main/services/SystemCliInstallService.ts`
  * `src/main/services/SystemCliContextService.ts`
* Renderer
  * `src/renderer/src/components/settings/tabs/SystemCliToolDetailDialog.tsx`
  * `src/renderer/src/components/settings/tabs/SystemCliInstallDialog.tsx`
  * `src/renderer/src/components/settings/tabs/SystemCliToolFilters.tsx`

## Detection Model

* 系统 CLI 工具由 `SystemCliToolService` 统一维护 catalog 与检测缓存。
* 服务支持快照读取、单工具检测、全量刷新和 `updated` 事件广播。
* 为满足安全执行约束，以下命令已加入 allowlist：
  * `ffmpeg`
  * `jq`
  * `rg`
  * `yt-dlp`
  * `pandoc`
* `CLI Tools` 检测状态和 `Agent CLI` 状态完全独立，不会影响 agent runtime 选择。

## Product Roadmap

### Phase P1: Settings-first capability center

目标：先把 `CLI Tools` 做成一个高质量的设置中心，而不是急着扩展到安装或聊天。

包括：

* 保持 `CLI Tools` 独立 tab。
* 优化列表密度与信息层级。
* 增加详情面板或详情弹窗。
* 为 catalog 补齐：
  * guide steps
  * example prompts
  * 更完整的 summary / use cases
* 增加搜索、分类筛选、仅看已安装。
* 增加复制安装命令、复制示例用法。
* 引入 `EXTRA_WELL_KNOWN_BINS` 检测，但仅在已检测区展示，不进入推荐安装区。

预期结果：

* 用户能快速知道“我机器上有什么”“缺什么”“怎么开始用”。
* 页面更适合设置页场景，而不是大卡片展示页。

### Phase P1.5: Platform guidance

目标：提升可操作性，减少用户在安装前的阻塞。

包括：

* 检测 Homebrew / pipx / cargo / npm 等安装前置条件。
* 在不同平台给出更明确的前置依赖提示。
* 对无法自动安装的平台展示只读引导而不是失败操作。

### Phase P2: Controlled installation

目标：支持受控安装，但保持安全边界清晰。

包括：

* 新增 `SystemCliInstallService`。
* 只允许执行 catalog 中声明的安装命令。
* 支持安装方式选择：
  * `brew`
  * `pipx`
  * `cargo`
  * `npm`
  * 其他白名单方式
* 安装日志通过事件流回传。
* 安装完成后自动重新检测。

关键约束：

* 需要用户确认。
* 需要平台校验。
* 需要失败态与重试策略。

### Phase P3: Agent awareness

目标：让系统 CLI 能力帮助 Deskly 的 agent 工作，但不引入产品心智混乱。

优先接入的场景：

* 工作流生成提示。
* Task 创建辅助建议。
* Task 详情页中的 agent 运行提示。
* Skills / MCP 的推荐上下文。

暂不优先：

* 聊天输入框 CLI 选择器。
* 全局 chat system prompt 无条件注入。

原因：

* Deskly 当前主链路不是聊天，而是 task / workflow / agent runtime。
* 先把 agent 执行场景接稳，收益更直接。

## Naming Cleanup

已完成的命名整理：

* `CLISettings.tsx` -> `AgentCLISettings.tsx`
* `CLIToolDetectorService.ts` -> `AgentCLIToolDetectorService.ts`
* `CLIToolConfigService.ts` -> `AgentCLIToolConfigService.ts`
* `cli-tool-enablement` -> `agent-cli-tool-enablement`
* `cli-config-spec` -> `agent-cli-config-spec`
* `src/main/ipc/cli-tools.ipc.ts` -> `src/main/ipc/agent-cli-tools.ipc.ts`

目的：

* 让“Agent CLI”一眼可辨是 runtime 层能力。
* 为新的 `CLI Tools` 预留明确且不冲突的命名空间。

## Acceptance Criteria

* [x] 设置页存在独立的 `CLI Tools` Tab。
* [x] `CLI Tools` 与 `Agent CLI` 在文案、命名和实现层面被明确区分。
* [x] 新系统工具链路使用独立 service / IPC / preload API。
* [x] `Agent CLI` 现有能力与任务执行链路保持兼容。
* [x] `CLI Tools` 首期提供工具目录、检测状态、安装引导与文档链接。
* [x] PRD 明确记录 Deskly 不直接复制 CodePilot 的通用 catalog 模式，而是采用 Deskly 适配后的双轨方案。

## Next Implementation Checklist

### P1

* [x] 将系统工具详情从列表中抽离到详情面板或弹窗。
* [x] 为 catalog 增加 guide steps 与 example prompts 数据结构。
* [x] 在列表页增加搜索、分类筛选、仅看已安装。
* [x] 增加复制安装命令。
* [ ] 增加 `EXTRA_WELL_KNOWN_BINS` 检测展示。
* [ ] 增加 Homebrew / 平台前置提示。

### P2

* [ ] 设计安装 service 与 IPC contract。
* [ ] 实现安装方式选择与执行确认。
* [ ] 实现安装过程日志流与安装状态 UI。
* [ ] 安装完成后自动触发检测刷新。

### P3

* [ ] 设计 `SystemCliContextService` 的数据格式。
* [ ] 选择 Deskly 中首个接入的 agent 场景。
* [ ] 仅在受益明确的场景中注入系统 CLI 上下文。

## Verification

* 命名整理阶段已通过 `npm run typecheck` 与 `npm run lint`。
* 当前实现阶段要求继续保持：
  * `npm run typecheck`
  * `npm run lint`

## Risks And Follow-ups

* 当前首期不执行安装命令，因此“安装引导”仍是只读体验。
* 如果后续要支持一键安装，需要单独设计：
  * 权限与安全确认
  * 跨平台包管理器差异
  * 安装日志和失败恢复
* 如果后续要让 agent 感知系统 CLI tools，需要新增独立的上下文注入策略，不能直接复用 Agent CLI 配置模型。
* 如果未来引入聊天入口，也需要重新评估是否有必要补做 CodePilot 风格的 CLI 选择器，而不是提前预埋聊天中心化设计。
