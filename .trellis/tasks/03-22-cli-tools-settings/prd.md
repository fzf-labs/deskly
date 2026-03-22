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
