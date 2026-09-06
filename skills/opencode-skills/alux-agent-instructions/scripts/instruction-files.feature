@bdd @governed-files
Feature: 受管指令文件发现

  作为 Alux 编排工具
  我希望 对指令文件词表所管辖的指令文件进行分类与发现
  以便 仅对项目自有文档与 Agent 清单做归一化与校验。

  Background:
    Given Alux uses the shared instruction-file rules

  Rule: 仅项目自有文档与 Agent 清单受管

    Scenario: Windows 风格路径在分类前先归一化
      Given a relative path "skills\\trax/AGENTS.md"
      When I check whether it is a governed file
      Then the result should be true

    Scenario: 根目录 AGENTS.md 始终受管
      Given a relative path "AGENTS.md"
      When I check whether it is a governed file
      Then the result should be true

    Scenario: 嵌套的 Agent 清单文件受管
      Given a relative path "agents/publisher.toml"
      When I check whether it is a governed file
      Then the result should be true

    Scenario Outline: 按扩展名判定 Agent 清单是否受管
      Given a relative path "<path>"
      When I check whether it is a governed file
      Then the result should be <governed>

      Examples:
        | path                | governed |
        | agents/publisher.md     | true  |
        | agents/editor.yaml      | true  |
        | agents/planner.yml      | true  |
        | agents/reviewer.json    | true  |
        | agents/user-notes.txt   | false |

    Scenario: skills/ 下的 SKILL.md 受管
      Given a relative path "skills/df-example/SKILL.md"
      When I check whether it is a governed file
      Then the result should be true

    Scenario: skills/ 下嵌套的 Agent 清单受管
      Given a relative path "skills/df-example/agents/openai.yaml"
      When I check whether it is a governed file
      Then the result should be true

    Scenario: skills/ 下的说明文档不受管
      Given a relative path "skills/df-example/README.md"
      When I check whether it is a governed file
      Then the result should be false

    Scenario: skills/ 与 agents/ 之外的无关文件不受管
      Given a relative path "docs/architecture.md"
      When I check whether it is a governed file
      Then the result should be false

  Rule: 发现时遍历项目并跳过版本控制与依赖噪声

    Scenario: 按相对根目录排序返回已发现的受管文件
      Given a temporary project
      And a file at "AGENTS.md"
      And a file at "README.md"
      And a file at "agents/reviewer.json"
      And a file at "skills/df-example/agents/openai.yaml"
      And a file at "skills/df-example/SKILL.md"
      And a file at ".git/HEAD"
      And a file at "node_modules/pkg/index.js"
      When I list the governed files
      Then the governed files should be
        """
        AGENTS.md
        agents/reviewer.json
        skills/df-example/agents/openai.yaml
        skills/df-example/SKILL.md
        """

    Scenario: 空项目返回空的受管文件列表
      Given a temporary project
      When I list the governed files
      Then the governed files should be empty