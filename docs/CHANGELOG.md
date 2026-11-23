# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## Unreleased

## 0.0.27 - 2026-11-23

- Kimi Code 安装说明改为会话内斜杠命令,并警告旧版 kimi-cli 已不再是官方支持的产品:Kimi Code CLI 2.7.2 没有 `kimi plugins install` 子命令,不能在 shell 里自动装插件;须运行 `kimi` 后执行 `/plugins install`。旧 Python/uv kimi-cli(`~/.kimi`)加载不了本插件,`kimi migrate` 也不迁移插件。
- 新增 Kimi Code 插件支持:`.kimi-plugin/plugin.json` 清单(Kimi Code 原生要求 `hooks` 规则数组与 `mcpServers` 内联声明,清单内嵌副本与 `hooks/hooks.kimi.json`、`mcps/.mcp.kimi.json` 规范文件保持同步并由契约测试锁定;不另放根目录 `kimi.plugin.json`,两者并存时根文件优先)与 `.kimi-plugin/marketplace.json` 市场目录(`version: "2"` 目录格式,条目以 `id` 为主键,`source` 为 `..`——Kimi 按目录文件所在目录解析相对 source,指回含清单的仓库根)、`hooks/hooks.kimi.json` 会话钩子(命令为 `bun ./hooks/session-start/sync-agent-instructions.ts`:插件钩子的 cwd 是插件根,Kimi 不展开命令字符串里的 `${KIMI_PLUGIN_ROOT}`,Windows cmd 也不会;脚本从 stdin 的 `cwd` 取会话项目目录。经 Kimi Code 2.7.2 源码核实:`PreToolUse` 的 JSON 输出只认 `permissionDecision: deny` 阻塞、无命令改写通道,`PostToolUse` 为纯观察事件且输出不替换工具结果,故 RTK 前/后置钩子均不接入,仅保留 session-start 指令同步)、`skills/kimi-skills/` 共享技能分发、`mcps/.mcp.kimi.json` MCP 配置(不带 `type` 字段,与 Kimi Code `mcp.json` 文档形态一致,以 `command` 判定 stdio);项目资产安装器新增 `--platform kimi`(技能安装到 `.kimi-code/skills/`),并补充插件契约测试与跨平台 MCP 内联断言。

## 0.0.26 - 2026-11-23

- OpenCode 插件只适配 V2:入口改为 `@opencode/plugin` 的 `Plugin.define`,移除 `@opencode-ai/plugin` 与 V1 `server()` 兼容导出。`package.json` 的 `exports` 指向 server 入口,仓库内通过 `.opencode/plugins/alux` 自动发现。setup 注册 CodeGraph MCP 与 `skills/opencode-skills`,并在 tool/shell hook 中保留命令改写、冗长输出压缩和安全只读命令的 `rtk proxy` 回放。
- 修复 Windows 上 `npm install` 的 postinstall 语法错误:Cline 等以 npm 为安装器的宿主经 `cmd.exe` 执行脚本,单引号对 cmd 无效,echo 文案里的圆括号(如 `(bun unavailable or failed)`)被解析为组括号导致 `此时不应有 ')'` 安装失败;文案改用破折号表述。bun/Codex/CodeBuddy 的安装器不经 cmd,不受影响。

## 0.0.25 - 2026-11-20

