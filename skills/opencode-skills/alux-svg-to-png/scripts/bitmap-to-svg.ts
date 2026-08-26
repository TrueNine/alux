#!/usr/bin/env bun

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function usage(): never {
  console.error('Usage: bitmap-to-svg.ts <input.png> [output.svg] [--force] [--packages-dir <dir>] [--colors <n>] [--pathomit <n>] [--ltres <n>]');
  process.exit(2);
}

const args = process.argv.slice(2);
const positional: string[] = [];
const options: Record<string, string | boolean> = {};
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (!arg.startsWith('--')) {
    positional.push(arg);
    continue;
  }
  const name = arg.slice(2);
  if (name === 'force') {
    options.force = true;
    continue;
  }
  if (!['colors', 'pathomit', 'ltres', 'packages-dir'].includes(name)) usage();
  const value = args[index + 1];
  if (!value || value.startsWith('--')) usage();
  if (name !== 'packages-dir' && !/^\d+(?:\.\d+)?$/.test(value)) {
    usage();
  }
  options[name] = value;
  index += 1;
}

if (positional.length < 1 || positional.length > 2) usage();

const inputPath = resolve(positional[0]);
const outputPath = resolve(positional[1] ?? `${inputPath.slice(0, -extname(inputPath).length)}.svg`);
if (!existsSync(inputPath)) throw new Error(`Input does not exist: ${inputPath}`);
if (extname(inputPath).toLowerCase() !== '.png') {
  throw new Error('The vectorization script currently accepts PNG input');
}
if (extname(outputPath).toLowerCase() !== '.svg') {
  throw new Error(`Output must use the .svg extension: ${outputPath}`);
}
if (inputPath === outputPath) throw new Error('Input and output paths must differ');
if (existsSync(outputPath) && !options.force) {
  throw new Error(`Output already exists; pass --force to replace it: ${outputPath}`);
}

type PngModule = {
  PNG: {
    sync: {
      read(input: Uint8Array): {
        width: number;
        height: number;
        data: Uint8Array;
      };
    };
  };
};

type TracerModule = {
  imagedataToSVG(image: { width: number; height: number; data: Uint8Array }, options: Record<string, number>): string;
};

let pngModule: PngModule;
let tracerModule: TracerModule;
try {
  const packageBase = options['packages-dir'] ? resolve(String(options['packages-dir'])) : undefined;
  const packageImport = (name: string) => (packageBase ? import(pathToFileURL(Bun.resolveSync(name, `${packageBase}/runner.ts`)).href) : import(name));
  pngModule = (await packageImport('pngjs')) as PngModule;
  tracerModule = (await packageImport('imagetracerjs')) as TracerModule;
} catch (error) {
  throw new Error('Vectorization packages are unavailable. Install them in a temporary directory with `bun add --cwd <dir> --no-save imagetracerjs pngjs`, then pass `--packages-dir <dir>`.', {
    cause: error,
  });
}
const image = pngModule.PNG.sync.read(Buffer.from(await Bun.file(inputPath).arrayBuffer()));
const traceOptions = {
  numberofcolors: Number(options.colors ?? 16),
  pathomit: Number(options.pathomit ?? 8),
  ltres: Number(options.ltres ?? 1),
};
const svg = tracerModule.imagedataToSVG({ width: image.width, height: image.height, data: image.data }, traceOptions);

if (!svg.trimStart().startsWith('<svg')) {
  throw new Error('Vectorizer returned invalid SVG output');
}
await mkdir(dirname(outputPath), { recursive: true });
await Bun.write(outputPath, svg);
console.log(`${outputPath}: ${image.width}x${image.height}, traced with imagetracerjs`);
