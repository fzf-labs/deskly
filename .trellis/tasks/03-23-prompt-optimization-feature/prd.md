# brainstorm: prompt optimization feature

## Goal

为 Deskly 增加一个“优化提示词”的通用能力：复用现有 agent CLI runtime，让系统能把用户输入的原始 prompt 优化成更清晰、更可执行、更适合目标 CLI 的版本，并且这项能力可以被多个需要编辑 prompt 的入口复用，而不是只写死在单一页面里。

## What I already know

* 当前仓库已经有一条“用现有 agent CLI 做一次性结构化生成”的成熟路径，不需要从零新建模型调用栈。
* 已落地的相似实现是工作流 DAG 生成：
  * renderer 入口在 `src/renderer/src/components/pipeline/WorkflowTemplateDialog.tsx`
  * renderer -> main 调用链是 `src/renderer/src/data/adapter.ts` -> `src/main/ipc/workflow.ipc.ts` -> `src/main/services/DatabaseService.ts` -> `src/main/services/WorkflowDefinitionGenerationService.ts`
  * `WorkflowDefinitionGenerationService` 已经支持：
    * `CliSessionService.runOneShotSession(...)`
    * 针对不同 CLI 注入系统提示词和 schema
    * 从 Claude/Codex 输出里提取 JSON
    * 统一做 normalize + validate + fallback
* `CliSessionService` 已经有可复用的一次性短生命周期执行能力：
  * `runOneShotSession({ toolId, workdir, prompt, timeoutMs, toolConfig })`
  * 会复用现有 CLI 配置归一化逻辑和工具启用状态检查
* 当前仓库里与 prompt 编辑直接相关、适合后续接入“优化提示词”的入口至少有这些：
  * 新建任务对话框 `src/renderer/src/components/task/CreateTaskDialog.tsx`
  * 任务详情中的编辑提示词对话框 `src/renderer/src/pages/task-detail/components/TaskDialogs.tsx`
  * 工作流编辑器里的“根据目标生成”输入框 `src/renderer/src/components/pipeline/WorkflowTemplateDialog.tsx`
  * 工作流节点的 agent prompt 编辑区 `src/renderer/src/components/pipeline/WorkflowTemplateDialog.tsx`
  * 自动化规则表单里的任务提示词 `src/renderer/src/pages/automations/components/AutomationFormDialog.tsx`
* 当前 renderer 侧的数据调用模式是手写 async + loading/error，本仓库没有引入额外状态库；如果加优化能力，最好继续复用这种模式，而不是引入全局状态或新的请求框架。
* 当前 frontend spec 要求：
  * IPC 边界要显式 typed 且防御式收敛
  * 异步 UI 必须有 loading/error 反馈
  * 优先复用现有抽象，不要为相似场景复制逻辑

## Assumptions (temporary)

* 第一版“优化提示词”是帮助用户改写/增强 prompt 文本，不直接自动执行任务。
* 第一版输出应以“单个优化后的 prompt 文本”为主，最多附带少量解释，不做复杂多段结构编辑器。
* 第一版应优先支持 agent prompt 类场景，而不是命令行 command 文本优化。
* 第一版会复用用户当前选择的 CLI / CLI 配置；如果当前页面没有显式选中 CLI，则按现有默认 CLI 选择逻辑处理。
* 第一版不引入对话式多轮优化，而是一次点击、一次生成、一次接受或取消。

## Open Questions

* 暂无阻塞性开放问题。

## Requirements (evolving)

* 系统必须提供一个可复用的 prompt optimization 能力，而不是把逻辑写死在某个页面组件里。
* 该能力必须复用现有 agent CLI runtime，而不是新增 direct provider client。
* 该能力应支持至少 Claude/Codex 这类当前已有结构化生成经验的 CLI 工具。
* 该能力必须允许调用方传入上下文，以便针对不同场景优化：
  * 场景类型，例如 task / workflow-generation / workflow-node / automation
  * 原始 prompt 文本
  * 可选的标题/名称
  * 可选的目标 CLI 与配置