- 新增 PowerShell cmdlet → RTK 候选映射层:经实测确认 rtk(含 v1.2.1 与 dev-1.3.0-rc.648)对 PowerShell cmdlet 无任何改写能力(`rtk rewrite` 对 `Get-ChildItem`/`Get-Content`/`Select-String` 全部 exit 1,`rtk hook check --agent copilot` 同样拒绝,上游源码零 cmdlet 处理),`rtk run --shell powershell` 亦为无过滤的纯执行通道——`preprocessCommand` 遂在 PowerShell 纠偏之后新增 `mapPowerShellCmdlets` 钩子层映射(仅 win32):常用只读 cmdlet(`Get-ChildItem`/`gci`→`ls`、`Get-Content`/`gc`→`cat`、`Select-String`/`sls`→`rg`,孤立 `-Recurse` 翻译为 `-R`)翻译为 POSIX 候选喂给 `rtk rewrite` 咨询,映射本身不产生替换——rtk 确认的 RTK 形式(`cat README.md` → `rtk read README.md`,实测 `rtk ls`/`rtk read`/`rtk rg` 在 Windows 均可用)才替换模型所见命令,咨询被拒或 rtk 缺失时回落到既有 UTF-8 纠偏/原样放行,失败模式零新增;带任何参数(`-Tail`/`-Filter`/`-Name`/`-Encoding`)、引号、拼接(`&&`/`;`/`|`)、重定向、`$(`/反引号的 cmdlet 一律拒绝映射。Windows 宿主(codex/copilot 几乎全部 PowerShell)的 `Get-ChildItem` 等命令由此首次进入 RTK 压缩链路,对应单测与 BDD 场景已补齐(全套 140 用例通过)。
- 放宽 PreToolUse 改写门,顺序拼接命令进入 RTK 改写:实测 rtk 1.1.0 对 `&&`/`;`/`||` 复合命令逐段改写(`git status && git diff` → `rtk git status && rtk git diff`,含引号内操作符与多行命令),此前 `isRewritableCommand` 将它们整体挡在门外是 ZCode 等平台"换个调用方式就逃逸"的主因;现改写门仅拒绝重定向(`>`/`>>`/`<`/`2>`/`&>`)与命令替换(`$(`/反引号)——rtk 对这些返回空,咨询只耗子进程;严格只读白名单 `isSafeRtkCommand`(PostToolUse `rtk proxy` 回放)保持全部危险 token 不变,并补充顺序拼接/重定向的单测与 BDD 场景。
- 文档:新增 `hooks/AGENTS.md` 目录级 agent 指令,沉淀 Codex hooks 的真实注册链(manifest `hooks` 声明 → 插件缓存 → `~/.codex/config.toml` 的 `[hooks.state]` 信任条目 → sqlite `hook/started|completed` 运行事件)与 `~/.codex/hooks.json`(2026-08-26 遗留、hooks 数组全空、当前版本不加载)这一无效遗留的判定依据,并附"触发率 ≠ 改写率"的 JS harness 逃逸提示——2026-11-20 排查 RTK 逃逸时曾在该遗留文件上误判"钩子未注册";经 `alux-agent-instructions` normalizer 与 authoring validator 校验通过。

## 0.0.24 - 2026-11-19

- PostToolUse 按平台协议分流:仅在能真正替换模型所见结果的平台(Codex `exit 2` 替换语义、Copilot `modifiedResult`、CodeBuddy/Qoder `updatedToolOutput`、Cline/OpenCode SDK 直改 toolResponse)保留冗长输出压缩与 `rtk proxy` 回放;附加型平台(Claude/ZCode/Grok/Cursor)摘除 PostToolUse 钩子并在入口静默放行——其协议只能把反馈追加在冗长原文旁边,摘要在这些平台反而增加 token(经官方文档逐平台核实,Claude 为 "shows stderr to Claude"、Grok 为 passive event、Cursor 仅许 `additional_context`)。省 token 全部收敛到 PreToolUse 的 RTK 改写与 `ALUX_RTK_COMPACT_*` 可调压缩。

## 0.0.23 - 2026-11-19

- 扩大 RTK 改写面:新增 `isRewritableCommand` 双门模型,PreToolUse 对一切非危险拼接(无 `&&`/`||`/`;`/重定向/`$(`/反引号)的单一命令都会咨询 `rtk rewrite`,由 rtk 自行决定能否优化——只读白名单外的简单命令(如 `bun run dev`)现在也进入改写;严格只读白名单 `isSafeRtkCommand` 仅保留给 PostToolUse 的 `rtk proxy` 回放(回放会二次执行命令,必须保证无副作用)。
- RTK 压缩参数可调:PostToolUse 摘要新增 `ALUX_RTK_COMPACT_MIN_CHARS`(默认 500)、`ALUX_RTK_COMPACT_HEAD_LINES`(35)、`ALUX_RTK_COMPACT_TAIL_LINES`(35)、`ALUX_RTK_COMPACT_LINE_WIDTH`(320)四个环境变量,非法或非正值回落默认;`summarize` 支持显式 `Partial<CompactOptions>` 注入,README 新增 "RTK hooks" 章节与变量表。
- RTK 预处理扩展到全部平台:`preprocessCommand` 统一为「PowerShell UTF-8 纠偏 → `rtk rewrite` 改写 → 警告标记刷新」管线,此前仅 Cursor 走 `preprocessCursorCommand` 接入的 RTK 改写现在覆盖 Claude、Codex、ZCode、Copilot、Grok、CodeBuddy、Qoder 八个钩子入口与 Cline/OpenCode 适配器(含各平台 `cwd` 透传)。
- Codex RTK 改写落地:经官方 hooks 文档核实,Codex(shell 匹配名为 `Bash`,hooks 自 CLI 0.117.0 进入 beta)的 PreToolUse 接受 `hookSpecificOutput.updatedInput` 改写命令,PostToolUse 将 exit 2 + stderr 视为替换工具结果——现有输出协议无需变更,Codex 此前缺失的仅是改写逻辑本身;补充 Codex 入口契约测试。
- 通用化 BDD 规格与单测:`rtk.feature` 的 Cursor 专属场景改为全平台语义("安全命令经由 RTK 改写"/"不安全命令不走 RTK 改写"),`rtk-pre-tool-use.test.ts` 新增全平台 RTK 改写与不安全命令跳过改写的单测。

