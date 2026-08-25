import { expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { synchronizeAgentInstructions } from "./sync-agent-instructions";

function createWorktree(): string {
	const worktree = mkdtempSync(join(tmpdir(), "alux-session-start-"));
	mkdirSync(join(worktree, ".git", "info"), { recursive: true });
	return worktree;
}

test("derives Claude and Gemini instructions and excludes them locally", () => {
	const worktree = createWorktree();
	const agents = "Read AGENTS.md before changing AGENTS.md.\n";
	writeFileSync(join(worktree, "AGENTS.md"), agents);
	writeFileSync(join(worktree, ".git", "info", "exclude"), "local-only\n");

	synchronizeAgentInstructions(worktree);
	synchronizeAgentInstructions(worktree);

	expect(readFileSync(join(worktree, "AGENTS.md"), "utf8")).toBe(agents);
	expect(readFileSync(join(worktree, "CLAUDE.md"), "utf8")).toBe(
		"Read CLAUDE.md before changing CLAUDE.md.\n",
	);
	expect(readFileSync(join(worktree, "GEMINI.md"), "utf8")).toBe(
		"Read GEMINI.md before changing GEMINI.md.\n",
	);
	const exclude = readFileSync(
		join(worktree, ".git", "info", "exclude"),
		"utf8",
	);
	expect(exclude.match(/^CLAUDE\.md$/gm)).toHaveLength(1);
	expect(exclude.match(/^GEMINI\.md$/gm)).toHaveLength(1);
});

test("derives nested Claude and Gemini instructions", () => {
	const worktree = createWorktree();
	const nestedDirectory = join(worktree, "skills", "example");
	mkdirSync(nestedDirectory, { recursive: true });
	writeFileSync(
		join(nestedDirectory, "AGENTS.md"),
		"Read skills/example/AGENTS.md before changing it.\n",
	);

	synchronizeAgentInstructions(worktree);

	expect(readFileSync(join(nestedDirectory, "CLAUDE.md"), "utf8")).toBe(
		"Read skills/example/CLAUDE.md before changing it.\n",
	);
	expect(readFileSync(join(nestedDirectory, "GEMINI.md"), "utf8")).toBe(
		"Read skills/example/GEMINI.md before changing it.\n",
	);
	const exclude = readFileSync(
		join(worktree, ".git", "info", "exclude"),
		"utf8",
	);
	expect(exclude).toContain("skills/example/CLAUDE.md");
	expect(exclude).toContain("skills/example/GEMINI.md");
});

test("does nothing when AGENTS.md is absent", () => {
	const worktree = createWorktree();

	synchronizeAgentInstructions(worktree);

	expect(existsSync(join(worktree, "CLAUDE.md"))).toBe(false);
	expect(existsSync(join(worktree, "GEMINI.md"))).toBe(false);
	expect(existsSync(join(worktree, ".git", "info", "exclude"))).toBe(false);
});

test("does not create a Git directory outside a Git worktree", () => {
	const worktree = mkdtempSync(join(tmpdir(), "alux-session-start-"));
	writeFileSync(join(worktree, "AGENTS.md"), "Read AGENTS.md.\n");

	synchronizeAgentInstructions(worktree);

	expect(readFileSync(join(worktree, "CLAUDE.md"), "utf8")).toBe(
		"Read CLAUDE.md.\n",
	);
	expect(readFileSync(join(worktree, "GEMINI.md"), "utf8")).toBe(
		"Read GEMINI.md.\n",
	);
	expect(existsSync(join(worktree, ".git"))).toBe(false);
});

test("Claude registers the synchronizer for SessionStart", () => {
	const configuration = JSON.parse(
		readFileSync(join(import.meta.dir, "..", "hooks.claude.json"), "utf8"),
	);

	expect(configuration.hooks.SessionStart).toEqual([
		{
			hooks: [
				{
					type: "command",
					command: `bun "\${CLAUDE_PLUGIN_ROOT}/hooks/session-start/sync-agent-instructions.ts"`,
					statusMessage: "Synchronizing local agent instructions",
				},
			],
		},
	]);
});

test("Codex registers the shared synchronizer for SessionStart", () => {
	const configuration = JSON.parse(
		readFileSync(join(import.meta.dir, "..", "hooks.codex.json"), "utf8"),
	);

	expect(configuration.hooks.SessionStart).toEqual([
		{
			hooks: [
				{
					type: "command",
					command: `bun "\${PLUGIN_ROOT}/hooks/session-start/sync-agent-instructions.ts"`,
					statusMessage: "Synchronizing local agent instructions",
				},
			],
		},
	]);
});
