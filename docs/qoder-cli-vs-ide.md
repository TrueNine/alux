# Qoder CLI 与 Qoder IDE 的插件加载差异

> 本文记录 alux 在 Qoder 上「CLI 正常、IDE 面板却显示 66 个 skills」的根因，以及 Qoder CLI 与 IDE 在插件加载上的行为差异。
> 结论先行：**CLI 与 IDE 运行时都认 manifest，实际只加载 6 个 skill；66 只来自 IDE「插件市场面板 / 资源绑定」这一条按约定全量扫目录的路径。**

## 1. 背景与现象

- 用户报告：Qoder IDE 插件面板显示 **66 个 skills**，且 hooks / subagent / MCP「完全没作用」。
- alux 仓库的技能分发结构（见 `skills/AGENTS.md`）：`skills/shared/` 为真源，`bun run sync:skills` 把它复制到每个 `*-skills/` 平台树。当前共 **11 棵树**（`shared` + 10 个平台树），每棵 6 个 skill，合计 **66 个 `SKILL.md`**，内容几乎逐字节相同。
  - 唯一例外：`skills/codex-skills/` 额外带 5 个 `agents/openai.yaml` 与 1 个 `assets/openai-logo.svg`（Codex 专属，`skills/AGENTS.md` 明确要求保留）。
- Qoder 清单 `.qoder-plugin/plugin.json` 只声明了自己的那棵树：

  ```json
  {
    "skills": "./skills/qoder-skills",
    "hooks": "./hooks/hooks.qoder.json",
    "mcpServers": "./mcps/.mcp.qoder.json"
  }
  ```

  即 manifest 层面只有 **6 个 skill、3 个 hook、1 个 MCP**。

## 2. 三条加载路径对比（核心）

| 加载路径 | 是否认 manifest 的 `skills` 范围 | 实际结果 | 证据 |
| --- | --- | --- | --- |
| **Qoder CLI**（`qodercli`） | ✅ 认 | 6 skills / 3 hooks / 1 MCP，`plugins validate` ok | 实测 `plugins validate . --json` |
| **IDE 运行时**（agent 实际调用） | ✅ 认 | 运行时清单 6 skills + `codegraph`，`runtimeReady:true`，MCP ready | 实测 `main.sqlite`、MCP 日志 |
| **IDE 市场面板 / 资源绑定** | ❌ 不认，按约定全量递归扫 `skills/` | 66 个条目，同名重复 → 绑定失败 | 实测主日志报错 + asar 逆向 |

要点：

- **CLI**：`qodercli plugins validate . --json` 返回 `ok:true`，`componentCount:10`，资源为 6 skills / 0 agents / 1 mcpServer(`codegraph`) / 3 hooks。完全按 manifest 声明的范围加载。
- **IDE 运行时**：`main.sqlite` 的 `plugin_inventory_resources` 里 alux 只有 **6 条 skill 记录 + `mcp:codegraph`**；`installed_extension_json` 为 `runtimeReady:true`、`runtimeLoadFailed:false`、`enabledForAgent:true`。MCP 日志显示 `codegraph` 已 `started` 且 `status:"ready"`（`reason: plugin_activation`）。**运行时是对的。**
- **IDE 市场面板 / 资源绑定**：主日志反复出现
  `MARKETPLACE_RESOURCE_BINDING_DUPLICATED`（`replaceResources` ← `synchronizePluginMarketplaceBindingRecord` ← `listInstalled`）。
  该路径枚举 skill 时**不走 manifest 的 `skills` 范围，而是递归扫打包进来的整个 `skills/` 目录**，于是看到 11 棵树 × 6 = 66；6 个名字各重复 11 次，`definitionId` / `domainResourceKey` 撞车，抛 `MARKETPLACE_RESOURCE_BINDING_DUPLICATED`，skill 绑定写入失败。

## 3. 为什么「光改 manifest 治不了 66」

市场面板 / 资源绑定这条路径**不读 manifest 的 `skills` 字段**。因此：

- 只把 manifest 的 `skills` 指得更窄，**无法**改变该路径看到的 66。
- 要让它只看到 6，必须让**实际打包进 Qoder 插件的 `skills/` 目录物理上只有 6 个 `SKILL.md`**。

这也是「IDE 强制这套结构」的真实含义：**不是整个仓库要被重构**，而是这一条扫描路径不认 manifest，只能让实际内容去匹配它。CLI 与 IDE 运行时不受影响。

## 4. 安装打包机制（已从 CLI 二进制确认）

Qoder 市场安装时，对每个插件：

```text
B = join(marketplaceInstallLocation, plugin.source)   // 解析 source 到市场克隆内的子目录
await copy(B, installCache, { containmentRoot: marketplaceInstallLocation ?? B })
```