## 0.0.22 - 2026-11-16

- 全部平台 MCP 配置接入 CodeGraph：各插件清单的 `mcps/.mcp.*.json` 统一声明 `codegraph serve --mcp`(OpenCode 使用原生 `mcp.servers` 格式,Copilot 使用 `type: local`),Cursor 通过根目录 `mcp.json` 自动发现,并补充跨平台 MCP 契约测试。
- Cline 插件接入 CodeGraph MCP：声明 `mcp` capability,在 `setup` 中通过 `api.registerMcpServer` 注册 `codegraph serve --mcp`(stdio),对不支持 MCP 注册的宿主 fail-open,并补充契约测试。
- 修复 Copilot RTK 钩子不生效:Copilot camelCase 载荷使用小写运行时工具名(`bash`/`powershell`),此前落入默认 `Bash|exec` 过滤导致改写与压缩均不触发;现按 `copilotShellTools` 过滤,后置钩子读取 `toolResult.textResultForLlm` 并改用 `modifiedResult` 真正替换冗长结果,补充 Copilot 入口契约测试。
- 新增 Qoder 插件支持(Qoder CLI 与 Qoder IDE)：`.qoder-plugin/plugin.json` 清单与 `.qoder-plugin/marketplace.json` 市场目录、`hooks/hooks.qoder.json` 会话与 RTK 钩子、`skills/qoder-skills/` 共享技能分发、`mcps/.mcp.qoder.json` MCP 配置,并补充插件契约测试。
- RTK 钩子新增 `--qoder` 平台:沿用 Claude 兼容的 Bash 协议,预处理通过 `hookSpecificOutput.updatedInput` 改写命令,后置压缩通过 `hookSpecificOutput.updatedToolOutput` 替换工具结果。
- 新增 `rules/qoder-rules/` 规则树:Qoder 的 `.qoder/rules/` 支持与 Claude 相同的 `paths` frontmatter,纳入 `sync:rules` 与项目资产安装器(`--platform qoder`)。

## 0.0.21 - 2026-11-15

- 新增 CodeBuddy Code 插件支持：`.codebuddy-plugin/plugin.json` 清单与 `.codebuddy-plugin/marketplace.json` 市场目录、`hooks/hooks.codebuddy.json` 会话与 RTK 钩子、`skills/codebuddy-skills/` 共享技能分发、`mcps/.mcp.codebuddy.json` 占位目录,并补充插件契约测试。
- RTK 钩子新增 `--codebuddy` 平台:沿用 Claude 兼容的 Bash 协议,预处理通过 `hookSpecificOutput.modifiedInput` 改写命令,后置压缩通过 `hookSpecificOutput.updatedToolOutput` 替换工具结果。
- 新增 `rules/codebuddy-rules/` 规则树:CodeBuddy 的 `.codebuddy/rules/` 支持与 Claude 相同的 `paths` frontmatter,纳入 `sync:rules` 与项目资产安装器(`--platform codebuddy`)。
- Pre-commit 钩子加固:四个前置脚本的 `Bun.spawnSync` 由 `stdin: inherit` 改为 `stdin: ignore`,消除钩子进程在自动化管道 stdin 场景下潜在的阻塞向量(实测完整钩子链 2.5 秒,发布日卡顿为环境性一次性事件)。

## 0.0.20 - 2026-11-09

