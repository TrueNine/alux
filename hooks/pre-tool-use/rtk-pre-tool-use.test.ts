import { expect, test } from "bun:test";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preprocessCommand, refreshRtkWarningMarker } from "./rtk-pre-tool-use";

const hooksDirectory = join(import.meta.dir, "..");
const entrypoint = join(import.meta.dir, "rtk-pre-tool-use.ts");

test("PreToolUse invokes the Bun TypeScript entrypoint", () => {
	const configuration = JSON.parse(
		readFileSync(join(hooksDirectory, "hooks.codex.json"), "utf8"),
	);
	const group = configuration.hooks.PreToolUse[0];

	expect(group).toEqual({
		matcher: "^(Bash|exec|exec_command|unified_exec)$",
		hooks: [
			{
				type: "command",
				command: `bun "\${PLUGIN_ROOT}/hooks/pre-tool-use/rtk-pre-tool-use.ts"`,
				statusMessage: "PowerShell UTF-8 and RTK preprocessing",
			},
		],
	});
});

test("refreshes the Windows RTK warning marker before an RTK command", () => {
	const localAppData = mkdtempSync(join(tmpdir(), "rtk-pre-tool-use-"));
	try {
		expect(
			refreshRtkWarningMarker("  rtk git status", "win32", localAppData),
		).toBe(true);
		const marker = join(localAppData, "rtk", ".hook_warn_last");
		expect(existsSync(marker)).toBe(true);
		expect(Date.now() - statSync(marker).mtimeMs).toBeLessThan(5_000);
	} finally {
		rmSync(localAppData, { recursive: true, force: true });
	}
});

test("rewrites PowerShell Get-Content before RTK preprocessing", () => {
	const calls: string[] = [];
	const rewritten = preprocessCommand(
		"Get-Content README.md",
		"win32",
		"C:\\local-app-data",
		(command) => {
			calls.push(`utf8:${command}`);
			return "Get-Content -Encoding utf8 README.md";
		},
		(command) => {
			calls.push(`rtk:${command}`);
			return false;
		},
	);

	expect(rewritten).toBe("Get-Content -Encoding utf8 README.md");
	expect(calls).toEqual([
		"utf8:Get-Content README.md",
		"rtk:Get-Content -Encoding utf8 README.md",
	]);
});

test("does not touch the marker for unrelated commands or non-Windows platforms", () => {
	const localAppData = mkdtempSync(join(tmpdir(), "rtk-pre-tool-use-"));
	try {
		expect(refreshRtkWarningMarker("git status", "win32", localAppData)).toBe(
			false,
		);
		expect(
			refreshRtkWarningMarker("rtk git status", "linux", localAppData),
		).toBe(false);
		expect(existsSync(join(localAppData, "rtk", ".hook_warn_last"))).toBe(
			false,
		);
	} finally {
		rmSync(localAppData, { recursive: true, force: true });
	}
});

test("TypeScript entrypoint is a fail-open no-op for invalid input", () => {
	const result = Bun.spawnSync({
		cmd: ["bun", entrypoint],
		stdin: new TextEncoder().encode("not json"),
		stdout: "pipe",
		stderr: "pipe",
	});

	expect(result.exitCode).toBe(0);
	expect(new TextDecoder().decode(result.stdout)).toBe("");
	expect(new TextDecoder().decode(result.stderr)).toBe("");
});
