# Agent 产品使用逻辑与操作流程

本文基于当前 [agent brainstorm PRD](../.trellis/tasks/04-01-04-01-agent-profile-workflow/prd.md) 整理，目标是把最终产品的用户使用逻辑、操作流程和运行边界可视化，便于后续进入数据模型和 UI 设计。

## 1. 产品心智模型

用户不应该感知自己在配置底层 CLI，而应该感知自己在定义和使用“专家 Agent”。

```mermaid
flowchart TB
  subgraph Asset["资产层"]
    RP["AgentToolConfig<br/>运行配置 / Runtime Profile"]
    SK["Skills<br/>显式绑定"]
    AG["Agent<br/>业务能力单元"]
  end

  subgraph Entry["使用入口"]
    CT["Conversation Task"]
    WN["Workflow Node"]
    MM["Manual Mode<br/>手动 CLI/Profile/Prompt"]
  end

  subgraph Run["运行层"]
    SNAP["Run Snapshot<br/>冻结本次运行配置"]
    EXEC["CLI Session / Workflow Run"]
  end

  RP --> AG
  SK --> AG

  AG --> CT
  AG --> WN

  MM --> CT
  MM --> WN

  CT --> SNAP
  WN --> SNAP
  SNAP --> EXEC
```

对应的产品逻辑是：

- `AgentToolConfig` 是底层 runtime profile，不是用户主概念。
- `Agent` 才是用户真正复用的“专家”。
- `Conversation` 和 `Workflow` 都可以引用 Agent。
- 一旦开始运行，就会创建 `Run Snapshot`。
- 历史运行是否可复现，取决于 snapshot 是否足够完整。

## 2. 用户角色与职责

```mermaid
flowchart LR
  A["高级用户 / 管理者"] --> B["创建和发布 Agent"]
  C["普通用户"] --> D["选择 Agent 使用"]
  B --> D
  D --> E["Conversation Task"]
  D --> F["Workflow Node"]
```

产品上默认存在两类用户：

- 高级用户负责沉淀和维护 Agent 资产。
- 普通用户直接消费 Agent，不需要理解底层 CLI 参数。

## 3. Agent 创建与发布流程

这是资产配置流程，不是运行流程。

```mermaid
flowchart TD
  S["进入 Agent Library"] --> A["新建 Agent"]
  A --> B["选择 Scope<br/>Global 或 Project"]
  B --> C["填写名称 / 描述 / 分类"]
  C --> D["选择 Runtime Profile<br/>引用 AgentToolConfig"]
  D --> E["绑定 Skills"]
  E --> F["编写 Agent Prompt"]
  F --> G["保存为 Draft"]
  G --> H["测试 / 校验"]
  H --> I["Publish"]
  I --> J["成为可被任务 / 工作流引用的 Agent"]
```

第一版推荐的资产侧操作顺序：

1. 创建 Agent。
2. 选择作用域。
3. 绑定 runtime profile。
4. 绑定 skills。
5. 编写 Agent prompt。
6. 保存草稿并发布。

## 4. Conversation 的用户使用流程

这是普通用户最直接的使用路径。

```mermaid
sequenceDiagram
  participant U as 用户
  participant D as Deskly
  participant A as Published Agent
  participant S as Run Snapshot
  participant C as CLI Session

  U->>D: 新建 Conversation Task
  D->>U: 选择模式<br/>Agent Mode 或 Manual Mode
  U->>D: 选择 Agent
  U->>D: 输入当前任务需求(task prompt)
  D->>A: 读取最新已发布 Agent
  D->>S: 生成本次运行快照
  Note over D,S: 固化 agent revision + runtime profile + skills snapshot
  D->>C: 启动会话
  Note over D,C: Agent 角色配置持续生效<br/>task prompt 只描述本次需求
  U->>C: 后续追问 / 补充要求
  C-->>U: 连续回复
```

这里最关键的逻辑是：

- 用户输入的是当前需求，不是“你要扮演谁”。
- Agent 定义角色边界和可用能力。
- 后续 conversation 继续沿用同一个会话和同一个 Agent 身份。

## 5. Workflow 的用户使用流程

这是编排型使用路径。

```mermaid
flowchart TD
  A["打开 Workflow Editor"] --> B["新增 Agent Node"]
  B --> C["为节点选择 Agent"]
  C --> D["填写 Step Prompt<br/>定义本步骤职责"]
  D --> E["保存 Workflow Template"]
  E --> F["创建运行任务"]
  F --> G["输入整体 Task Prompt"]
  G --> H["系统解析每个节点引用的最新 Published Agent"]
  H --> I["生成 Workflow Run Snapshot"]
  I --> J["按节点执行"]
```

Workflow 场景下三层分工应该很清楚：

- Agent 定义“这个节点是谁”。
- Step Prompt 定义“这个节点这一步干什么”。
- Task Prompt 定义“这次整体任务是什么”。

## 6. Prompt 组合规则

第一版的 prompt 组合顺序如下：

