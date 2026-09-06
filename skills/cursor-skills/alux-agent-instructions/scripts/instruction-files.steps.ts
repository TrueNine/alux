import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { Before, Given, Then, When } from '@cucumber/cucumber';
import { findGovernedFiles, isGovernedFile, normalizedPath } from './instruction-files';

interface ScenarioState {
  relativePath?: string;
  governed?: boolean;
  root?: string;
  governedFiles?: string[];
}

const state: ScenarioState = {};
const temporaryRoots: string[] = [];

Before(() => {
  while (temporaryRoots.length) {
    const root = temporaryRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
  state.relativePath = undefined;
  state.governed = undefined;
  state.root = undefined;
  state.governedFiles = undefined;
});

function createTemporaryProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'alux-features-'));
  temporaryRoots.push(root);
  return root;
}

function writeFileAt(root: string, relativePath: string): void {
  const absolute = join(root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, normalizedPath(relativePath), 'utf-8');
}

Given('Alux uses the shared instruction-file rules', () => {
  // Intentional no-op: `instruction-files.ts` is imported directly by the steps.
});

Given('a relative path {string}', (relativePath: string) => {
  state.relativePath = relativePath;
});

Given('a windows relative path {string}', (relativePath: string) => {
  state.relativePath = relativePath;
});

When('I check whether it is a governed file', () => {
  const relativePath = state.relativePath;
  if (relativePath === undefined) throw new Error('no relative path was set');
  state.governed = isGovernedFile(relativePath);
});

Then('the result should be true', () => {
  if (state.governed !== true) throw new Error(`expected governed, got ${String(state.governed)}`);
});

Then('the result should be false', () => {
  if (state.governed !== false) throw new Error(`expected not governed, got ${String(state.governed)}`);
});

Given('a temporary project', () => {
  state.root = createTemporaryProject();
});

Given('a file at {string}', (relativePath: string) => {
  if (!state.root) throw new Error('no temporary project was created');
  writeFileAt(state.root, relativePath);
});

When('I list the governed files', () => {
  if (!state.root) throw new Error('no temporary project was created');
  const root = state.root;
  state.governedFiles = findGovernedFiles(root)
    .map((file) => normalizedPath(relative(root, file)))
    .sort();
});

Then('the governed files should be empty', () => {
  if (state.governedFiles && state.governedFiles.length > 0) {
    throw new Error(`expected no governed files, got ${state.governedFiles.join(', ')}`);
  }
});

Then('the governed files should be', (docString: string) => {
  const expected = docString
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort();
  const actual = [...(state.governedFiles ?? [])].sort();
  if (actual.join('\n') !== expected.join('\n')) {
    throw new Error(`expected governed files:\n${expected.join('\n')}\ngot:\n${actual.join('\n')}`);
  }
});
