#!/usr/bin/env bun

import {
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

const derivedFiles = ["CLAUDE.md", "GEMINI.md"] as const;

function appendExcludedFiles(excludePath: string): void {
	const existing = existsSync(excludePath)
		? readFileSync(excludePath, "utf8")
		: "";
	const entries = existing.split(/\r?\n/);
	const missing = derivedFiles.filter((file) => !entries.includes(file));
	if (missing.length === 0) return;

	const separator = existing && !existing.endsWith("\n") ? "\n" : "";
	writeFileSync(excludePath, `${existing}${separator}${missing.join("\n")}\n`);
}

export function synchronizeAgentInstructions(worktree: string): void {
	try {
		const agentsPath = join(worktree, "AGENTS.md");
		if (!existsSync(agentsPath)) return;

		const agents = readFileSync(agentsPath, "utf8");
		for (const file of derivedFiles) {
			writeFileSync(join(worktree, file), agents.replaceAll("AGENTS.md", file));
		}

		const gitDirectory = join(worktree, ".git");
		if (!existsSync(gitDirectory) || !statSync(gitDirectory).isDirectory())
			return;

		const infoDirectory = join(gitDirectory, "info");
		mkdirSync(infoDirectory, { recursive: true });
		appendExcludedFiles(join(infoDirectory, "exclude"));
	} catch {
		// SessionStart must not prevent Claude from starting when local files are unavailable.
	}
}

async function main(): Promise<void> {
	try {
		const payload = JSON.parse(
			new TextDecoder().decode(await Bun.stdin.arrayBuffer()),
		) as { cwd?: unknown };
		const worktree =
			typeof payload.cwd === "string" ? payload.cwd : process.cwd();
		synchronizeAgentInstructions(worktree);
	} catch {
		return;
	}
}

if (import.meta.main) await main();
