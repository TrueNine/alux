@bdd @rtk @hooks
Feature: RTK 钩子行为

  作为 Alux 钩子维护者
  我希望 共享 RTK 规则能准确判定安全命令并在执行前后做预处理与压缩
  以便 只读与构建检查命令可回放优化而写操作与危险拼接一律放行失败保持静默。

  Background:
    Given Alux uses the shared RTK rules

  Rule: 命令归一化只做裁剪与尾部容错剥离

    Scenario: 尾部或真短路被剥离
      Given a command "bun test || true"
      When I normalize the RTK command
      Then the normalized command should be "bun test"

    Scenario: 带重定向抑制的尾部短路被剥离
      Given a command "deno lint 2>/dev/null || true"
      When I normalize the RTK command
      Then the normalized command should be "deno lint"

    Scenario: 前后空白被裁剪
      Given a command "  git status  "
      When I normalize the RTK command
      Then the normalized command should be "git status"

    Scenario: 普通命令保持不变
      Given a command "git status"
      When I normalize the RTK command
      Then the normalized command should be "git status"

    Scenario: 非尾部的短路保持不变
      Given a command "a || true b"
      When I normalize the RTK command
      Then the normalized command should be "a || true b"

    Scenario: 双空格的尾部短路被剥离
      Given a command "bun test  || true"
      When I normalize the RTK command
      Then the normalized command should be "bun test"

    Scenario: 短路符后双空格被剥离
      Given a command "bun test ||  true"
      When I normalize the RTK command
      Then the normalized command should be "bun test"

    Scenario: 双空格的重定向抑制短路被剥离
      Given a command "deno lint 2>/dev/null  || true"
      When I normalize the RTK command
      Then the normalized command should be "deno lint"

    Scenario: true 后缀不被误判为短路
      Given a command "bun test || trueX"
      When I normalize the RTK command
      Then the normalized command should be "bun test || trueX"

  Rule: 只读与构建检查命令判定为安全

    Scenario Outline: 常见只读检查命令是安全的
      Given a command "<command>"
      When I check whether it is a safe RTK command
      Then the safety result should be true

      Examples:
        | command                      |
        | ls -la                       |
        | tree src                     |
        | rg foo                       |
        | git status                   |
        | git diff --cached            |
        | git log --oneline            |
        | cargo test                   |
        | cargo clippy                 |
        | go test ./...                |
        | bunx vitest run              |
        | bunx tsc --noEmit            |
        | pytest -q                    |
        | ruff check .                 |
        | dotnet test                  |
        | npm run test                 |
        | bun test                     |
        | bun test --watch             |
        | bun build ./src/index.ts     |
        | bun run test                 |
        | bun install express          |
        | bun pm ls --all --json       |
        | deno test --allow-all        |
        | deno lint                    |
        | deno check mod.ts            |
        | gh pr view 42                |
        | gh issue list                |
        | docker ps                    |
        | docker container ls          |
        | ./gradlew test               |
        | ls                           |
        | go test                      |
        | go  test                     |
        | cargo  test                  |
        | cargo test --lib             |
        | git  status                  |
        | vitest                       |
        | bunx  vitest run             |
        | playwright test              |
        | playwright test --headed     |
        | playwright  test             |
        | bunx playwright test         |
        | bunx  playwright test        |
        | pytest                       |
        | ruff check                   |
        | ruff  check                  |
        | ruff format --check          |
        | ruff format  --check         |
        | dotnet test --info           |
        | dotnet  test                 |
        | npm  run test                |
        | npm run  test                |
        | bun  install                 |
        | bun pm  ls                   |
        | deno  test                   |
        | gh  pr view 42               |
        | gh pr  view 42               |
        | docker compose ps            |
        | docker compose  ps           |
        | docker  ps                   |
        | docker image ls              |
        | docker image  ls             |
        | docker network ls            |
        | docker network  ls           |
        | docker system df             |
        | docker system  df            |
        | docker container  ls         |
        | docker volume ls             |
        | docker volume  ls            |
        | gradlew test                 |
        | gradle test gh x             |
        | git status docker x          |

    Scenario: Bun 与 Deno 的包管理查询是安全的
      Given a command "bun install"
      When I check whether it is a safe RTK command
      Then the safety result should be true

    Scenario Outline: 受限子命令之外的同前缀命令是不安全的
      Given a command "<command>"
      When I check whether it is a safe RTK command
      Then the safety result should be false

      Examples:
        | command               |
        | bun start             |
        | bun run dev           |
        | deno run mod.ts       |
        | deno task build       |
        | deno install -Af      |
        | git push              |
        | gh pr create          |
        | docker run nginx      |
        | ./gradlew publish     |
        | ./gradlew clean build |
        | rm -rf dist           |

    Scenario Outline: 带前缀的命令不受前缀后的安全词影响
      Given a command "<command>"
      When I check whether it is a safe RTK command
      Then the safety result should be false

      Examples:
        | command                |
        | echo ls                |
        | echo git status        |
        | echo cargo test        |
        | echo go test           |
        | echo vitest run        |
        | echo playwright test   |
        | echo pytest -q         |
        | echo ruff check        |
        | echo dotnet test       |
        | echo npm run test      |
        | echo bun install       |
        | echo deno test         |
        | echo docker ps         |
        | echo gh pr view 42     |
        | echo gradle test       |
        | echo ./gradlew test    |
        | gh echo gh pr view 42  |
        | docker x docker ps   |

  Rule: 危险拼接与空命令一律判定为不安全

    Scenario: 空命令是不安全的
      Given an empty command
      When I check whether it is a safe RTK command
      Then the safety result should be false

    Scenario: shell 拼接是不安全的
      Given a command "git status && git diff"
      When I check whether it is a safe RTK command
      Then the safety result should be false

    Scenario: 分号拼接是不安全的
      Given a command "ls; rm -rf dist"
      When I check whether it is a safe RTK command
      Then the safety result should be false

    Scenario: 输出重定向是不安全的
      Given a command "git status > out.txt"
      When I check whether it is a safe RTK command
      Then the safety result should be false

    Scenario: 命令替换是不安全的
      Given a command "echo $(whoami)"
      When I check whether it is a safe RTK command
      Then the safety result should be false

    Scenario: 反引号替换是不安全的
      Given a command "echo `whoami`"
      When I check whether it is a safe RTK command
      Then the safety result should be false

    Scenario: 归一化后为空的短路命令是不安全的
      Given a command "|| true"
      When I check whether it is a safe RTK command
      Then the safety result should be false

  Rule: 改写与代理决策来自 rtk rewrite

    Scenario: 改写成功且发生变化时返回优化命令
      Given a command "gh pr view 42"
      And an RTK rewrite stub with exit code 3 and output "rtk gh pr view 42"
      When I resolve the optimized command
      Then the optimized command should be "rtk gh pr view 42"
      And the rewrite invocation should be "rtk rewrite gh pr view 42"

    Scenario: 改写进程失败时无优化命令
      Given a command "unknown-tool --flag"
      And an RTK rewrite stub with exit code 1 and output "rtk rewritten output"
      When I resolve the optimized command
      Then there should be no optimized command

    Scenario: 成功退出但改写变化时返回优化命令
      Given a command "git status"
      And an RTK rewrite stub with exit code 0 and output "rtk rewritten output"
      When I resolve the optimized command
      Then the optimized command should be "rtk rewritten output"

    Scenario: 改写输出的空白被裁剪
      Given a command "gh pr view 42"
      And an RTK rewrite stub with exit code 3 and output "rtk gh pr view 42 "
      When I resolve the optimized command
      Then the optimized command should be "rtk gh pr view 42"

    Scenario: 改写结果相同时无优化命令
      Given a command "git status"
      And an RTK rewrite stub with exit code 0 and output "git status"
      When I resolve the optimized command
      Then there should be no optimized command

    Scenario: 改写进程异常时无优化命令
      Given a command "git status"
      And an RTK rewrite stub that throws
      When I resolve the optimized command
      Then there should be no optimized command

    Scenario: 优化命令经由 rtk proxy 执行
      Given a command "rtk gh pr view 42"
      When I build the proxy invocation
      Then the proxy invocation should be "rtk proxy rtk gh pr view 42"

  Rule: PreToolUse 先做 PowerShell 纠偏再做 RTK 预处理

    Scenario: Windows 下 RTK 命令刷新警告标记
      Given a marker check for command "rtk git status" on platform "win32" with local app data set
      When I refresh the RTK warning marker
      Then the marker should be refreshed

    Scenario Outline: 无关命令或非 Windows 不触碰标记
      Given a marker check for command "<command>" on platform "<platform>" with local app data set
      When I refresh the RTK warning marker
      Then the marker should not be refreshed

      Examples:
        | command        | platform |
        | git status     | win32    |
        | rtk git status | linux    |
        | rtk git status | darwin   |

    Scenario: 缺少本地应用数据目录时不刷新标记
      Given a marker check for command "rtk git status" on platform "win32" with local app data missing
      When I refresh the RTK warning marker
      Then the marker should not be refreshed

    Scenario: 非 Windows 不调用解析器直接放过
      Given a PowerShell command "Get-Content README.md" on platform "linux" with offsets "11"
      When I rewrite PowerShell Get-Content
      Then the PowerShell command should be unchanged

    Scenario: 缺少 Encoding 的 Get-Content 被补齐
      Given a PowerShell command "Get-Content README.md" on platform "win32" with offsets "11"
      When I rewrite PowerShell Get-Content
      Then the rewritten PowerShell command should be "Get-Content -Encoding utf8 README.md"

    Scenario: 已带 Encoding 的 Get-Content 保持不变
      Given a PowerShell command "Get-Content third.md -Encoding unicode" on platform "win32" with no offsets
      When I rewrite PowerShell Get-Content
      Then the PowerShell command should be unchanged

    Scenario: 单个 Get-Content 按解析器偏移补齐
      Given a PowerShell command "Get-Content first.md" on platform "win32" with offsets "11"
      When I rewrite PowerShell Get-Content
      Then the rewritten PowerShell command should contain "-Encoding utf8"

    Scenario: 通用预处理先改写后刷新标记
      Given a preprocess input "Get-Content README.md"
      When I preprocess the command
      Then the preprocessed command should be "Get-Content -Encoding utf8 README.md"
      And the marker should have seen "Get-Content -Encoding utf8 README.md"

    Scenario: Cursor 安全命令走 RTK 改写
      Given a Cursor preprocess input "git status"
      And an RTK rewrite stub with exit code 3 and output "rtk git status"
      When I preprocess the Cursor command
      Then the preprocessed command should be "rtk git status"
      And the marker should have seen "rtk git status"

    Scenario: Cursor 不安全命令不走 RTK 改写
      Given a Cursor preprocess input "bun run dev"
      When I preprocess the Cursor command
      Then the Cursor command should fall back to the PowerShell rewrite result
      And the marker should have seen "bun run dev"

    Scenario Outline: 平台与工具名不匹配时入口静默放过
      Given a PreToolUse payload for tool "<tool>" with command "git status"
      And a platform flag "<flag>"
      When I invoke the PreToolUse entrypoint
      Then the PreToolUse result should be silent

      Examples:
        | tool | flag      |
        | Read | --claude  |
        | Read | --codex   |
        | Bash | --cursor  |
        | Bash | --unknown |

    Scenario: 非法输入入口失败保持静默
      Given an invalid PreToolUse payload
      When I invoke the PreToolUse entrypoint
      Then the PreToolUse result should be silent

    Scenario Outline: 多平台钩子配置指向同一组合入口
      Given the hook configuration for "<platform>"
      When I inspect the PreToolUse hook
      Then the PreToolUse matcher should be "<matcher>"
      And the PreToolUse command should contain "rtk-pre-tool-use.ts"

      Examples:
        | platform | matcher                          |
        | claude   | ^Bash$                           |
        | codex    | ^(Bash\|exec\|exec_command\|unified_exec)$ |
        | cursor   | ^Shell$                          |

  Rule: PostToolUse 只压缩冗长输出并对安全命令做失败回放

    Scenario: 短输出不做摘要
      Given a short tool output "ok"
      When I summarize the tool output
      Then there should be no summary

    Scenario: 百行输出被压缩为首尾摘要
      Given a verbose tool output with 100 lines
      When I summarize the tool output
      Then the summary should contain "Output summary (100 lines)"
      And the summary should contain "... omitted verbose output ..."
      And the summary should not contain "line 50"

    Scenario: 超长行按列截断
      Given a verbose tool output with one 1000-character line repeated 100 times
      When I summarize the tool output
      Then the summary lines should be at most 320 characters

    Scenario Outline: 非 Bash 工具输出永不摘要
      Given a PostToolUse payload for tool "<tool>" with 100 lines of output
      And a platform flag "--claude"
      When I invoke the PostToolUse entrypoint
      Then the PostToolUse result should be silent

      Examples:
        | tool |
        | Read |
        | Edit |

    Scenario: 缺少工具名时入口静默放过
      Given a PostToolUse payload without a tool name and with 100 lines of output
      And a platform flag "--claude"
      When I invoke the PostToolUse entrypoint
      Then the PostToolUse result should be silent

    Scenario: 缺少平台模式时入口静默放过
      Given a PostToolUse payload for tool "Bash" with 100 lines of output
      And no platform flag
      When I invoke the PostToolUse entrypoint
      Then the PostToolUse result should be silent

    Scenario: 非法输入入口失败保持静默
      Given an invalid PostToolUse payload
      When I invoke the PostToolUse entrypoint
      Then the PostToolUse result should be silent

    Scenario: Claude 百行 Bash 输出经由标准错误替换并退出码为二
      Given a PostToolUse payload for tool "Bash" with 100 lines of output
      And a platform flag "--claude"
      When I invoke the PostToolUse entrypoint
      Then the PostToolUse exit code should be 2
      And the PostToolUse stderr should contain "Output summary (100 lines)"

    Scenario: Cursor 百行 Shell 输出以附加上下文返回并退出码为零
      Given a PostToolUse payload for tool "Shell" with 100 lines of output
      And a platform flag "--cursor"
      When I invoke the PostToolUse entrypoint
      Then the PostToolUse exit code should be 0
      And the PostToolUse stdout should contain "Output summary (100 lines)"

    Scenario: Codex 保留 exec 系列工具支持
      Given a PostToolUse payload for tool "exec" with 100 lines of output
      And a platform flag "--codex"
      When I invoke the PostToolUse entrypoint
      Then the PostToolUse exit code should be 2

    Scenario Outline: 多平台钩子配置指向同一压缩入口
      Given the hook configuration for "<platform>"
      When I inspect the PostToolUse hook
      Then the PostToolUse matcher should be "<matcher>"
      And the PostToolUse command should contain "rtk-post-tool-use.ts"

      Examples:
        | platform | matcher                          |
        | claude   | ^Bash$                           |
        | codex    | ^(Bash\|exec\|exec_command\|unified_exec)$ |
        | cursor   | ^Shell$                          |

    Scenario: 拒绝残留 Python 实现依赖
      Given the PostToolUse entrypoint source
      When I inspect the implementation dependencies
      Then the source should not contain "python3"
      And the source should not contain "hook.py"

    Scenario: 入口源码注明 RTK 仓库与文档
      Given the PostToolUse entrypoint source
      When I inspect the implementation provenance
      Then the source should contain "https://github.com/rtk-ai/rtk"
      And the source should contain "https://github.com/rtk-ai/rtk/blob/develop/hooks/README.md"
