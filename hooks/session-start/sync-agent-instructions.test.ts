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

test("derives instructions at every nested directory depth", () => {
	const worktree = createWorktree();
	const nestedDirectory = join(worktree, "one", "two", "three", "four", "five");
	mkdirSync(nestedDirectory, { recursive: true });
	writeFileSync(join(nestedDirectory, "AGENTS.md"), "Use AGENTS.md.\n");

	synchronizeAgentInstructions(worktree);

	expect(readFileSync(join(nestedDirectory, "CLAUDE.md"), "utf8")).toBe(
		"Use CLAUDE.md.\n",
	);
	expect(readFileSync(join(nestedDirectory, "GEMINI.md"), "utf8")).toBe(
		"Use GEMINI.md.\n",
	);
});

test("finds every AGENTS.md when SessionStart begins in a nested directory", () => {
	const worktree = createWorktree();
	const secondLevel = join(worktree, "one", "two");
	const fifthLevel = join(secondLevel, "three", "four", "five");
	mkdirSync(fifthLevel, { recursive: true });
	writeFileSync(join(worktree, "AGENTS.md"), "Root AGENTS.md.\n");
	writeFileSync(join(secondLevel, "AGENTS.md"), "Second AGENTS.md.\n");
	writeFileSync(join(fifthLevel, "AGENTS.md"), "Fifth AGENTS.md.\n");

	synchronizeAgentInstructions(join(worktree, "one"));

	for (const directory of [worktree, secondLevel, fifthLevel]) {
		expect(readFileSync(join(directory, "CLAUDE.md"), "utf8")).toContain(
			"CLAUDE.md",
		);
		expect(readFileSync(join(directory, "GEMINI.md"), "utf8")).toContain(
			"GEMINI.md",
		);
	}
});

test("synchronizes initialized submodules into their own Git exclude", () => {
	const worktree = createWorktree();
	const submodule = join(worktree, "vendor", "module");
	const submoduleGitDirectory = join(
		worktree,
		".git",
		"modules",
		"vendor",
		"module",
	);
	const nestedDirectory = join(submodule, "docs", "guide");
	mkdirSync(nestedDirectory, { recursive: true });
	mkdirSync(submoduleGitDirectory, { recursive: true });
	writeFileSync(join(submodule, ".git"), `gitdir: ${submoduleGitDirectory}\n`);
	writeFileSync(
		join(nestedDirectory, "AGENTS.md"),
		"Submodule docs/guide/AGENTS.md.\n",
	);

	synchronizeAgentInstructions(worktree);

	expect(readFileSync(join(nestedDirectory, "CLAUDE.md"), "utf8")).toBe(
		"Submodule docs/guide/CLAUDE.md.\n",
	);
	expect(readFileSync(join(nestedDirectory, "GEMINI.md"), "utf8")).toBe(
		"Submodule docs/guide/GEMINI.md.\n",
	);
	const submoduleExclude = readFileSync(
		join(submoduleGitDirectory, "info", "exclude"),
		"utf8",
	);
	expect(submoduleExclude).toContain("docs/guide/CLAUDE.md");
	expect(submoduleExclude).toContain("docs/guide/GEMINI.md");
	expect(existsSync(join(worktree, ".git", "info", "exclude"))).toBe(false);
});

test("ignores uninitialized submodule Git metadata safely", () => {
	const worktree = createWorktree();
	const submodule = join(worktree, "vendor", "module");
	mkdirSync(submodule, { recursive: true });
	writeFileSync(
		join(submodule, ".git"),
		"gitdir: ../../.git/modules/vendor/module\n",
	);
	writeFileSync(join(submodule, "AGENTS.md"), "Submodule AGENTS.md.\n");

	synchronizeAgentInstructions(worktree);

	expect(readFileSync(join(submodule, "CLAUDE.md"), "utf8")).toBe(
		"Submodule CLAUDE.md.\n",
	);
	expect(readFileSync(join(submodule, "GEMINI.md"), "utf8")).toBe(
		"Submodule GEMINI.md.\n",
	);
	expect(existsSync(join(worktree, ".git", "modules"))).toBe(false);
});

test("uses the common Git exclude for linked worktrees", () => {
	const worktree = mkdtempSync(join(tmpdir(), "alux-linked-worktree-"));
	const commonGitDirectory = join(worktree, "common.git");
	const linkedGitDirectory = join(commonGitDirectory, "worktrees", "linked");
	mkdirSync(linkedGitDirectory, { recursive: true });
	mkdirSync(join(worktree, "nested", "directory"), { recursive: true });
	writeFileSync(join(worktree, ".git"), `gitdir: ${linkedGitDirectory}\n`);
	writeFileSync(join(linkedGitDirectory, "commondir"), "../..\n");
	writeFileSync(
		join(worktree, "nested", "directory", "AGENTS.md"),
		"AGENTS.md\n",
	);

	synchronizeAgentInstructions(worktree);

	expect(
		readFileSync(join(commonGitDirectory, "info", "exclude"), "utf8"),
	).toContain("nested/directory/CLAUDE.md");
	expect(
		readFileSync(join(commonGitDirectory, "info", "exclude"), "utf8"),
	).toContain("nested/directory/GEMINI.md");
	expect(existsSync(join(linkedGitDirectory, "info", "exclude"))).toBe(false);
});

test("escapes Git ignore metacharacters in derived paths", () => {
	const worktree = createWorktree();
	const nestedDirectory = join(worktree, "skills", "[legacy]", "#draft");
	mkdirSync(nestedDirectory, { recursive: true });
	writeFileSync(join(nestedDirectory, "AGENTS.md"), "AGENTS.md\n");

	synchronizeAgentInstructions(worktree);

	const exclude = readFileSync(
		join(worktree, ".git", "info", "exclude"),
		"utf8",
	);
	expect(exclude).toContain("skills/\\[legacy\\]/\\#draft/CLAUDE.md");
	expect(exclude).toContain("skills/\\[legacy\\]/\\#draft/GEMINI.md");
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
