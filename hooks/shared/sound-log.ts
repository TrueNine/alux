export type SoundLogLevel =
	| "debug"
	| "error"
	| "info"
	| "log"
	| "trace"
	| "warn";

type ExecutableResolver = (executable: string) => string | null;
type CommandRunner = (command: string[]) => void;

export type SoundLogOptions = {
	enabled?: boolean;
	platform?: NodeJS.Platform;
	resolveExecutable?: ExecutableResolver;
	run?: CommandRunner;
};

const windowsFrequencies: Record<SoundLogLevel, number> = {
	debug: 440,
	error: 880,
	info: 523,
	log: 523,
	trace: 440,
	warn: 659,
};

function defaultRun(command: string[]): void {
	const subprocess = Bun.spawn({
		cmd: command,
		stdin: "ignore",
		stdout: "ignore",
		stderr: "ignore",
	});
	subprocess.unref();
}

function resolveCommand(
	level: SoundLogLevel,
	platform: NodeJS.Platform,
	resolveExecutable: ExecutableResolver,
): string[] | undefined {
	if (platform === "darwin") {
		const afplay = resolveExecutable("afplay");
		if (!afplay) return;
		const sound =
			level === "error" ? "Basso" : level === "warn" ? "Funk" : "Pop";
		return [afplay, `/System/Library/Sounds/${sound}.aiff`];
	}

	if (platform === "win32") {
		const powershell =
			resolveExecutable("powershell.exe") ?? resolveExecutable("pwsh.exe");
		if (!powershell) return;
		return [
			powershell,
			"-NoLogo",
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			`[Console]::Beep(${windowsFrequencies[level]}, 120)`,
		];
	}

	if (platform === "linux") {
		const canberra = resolveExecutable("canberra-gtk-play");
		if (!canberra) return;
		const sound =
			level === "error"
				? "dialog-error"
				: level === "warn"
					? "dialog-warning"
					: "message-new-instant";
		return [canberra, `--id=${sound}`];
	}
}

/** Plays a best-effort, non-blocking sound without writing to stdout or stderr. */
export function emitLogSound(
	level: SoundLogLevel,
	options: SoundLogOptions = {},
): boolean {
	if (options.enabled === false) return false;

	try {
		const command = resolveCommand(
			level,
			options.platform ?? process.platform,
			options.resolveExecutable ?? ((executable) => Bun.which(executable)),
		);
		if (!command) return false;
		(options.run ?? defaultRun)(command);
		return true;
	} catch {
		return false;
	}
}
