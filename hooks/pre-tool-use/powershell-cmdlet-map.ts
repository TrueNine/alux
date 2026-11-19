#!/usr/bin/env bun

// Hook-level adapter for PowerShell-hosted agents (Codex/Copilot on Windows):
// rtk has no rewrite support for PowerShell cmdlets (`rtk rewrite` exits 1 for
// `Get-ChildItem`, `Get-Content`, `Select-String`, and Windows-native tools),
// so common read-only cmdlets are translated into POSIX candidates the `rtk
// rewrite` consult understands. The mapping never rewrites by itself: the
// candidate only reaches the model after rtk confirms its RTK form, and a
// refused or failed consult falls back to the previous pipeline (the
// PowerShell UTF-8 rewrite for `Get-Content`, or an untouched passthrough).

// Compound, pipe, redirection, substitution, and quoting constructs stay out
// of the map: token translation is only sound for plain argument lists.
const shellConstructs = /(?:&&|\|\||[;|&<>]|\$\(|`|'|")/;

const cmdletTranslations: Record<string, { posix: string; allowRecursive?: boolean; requireArgument?: boolean }> = {
  'get-childitem': { posix: 'ls', allowRecursive: true },
  gci: { posix: 'ls', allowRecursive: true },
  'get-content': { posix: 'cat', requireArgument: true },
  gc: { posix: 'cat', requireArgument: true },
  'select-string': { posix: 'rg', requireArgument: true },
  sls: { posix: 'rg', requireArgument: true },
};

export function mapPowerShellCmdlets(command: string, platform: NodeJS.Platform = process.platform): string | undefined {
  if (platform !== 'win32') return undefined;
  const value = command.trim();
  if (!value || shellConstructs.test(value)) return undefined;
  const tokens = value.split(/\s+/);
  const translation = cmdletTranslations[tokens[0].toLowerCase()];
  if (!translation) return undefined;
  const arguments_ = tokens.slice(1);
  const recursive = translation.allowRecursive === true && arguments_.some((token) => /^-recurse$/i.test(token));
  const positional = arguments_.filter((token) => !token.startsWith('-'));
  // Any parameter other than a lone `-Recurse` refuses the map: flag semantics
  // differ per cmdlet (`-Tail`, `-Filter`, `-Name`, `-Raw`, …) and would be lost.
  if (arguments_.length !== positional.length + (recursive ? 1 : 0)) return undefined;
  if (translation.requireArgument === true && positional.length === 0) return undefined;
  const flags = recursive ? ['-R'] : [];
  return [translation.posix, ...flags, ...positional].join(' ');
}
