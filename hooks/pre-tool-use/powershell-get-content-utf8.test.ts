import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { rewritePowerShellGetContent } from './powershell-get-content-utf8';

const __dirname = dirname(fileURLToPath(import.meta.url));

const hooksDirectory = join(__dirname, '..');
const entrypoint = join(__dirname, 'rtk-pre-tool-use.ts');

test('PreToolUse uses one combined entrypoint to guarantee ordering', () => {
  const configuration = JSON.parse(readFileSync(join(hooksDirectory, 'hooks.codex.json'), 'utf8'));
  const commands = configuration.hooks.PreToolUse.flatMap((group: { hooks: Array<{ command: string }> }) => group.hooks.map((hook) => hook.command));

  expect(commands).toEqual([`bun "\${PLUGIN_ROOT}/hooks/pre-tool-use/rtk-pre-tool-use.ts" --codex`]);
});

test('does not rewrite Get-Content outside Windows', () => {
  let inspected = false;
  const rewritten = rewritePowerShellGetContent('Get-Content README.md', 'linux', () => {
    inspected = true;
    return [11];
  });

  expect(rewritten).toBeUndefined();
  expect(inspected).toBe(false);
});

test('inserts UTF-8 at every parser-selected Get-Content command', () => {
  const command = 'Get-Content first.md; $text = Get-Content -Raw second.md; Get-Content third.md -Encoding unicode';
  const first = command.indexOf('Get-Content') + 'Get-Content'.length;
  const second = command.indexOf('Get-Content', first) + 'Get-Content'.length;

  expect(rewritePowerShellGetContent(command, 'win32', () => [first, second])).toBe(
    'Get-Content -Encoding utf8 first.md; $text = Get-Content -Encoding utf8 -Raw second.md; Get-Content third.md -Encoding unicode',
  );
});

test.skipIf(process.platform !== 'win32')('entrypoint rewrites real PowerShell Get-Content commands', () => {
  const payload = {
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: {
      command: 'Get-Content -Raw first.md; $text = Get-Content second.md; Get-Content third.md -Encoding unicode',
      timeout_ms: 30_000,
      workdir: 'C:\\workspace',
    },
  };
  const result = spawnSync('bun', [entrypoint, '--codex'], {
    input: JSON.stringify(payload),
  });

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stderr)).toBe('');
  expect(JSON.parse(new TextDecoder().decode(result.stdout))).toEqual({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      updatedInput: {
        command: 'Get-Content -Encoding utf8 -Raw first.md; $text = Get-Content -Encoding utf8 second.md; Get-Content third.md -Encoding unicode',
        timeout_ms: 30_000,
        workdir: 'C:\\workspace',
      },
    },
  });
});

test('entrypoint remains fail-open for invalid input', () => {
  const result = spawnSync('bun', [entrypoint], {
    input: 'not json',
  });

  expect(result.status).toBe(0);
  expect(new TextDecoder().decode(result.stdout)).toBe('');
  expect(new TextDecoder().decode(result.stderr)).toBe('');
});
