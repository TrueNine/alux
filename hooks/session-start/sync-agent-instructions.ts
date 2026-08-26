#!/usr/bin/env bun

import {
	type Dirent,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const derivedFiles = ["CLAUDE.md", "GEMINI.md"] as const;
const ignoredDirectories = new Set([".git", "node_modules"]);

function findInstructionRoot(workingDirectory: string): string {
	const initialDirectory = resolve(workingDirectory);
	let directory = initialDirectory;
	while (true) {
		if (existsSync(join(directory, ".git"))) return directory;
		const parent = dirname(directory);
		if (parent === directory) return initialDirectory;
		directory = parent;
	}
}

function findRepositoryRoot(directory: string, boundary: string): string {
	let current = resolve(directory);
	const root = resolve(boundary);
	while (true) {
		if (existsSync(join(current, ".git"))) return current;
		if (current === root) return root;
		const parent = dirname(current);
		if (parent === current) return root;
		current = parent;
	}
}

function findAgentInstructionFiles(worktree: string): string[] {
	const agentFiles: string[] = [];

	function visit(directory: string): void {
		let entries: Dirent[];
		try {
			entries = readdirSync(directory, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			const path = join(directory, entry.name);
			try {
				if (entry.isDirectory()) {
					if (!ignoredDirectories.has(entry.name)) visit(path);
					continue;
				}
				if (
					(entry.isFile() || entry.isSymbolicLink()) &&
					entry.name === "AGENTS.md"
				)
					agentFiles.push(path);
			} catch {
				// Ignore entries that disappear or become unavailable during traversal.
			}
		}
	}

	visit(worktree);
	return agentFiles;
}

function gitExcludePath(worktree: string): string | undefined {
	const gitPath = join(worktree, ".git");
	try {
		if (!existsSync(gitPath)) return;
		if (statSync(gitPath).isDirectory())
			return join(gitPath, "info", "exclude");

		const gitFile = readFileSync(gitPath, "utf8").trim();
		const match = gitFile.match(/^gitdir:\s*(.+)$/im);
		if (!match) return;
		const gitDirectory = resolve(dirname(gitPath), match[1].trim());
		if (!existsSync(gitDirectory)) return;
		const commonDirectoryPath = join(gitDirectory, "commondir");
		if (existsSync(commonDirectoryPath)) {
			const commonDirectory = readFileSync(commonDirectoryPath, "utf8").trim();
			if (commonDirectory) {
				return join(resolve(gitDirectory, commonDirectory), "info", "exclude");
			}
		}
		return join(gitDirectory, "info", "exclude");
	} catch {
		return;
	}
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

export function synchronizeAgentInstructions(workingDirectory: string): void {
	try {
		const worktree = findInstructionRoot(workingDirectory);
		const agentsFiles = findAgentInstructionFiles(worktree);
		if (agentsFiles.length === 0) return;

		const repositories = new Set<string>();
		for (const agentsPath of agentsFiles) {
			let agents: string;
			try {
				agents = readFileSync(agentsPath, "utf8");
			} catch {
				continue;
			}

			const instructionDirectory = dirname(agentsPath);
			const repository = findRepositoryRoot(instructionDirectory, worktree);
			repositories.add(repository);
			for (const file of derivedFiles) {
				try {
					const derivedPath = join(instructionDirectory, file);
					writeFileSync(derivedPath, agents.replaceAll("AGENTS.md", file));
				} catch {
					// Continue synchronizing other instruction files when one is unavailable.
				}
			}
		}

		for (const repository of repositories) {
			try {
				const excludePath = gitExcludePath(repository);
				if (!excludePath) continue;
				mkdirSync(dirname(excludePath), { recursive: true });
				appendExcludedFiles(excludePath, [...derivedFiles]);
			} catch {
				// Continue updating other repositories when one Git directory is unavailable.
			}
		}
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