* 第一版优化结果必须可被页面安全接收：
  * 成功时可回填到 textarea 或编辑态
  * 失败时保留原始 prompt，不覆盖用户输入
  * 有明确错误反馈
* 第一版接口设计需要为后续扩展预留空间：
  * 支持返回 explanation / suggestedTitle / warnings 等附加字段
  * 支持未来基于不同场景定制优化策略
* 第一版应避免“黑盒自动覆盖”：
  * 用户应能看到优化结果并决定是否采用
  * 不应在后台静默改写用户 prompt

## Acceptance Criteria (evolving)

* [x] 明确复用现有 CLI runtime 的可行性与主要复用点
* [x] 明确至少 4 个后续可接入的 prompt 编辑入口
* [x] 明确 MVP 的产品形态与首个接入点
* [x] 明确通用 service / IPC / renderer 复用边界
* [x] 明确优化结果的数据结构与失败行为
* [x] 明确首版是否包含“一键替换”之外的预览/差异能力

## Definition of Done (team quality bar)

* 通用能力能映射到现有 renderer -> preload -> IPC -> main service -> CLI runtime 链路
* 新增接口在 IPC 边界上类型明确，renderer 只消费收敛后的结果
* 至少一个真实入口完成接入，并验证 loading / error / replace 流程
* 实现复用良好，后续接第二个入口时不需要复制核心调用逻辑
* lint / typecheck 通过，并完成相关手动验证

## Out of Scope (explicit)

* 第一版不做 prompt 历史版本管理
* 第一版不做多轮对话式 prompt coaching
* 第一版不做 command 文本的复杂重写或 shell 安全校验
* 第一版不做模型质量评分、A/B 对比或自动评测
* 第一版不做“自动在所有入口同时铺开”的大范围 UI 改造，除非 MVP 范围明确要求

## Technical Notes

* 可复用 CLI 执行入口：
  * `src/main/services/cli/CliSessionService.ts`
* 已有相似 AI 结构化能力：
  * `src/main/services/WorkflowDefinitionGenerationService.ts`
  * `src/main/services/workflow-generation-prompt.ts`
* 现有 workflow 生成 IPC：
  * `src/main/ipc/workflow.ipc.ts`
  * `src/main/services/DatabaseService.ts`
  * `src/renderer/src/data/adapter.ts`
* 当前 prompt 编辑入口：
  * `src/renderer/src/components/task/CreateTaskDialog.tsx`
  * `src/renderer/src/pages/task-detail/components/TaskDialogs.tsx`
  * `src/renderer/src/components/pipeline/WorkflowTemplateDialog.tsx`
  * `src/renderer/src/pages/automations/components/AutomationFormDialog.tsx`
