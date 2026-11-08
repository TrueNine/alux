#!/usr/bin/env bun

const result = Bun.spawnSync([process.execPath, 'run', 'check:typescript'], { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' });
process.exit(result.exitCode);
