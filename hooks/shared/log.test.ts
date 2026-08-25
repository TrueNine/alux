import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	appendLogRecord,
	hijackConsole,
	type LogRecord,
	platformFromArgv,
} from "./log";

const timestamp = "2026-08-25T00:00:00.000Z";

function temporaryLogFile(): { directory: string; logFile: string } {
	const directory = mkdtempSync(join(tmpdir(), "alux-log-"));
	return { directory, logFile: join(directory, "nested", "claude.jsonl") };
}

test("detects Claude and Codex modes from argv", () => {
	expect(platformFromArgv(["bun", "hook.ts", "--claude"])).toBe("claude");
	expect(platformFromArgv(["bun", "hook.ts", "--codex"])).toBe("codex");
	expect(platformFromArgv(["bun", "hook.ts"])).toBeUndefined();
});

test("appends one valid JSON object per line", () => {
	const { directory, logFile } = temporaryLogFile();
	const record: LogRecord = {
		timestamp,
		platform: "claude",
		level: "info",
		message: "first",
		arguments: ["first"],
	};
	try {
		expect(appendLogRecord(logFile, record)).toBe(true);
		expect(appendLogRecord(logFile, { ...record, message: "second" })).toBe(
			true,
		);
		const content = readFileSync(logFile, "utf8");
		expect(content.endsWith("\n")).toBe(true);
		expect(
			content
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line)),
		).toEqual([record, { ...record, message: "second" }]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("hijacks console methods and restores them", () => {
	const { directory, logFile } = temporaryLogFile();
	const originalLog = console.log;
	const logger = hijackConsole({
		argv: ["bun", "hook.ts", "--claude"],
		logFile,
		now: () => new Date(timestamp),
		sound: false,
	});
	try {
		expect(logger.platform).toBe("claude");
		expect(logger.logFile).toBe(logFile);
		console.log("hello", { answer: 42 });
		console.error(new Error("broken"));

		const records = readFileSync(logFile, "utf8")
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));
		expect(records).toHaveLength(2);
		expect(records[0]).toEqual({
			timestamp,
			platform: "claude",
			level: "log",
			message: "hello { answer: 42 }",
			arguments: ["hello", { answer: 42 }],
		});
		expect(records[1].level).toBe("error");
		expect(records[1].arguments[0]).toMatchObject({
			name: "Error",
			message: "broken",
		});
	} finally {
		logger.restore();
		rmSync(directory, { recursive: true, force: true });
	}
	expect(console.log).toBe(originalLog);
});

test("does not hijack console without a platform mode", () => {
	const originalLog = console.log;
	const logger = hijackConsole({ argv: ["bun", "hook.ts"] });

	expect(logger.platform).toBeUndefined();
	expect(console.log).toBe(originalLog);
	logger.restore();
});

test("logging failures are fail-open", () => {
	expect(
		appendLogRecord("/dev/null/alux.jsonl", {
			timestamp,
			platform: "codex",
			level: "error",
			message: "ignored",
			arguments: [],
		}),
	).toBe(false);
});
