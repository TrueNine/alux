#!/usr/bin/env bun

const diff = Bun.spawnSync(['git', 'diff', '--cached', '--quiet', '--', 'rules/shared/'], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
if (diff.exitCode !== 0) {
  const result = Bun.spawnSync([process.execPath, 'scripts/mixing-shared-rules-to-native-rules.ts'], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
  process.exit(result.exitCode);
}
