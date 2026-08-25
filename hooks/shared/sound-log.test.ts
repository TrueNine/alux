import { expect, test } from "bun:test";
import { emitLogSound } from "./sound-log";

test("does not play a sound when disabled", () => {
	const commands: string[][] = [];
	expect(
		emitLogSound("error", {
			enabled: false,
			run: (command) => commands.push(command),
		}),
	).toBe(false);
	expect(commands).toEqual([]);
});

test("maps Linux log levels to desktop sounds", () => {
	const commands: string[][] = [];
	const result = emitLogSound("error", {
		platform: "linux",
		resolveExecutable: (executable) => `/usr/bin/${executable}`,
		run: (command) => commands.push(command),
	});

	expect(result).toBe(true);
	expect(commands).toEqual([
		["/usr/bin/canberra-gtk-play", "--id=dialog-error"],
	]);
});

test("uses the macOS system sound for warnings", () => {
	const commands: string[][] = [];
	emitLogSound("warn", {
		platform: "darwin",
		resolveExecutable: (executable) => `/usr/bin/${executable}`,
		run: (command) => commands.push(command),
	});

	expect(commands).toEqual([
		["/usr/bin/afplay", "/System/Library/Sounds/Funk.aiff"],
	]);
});

test("uses PowerShell for Windows sounds", () => {
	const commands: string[][] = [];
	emitLogSound("info", {
		platform: "win32",
		resolveExecutable: (executable) =>
			executable === "powershell.exe" ? "C:/Windows/powershell.exe" : null,
		run: (command) => commands.push(command),
	});

	expect(commands).toEqual([
		[
			"C:/Windows/powershell.exe",
			"-NoLogo",
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			"[Console]::Beep(523, 120)",
		],
	]);
});

test("silently skips unavailable sound providers", () => {
	const commands: string[][] = [];
	expect(
		emitLogSound("log", {
			platform: "linux",
			resolveExecutable: () => null,
			run: (command) => commands.push(command),
		}),
	).toBe(false);
	expect(commands).toEqual([]);
});
