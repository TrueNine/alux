#!/usr/bin/env bun

import { access, cp, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export type MixSharedSkillsResult = {
	copiedSkills: string[];
	targetDirectories: string[];
};

async function exists(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function directoriesWithin(path: string): Promise<string[]> {
	const entries = await readdir(path, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right));
}

/** Synchronizes shared skills while preserving platform-specific files. */
export async function mixSharedSkills(
	skillsRoot: string,
): Promise<MixSharedSkillsResult> {
	const sharedRoot = join(skillsRoot, "shared");
	if (!(await exists(sharedRoot))) {
		throw new Error(`Shared skills directory does not exist: ${sharedRoot}`);
	}

	const [sharedSkills, targetDirectories] = await Promise.all([
		directoriesWithin(sharedRoot),
		directoriesWithin(skillsRoot).then((directories) =>
			directories.filter(
				(directory) => directory !== "shared" && directory.endsWith("-skills"),
			),
		),
	]);
	if (targetDirectories.length === 0) {
		throw new Error(`No native skills directories found under: ${skillsRoot}`);
	}

	for (const targetDirectory of targetDirectories) {
		for (const skill of sharedSkills) {
			await cp(
				join(sharedRoot, skill),
				join(skillsRoot, targetDirectory, skill),
				{ recursive: true, force: true },
			);
		}
	}

	return { copiedSkills: sharedSkills, targetDirectories };
}

function usage(): never {
	console.error(
		"Usage: mixining-shared-skills-to-native-skills.ts [skills-root]",
	);
	process.exit(2);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.length > 1 || args.some((arg) => arg.startsWith("-"))) usage();

	try {
		const skillsRoot = resolve(
			args[0] ?? join(dirname(import.meta.dir), "skills"),
		);
		const result = await mixSharedSkills(skillsRoot);
		console.log(
			`Copied ${result.copiedSkills.length} shared skill(s) to ${result.targetDirectories.length} native director(ies).`,
		);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}

if (import.meta.main) await main();
