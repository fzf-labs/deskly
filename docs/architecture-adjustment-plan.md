# Deskly 架构调整方案

本文整理于 2026-03-27，目标是把当前仓库从"分层基本清晰，但 AI 修改上下文成本偏高"提升到"AI 易定位、易局部修改、易验证"的状态。

## 改造目标

- 优先提升 AI 协作开发效率，而不是先追求目录最少或重写业务交互。
- 在不改变核心业务行为的前提下，降低前端复杂页面和跨层合同带来的理解成本。
- 通过真实规范、单一合同来源和更稳定的模块边界，让后续重构和功能迭代更可控。

## 当前判断

当前仓库已经具备一些明显的 AI 友好基础：

- `src/main`、`src/preload`、`src/renderer`、`src/shared` 的大层分隔清楚。
- IPC channel、主进程 service、测试目录已经形成基本结构。
- `.trellis/` 工作流、任务、PRD、workspace 机制已经为 AI 会话提供了入口。

当前主要瓶颈也比较明确：

- `.trellis/spec/frontend/*.md` 全部 7 个文件仍为空壳模板（内容均为 `(To be filled by the team)`），AI 无法从中获取任何项目真实规范。
- 前端出现大量超大上下文文件，局部修改风险极高。按行数排列前 10：
  - `useTaskDetail.tsx` — 2288 行
  - `WorkflowTemplateDialog.tsx` — 2125 行
  - `MCPSettings.tsx` — 1788 行
  - `codex-log-model.ts` — 1534 行
  - `RightPanel.tsx` — 1158 行
  - `ArtifactPreview.tsx` — 1025 行
  - `AgentCLISettings.tsx` — 961 行
  - `DatabaseService.ts` — 873 行
  - `GitService.ts` — 822 行
  - `VirtualComputer.tsx` — 807 行
  - 全项目共 68 个文件超过 300 行。
- `src/shared/` 仅有 3 个文件且只覆盖 CLI 工具配置（`agent-cli-config-spec.ts`、`system-cli-tools.ts`、`agent-cli-tool-enablement.ts`）。核心业务 DTO（Task、WorkflowRun、Automation 等）在 `src/main/types/` 和 renderer 侧各自独立定义，存在重复和语义漂移。
- `preload/index.ts`（494 行）+ `index.d.ts`（549 行）是两个涵盖所有域的巨型文件，且 `renderer` 侧 `data/adapter.ts`、`lib/electron-api.ts`、`lib/notifications.ts`（529 行）、`lib/session.ts`（534 行）等数据适配和副作用文件体量持续增长。
- `DatabaseService.ts`（873 行）同时承担仓储协调、workflow 生成运行时注入、调度器绑定等多类职责。
- renderer 侧不存在 `features/` 目录，所有业务逻辑分散在 `pages/`、`components/`、`hooks/`、`lib/`、`data/` 中。

## 目标状态

改造完成后，希望仓库具备以下特征：

- AI 能通过规范文档快速判断"代码应该放在哪里、怎么写、如何验证"。
- 跨层实体和 IPC 合同由单一来源维护，不再在多个目录重复定义。
- 页面壳、业务 feature、基础组件、纯工具函数的职责稳定，不再互相渗透。
- 主进程中的持久化、运行时编排、IPC 转发三类职责明确分离。
- 高复杂度域可以按统一模板继续拆分，而不是每次重新摸索结构。
- 单文件行数控制在 500 行以内，单 hook 只承担单一职责。

## 改造原则

- 行为尽量不变，优先做结构收敛和职责调整。
- 先兼容、后切换、最后删除旧层，避免一次性大爆炸替换。
- 优先处理复杂度最高、最影响 AI 理解效率的模块。
- 新规范必须基于现有代码现实，而不是理想化设计。

## 分阶段改造计划

### 阶段 1：补齐真实开发规范

目标：先补齐"AI 说明书"，减少后续重构中的风格漂移。

