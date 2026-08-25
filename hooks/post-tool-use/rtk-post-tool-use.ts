#!/usr/bin/env bun
// GitHub: https://github.com/rtk-ai/rtk
// Documentation: https://github.com/rtk-ai/rtk/blob/develop/hooks/README.md
import "../shared/log";

const shellTools = new Set([
	"Bash",
	"shell",
	"exec",
	"exec_command",
	"unified_exec",
	"write_stdin",
]);
const platform = process.argv.includes("--claude")
	? "claude"
	: process.argv.includes("--codex")
		? "codex"
		: undefined;
const replaySafeCommands = [
	/^(?:ls|tree|rg|grep|find|cat|sed|head|tail|nl|wc)(?:\s|$)/,
	/^git\s+(?:status|diff|log|show|branch|remote)(?:\s|$)/,
	/^cargo\s+(?:test|build|check|clippy|fmt|nextest)(?:\s|$)/,
	/^go\s+(?:test|build|vet)(?:\s|$)/,
	/^(?:bunx\s+)?(?:vitest|jest|tsc|next)(?:\s|$)/,
	/^(?:bunx\s+)?playwright\s+test(?:\s|$)/,
	/^(?:pytest|mypy|rspec|rubocop)(?:\s|$)/,
	/^ruff\s+(?:check|format\s+--check)(?:\s|$)/,
	/^dotnet\s+(?:test|build|restore)(?:\s|$)/,
	/^(?:npm|pnpm|yarn|bun)\s+(?:run(?:-script)?\s+)?(?:test|build|lint|check|typecheck|vitest|jest|tsc|next|playwright)(?:\b|:)/,
];
const unsafeTokens = ["&&", "||", ";", ">", ">>", "<", "2>", "&>", "$(", "`"];

type JsonObject = Record<string, unknown>;
type SpawnOptions = {
	cmd: string[];
	cwd?: string;
	stdout: "pipe";
	stderr: "pipe";
};
type SpawnResult = { exitCode: number; stdout: Uint8Array; stderr: Uint8Array };
type SpawnSync = (options: SpawnOptions) => SpawnResult;

const spawnSync: SpawnSync = (options) => Bun.spawnSync(options);

function asObject(value: unknown): JsonObject | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as JsonObject)
		: undefined;
}

function text(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(text).filter(Boolean).join("\n");
	const object = asObject(value);
	if (!object) return "";
	for (const key of [
		"aggregated_output",
		"output",
		"text",
		"stdout",
		"stderr",
		"message",
	]) {
		const result = text(object[key]);
		if (result) return result;
	}
	return "";
}

function originalOutput(response?: JsonObject): string {
	if (!response) return "";
	for (const key of ["aggregated_output", "output", "text"]) {
		const result = text(response[key]);
		if (result) return result;
	}
	return [text(response.stdout), text(response.stderr)]
		.filter(Boolean)
		.join("\n");
}

function commandFrom(input?: JsonObject): string | undefined {
	for (const key of ["command", "cmd"]) {
		const value = input?.[key];
		if (typeof value === "string" && value.trim()) return value;
	}
}

function normalized(command: string): string {
	return command.trim().replace(/\s+(?:2>\/dev\/null\s+)?\|\|\s+true\s*$/, "");
}

function isSafe(command: string): boolean {
	const value = normalized(command);
	if (!value || unsafeTokens.some((token) => value.includes(token)))
		return false;
	if (/^gh\s/.test(value))
		return /^gh\s+(?:issue|pr|run|repo)\s+(?:list|view|status|checks|diff)\b/.test(
			value,
		);
	if (/^docker(?:-compose)?\s/.test(value)) {
		return /^docker(?:-compose)?\s+(?:(?:compose\s+)?(?:ps|logs|images|info|inspect|version)|container\s+(?:inspect|logs|ls|ps)|image\s+(?:history|inspect|ls)|network\s+(?:inspect|ls)|system\s+(?:df|info)|volume\s+(?:inspect|ls))\b/.test(
			value,
		);
	}
	if (/^(?:\.\/)?gradlew\b|^gradle\b/.test(value)) {
		return (
			/\b(?:test|check|build|assemble|compile|classes|jar|dependencies|dependencyinsight|help|projects|properties|tasks|lint|detekt|ktlint)\b/i.test(
				value,
			) &&
			!/\b(?:clean|deploy|docker|install|jib|publish|release|run|upload)\b/i.test(
				value,
			)
		);
	}
	return replaySafeCommands.some((pattern) => pattern.test(value));
}

export function resolveOptimizedCommand(
	command: string,
	cwd?: string,
	spawn: SpawnSync = spawnSync,
): string | undefined {
	try {
		const result = spawn({
			cmd: ["rtk", "rewrite", command],
			cwd,
			stdout: "pipe",
			stderr: "pipe",
		});
		if (result.exitCode !== 0 && result.exitCode !== 3) return;
		const rewritten = new TextDecoder().decode(result.stdout).trim();
		if (rewritten && rewritten !== command) return rewritten;
	} catch {
		return;
	}
}

export function proxyInvocation(command: string): string[] {
	return ["rtk", "proxy", command];
}

function summarize(output: string): string | undefined {
	if (output.length < 2400) return;
	const lines = output.split("\n").filter(Boolean);
	const retained = [
		...lines.slice(0, 35),
		"... omitted verbose output ...",
		...lines.slice(-35),
	];
	return `Output summary (${lines.length} lines)\n${retained.map((line) => line.slice(0, 320)).join("\n")}`;
}

function emitReplacement(value: string): never {
	process.stderr.write(`${value}\n`);
	process.exit(2);
}

function execute(command: string, cwd?: string): void {
	const rewritten = resolveOptimizedCommand(command, cwd);
	if (!rewritten) return;
	try {
		const result = spawnSync({
			cmd: proxyInvocation(rewritten),
			cwd,
			stdout: "pipe",
			stderr: "pipe",
		});
		const output =
			`${new TextDecoder().decode(result.stdout)}${new TextDecoder().decode(result.stderr)}`.trim();
		if (output) emitReplacement(output);
	} catch {
		return;
	}
}

async function main(): Promise<void> {
	let payload: JsonObject;
	try {
		payload = JSON.parse(
			new TextDecoder().decode(await Bun.stdin.arrayBuffer()),
		) as JsonObject;
	} catch {
		return;
	}

	const toolName =
		typeof payload.tool_name === "string"
			? payload.tool_name
			: typeof payload.toolName === "string"
				? payload.toolName
				: "";
	if (
		!platform ||
		!toolName ||
		(platform === "claude" ? toolName !== "Bash" : !shellTools.has(toolName))
	)
		return;
	const input = asObject(payload.tool_input) ?? asObject(payload.toolInput);
	const response =
		asObject(payload.tool_response) ??
		asObject(payload.toolResponse) ??
		asObject(payload.response);
	const output = originalOutput(response);
	const summary = summarize(output);
	if (summary) emitReplacement(summary);
	const command = commandFrom(input);
	if (!command || !isSafe(command)) return;
	const exitCode = response?.exit_code ?? response?.exitCode;
	if (typeof exitCode === "number" && exitCode !== 0) return;
	const cwd =
		typeof input?.workdir === "string"
			? input.workdir
			: typeof payload.cwd === "string"
				? payload.cwd
				: undefined;
	execute(normalized(command), cwd);
}

if (import.meta.main) await main();