（二进制中为 `B=YGH(D.marketplaceInstallLocation,H)` 后 `fi(B,I,{containmentRoot:...})`，`H` 即 `plugin.source`。）

- 即**只拷贝 `source` 指向的那个子目录**，并做 `containmentRoot` 越界校验，不是整个市场克隆。
- 当前 `.qoder-plugin/marketplace.json` 的 `plugins[0].source = "./"` → 指向仓库根 → **整仓入库**，11 棵技能树全被打包 → 66。
- 推论：把 `source` 指向一个**只含 Qoder 资产的自包含子目录**，即可让包内只有 6 个 `SKILL.md`。`scripts/qoder-plugin.test.ts:84-85` 也正是把 `source` 解析为 `pluginRoot` 并要求 `<pluginRoot>/.qoder-plugin/plugin.json` 存在。

## 5. IDE 约定目录 vs manifest 字段

IDE 除了 manifest，还按一套**约定目录**发现组件（asar 逆向）：

```
commands/  skills/  agents/  hooks/hooks.json  output-styles/  workflows/  bin/  .mcp.json  mcp.json
```

差异点：

- **hooks**：可反编译的 base 版清单读取器返回 `{name, version, description, skills, agents, mcpServers, ...}`，**不含 `hooks` 字段**；hooks 走约定 `hooks/hooks.json`。
  - 仓库目前只有 `hooks/hooks.qoder.json`，**没有 `hooks/hooks.json`** → IDE 侧 hooks 是否加载存疑。
  - 注意：运行中的 IDE 版本（0.5.11）含 hook 协议（`hookSpecificOutput` / `permissionDecision` / `QODER_PLUGIN_ROOT` 等），但其加载路径被字符串混淆，未能完全确认；base 版行为不一定代表运行版。**CLI 侧 hooks 正常**（`hooks.qoder.json` 被 manifest 正确引用）。
- **MCP**：约定 `.mcp.json` / `mcp.json`。仓库根 `mcp.json` 已存在（`codegraph serve --mcp`），与 `mcps/.mcp.qoder.json` 内容一致；codegraph 在 IDE 已 ready。
- **skills**：运行时认 manifest；市场面板 / 资源绑定按约定全量扫 `skills/`（见 §2、§3）。

## 6. 结论与可选方向（仅陈述，未实施）

- **CLI 与 IDE 运行时都认 manifest**，当前结构无需改动即正确（6 skills / 3 hooks / 1 MCP）。
- **66 与绑定冲突**只来自 IDE 市场面板的约定式全树扫描，可视为 IDE 的限制 / bug。
- 可选修复方向：
  - **A. Qoder 专用包（绕过）**：新增一个只含 Qoder 资产的自包含子目录（6 skills + Qoder hooks + MCP + `.qoder-plugin/plugin.json`），把 marketplace `source` 指过去。**只影响 Qoder**，不动多平台共享设计与其他 9 个平台。若需 IDE 加载 hooks，可在该包内提供约定名 `hooks/hooks.json`（包是 Qoder 专用，不会与其他平台冲突）。
  - **B. 视为 IDE bug，不迁就**：保持仓库现状，把「市场面板不认 manifest 范围」上报 IDE 侧修复。
- **subagent**：仓库目前不存在任何 subagent 定义（用户已表示暂不需要），故「subagent 没作用」当前无实体可加载。

## 7. 依据与验证方法

| 结论 | 来源 | 类型 |
| --- | --- | --- |
| CLI 6/3/1、validate ok | `qodercli plugins validate . --json`、`plugins list --json` | 运行时实测 |
| IDE 运行时 6 skills + codegraph、runtimeReady | `main.sqlite`（`plugin_inventory_resources`、`installed_extension_json`） | 运行时实测 |
| codegraph 在 IDE ready | IDE `mcp/*.log`（`status:"ready"`） | 运行时实测 |
| `MARKETPLACE_RESOURCE_BINDING_DUPLICATED` | IDE 主日志 `main.log` | 运行时实测 |
| 市场面板全量扫 `skills/`、不认 manifest | IDE asar 反编译 + 66 计数 | 逆向推断 |
| 安装只拷贝 `source` 子目录 | CLI 二进制字符串（`join(marketplaceInstallLocation, source)` + `containmentRoot`） | 逆向确认 |
| base 版清单不读 `hooks`、约定 `hooks/hooks.json` | IDE base asar 反编译 | 逆向推断（运行版被混淆，未完全确认） |

> 环境参考：Qoder CLI `qodercli.exe` v1.1.29；IDE 运行版 0.5.11；IDE 数据目录 `~/AppData/Roaming/com.qoder.app.stable`；共享安装清单 `~/.qoder/plugins/installed_plugins_v2.json`。