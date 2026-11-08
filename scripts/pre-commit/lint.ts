#!/usr/bin/env bun

const result = Bun.spawnSync([process.execPath, 'run', '--if-present', 'lint'], { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' });
process.exit(result.exitCode);
