import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { inspect } from 'node:util';
import { emitLogSound, type SoundLogLevel, type SoundLogOptions } from './sound-log';

export type LogPlatform = 'claude' | 'codex' | 'cursor' | 'cline';
export type LogLevel = SoundLogLevel;

export type LogRecord = {
  timestamp: string;
  platform: LogPlatform;
  level: LogLevel;
  message: string;
  arguments: unknown[];
};

export type LoggerOptions = {
  argv?: readonly string[];
  logFile?: string;
  now?: () => Date;
  sound?: boolean | SoundLogOptions;
};

export type ConsoleLogger = Pick<Console, 'debug' | 'error' | 'info' | 'log' | 'trace' | 'warn'> & {
  readonly platform?: LogPlatform;
  readonly logFile?: string;
  restore(): void;
};

const levels: readonly LogLevel[] = ['debug', 'error', 'info', 'log', 'trace', 'warn'];

function defaultLogFile(platform: LogPlatform): string {
  const stateDirectory = process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state');
  return join(stateDirectory, 'alux', `${platform}.jsonl`);
}

function serializeArgument(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? inspect(value) : JSON.parse(serialized);
  } catch {
    return inspect(value);
  }
}

function formatMessage(arguments_: unknown[]): string {
  return arguments_.map((value) => (typeof value === 'string' ? value : inspect(value, { depth: 6 }))).join(' ');
}

export function platformFromArgv(argv: readonly string[] = process.argv): LogPlatform | undefined {
  if (argv.includes('--claude')) return 'claude';
  if (argv.includes('--codex')) return 'codex';
  if (argv.includes('--cursor')) return 'cursor';
  if (argv.includes('--cline')) return 'cline';
}

export function appendLogRecord(logFile: string, record: LogRecord): boolean {
  try {
    mkdirSync(dirname(logFile), { recursive: true });
    appendFileSync(logFile, `${JSON.stringify(record)}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Replaces console logging methods with JSONL writers. `restore` puts the
 * original methods back. Without `--claude`, `--codex`, or `--cursor`, this is a no-op.
 */
export function hijackConsole(options: LoggerOptions = {}): ConsoleLogger {
  const platform = platformFromArgv(options.argv);
  const original = Object.fromEntries(levels.map((level) => [level, console[level]])) as Record<LogLevel, (...arguments_: unknown[]) => void>;
  let restored = false;

  if (!platform) {
    return {
      debug: console.debug.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
      log: console.log.bind(console),
      trace: console.trace.bind(console),
      warn: console.warn.bind(console),
      platform: undefined,
      logFile: undefined,
      restore() {},
    };
  }

  const logFile = options.logFile ?? defaultLogFile(platform);
  const soundOptions = typeof options.sound === 'object' ? options.sound : undefined;
  const soundEnabled = options.sound !== false;

  for (const level of levels) {
    console[level] = (...arguments_: unknown[]) => {
      appendLogRecord(logFile, {
        timestamp: (options.now ?? (() => new Date()))().toISOString(),
        platform,
        level,
        message: formatMessage(arguments_),
        arguments: arguments_.map(serializeArgument),
      });
      if (soundEnabled) emitLogSound(level, soundOptions);
    };
  }

  return Object.assign(console, {
    platform,
    logFile,
    restore() {
      if (restored) return;
      restored = true;
      for (const level of levels) console[level] = original[level];
      Reflect.deleteProperty(console, 'platform');
      Reflect.deleteProperty(console, 'logFile');
      Reflect.deleteProperty(console, 'restore');
    },
  }) as ConsoleLogger;
}

export const logger = hijackConsole();
