import type { Plugin } from '@opencode-ai/plugin';
import { compactAfterToolOutput, rewriteBeforeToolInput, synchronizeWorkspaceInstructions } from './adapter';

export const AluxPlugin: Plugin = async ({ directory, worktree }) => {
  // Mirror the Claude `SessionStart` workflow: derive instruction files once
  // when the plugin is initialized. Synchronization is fail-open.
  try {
    synchronizeWorkspaceInstructions(worktree ?? directory);
  } catch {
    // Plugin initialization must not prevent OpenCode from starting.
  }

  return {
    'tool.execute.before': async (input, output) => {
      try {
        const rewritten = rewriteBeforeToolInput(input.tool, output.args);
        if (rewritten) output.args = rewritten.args;
      } catch {
        // Observational hooks must never break tool execution.
      }
    },
    'tool.execute.after': async (input, output) => {
      try {
        const compacted = compactAfterToolOutput(input.tool, output.output);
        if (compacted) output.output = compacted.output;
      } catch {
        // Observational hooks must never break tool execution.
      }
    },
  };
};

export default AluxPlugin;
