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
