#!/usr/bin/env bun

import { type Dirent, existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { appendGitExclude } from '../shared/git-exclude.ts';

const derivedFiles = ['CLAUDE.md', 'GEMINI.md', 'CODEBUDDY.md'] as const;
const ignoredDirectories = new Set(['.git', 'node_modules']);

function findInstructionRoot(workingDirectory: string): string {
  const initialDirectory = resolve(workingDirectory);
  let directory = initialDirectory;
  while (true) {
    if (existsSync(join(directory, '.git'))) return directory;
    const parent = dirname(directory);
    if (parent === directory) return initialDirectory;
    directory = parent;
  }
}

function findRepositoryRoot(directory: string, boundary: string): string {
  let current = resolve(directory);
  const root = resolve(boundary);
  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    if (current === root) return root;
    const parent = dirname(current);
    if (parent === current) return root;
    current = parent;
  }
}

function findInstructionFiles(worktree: string, fileNames: ReadonlySet<string>): string[] {
  const files: string[] = [];

  function visit(directory: string): void {
    let entries: Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const path = join(directory, entry.name);
      try {
        if (entry.isDirectory()) {
          if (!ignoredDirectories.has(entry.name)) visit(path);
          continue;
        }
        if ((entry.isFile() || entry.isSymbolicLink()) && fileNames.has(entry.name)) files.push(path);
      } catch {
        // Ignore entries that disappear or become unavailable during traversal.
      }
    }
  }

  visit(worktree);
  return files;
}

function findAgentInstructionFiles(worktree: string): string[] {
  return findInstructionFiles(worktree, new Set(['AGENTS.md']));
}

function removeOrphanedDerivedFiles(worktree: string, agentsFiles: string[]): void {
  const agentDirectories = new Set(agentsFiles.map((path) => dirname(path)));
  const derivedFilesInWorktree = findInstructionFiles(worktree, new Set(derivedFiles));

  for (const derivedPath of derivedFilesInWorktree) {
    if (agentDirectories.has(dirname(derivedPath))) continue;
    try {
      unlinkSync(derivedPath);
    } catch {
      // Continue removing other orphaned instruction files when one is unavailable.
    }
  }
}

export function synchronizeAgentInstructions(workingDirectory: string): void {
  try {
    const worktree = findInstructionRoot(workingDirectory);
    const agentsFiles = findAgentInstructionFiles(worktree);
    removeOrphanedDerivedFiles(worktree, agentsFiles);
    if (agentsFiles.length === 0) return;

    const repositories = new Set<string>();
    for (const agentsPath of agentsFiles) {
      let agents: string;
      try {
        agents = readFileSync(agentsPath, 'utf8');
      } catch {
        continue;
      }

      const instructionDirectory = dirname(agentsPath);
      const repository = findRepositoryRoot(instructionDirectory, worktree);
      repositories.add(repository);
      for (const file of derivedFiles) {
        try {
          const derivedPath = join(instructionDirectory, file);
          writeFileSync(derivedPath, agents.replaceAll('AGENTS.md', file));
        } catch {
          // Continue synchronizing other instruction files when one is unavailable.
        }
      }
    }

    for (const repository of repositories) {
      try {
        appendGitExclude(repository, [...derivedFiles]);
      } catch {
        // Continue updating other repositories when one Git directory is unavailable.
      }
    }
  } catch {
    // SessionStart must not prevent Claude from starting when local files are unavailable.
  }
}

async function main(): Promise<void> {
  try {
    const payload = JSON.parse(new TextDecoder().decode(await Bun.stdin.arrayBuffer())) as { cwd?: unknown };
    const worktree = typeof payload.cwd === 'string' ? payload.cwd : process.cwd();
    synchronizeAgentInstructions(worktree);
  } catch {
    return;
  }
}

if (import.meta.main) await main();