- 完整填充 `.trellis/spec/frontend/` 下的目录结构、组件、hooks、状态管理、类型安全、质量规范文档。
- 所有规范都引用当前代码中的真实示例，不写脱离代码现实的约定。
- 在规范中明确新增硬性边界：
  - `pages` 只做路由入口和装配。
  - `features` 承载业务 UI、业务状态、view-model 和用例组织。
  - `components/ui` 只放纯复用基础组件。
  - `lib` 只放纯函数和无业务状态工具。
  - `data/` 只放纯 client 调用层，不混入副作用。
- 在规范中明确禁止模式：
  - UI 组件直接访问 `window.api`
  - 页面文件直接承担业务状态编排
  - 重复定义跨层 DTO
  - 单个 hook 混合数据加载、派生、动作控制和副作用
  - 单文件超过 500 行（新增或修改时必须拆分）

### 阶段 2：收敛 shared / main / renderer 合同

目标：把跨层类型和 IPC 合同统一成单一来源。

#### 2a. shared 合同统一

- 在 `src/shared` 下按域建立 contract 模块，统一维护：
  - `contracts/task.ts`
  - `contracts/workflow.ts`
  - `contracts/automation.ts`
  - `contracts/cli-session.ts`
  - `contracts/project.ts`
  - `contracts/notification.ts`
- IPC channel 字符串保持不变，优先降低迁移风险。
- `main` 和 `renderer` 都从 shared 合同中引用 DTO、事件 payload 和请求响应类型。
- renderer 侧移除本地重复的 `Task`、`WorkflowRun`、`Automation` 等跨层实体定义。

#### 2b. preload 按域拆分

- `preload` 从单文件改成按域组织的薄桥接层，只负责透传、解包、订阅事件，不承担业务整形：
  - 按域拆分为独立文件：`projects.ts`、`git.ts`、`cli-session.ts`、`task.ts`、`workflow.ts`、`automation.ts`、`settings.ts`、`terminal.ts` 等。
  - 每个域文件只导出该域的 `invoke` 封装和事件订阅函数。
  - `preload/index.ts` 缩减为纯装配入口：导入各域模块，统一注册到 `contextBridge.exposeInMainWorld`。
  - `preload/index.d.ts` 的类型声明从 shared contract 派生，不再手工维护独立的 `window.api` 类型。可通过 `export type` 从 `src/shared/contracts/` 重新导出，确保类型单一来源。
  - 目标：`preload/index.ts` 降至 100 行以内，各域文件控制在 50 行以内。

### 阶段 3：拆 renderer 数据访问与副作用职责

目标：让数据访问层重新变成"可预测的 client 层"。

#### 3a. renderer `data/` 层定位与迁移

当前 `src/renderer/src/data/` 包含 `adapter.ts`、`projects.ts`、`types.ts`、`index.ts` 以及 `settings/` 子目录。迁移策略：

- `data/` 目录重新定位为 **纯 client 调用层**，只负责封装 `window.api` 调用并返回结果，不混入副作用。
- `data/settings/` 保留在 `data/` 中，因为它是跨 feature 的基础配置数据源。
- `data/adapter.ts` 中的 IPC 调用封装保留；其中混入的通知、声音、广播等副作用抽离到对应 feature 的 usecase 层。
- `data/types.ts` 中的跨层类型迁移到 `src/shared/contracts/`，本地仅保留 renderer 专用的 view 类型。

#### 3b. `lib/` 大文件归属与拆分

`lib/` 目录按规范只存放纯函数和无业务状态工具，但当前有多个文件已偏离：

| 文件 | 行数 | 处理方式 |
|------|------|----------|
| `lib/notifications.ts` | 529 | 通知触发属于应用副作用，迁出到独立的 `notifications` feature 或 `providers/` 中的通知 provider |
| `lib/session.ts` | 534 | 会话状态管理包含业务逻辑，迁出到 `features/cli-session/` |
| `lib/providers.ts` | 425 | CLI provider 配置属于业务知识，迁出到 `features/agent/` 或 `data/` |
| `lib/electron-api.ts` | 318 | 保留在 `lib/`，但仅作为 `window.api` 的类型安全薄封装 |

其余 `lib/` 文件（`utils.ts`、`ids.ts`、`paths.ts`、`task-status.ts` 等）符合纯工具定位，保留不动。

