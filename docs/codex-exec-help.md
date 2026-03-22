# Codex Exec 参数说明

本文基于本机在 2026-03-22 执行 `codex exec --help` 的输出整理，目标是用中文解释 `codex exec` 中每个参数的含义、作用和常见示例，方便在 Deskly 中配置和排查。

## 命令定位

`codex exec` 用于非交互式运行 Codex。

典型场景：

- 在脚本里调用 Codex
- 在 CI 或自动化任务中调用 Codex
- 在 Deskly 这类上层工具中，把一次任务作为单次执行交给 Codex

基础用法：

```bash
codex exec [OPTIONS] [PROMPT] [COMMAND]
```

说明：

- `[PROMPT]` 是给 Codex 的任务说明。
- help 输出里出现了 `[COMMAND]`，但当前帮助文本没有进一步解释这个位置参数的具体语义。实际使用里更常见的是直接传 `PROMPT`。

示例：

```bash
codex exec "帮我总结当前仓库的测试失败原因"
```

## 子命令

### `resume`

含义：
恢复一个已有的 `codex exec` 会话。

作用：
当上一次任务执行到一半，或者你希望延续之前的上下文时使用。

示例：

```bash
codex exec resume
```

### `review`

含义：
对当前仓库执行一次非交互式代码审查。

作用：
适合做自动化 review、快速风险检查、批量扫描变更。

示例：

```bash
codex exec review
```

### `help`

含义：
查看 `codex exec` 自身或其子命令的帮助信息。

作用：
当你不确定参数写法、子命令用法时，用它查看最新帮助。

示例：

```bash
codex exec help
```

## 位置参数

### `[PROMPT]`

含义：
本次执行给 Codex 的初始任务说明。

作用：
告诉 Codex 这次要做什么。可以是一句简单指令，也可以是一段较长需求。

补充：

- 如果没有直接写在命令里，或者写成 `-`，Codex 会从标准输入读取提示词。

示例：

```bash
codex exec "检查当前 Go 项目的编译错误并给出修复建议"
```

从标准输入传入：

```bash
echo "请根据 README 生成一份发布检查清单" | codex exec -
```

## 选项参数

### `-c, --config <key=value>`

含义：
临时覆盖 `~/.codex/config.toml` 中的某个配置项。

作用：
适合在不改全局配置文件的前提下，为当前这次执行单独指定配置。

补充：

- 支持点路径，例如 `reasoning.effort="high"`。
- `value` 会先按 TOML 解析；如果 TOML 解析失败，就按普通字符串处理。

示例：

```bash
codex exec -c 'reasoning.effort="high"' "分析这个模块的复杂度"
```

```bash
codex exec -c 'shell_environment_policy.inherit=all' "读取当前环境变量并说明影响"
```

### `--enable <FEATURE>`

含义：
启用某个功能开关。

作用：
适合临时打开某个实验特性或可选能力。

补充：

- 可重复传入多次。
- 等价于 `-c features.<name>=true`。

示例：

```bash
codex exec --enable my_feature "使用启用后的特性执行任务"
```

### `--disable <FEATURE>`

含义：
关闭某个功能开关。

作用：
适合临时禁用某个特性，验证行为差异或绕过实验功能。

补充：

- 可重复传入多次。
- 等价于 `-c features.<name>=false`。

示例：

```bash
codex exec --disable my_feature "在关闭该特性的情况下重新执行"
```

### `-i, --image <FILE>...`

含义：
给初始提示词附带一张或多张图片。

作用：
适合界面截图分析、视觉问题排查、图表解读、OCR 类任务。

示例：

```bash
codex exec -i ./screenshot.png "分析这个页面的布局问题"
```

### `-m, --model <MODEL>`

含义：
指定本次执行使用的模型。

作用：
在不同模型之间切换，用于平衡质量、速度和成本。

示例：

```bash
codex exec -m gpt-5.2-codex "重构这个函数并补上单元测试"
```

### `--oss`

含义：
使用开源本地 provider。

作用：
当你不想走云端模型，而是希望使用本地模型服务时使用。

补充：

- 通常会和 `--local-provider` 搭配使用。

示例：

```bash
codex exec --oss "使用本地模型总结当前目录结构"
```

### `--local-provider <OSS_PROVIDER>`

含义：
指定本地 provider。

作用：
在本地模型模式下，明确告诉 Codex 走哪个 provider。

当前 help 中提到的可选 provider：

- `lmstudio`
- `ollama`

示例：

```bash
codex exec --oss --local-provider ollama "读取项目结构并生成开发建议"
```

### `-s, --sandbox <SANDBOX_MODE>`

含义：
指定执行模型生成命令时的沙箱模式。

作用：
控制 Codex 在本机上的文件访问和命令执行边界。

可选值：

- `read-only`：只读，最安全，适合分析类任务
- `workspace-write`：允许写当前工作区，适合改代码
- `danger-full-access`：完全访问，风险最高

示例：

```bash
codex exec --sandbox read-only "只分析这个仓库，不要修改文件"
```

```bash
codex exec --sandbox workspace-write "修复当前目录中的 lint 错误"
```

### `-p, --profile <CONFIG_PROFILE>`

含义：
指定 `config.toml` 中的 profile。

