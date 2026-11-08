#!/usr/bin/env bun

import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export type SharedRule = {
  name: string;
  description?: string;
  globs?: string[];
  body: string;
};

export type MixSharedRulesResult = {
  copiedRules: string[];
  targetDirectories: string[];
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Parses the shared rule document into its frontmatter fields and Markdown body. */
export function parseSharedRule(name: string, document: string): SharedRule {
  const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(document);
  if (!frontmatterMatch) throw new Error(`Shared rule ${name} must start with YAML frontmatter`);

  const frontmatter = frontmatterMatch[1] ?? '';
  const body = document.slice(frontmatterMatch[0].length).replace(/^\r?\n+/, '');
  const lines = frontmatter.split(/\r?\n/);
  const rule: SharedRule = { name, body };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const description = /^description:\s*(.+?)\s*$/.exec(line);
    if (description?.[1]) {
      rule.description = description[1].replace(/^["']|["']$/g, '');
      continue;
    }
    if (/^globs:\s*$/.test(line)) {
      const globs: string[] = [];
      while (index + 1 < lines.length) {
        const item = /^\s*-\s+(.+?)\s*$/.exec(lines[index + 1] ?? '');
        if (!item?.[1]) break;
        globs.push(item[1].replace(/^["']|["']$/g, ''));
        index += 1;
      }
      rule.globs = globs;
      continue;
    }
    const inlineGlobs = /^globs:\s*(\[.*\]|.+?)\s*$/.exec(line);
    if (inlineGlobs?.[1]) {
      const value = inlineGlobs[1].trim();
      rule.globs = value.startsWith('[')
        ? value
            .slice(1, -1)
            .split(',')
            .map((entry) => entry.trim().replace(/^["']|["']$/g, ''))
            .filter(Boolean)
        : [value.replace(/^["']|["']$/g, '')];
    }
  }
  if (!rule.description) throw new Error(`Shared rule ${name} must declare a description`);
  return rule;
}

/** Renders a YAML scalar for single values and a block list otherwise. */
function renderYamlList(field: string, values: string[]): string {
  return values.length === 1 ? `${field}: ${values[0]}` : `${field}:\n${values.map((value) => `  - ${value}`).join('\n')}`;
}

/** Renders the Cursor rule document (`.mdc`): globs scope the rule, otherwise it applies to every session. */
export function renderCursorRule(rule: SharedRule): string {
  const lines = ['---', `description: ${rule.description}`];
  if (rule.globs?.length) lines.push(renderYamlList('globs', rule.globs));
  else lines.push('alwaysApply: true');
  lines.push('---');
  return `${lines.join('\n')}\n\n${rule.body}`;
}

/** Renders the Claude rule document (`.md`): `paths` scopes the rule, otherwise it loads every session. */
export function renderClaudeRule(rule: SharedRule): string {
  const lines = ['---', `description: ${rule.description}`];
  if (rule.globs?.length) lines.push(renderYamlList('paths', rule.globs));
  lines.push('---');
  return `${lines.join('\n')}\n\n${rule.body}`;
}

/** Renders the Grok rule document (`.md`): Grok strips frontmatter and loads rules unconditionally, so ship the body alone. */
export function renderGrokRule(rule: SharedRule): string {
  return rule.body;
}

/** Renders the Cline rule document (`.md`): Cline conditions rules on the same `paths` frontmatter as Claude. */
export function renderClineRule(rule: SharedRule): string {
  return renderClaudeRule(rule);
}

/** Renders the Copilot instruction document (`.instructions.md`): `applyTo` takes one comma-separated glob string. */
export function renderCopilotRule(rule: SharedRule): string {
  const globs = rule.globs?.length ? rule.globs : ['**'];
  const lines = ['---', `description: ${rule.description}`, `applyTo: '${globs.join(', ')}'`, '---'];
  return `${lines.join('\n')}\n\n${rule.body}`;
}

/** Synchronizes shared rules into every existing native rules directory, transforming frontmatter per platform. */
export async function mixSharedRules(rulesRoot: string): Promise<MixSharedRulesResult> {
  const sharedRoot = join(rulesRoot, 'shared');
  if (!(await exists(sharedRoot))) {
    throw new Error(`Shared rules directory does not exist: ${sharedRoot}`);
  }

  const [sharedEntries, nativeDirectories] = await Promise.all([
    readdir(sharedRoot, { withFileTypes: true }),
    readdir(rulesRoot, { withFileTypes: true }).then((entries) =>
      entries
        .filter((entry) => entry.isDirectory() && entry.name !== 'shared' && entry.name.endsWith('-rules'))
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right)),
    ),
  ]);
  if (nativeDirectories.length === 0) {
    throw new Error(`No native rules directories found under: ${rulesRoot}`);
  }

  const renderers: Record<string, (rule: SharedRule) => string> = {
    'cursor-rules': (rule) => renderCursorRule(rule),
    'claude-rules': (rule) => renderClaudeRule(rule),
    'cline-rules': (rule) => renderClineRule(rule),
    'copilot-rules': (rule) => renderCopilotRule(rule),
    'grok-rules': (rule) => renderGrokRule(rule),
  };
  const extensions: Record<string, string> = {
    'cursor-rules': '.mdc',
    'claude-rules': '.md',
    'cline-rules': '.md',
    'copilot-rules': '.instructions.md',
    'grok-rules': '.md',
  };

  const copiedRules: string[] = [];
  for (const entry of sharedEntries.filter((item) => item.isFile() && item.name.endsWith('.md'))) {
    const name = entry.name.replace(/\.md$/, '');
    const rule = parseSharedRule(name, await readFile(join(sharedRoot, entry.name), 'utf8'));
    for (const targetDirectory of nativeDirectories) {
      const render = renderers[targetDirectory];
      if (!render) throw new Error(`No rule renderer registered for native rules directory: ${targetDirectory}`);
      const targetPath = join(rulesRoot, targetDirectory, `${name}${extensions[targetDirectory] ?? '.md'}`);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, render(rule));
    }
    copiedRules.push(name);
  }
  if (copiedRules.length === 0) {
    throw new Error(`No shared rules found under: ${sharedRoot}`);
  }

  return { copiedRules: copiedRules.sort((left, right) => left.localeCompare(right)), targetDirectories: nativeDirectories };
}

function usage(): never {
  console.error('Usage: mixing-shared-rules-to-native-rules.ts [rules-root]');
  process.exit(2);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => arg.startsWith('-'))) usage();

  try {
    const rulesRoot = resolve(args[0] ?? join(dirname(import.meta.dir), 'rules'));
    const result = await mixSharedRules(rulesRoot);
    console.log(`Copied ${result.copiedRules.length} shared rule(s) to ${result.targetDirectories.length} native director(ies).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.main) await main();