```mermaid
flowchart LR
  AG["Agent Prompt<br/>稳定角色定义"] --> P["最终节点 Prompt"]
  SP["Step Prompt<br/>本步骤职责"] --> P
  TP["Task Prompt<br/>本次实例需求"] --> P
  P --> RUN["执行当前节点"]
```

解释：

- `Agent Prompt` 负责长期稳定角色。
- `Step Prompt` 负责 workflow 节点的局部职责。
- `Task Prompt` 负责这次实例化请求。

Conversation 中通常没有 `Step Prompt`，但同样遵守 “Agent 在前，Task 在后” 的原则。

## 7. Agent 更新后的生效边界

这个流程决定“共享能力资产”是否可控。

```mermaid
flowchart TD
  A["编辑 Agent Draft"] --> B["Publish 新 Revision"]
  B --> C["未来新建的 Conversation / Workflow Run"]
  B --> D["已有模板继续引用最新 Published Agent"]
  C --> E["生成新的 Run Snapshot"]
  E --> F["按新 Revision 运行"]

  G["历史已创建的 Run Snapshot"] --> H["继续保留原配置"]
```

推荐的产品语义：

- 模板默认引用最新的已发布 Agent。
- 历史运行不回写，不受未来发布影响。
- Draft 不应直接影响未来运行。

## 8. Scope 可见性与引用规则

### 8.1 用户可见性

```mermaid
flowchart TD
  A["当前是否在项目上下文内?"] -->|否| B["只能看到 Global Agent"]
  A -->|是| C["看到 Global Agent + 当前项目的 Project Agent"]
```

### 8.2 引用约束矩阵

| 使用场景 | 可引用 Global Agent | 可引用当前项目 Agent | 可引用其他项目 Agent |
| --- | --- | --- | --- |
| 无项目上下文的 conversation | Yes | No | No |
| 项目内 conversation | Yes | Yes | No |
| Global workflow | Yes | No | No |
| Project workflow | Yes | Yes | No |

这张矩阵的目的，是防止作用域穿透和模板在错误上下文里变成不可执行状态。

## 9. 与旧模式的并存关系

第一版不替代旧入口，而是新增高层入口。

```mermaid
flowchart LR
  START["新建 Task / 编辑 Workflow Node"] --> CHOICE{"选择使用方式"}
  CHOICE -->|推荐| AGENT["Agent Mode"]
  CHOICE -->|高级 / 兼容| MANUAL["Manual Mode"]
  AGENT --> RUN1["按 Agent 运行"]
  MANUAL --> RUN2["按 CLI/Profile/Prompt 直接运行"]
```

产品含义：

- 普通用户优先走 `Agent Mode`。
- 高级用户仍可使用手动模式。
- 第一版可以渐进引导，而不是强制替换。

## 10. 端到端操作流程

### 10.1 先创建 Agent，再让别人使用

```mermaid
flowchart TD
  A["高级用户创建 Agent"] --> B["发布 Agent"]
  B --> C["普通用户创建 Task"]
  C --> D["选择 Agent"]
  D --> E["输入本次需求"]
  E --> F["开始运行"]
```

### 10.2 普通用户直接发起对话

```mermaid
flowchart TD
  A["新建任务"] --> B["选择 Agent Mode"]
  B --> C["选择项目"]
  C --> D["选择 Agent"]
  D --> E["输入当前需求"]
  E --> F["启动 Conversation"]
  F --> G["持续追问 / 补充素材 / 调整输出"]
```

### 10.3 在 Workflow 中编排多个专家

```mermaid
flowchart TD
  A["打开 Workflow Editor"] --> B["节点 1 选择 Agent A"]
  B --> C["节点 2 选择 Agent B"]
  C --> D["节点 3 选择 Agent C"]
  D --> E["分别填写 Step Prompt"]
  E --> F["保存 Workflow"]
  F --> G["运行时输入整体 Task Prompt"]
  G --> H["系统为每个节点生成 Snapshot"]
  H --> I["按节点执行"]
```

## 11. 第一版 UI 信息架构建议

```mermaid
flowchart TB
  APP["Deskly"] --> LIB["Agent Library"]
  APP --> TASK["Create Task"]
  APP --> WF["Workflow Editor"]
  APP --> DETAIL["Task / Run Detail"]

  LIB --> LIB1["创建 / 编辑 / 发布 Agent"]
  TASK --> TASK1["Agent Mode"]
  TASK --> TASK2["Manual Mode"]
  WF --> WF1["节点选择 Agent"]
  WF --> WF2["节点填写 Step Prompt"]
  DETAIL --> DETAIL1["显示 Agent 名称 / Revision / Snapshot"]
```

## 12. 最终产品一句话总结

```mermaid
flowchart LR
  A["定义专家"] --> B["发布专家"]
  B --> C["在任务或工作流里调用专家"]
  C --> D["运行时冻结快照执行"]
```

最终用户体验不应该是“我在配 CLI”，而应该是：

**我在定义专家、发布专家、调用专家，然后系统按本次快照执行。**
