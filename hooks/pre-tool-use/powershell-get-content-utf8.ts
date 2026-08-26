#!/usr/bin/env bun

type OffsetFinder = (command: string) => number[];

const parserScript = `
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$source = [System.Text.Encoding]::UTF8.GetString(
  [System.Convert]::FromBase64String($env:CODEX_GET_CONTENT_COMMAND)
)
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput(
  $source,
  [ref]$tokens,
  [ref]$parseErrors
)
$offsets = @(
  $ast.FindAll({
    param($node)
    if ($node -isnot [System.Management.Automation.Language.CommandAst]) { return $false }
    if ($node.GetCommandName() -ine "Get-Content") { return $false }
    $hasEncoding = $node.CommandElements | Where-Object {
      $_ -is [System.Management.Automation.Language.CommandParameterAst] -and
      $_.ParameterName -ieq "Encoding"
    } | Select-Object -First 1
    return -not $hasEncoding
  }, $true) | ForEach-Object {
    $_.CommandElements[0].Extent.EndOffset
  }
)
[Console]::Write((ConvertTo-Json -InputObject $offsets -Compress))
`;

function powershellEncodedCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function findGetContentInsertionOffsets(command: string): number[] {
  try {
    const result = Bun.spawnSync({
      cmd: ['powershell.exe', '-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', powershellEncodedCommand(parserScript)],
      env: {
        ...process.env,
        CODEX_GET_CONTENT_COMMAND: Buffer.from(command, 'utf8').toString('base64'),
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (result.exitCode !== 0) return [];
    const output = new TextDecoder().decode(result.stdout).trim();
    if (!output) return [];
    const parsed = JSON.parse(output) as unknown;
    if (typeof parsed === 'number') return [parsed];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is number => Number.isInteger(value));
  } catch {
    return [];
  }
}

export function rewritePowerShellGetContent(command: string, platform: NodeJS.Platform = process.platform, findOffsets: OffsetFinder = findGetContentInsertionOffsets): string | undefined {
  if (platform !== 'win32' || !/\bGet-Content\b/i.test(command)) return;
  const offsets = [...new Set(findOffsets(command))].filter((offset) => offset >= 0 && offset <= command.length).sort((left, right) => right - left);
  if (offsets.length === 0) return;

  let rewritten = command;
  for (const offset of offsets) rewritten = `${rewritten.slice(0, offset)} -Encoding utf8${rewritten.slice(offset)}`;
  return rewritten === command ? undefined : rewritten;
}
