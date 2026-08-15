#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { rewritePowerShellGetContent } from "./powershell-get-content-utf8";

type JsonObject = Record<string, unknown>;
type CommandRewriter = (
	command: string,
	platform?: NodeJS.Platform,
) => string | undefined;
type MarkerRefresher = (
	command: string,
	platform?: NodeJS.Platform,
	localAppData?: string,
) => boolean;

function asObject(value: unknown): JsonObject | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as JsonObject)
		: undefined;
}

function commandFrom(input?: JsonObject): string | undefined {
	for (const key of ["command", "cmd"]) {
		const value = input?.[key];
		if (typeof value === "string" && value.trim()) return value;
	}
}

export function refreshRtkWarningMarker(
	command: string,
	platform: NodeJS.Platform = process.platform,
	localAppData = process.env.LOCALAPPDATA,
): boolean {
	if (
		platform !== "win32" ||
		!localAppData ||
		!/^rtk(?:\.exe)?(?:\s|$)/i.test(command.trim())
	)
		return false;

	try {
		const dataDirectory = join(localAppData, "rtk");
		mkdirSync(dataDirectory, { recursive: true });
		writeFileSync(join(dataDirectory, ".hook_warn_last"), "");
		return true;
	} catch {
		return false;
	}
}

export function preprocessCommand(
	command: string,
	platform: NodeJS.Platform = process.platform,
	localAppData = process.env.LOCALAPPDATA,
	rewrite: CommandRewriter = rewritePowerShellGetContent,
	refreshMarker: MarkerRefresher = refreshRtkWarningMarker,
): string | undefined {
	const rewritten = rewrite(command, platform);
	refreshMarker(rewritten ?? command, platform, localAppData);
	return rewritten;
}

async function main(): Promise<void> {
	try {
		const payload = JSON.parse(
			new TextDecoder().decode(await Bun.stdin.arrayBuffer()),
		) as JsonObject;
		const input = asObject(payload.tool_input) ?? asObject(payload.toolInput);
		const command = commandFrom(input);
		if (!command) return;
		const rewritten = preprocessCommand(command);
		if (!rewritten) return;
		process.stdout.write(
			`${JSON.stringify({
				hookSpecificOutput: {
					hookEventName: "PreToolUse",
					permissionDecision: "allow",
					updatedInput: { ...input, command: rewritten },
				},
			})}\n`,
		);
	} catch {
		return;
	}
}

if (import.meta.main) await main();
