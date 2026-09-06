# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

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
