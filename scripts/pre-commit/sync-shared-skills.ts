#!/usr/bin/env bun

const diff = Bun.spawnSync(['git', 'diff', '--cached', '--quiet', '--', 'skills/shared/'], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
if (diff.exitCode !== 0) {
  const result = Bun.spawnSync([process.execPath, 'scripts/mixining-shared-skills-to-native-skills.ts'], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
  process.exit(result.exitCode);
}
