import type { AgentPlugin } from '@cline/sdk';
import { compactAfterToolOutput, rewriteBeforeToolInput, synchronizeWorkspaceInstructions } from './adapter';

const alux: AgentPlugin = {
  name: 'alux',
  manifest: {
    capabilities: ['hooks', 'skills'],
  },

  setup(_api, ctx) {
    // Mirror the Claude `SessionStart` workflow: derive instruction files once
    // when the plugin session is created. Synchronization is fail-open.
    try {
      synchronizeWorkspaceInstructions(ctx.workspaceInfo?.rootPath);
    } catch {
      // Session setup must not prevent Cline from starting.
    }
  },

  hooks: {
    beforeTool(context) {
      try {
        const toolName = context.tool?.name ?? context.toolCall.toolName;
        return rewriteBeforeToolInput(toolName, context.input);
      } catch {
        // Observational hooks must never break tool execution.
        return undefined;
      }
    },

    afterTool(context) {
      try {
        const toolName = context.tool?.name ?? context.toolCall.toolName;
        const compacted = compactAfterToolOutput(toolName, context.result?.output);
        return compacted ? { result: { ...context.result, output: compacted.output } } : undefined;
      } catch {
        return undefined;
      }
    },
  },
};

export default alux;