作用：
如果你在 `~/.codex/config.toml` 里预设了多套配置，可以通过 profile 快速切换。

示例：

```bash
codex exec --profile work "检查当前项目中待处理的技术债"
```

### `--full-auto`

含义：
低摩擦自动执行模式的快捷开关。

作用：
适合希望减少人工干预、让 Codex 更顺畅完成任务时使用。

补充：

- help 明确说明它等价于：`-a on-request, --sandbox workspace-write`

示例：

```bash
codex exec --full-auto "修复这个仓库里最明显的类型错误"
```

### `--dangerously-bypass-approvals-and-sandbox`

含义：
跳过所有确认并关闭沙箱保护。

作用：
只适合外部环境已经完全隔离的场景，例如受控容器、一次性沙箱机。

风险：

- 风险非常高
- 会绕过审批
- 会绕过沙箱
- 不适合日常开发环境直接使用

示例：

```bash
codex exec --dangerously-bypass-approvals-and-sandbox "在受控容器内批量修改所有依赖版本"
```

### `-C, --cd <DIR>`

含义：
指定 Codex 执行时使用的工作根目录。

作用：
当你当前 shell 所在目录不是目标项目目录时，可以显式切换执行根目录。

示例：

```bash
codex exec -C /path/to/project "检查当前项目的未使用依赖"
```

### `--skip-git-repo-check`

含义：
允许在非 Git 仓库目录中运行 Codex。

作用：
适合临时目录、导出目录、纯文本目录等没有 `.git` 的场景。

示例：

```bash
codex exec --skip-git-repo-check "整理这个目录中的 Markdown 文档结构"
```

### `--add-dir <DIR>`

含义：
为 Codex 追加额外可写目录。

作用：
当主工作区之外还有其他目录需要一起读写时使用。

典型场景：

- 一个仓库主目录外还有共享配置目录
- 需要同时写入输出目录和源码目录

示例：

```bash
codex exec --add-dir /tmp/output "把生成结果同时写到当前项目和 /tmp/output"
```

### `--ephemeral`

含义：
以临时模式运行，不把会话文件持久化到磁盘。

作用：
适合一次性任务、敏感任务、或不想保留本地会话痕迹的场景。

示例：

```bash
codex exec --ephemeral "快速检查这个目录结构并给出建议"
```

### `--output-schema <FILE>`

含义：
指定一个 JSON Schema 文件，约束模型最终输出格式。

作用：
当你希望结果严格按固定 JSON 结构返回时非常有用，尤其适合自动化流水线。

示例：

```bash
codex exec --output-schema ./schema.json "按 schema 输出当前仓库的质量报告"
```

### `--color <COLOR>`

含义：
控制输出中的颜色行为。

作用：
在终端显示、日志重定向、CI 输出等场景中控制是否保留颜色。

可选值：

- `always`
- `never`
- `auto`

示例：

```bash
codex exec --color never "输出纯文本结果，方便写入日志文件"
```

### `--progress-cursor`

含义：
在 `exec` 模式下强制使用基于光标的进度更新方式。

作用：
主要用于终端显示兼容性控制，让进度展示方式更符合当前终端环境。

示例：

```bash
codex exec --progress-cursor "执行任务并展示进度"
```

### `--json`

含义：
把事件输出为 JSONL。

作用：
适合程序消费、日志采集、自动化系统解析，而不是给人直接阅读。

示例：

```bash
codex exec --json "输出结构化执行事件"
```

### `-o, --output-last-message <FILE>`

含义：
把 agent 的最后一条消息写入指定文件。

作用：
适合自动化脚本只关心最终结果，并希望把最终文本落盘。

示例：

```bash
codex exec -o ./last-message.txt "总结当前仓库的风险点"
```

### `-h, --help`

含义：
打印帮助信息。

作用：
查看 `codex exec` 的当前支持参数和用法。

示例：

```bash
codex exec --help
```

### `-V, --version`

含义：
打印版本号。

作用：
确认当前机器上安装的 Codex CLI 版本，便于排查参数差异。

示例：

```bash
codex exec --version
```

## 常见组合示例

### 1. 只读分析仓库

```bash
codex exec --sandbox read-only --color never "分析当前仓库的潜在风险"
```

### 2. 在工作区内自动修复问题

```bash
codex exec \
  -m gpt-5.2-codex \
  -c 'reasoning.effort="high"' \
  --sandbox workspace-write \
  --full-auto \
  "修复当前项目中的类型错误并解释改动"
```

### 3. 输出结构化 JSON 结果

```bash
codex exec \
  --json \
  --output-schema ./schema.json \
  -o ./result.txt \
  "按 schema 输出本仓库的检查结果"
```

### 4. 在非 Git 目录中运行一次性任务

```bash
codex exec \
  --skip-git-repo-check \
  --ephemeral \
  -C /tmp/plain-folder \
  "整理这个目录中的文档并生成概览"
```

## 使用建议

- 分析类任务优先用 `--sandbox read-only`
- 修改代码类任务优先用 `--sandbox workspace-write`
- 自动化集成优先考虑 `--json`、`--output-schema`、`-o`
- 本地临时任务可以考虑 `--ephemeral`
- 除非你明确知道自己在做什么，否则不要使用 `--dangerously-bypass-approvals-and-sandbox`

