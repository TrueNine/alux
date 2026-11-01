#!/usr/bin/env bun

const result = Bun.spawnSync([process.execPath, 'run', 'check:typescript'], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
process.exit(result.exitCode);
