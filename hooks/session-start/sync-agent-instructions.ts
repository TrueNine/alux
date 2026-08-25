#!/usr/bin/env bun

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

const derivedFiles = ["CLAUDE.md", "GEMINI.md"] as const;
const ignoredDirectories = new Set([".git", "node_modules"]);

function findAgentInstructionFiles(worktree: string): string[] {
	const agentFiles: string[] = [];

	function visit(directory: string): void {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) {
				if (!ignoredDirectories.has(entry.name)) visit(path);
				continue;
			}
			if (entry.isFile() && entry.name === "AGENTS.md") agentFiles.push(path);
		}
	}

	visit(worktree);
	return agentFiles;
}

function appendExcludedFiles(excludePath: string, files: string[]): void {
	const existing = existsSync(excludePath)
		? readFileSync(excludePath, "utf8")
		: "";
	const entries = existing.split(/\r?\n/);
	const missing = files.filter((file) => !entries.includes(file));
	if (missing.length === 0) return;

	const separator = existing && !existing.endsWith("\n") ? "\n" : "";
	writeFileSync(excludePath, `${existing}${separator}${missing.join("\n")}\n`);
}

export function synchronizeAgentInstructions(worktree: string): void {
	try {
		const agentsFiles = findAgentInstructionFiles(worktree);
		if (agentsFiles.length === 0) return;

		const derivedPaths: string[] = [];
		for (const agentsPath of agentsFiles) {
			const agents = readFileSync(agentsPath, "utf8");
			const instructionDirectory = dirname(agentsPath);
			for (const file of derivedFiles) {
				const derivedPath = join(instructionDirectory, file);
				writeFileSync(derivedPath, agents.replaceAll("AGENTS.md", file));
				derivedPaths.push(
					relative(worktree, derivedPath).replaceAll("\\", "/"),
				);
			}
		}

		const gitDirectory = join(worktree, ".git");
		if (!existsSync(gitDirectory) || !statSync(gitDirectory).isDirectory())
			return;

		const infoDirectory = join(gitDirectory, "info");
		mkdirSync(infoDirectory, { recursive: true });
		appendExcludedFiles(join(infoDirectory, "exclude"), derivedPaths);
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
