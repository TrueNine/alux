import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ExtensionAPI, isBashToolResult, isPowerShellToolResult, isToolCallEventType, type ToolResultEvent } from '@earendil-works/pi-coding-agent';
import { summarize } from '../hooks/post-tool-use/rtk-post-tool-use.ts';
import { preprocessCommand, refreshRtkWarningMarker } from '../hooks/pre-tool-use/rtk-pre-tool-use.ts';
import { isRewritableCommand, resolveOptimizedCommand } from '../hooks/shared/rtk.ts';
import mcp from '../mcp.json';
import { parseSharedRule } from '../scripts/mixing-shared-rules-to-native-rules.ts';

const sharedRules = fileURLToPath(new URL('../rules/shared/', import.meta.url));

function sharedRuleGuidance(): string | undefined {
  const entries = readdirSync(sharedRules, { withFileTypes: true });
  const rules = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort()
    .flatMap((name) => {
      const path = join(sharedRules, name);
      try {
        const rule = parseSharedRule(name, readFileSync(path, 'utf8'));
        if (!rule.globs?.length) return [rule.body];
        return [`- ${rule.description} (paths: ${rule.globs.join(', ')}). Read ${JSON.stringify(path)} before working on matching files.`];
      } catch {
        return [];
      }
    });
  if (rules.length) return `## Alux shared rules\n\n${rules.join('\n\n')}`;
}

function rewriteBash(command: string, cwd: string): string | undefined {
  const rewritten = isRewritableCommand(command) ? resolveOptimizedCommand(command, cwd) : undefined;
  refreshRtkWarningMarker(rewritten ?? command);
  return rewritten;
}

function compactShellResult(event: ToolResultEvent) {
  if (event.isError || (!isBashToolResult(event) && !isPowerShellToolResult(event))) return;
  const [block] = event.content;
  if (event.content.length !== 1 || block?.type !== 'text') return;
  // Pi includes a file pointer in its truncated output. Preserve it verbatim.
  if (event.details?.fullOutputPath) return;
  const summary = summarize(block.text);
  if (!summary || summary.length >= block.text.length) return;
  return { content: [{ ...block, text: summary }], structuredContent: event.structuredContent };
}

export default function alux(pi: ExtensionAPI): void {
  try {
    const { command, args } = mcp.mcpServers.codegraph;
    pi.registerMcpServer('codegraph', { command, args });
  } catch {
    // MCP registration is optional for the rest of the extension.
  }

  pi.on('before_agent_start', (event) => {
    try {
      const guidance = sharedRuleGuidance();
      if (guidance) return { systemPrompt: `${event.systemPrompt}\n\n${guidance}` };
    } catch {
      // A missing rules directory must not interrupt a turn.
    }
  });

  pi.on('tool_call', (event, ctx) => {
    try {
      const powerShell = isToolCallEventType('powershell', event);
      if (!powerShell && !isToolCallEventType('bash', event)) return;
      const { command } = event.input;
      const rewrite = powerShell ? preprocessCommand : rewriteBash;
      const commandForShell = rewrite(command, ctx.cwd);
      if (commandForShell) event.input.command = commandForShell;
    } catch {
      // Let the original command run if preprocessing fails.
    }
  });

  pi.on('tool_result', (event) => {
    try {
      return compactShellResult(event);
    } catch {
      // Keep the original tool result if compaction fails.
    }
  });
}
