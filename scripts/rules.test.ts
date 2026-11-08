import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { parseSharedRule } from './mixing-shared-rules-to-native-rules.ts';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const rulesRoot = resolve(repositoryRoot, 'rules');

function frontmatterField(frontmatter: string, field: string): string | undefined {
  const match = new RegExp(`^${field}:\\s*(.+?)\\s*$`, 'm').exec(frontmatter);
  if (!match) return undefined;

  const value = match[1]?.trim();
  if (!value) return undefined;
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.at(-1) === quote) {
    return value.slice(1, -1).trim();
  }
  return value;
}

async function listRuleNames(directory: string, extension: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => entry.name.replace(new RegExp(`\\${extension}$`), ''))
    .sort((left, right) => left.localeCompare(right));
}

describe('Shared agent rules', () => {
  test('keeps every platform rules tree synchronized with the shared source', async () => {
    const sharedNames = await listRuleNames(resolve(rulesRoot, 'shared'), '.md');
    expect(sharedNames.length).toBeGreaterThan(0);

    const [cursorNames, claudeNames, clineNames, copilotNames, grokNames] = await Promise.all([
      listRuleNames(resolve(rulesRoot, 'cursor-rules'), '.mdc'),
      listRuleNames(resolve(rulesRoot, 'claude-rules'), '.md'),
      listRuleNames(resolve(rulesRoot, 'cline-rules'), '.md'),
      listRuleNames(resolve(rulesRoot, 'copilot-rules'), '.instructions.md'),
      listRuleNames(resolve(rulesRoot, 'grok-rules'), '.md'),
    ]);
    expect(cursorNames).toEqual(sharedNames);
    expect(claudeNames).toEqual(sharedNames);
    expect(clineNames).toEqual(sharedNames);
    expect(copilotNames).toEqual(sharedNames);
    expect(grokNames).toEqual(sharedNames);

    for (const name of sharedNames) {
      const shared = parseSharedRule(name, await readFile(resolve(rulesRoot, 'shared', `${name}.md`), 'utf8'));

      const cursor = await readFile(resolve(rulesRoot, 'cursor-rules', `${name}.mdc`), 'utf8');
      const cursorFrontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(cursor)?.[1] ?? '';
      expect(frontmatterField(cursorFrontmatter, 'description')).toBe(shared.description);
      expect(cursor.endsWith(shared.body)).toBe(true);

      const claude = await readFile(resolve(rulesRoot, 'claude-rules', `${name}.md`), 'utf8');
      const claudeFrontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(claude)?.[1] ?? '';
      expect(frontmatterField(claudeFrontmatter, 'description')).toBe(shared.description);
      expect(claude.endsWith(shared.body)).toBe(true);

      const cline = await readFile(resolve(rulesRoot, 'cline-rules', `${name}.md`), 'utf8');
      expect(cline).toBe(claude);

      const copilot = await readFile(resolve(rulesRoot, 'copilot-rules', `${name}.instructions.md`), 'utf8');
      const copilotFrontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(copilot)?.[1] ?? '';
      expect(frontmatterField(copilotFrontmatter, 'description')).toBe(shared.description);
      expect(copilot.endsWith(shared.body)).toBe(true);

      const grok = await readFile(resolve(rulesRoot, 'grok-rules', `${name}.md`), 'utf8');
      expect(grok).toBe(shared.body);
    }
  });

  test('scopes rules with globs only when the shared source declares them', async () => {
    const sharedNames = await listRuleNames(resolve(rulesRoot, 'shared'), '.md');
    for (const name of sharedNames) {
      const shared = parseSharedRule(name, await readFile(resolve(rulesRoot, 'shared', `${name}.md`), 'utf8'));
      const cursor = await readFile(resolve(rulesRoot, 'cursor-rules', `${name}.mdc`), 'utf8');
      const claude = await readFile(resolve(rulesRoot, 'claude-rules', `${name}.md`), 'utf8');
      const copilot = await readFile(resolve(rulesRoot, 'copilot-rules', `${name}.instructions.md`), 'utf8');
      const cursorFrontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(cursor)?.[1] ?? '';
      const claudeFrontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(claude)?.[1] ?? '';
      const copilotFrontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(copilot)?.[1] ?? '';

      if (shared.globs?.length) {
        expect(frontmatterField(cursorFrontmatter, 'globs'), `${name} must scope cursor via globs`).toBeTruthy();
        expect(frontmatterField(claudeFrontmatter, 'paths'), `${name} must scope claude via paths`).toBeTruthy();
        expect(frontmatterField(copilotFrontmatter, 'applyTo'), `${name} must scope copilot via applyTo`).toBeTruthy();
      } else {
        expect(frontmatterField(cursorFrontmatter, 'alwaysApply'), `${name} must apply always in cursor`).toBe('true');
        expect(claudeFrontmatter).not.toMatch(/^paths:/m);
        expect(frontmatterField(copilotFrontmatter, 'applyTo'), `${name} must apply to every copilot file`).toBe("'**'");
      }
    }
  });

  test('keeps the Cursor plugin manifest pointed at the generated rules tree', async () => {
    const manifest = JSON.parse(await readFile(resolve(repositoryRoot, '.cursor-plugin', 'plugin.json'), 'utf8')) as { rules?: string };
    expect(manifest.rules).toBe('./rules/cursor-rules');
    expect((await stat(resolve(repositoryRoot, manifest.rules ?? ''))).isDirectory()).toBe(true);
  });
});