* 当前仓库 spec/guides 对本任务的主要约束：
  * `.trellis/spec/frontend/type-safety.md`
  * `.trellis/spec/frontend/hook-guidelines.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
  * `.trellis/spec/guides/cross-layer-thinking-guide.md`
  * `.trellis/spec/guides/code-reuse-thinking-guide.md`

## Research Notes

### What similar capability already exists here

* 仓库已经证明了“业务 service 组装专用 prompt + schema + 调用 CLI 一次性会话 + 解析结果 + 统一校验”这条模式是成立的。
* `WorkflowDefinitionGenerationService` 本质上已经是一个“AI assisted authoring service”，只是当前产物是 workflow DAG，而不是优化后的 prompt 文本。
* 因此 prompt optimization 更像是在这个模式上再抽一层通用 authoring capability，而不是另起炉灶。

### Constraints from our repo/project

* 现有 CLI 工具能力并不完全一致，所以第一版最好继续优先支持已经验证过结构化输出的工具组合，而不是承诺“所有 CLI 工具都一致可用”。
* Prompt 编辑入口分散在多个 renderer 组件里，如果直接在每个页面里各写一套请求和按钮逻辑，很容易很快失控。
* 当前项目对异步 UI 的约束很明确：必须有 loading/error，且 IPC 边界类型要稳。
* 由于未来很可能接入多个入口，核心逻辑最好沉到 main service + adapter API，renderer 只做场景参数拼装和结果展示。

### Feasible approaches here

**Approach A: 先做通用后端能力 + 单入口接入** (Recommended)

* How it works:
  * 在 main 层新增通用 `optimizePrompt(...)` service
  * 复用 `CliSessionService.runOneShotSession(...)`
  * 设计结构化返回，例如 `{ optimizedPrompt, summary?, warnings? }`
  * renderer 先只在一个入口接入，例如 workflow node prompt 或 task prompt
* Pros:
  * 架构最干净，后续扩展到多个入口成本最低
  * 能尽快验证 prompt optimization 的质量与交互
  * 风险可控，首版改动范围小
* Cons:
  * 第一版用户能看到的覆盖面有限
  * 还需要第二步再把能力接到更多入口

**Approach B: 先在工作流编辑器内做完整闭环**

* How it works:
  * 把 prompt optimization 先作为 workflow 编辑器的专属能力
  * 同时覆盖“根据目标生成”的 goal prompt 和单个 agent 节点 prompt
  * 暂不抽成完全通用的跨页面 API
* Pros:
  * 与已有 workflow generation 路径最接近，复用上下文最多
  * 用户可见价值更集中，体验闭环更完整
* Cons:
  * 容易把实现绑死在 workflow 语义里
  * 后续推广到 task / automation 时可能需要回头抽象

**Approach C: 一次把多个入口统一做出来** (Selected)

* How it works:
  * 抽通用 service，同时在 task create、task edit、workflow、automation 等多个入口都加“优化提示词”按钮
* Pros:
  * 用户感知最强
  * 一次性建立统一交互语言和入口样式
* Cons:
  * 首版改动面太大，测试成本高
  * 交互细节很容易在不同表单里分叉
  * 一旦底层结果结构还不稳定，会放大返工成本

## Expansion Sweep

### Future evolution

* 后续很可能不只是“优化一句 prompt”，而是“按场景生成更适配特定 CLI 的 prompt 模板”。
* 如果第一版把场景类型设计好，后面可以扩展到“解释为什么这样改”“给出多个候选版本”“针对不同模型风格优化”。

### Related scenarios

* workflow generation、workflow node agent prompt、task prompt、automation prompt 本质上都是“用户写 prompt，系统帮忙增强”的同类问题。
* 如果这些入口最后交互不一致，用户会困惑什么地方能优化、优化后会不会自动覆盖。

### Failure & edge cases

* 未配置或未启用 CLI、CLI 不可用、超时、结构化解析失败、返回空文本。
* 用户在优化过程中继续编辑 textarea，需避免异步结果覆盖较新的输入。
* 不同场景下若没有显式 CLI 选择，默认选用哪个 CLI 需要规则清晰。

## Technical Approach

* 倾向于新增一条通用 prompt optimization 调用链：
  * renderer: `db.optimizePrompt(input)`
  * IPC: `workflow` 旁边新增独立 channel，或落在更通用的 `ai authoring` channel
  * main: `PromptOptimizationService`
  * runtime: `CliSessionService.runOneShotSession(...)`
* 返回值建议至少包含：
  * `optimizedPrompt: string`
  * `summary?: string | null`
  * `warnings?: string[]`
* 调用输入建议包含：
  * `prompt: string`
  * `contextType: 'task' | 'workflow-generation' | 'workflow-node' | 'automation'`
  * `name?: string | null`
  * `toolId?: string | null`
  * `agentToolConfigId?: string | null`
* renderer 侧交互建议首版采用：
  * 点击“优化提示词”
  * 显示 loading
  * 返回结果后让用户确认“替换当前内容”或“取消”
* 本次实现采用多入口首版：
  * `CreateTaskDialog` 任务创建 prompt
  * `TaskDialogs` 任务编辑 prompt
  * `WorkflowTemplateDialog` 的 workflow goal prompt
  * `WorkflowTemplateDialog` 的 agent 节点 prompt
  * `AutomationFormDialog` 自动化任务 prompt
* 首版不做 diff/双栏预览，采用“summary/warnings + confirm replace”交互。
