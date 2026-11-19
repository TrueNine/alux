import { expect, test } from 'vitest';
import { mapPowerShellCmdlets } from './powershell-cmdlet-map';

test.each([
  ['Get-ChildItem', 'ls'],
  ['gci', 'ls'],
  ['GET-CHILDITEM', 'ls'],
  ['Get-ChildItem src', 'ls src'],
  ['Get-ChildItem -Recurse', 'ls -R'],
  ['gci -Recurse src', 'ls -R src'],
  ['Get-ChildItem src -recurse', 'ls -R src'],
  ['Get-Content README.md', 'cat README.md'],
  ['gc app.log', 'cat app.log'],
  ['Get-Content a.log b.log', 'cat a.log b.log'],
  ['Select-String Unreleased docs/CHANGELOG.md', 'rg Unreleased docs/CHANGELOG.md'],
  ['sls pattern file.txt', 'rg pattern file.txt'],
])('maps %s to %s on win32', (command, expected) => {
  expect(mapPowerShellCmdlets(command, 'win32')).toBe(expected);
});

test.each([
  ['Get-Content README.md -TotalCount 5'],
  ['Get-Content -Encoding utf8 README.md'],
  ['Get-ChildItem -Filter *.ts'],
  ['Get-ChildItem -Recurse -Filter *.ts'],
  ['Get-ChildItem -Name'],
  ['Select-String -Pattern foo file.txt'],
  ['Get-Content'],
  ['Select-String'],
  ['Get-ChildItem "my dir"'],
  ["Get-Content 'a b.log'"],
  ['Get-ChildItem && git status'],
  ['Get-ChildItem | Select-Object Name'],
  ['Get-Content a.log > out.txt'],
  ['Get-Content $(Join-Path $home app.log)'],
  ['Get-Process'],
  ['Get-ChildItem.exe'],
  ['git status'],
  ['rtk git status'],
])('refuses to map %s', (command) => {
  expect(mapPowerShellCmdlets(command, 'win32')).toBeUndefined();
});

test('does not map on non-Windows platforms', () => {
  expect(mapPowerShellCmdlets('Get-ChildItem', 'linux')).toBeUndefined();
  expect(mapPowerShellCmdlets('Get-Content README.md', 'darwin')).toBeUndefined();
});
