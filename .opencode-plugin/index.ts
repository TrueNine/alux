import { fileURLToPath } from 'node:url';
import { type Mcp, Plugin, type Skill } from '@opencode/plugin';
import { compactAfterToolOutput, loadMcpServers, loadSkillDefinitions, type OpenCodeSkillDefinition, replayAfterToolOutput, rewriteBeforeToolInput, synchronizeWorkspaceInstructions } from './adapter';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

function skillInfo(skill: OpenCodeSkillDefinition): Skill.Info {
  return {
    id: skill.id as Skill.ID,
    name: skill.name as Skill.Name,
    description: skill.description,
    ...(skill.autoinvoke === undefined ? {} : { autoinvoke: skill.autoinvoke }),
    path: skill.path as Skill.Info['path'],
    content: skill.content,
  };
}

/**
 * OpenCode V2 server plugin. V1 `@opencode-ai/plugin` function exports are not
 * provided: OpenCode 2 does not run them.
 */
export default Plugin.define({
  id: 'alux',
  async setup(ctx) {
    const synced = new Set<string>();
    const sync = (root?: string): void => {
      if (!root || synced.has(root)) return;
      synced.add(root);
      try {
        synchronizeWorkspaceInstructions(root);
      } catch {
        synced.delete(root);
      }
    };

    sync(ctx.location.project.directory);

    try {
      const servers = loadMcpServers(repositoryRoot);
      await ctx.mcp.transform((editor) => {
        for (const [name, config] of Object.entries(servers)) editor.set(name, config as Mcp.ServerConfig);
      });
    } catch {
      // A missing MCP catalog must not prevent the plugin from loading.
    }

    try {
      const skills = loadSkillDefinitions(repositoryRoot);
      if (skills.length > 0) {
        await ctx.skill.transform((editor) => {
          for (const skill of skills) editor.add(skillInfo(skill));
        });
      }
    } catch {
      // Skill registration is additive; discovery failure must stay fail-open.
    }

    await ctx.tool.hook('execute.before', (event) => {
      try {
        const rewritten = rewriteBeforeToolInput(event.tool, event.input);
        if (rewritten) event.input = rewritten.args;
      } catch {
        // Observational hooks must never break tool execution.
      }
    });

    await ctx.tool.hook('execute.after', (event) => {
      try {
        if (event.status !== 'completed') return;
        const visible = event.result.content ?? event.result.output;
        const compacted = compactAfterToolOutput(event.tool, visible);
        if (compacted) {
          event.result = { ...event.result, content: compacted.output };
          return;
        }
        const replayed = replayAfterToolOutput(event.tool, event.input, visible);
        if (replayed) event.result = { ...event.result, content: replayed.output };
      } catch {
        // Observational hooks must never break tool execution.
      }
    });

    // V2 shell execution does not always arrive as a tool named `bash`.
    await ctx.shell.hook('create.before', (event) => {
      try {
        const rewritten = rewriteBeforeToolInput('shell', { command: event.command, cwd: event.cwd });
        const command = rewritten?.args.command;
        if (typeof command === 'string') event.command = command;
      } catch {
        // Observational hooks must never break shell execution.
      }
    });

    const controller = new AbortController();
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ types: ['session.created'], signal: controller.signal })) {
          if (event.type !== 'session.created') continue;
          sync(event.data.location.directory);
        }
      } catch {
        // Aborting the subscription ends the loop.
      }
    })();

    return () => controller.abort();
  },
});