#### 3c. 数据访问层职责拆分

- 将当前 renderer 侧的适配层明确拆成两类模块：
  - 纯 client 调用层（`data/`）：只发请求、只返回结果
  - 应用副作用层：通知、任务变更广播、声音、界面联动 — 归入对应 feature 的 usecase
- 禁止在基础数据 client 中混入通知触发、页面行为耦合和派生状态逻辑。
- 在 feature 内部建立面向页面的 usecase 或 service，承接原先散落在页面、hook、adapter 中的业务流程。

### 阶段 4：前端从页面中心切换到 feature 中心

目标：把高复杂度前端逻辑从页面壳中拆出，形成稳定 feature 边界。

#### 4a. 第一批试点（阶段 4 核心）

- 保留 `pages` 作为路由壳和装配层。
- 新增 feature 层，并优先迁移以下高复杂度域：
  - `task-detail`
  - `cli-session`
  - `workflow-definition`
- `task-detail` 作为首个试点，拆成固定职责模块：
  - 任务运行时加载
  - workflow 状态选择
  - Codex 日志与轮次聚合
  - 产物提取
  - 用户动作控制
  - 页面 view-model 组装
- 页面组件只消费 view-model，不直接拼 IPC 结果或写跨层数据流程。
- 超大 hook 不再继续扩展；每个 hook 只负责单一稳定职责。

#### 4b. 第二批 feature 化候选

试点完成并形成稳定模板后，按复杂度和膨胀风险排序推进第二批：

| 候选域 | 涉及大文件 | 合计行数 | 优先级理由 |
|--------|-----------|---------|-----------|
| `settings` | `MCPSettings.tsx`(1788)、`AgentCLISettings.tsx`(961)、`CLIToolsSettings.tsx`(544)、`DataSettings.tsx`(599)、`SkillsSettings.tsx`(499)、`SoundSettings.tsx`(430) | ~4800 | 文件数最多、总行数最大，且散布在 `components/settings/tabs/` 下缺乏 feature 边界 |
| `pipeline` | `WorkflowTemplateDialog.tsx`(2125)、`PipelineTemplatesPage.tsx`(237)、`WorkflowTemplateEditorPage.tsx`(205) | ~2500 | 包含全项目第二大文件，编辑频率高 |
| `skills` | `SkillsPage.tsx`(650) | 650 | 页面直接承担全部业务逻辑，违反 page/feature 分离 |
| `artifacts` | `ArtifactPreview.tsx`(1025)、辅助预览组件若干 | ~1700 | 预览类型持续增长，需要稳定的扩展模板 |

第二批不强制与第一批同步启动，但应在第一批模板验证通过后尽快推进，避免这些文件继续膨胀。

### 阶段 5：主进程 service 去耦与装配重组

目标：把持久化、运行时编排和 IPC 转发的边界重新拉清楚。

- `DatabaseService` 回归"持久化聚合服务"职责，只负责 repository 协调、事务边界和数据映射。
- workflow 生成、prompt 优化、scheduler、automation run 等运行时行为迁移到独立 runtime/domain service。
- `create-app-context.ts` 从平铺式实例化改成按域装配：
  - 项目 / Git
  - CLI / Session
  - Task / Workflow
  - Automation / Notification
- IPC 层保持薄转发，统一做参数校验、调用转发和错误映射。
- 禁止在 IPC handler 中继续累积业务逻辑。

### 阶段 6：清理兼容层并建立长期守卫

目标：在迁移完成后收口，避免旧结构继续反弹。

- 删除迁移期间保留的重复导出、旧 DTO 和临时兼容适配层。
- 补充约束检查：
  - 禁止 feature UI 直接引入 `window.api`
  - 禁止 renderer 再新增重复跨层 DTO
  - 禁止超大聚合 hook 继续无边界增长
  - 禁止单文件超过 500 行
- 将新的目录与职责规则固化到 `.trellis/spec/frontend/` 中，作为后续 AI 与人工开发共同遵守的标准。

## 优先级与实施顺序

