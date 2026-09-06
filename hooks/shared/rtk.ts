import { spawnSync as nodeSpawnSync } from 'node:child_process';

// GitHub: https://github.com/rtk-ai/rtk
// Documentation: https://github.com/rtk-ai/rtk/blob/develop/hooks/README.md

const replaySafeCommands = [
  /^(?:ls|tree|rg|grep|find|cat|sed|head|tail|nl|wc)(?:\s|$)/,
  /^git\s+(?:status|diff|log|show|branch|remote)(?:\s|$)/,
  /^cargo\s+(?:test|build|check|clippy|fmt|nextest)(?:\s|$)/,
  /^go\s+(?:test|build|vet)(?:\s|$)/,
  /^(?:bunx\s+)?(?:vitest|jest|tsc|next)(?:\s|$)/,
  /^(?:bunx\s+)?playwright\s+test(?:\s|$)/,
  /^(?:pytest|mypy|rspec|rubocop)(?:\s|$)/,
  /^ruff\s+(?:check|format\s+--check)(?:\s|$)/,
  /^dotnet\s+(?:test|build|restore)(?:\s|$)/,
  /^(?:npm|pnpm|yarn|bun)\s+(?:run(?:-script)?\s+)?(?:test|build|lint|check|typecheck|vitest|jest|tsc|next|playwright)(?:\b|:)/,
  /^bun\s+(?:install|add|remove|pm\s+ls)(?:\s|$)/,
  /^deno\s+(?:test|lint|check)(?:\s|$)/,
];
const unsafeTokens = ['&&', '||', ';', '>', '>>', '<', '2>', '&>', '$(', '`'];

type SpawnOptions = {
  cmd: string[];
  cwd?: string;
  stdout: 'pipe';
  stderr: 'pipe';
};
type SpawnResult = { exitCode: number; stdout: Uint8Array; stderr: Uint8Array };
type SpawnSync = (options: SpawnOptions) => SpawnResult;

const spawnSync: SpawnSync = ({ cmd, cwd }) => {
  const result = nodeSpawnSync(cmd[0], cmd.slice(1), {
    cwd,
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? new Uint8Array(),
    stderr: result.stderr ?? new Uint8Array(),
  };
};

export function normalizeRtkCommand(command: string): string {
  return command.trim().replace(/\s+(?:2>\/dev\/null\s+)?\|\|\s+true\s*$/, '');
}

export function isSafeRtkCommand(command: string): boolean {
  const value = normalizeRtkCommand(command);
  if (!value || unsafeTokens.some((token) => value.includes(token))) return false;
  if (/^gh\s/.test(value)) return /^gh\s+(?:issue|pr|run|repo)\s+(?:list|view|status|checks|diff)\b/.test(value);
  if (/^docker(?:-compose)?\s/.test(value)) {
    return /^docker(?:-compose)?\s+(?:(?:compose\s+)?(?:ps|logs|images|info|inspect|version)|container\s+(?:inspect|logs|ls|ps)|image\s+(?:history|inspect|ls)|network\s+(?:inspect|ls)|system\s+(?:df|info)|volume\s+(?:inspect|ls))\b/.test(
      value,
    );
  }
  if (/^(?:\.\/)?gradlew\b|^gradle\b/.test(value)) {
    return (
      /\b(?:test|check|build|assemble|compile|classes|jar|dependencies|dependencyinsight|help|projects|properties|tasks|lint|detekt|ktlint)\b/i.test(value) &&
      !/\b(?:clean|deploy|docker|install|jib|publish|release|run|upload)\b/i.test(value)
    );
  }
  return replaySafeCommands.some((pattern) => pattern.test(value));
}

export function resolveOptimizedCommand(command: string, cwd?: string, spawn: SpawnSync = spawnSync): string | undefined {
  try {
    const result = spawn({
      cmd: ['rtk', 'rewrite', command],
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (result.exitCode !== 0 && result.exitCode !== 3) return;
    const rewritten = new TextDecoder().decode(result.stdout).trim();
    if (rewritten && rewritten !== command) return rewritten;
  } catch {
    return;
  }
}

export function proxyInvocation(command: string): string[] {
  return ['rtk', 'proxy', command];
}