- 抽取 `hooks/shared/git-exclude.ts` 共享模块:session-start 钩子与项目资产安装器复用同一套 `.git/info/exclude` 解析(normal / submodule `.git` 指针 / worktree `commondir`)与幂等追加逻辑,消除两份重复实现。
- 新增 `scripts/install-project-assets.ts` 项目资产安装器:把复制分发的资产(claude/cline/copilot/grok 四平台规则树与 cline 技能)安装到目标项目,并逐文件写入项目 `.git/info/exclude`(幂等,含项目内的 alux 独立克隆目录),alux 资产保持本地化、不进入用户项目版本管理;支持 submodule 与 worktree 检出(解析 `.git` 指针与 `commondir`,排除写入其真实 git 目录),alux 自身作为 submodule 时不再误加排除;README 复制命令统一切换为该脚本。
- 共享规则体系扩展至五棵平台树:新增 `rules/cline-rules/`(`.cline/rules/` 目标,与 Claude 同款 `paths` glob)与 `rules/copilot-rules/`(`.github/instructions/` 目标,`applyTo` 逗号分隔 glob 字符串);确认 Codex、OpenCode、ZCode 无按文件条件加载机制,不建树。
- 新增共享规则体系:`rules/shared/` 真源 + `sync:rules` 同步脚本,按平台转换 frontmatter 后分发到 `rules/cursor-rules/`(`.mdc`,globs/alwaysApply)、`rules/claude-rules/`(`.md`,paths)与 `rules/grok-rules/`(仅正文,Grok 无条件加载)。
- Cursor 插件清单新增 `rules` 字段指向 `rules/cursor-rules/`,规则随插件分发、glob 匹配生效;Claude Code 与 Grok 插件清单均无 rules 组件,改由 README 指引复制到项目 `.claude/rules/` 与 `.grok/rules/`。
- Lefthook 预提交新增 `sync-shared-rules` 钩子,`rules/shared/` 变更时自动重新同步各平台规则树。
- 新增 Grok Build 插件支持:`.grok-plugin/plugin.json` 清单与 `.grok-plugin/marketplace.json` 市场目录、`hooks/hooks.grok.json` 会话与 RTK 钩子、`skills/grok-skills/` 共享技能分发、`mcps/.mcp.grok.json` 占位目录,并补充插件契约测试。
- RTK 钩子新增 `--grok` 平台:`^Bash$` matcher 通过 Grok 的 Claude 工具别名命中原生 `run_terminal_command` 工具,预处理沿用 Claude 兼容的 `hookSpecificOutput` 改写协议,后置压缩从 Grok 工具结果的 `output_for_prompt` 字段读取输出。

## 0.0.19 - 2026-11-07

- 修复 ZCode 市场条目 logo 不显示的问题：ZCode 对 git 来源市场实际读取 `.claude-plugin/marketplace.json`，为其插件条目补充 `icon` 字段，并将市场 icon 统一指向 `assets/logo.png`（官方市场图标均为 PNG，SVG 无法渲染）。
- ZCode 钩子命令改用 ZCode 原生 `${ZCODE_PLUGIN_ROOT}` 变量替代 Claude 兼容的 `${CLAUDE_PLUGIN_ROOT}`，并同步插件契约测试断言。

## 0.0.18 - 2026-11-07

- ZCode marketplace 条目新增 `icon` 字段，指向仓库 `assets/logo.svg` 的 raw GitHub 地址，ZCode 市场界面可展示 Alux logo。
- ZCode 插件契约测试同步断言 icon 地址，并校验其指向的本地资产存在。

## 0.0.17 - 2026-11-07

- 新增 ZCode 专用 marketplace 目录：`.zcode-plugin/marketplace.json`，对齐各平台独立 catalog 的仓库布局，条目版本与 `package.json` 保持同步。
- ZCode 插件契约测试改为断言专用 marketplace 目录，并新增 marketplace 条目与 `package.json` 的版本 lockstep 校验。
- 更新 README 的 ZCode 安装说明。

## 0.0.16 - 2026-11-04

- 新增 ZCode 插件支持：`.zcode-plugin/plugin.json` 清单、`hooks/hooks.zcode.json` 会话与 RTK 钩子、`skills/zcode-skills/` 共享技能分发、`mcps/.mcp.zcode.json` 占位目录，并补充插件契约测试。
- RTK 钩子新增 `--zcode` 平台，沿用 Claude 兼容的 Bash 协议执行 PowerShell UTF-8 重写、RTK 预处理与输出压缩。
- 清理遗留的 `.husky/` 目录，完成 Git hooks 向 Lefthook 的迁移收尾。