建议固定按以下顺序推进，避免同时动太多层：

1. 先补 `.trellis/spec/frontend/` 真实规范
2. 再统一 `src/shared` 合同与 `preload` 按域拆分
3. 接着拆 renderer `data/` 与 `lib/` 的数据访问层副作用
4. 然后以 `task-detail` 为试点做第一批 feature 化迁移
5. 第一批试点验证后推进第二批（settings / pipeline / skills / artifacts）
6. 收敛主进程 service 与装配方式
7. 完成后删除兼容层并补架构守卫

## 对外接口与类型策略

- 现有 `window.api` 的顶层域名保持兼容，降低一次性替换成本。
- 现有 IPC channel 字符串保持兼容，避免前后端同时大面积改动。
- 新增类型只在两个地方存在：
  - `src/shared`：跨层公共合同
  - feature 内部：仅用于页面展示和 view-model 的本地类型
- 不引入新的全局状态库，也不额外引入新的 schema 库，本轮优先通过结构调整解决问题。

## 验证与验收

每个阶段完成后都应执行：

```bash
pnpm lint && pnpm typecheck && pnpm test
```

### 量化验收标准

| 指标 | 目标值 | 检查方式 |
|------|--------|----------|
| 单文件最大行数 | ≤ 500 行（新增/修改的文件） | `wc -l` |
| 单 hook 职责数 | 1 个（数据加载 / 派生 / 动作 / 副作用不混合） | 代码审查 |
| `src/shared/contracts/` 覆盖域数 | ≥ 6（task / workflow / automation / cli-session / project / notification） | 文件检查 |
| `preload/index.ts` 行数 | ≤ 100 行 | `wc -l` |
| `preload/` 各域文件行数 | ≤ 50 行 | `wc -l` |
| renderer 侧重复跨层 DTO | 0 个 | `grep` + 类型审查 |
| `.trellis/spec/frontend/` 空模板文件 | 0 个 | 内容检查 |
| `DatabaseService.ts` 行数 | ≤ 500 行 | `wc -l` |

### 功能验收场景

- 任务创建、workflow run 创建和 task node 生命周期行为保持不变。
- Codex/CLI 会话的历史回放和实时输出行为不退化。
- 任务详情页、workflow 模板编辑、自动化与设置页关键路径不受影响。
- shared 合同修改能够同时约束 main 与 renderer，避免双边类型漂移。
- 新增 feature 或页面时，开发者可以直接依据规范判断代码落点和职责边界。

## 风险与控制

- 风险：一次改太多目录和类型，容易引入迁移期兼容问题。
  - 控制：采用"先兼容、后切换、最后删除旧层"的节奏。
- 风险：前端 feature 化过程中，页面状态和运行时状态可能短期混乱。
  - 控制：先选 `task-detail` 作为试点，形成稳定模板后再推广。
- 风险：shared 合同收敛时，可能暴露已有字段语义不一致问题。
  - 控制：先统一命名与归属，不在同一步里重设计业务字段。
- 风险：`preload/index.d.ts` 与 shared contract 的类型同步可能产生新的漂移源。
  - 控制：`index.d.ts` 的类型必须从 `src/shared/contracts/` 派生（`export type`），不允许手工维护独立类型定义。阶段 2 完成时验证 `index.d.ts` 中无自定义 DTO。
- 风险：第二批候选大文件（`WorkflowTemplateDialog.tsx` 2125 行、`MCPSettings.tsx` 1788 行等）在等待 feature 化期间继续膨胀。
  - 控制：阶段 1 完成后立即启用"单文件 ≤ 500 行"的增量约束 — 新增或修改时必须拆分，不允许向超大文件追加代码。

## 本方案默认假设

- 本轮不改数据库 schema。
- 本轮不改 IPC channel 字符串。
- 本轮不优先做用户可见的交互重设计。
- 本轮把"AI 协作效率"和"结构可维护性"放在第一优先级。
- `task-detail` 是首个前端试点模块，也是后续拆分模板的来源。
- 单文件 500 行上限适用于新增和修改场景，历史存量文件通过 feature 化过程逐步消化。