## 0.0.15 - 2026-11-01

- 新增 `CODEBUDDY.md` 指令同步，沿用 `CLAUDE.md`、`GEMINI.md` 的内容替换、Git 本地排除和孤立文件清理逻辑。
- 将 Lefthook 提交前检查集中到 `scripts/pre-commit/`，保留共享技能同步、lint 和 TypeScript 检查行为。
- 更新项目 logo 为橙色 Al 字母图标。
- 修复 RTK 缺少本地应用数据目录的 BDD 场景，避免回退到宿主机环境变量而误写标记。

## 0.0.14 - 2026-09-07

- 新增 Cursor 插件 agents 路径配置：`agents/cursor-agents/`，修正 AGENTS.md 错误识别为 subagents 的问题。

## 0.0.13 - 2026-09-06

- 新增 GitHub Copilot CLI 插件适配：提供插件清单、共享技能和钩子支持。
- 完善 Copilot 插件市场目录与资源校验，确保插件可被正确发现和安装。

## 0.0.12 - 2026-09-06

- 新增 OpenCode 插件适配：提供 `.opencode-plugin/` 清单与适配器，支持命令重写与输出压缩。
- 新增 Bun 与 Deno 运行时支持（对齐 rtk v0.48.0）：`bun install/add/remove/pm ls`、`deno test/lint/check` 从共享 hook 的 RTK 可重写命令映射放行。
- 迁移单元测试框架至 Vitest，配置 `bun --bun vitest` 执行以保留原生 `Bun` 运行环境。
- 移除 `js-yaml` 外部库依赖，运行时脚本统一使用原生运行时能力。
- 新增 `hooks/shared/rtk.test.ts`，覆盖 Bun/Deno 命令的安全路由判定与 `normalizeRtkCommand` 归一化。

## 0.0.11 - 2026-09-01

- 新增 Cline 插件适配：`package.json` 声明 `cline.plugins` 入口，`.cline-plugin` 导出 Cline SDK `AgentPlugin`。
- 插件生命周期钩子复用共享实现：`setup` 同步派生指令文件，`beforeTool` 执行 PowerShell UTF-8 重写，`afterTool` 压缩冗余 Shell 输出。
- hooks 平台标识增加 `cline`，Cline Shell 工具（`execute_command` 等）纳入共享工具名映射。
- 新增 `skills/cline-skills` 共享技能同步目标与 Cline 插件清单校验测试；技能按 Cline 项目技能约定复制到 `.cline/skills/` 使用。
- 放宽 `prepare`/`postinstall` 生命周期脚本，兼容 Cline 插件安装器的 `npm install --omit=dev` 环境。

## 0.0.10 - 2026-08-28

- 在 SessionStart 同步时删除没有对应 `AGENTS.md` 的孤单 `CLAUDE.md` 和 `GEMINI.md` 文件。
- 增加孤单指令文件清理逻辑的自动化测试。

## 0.0.9 - 2026-08-27

- 修复 `BEGIN_SUBMODULE:` 和 `END_SUBMODULE:` 包装标记的规范化逻辑，保留冒号后的无空格格式。

## 0.0.8 - 2026-08-27

- 添加 Cursor 原生插件清单、共享技能发布和本地插件安装说明。
- 集成 `hooks.cursor.json`，覆盖指令同步、PowerShell UTF-8、RTK 预处理和输出压缩流程。
- 增加 Cursor 插件路径、hooks 协议与技能 frontmatter 校验。

## 0.0.7 - 2026-08-26

- 自动将生成的 `CLAUDE.md` 和 `GEMINI.md` 添加到所属 Git 仓库的本地排除规则。
- 支持父仓库、子模块、独立嵌套仓库和 linked worktree 分别使用各自的 `info/exclude`。
- 使用仓库级通配规则，避免为每个嵌套目录重复写入排除路径。

## 0.0.6 - 2026-08-26

- 增强嵌套目录中的 `AGENTS.md` 指令同步支持。
- 支持独立嵌套仓库和子模块的 Git 排除处理。
- 增强 Claude、Gemini 等嵌套指令的同步逻辑。
- 改进 RTK hook 的输出压缩阈值。
