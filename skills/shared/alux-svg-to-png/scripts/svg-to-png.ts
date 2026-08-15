#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

function usage(): never {
	console.error(
		"Usage: svg-to-png.ts <input.svg> [output.png] [--force] [--render]",
	);
	process.exit(2);
}

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const flags = new Set(
	process.argv.slice(2).filter((arg) => arg.startsWith("--")),
);

if (
	positional.length < 1 ||
	positional.length > 2 ||
	[...flags].some((flag) => flag !== "--force" && flag !== "--render")
) {
	usage();
}

const inputPath = resolve(positional[0]);
const outputPath = resolve(
	positional[1] ?? `${inputPath.slice(0, -extname(inputPath).length)}.png`,
);

if (extname(inputPath).toLowerCase() !== ".svg") {
	throw new Error(`Input must be an SVG file: ${inputPath}`);
}
if (extname(outputPath).toLowerCase() !== ".png") {
	throw new Error(`Output must use the .png extension: ${outputPath}`);
}
if (!existsSync(inputPath)) {
	throw new Error(`Input does not exist: ${inputPath}`);
}
if (inputPath === outputPath) {
	throw new Error("Input and output paths must differ");
}
if (existsSync(outputPath) && !flags.has("--force")) {
	throw new Error(
		`Output already exists; pass --force to replace it: ${outputPath}`,
	);
}

await mkdir(dirname(outputPath), { recursive: true });
const svg = await Bun.file(inputPath).text();

function extractWrapperPng(source: string): Uint8Array | undefined {
	const body = source
		.replace(/^\s*<\?xml[\s\S]*?\?>/i, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.trim();
	const wrapper = body.match(
		/^<svg\b[^>]*>\s*<image\b([^>]*)\/?>(?:\s*<\/image>)?\s*<\/svg>$/is,
	);
	if (!wrapper) return undefined;

	const href = wrapper[1].match(
		/(?:href|xlink:href)\s*=\s*["']data:image\/png;base64,([^"']+)["']/i,
	);
	return href ? Buffer.from(href[1].replace(/\s/g, ""), "base64") : undefined;
}

function runRenderer(command: string[]): boolean {
	const result = Bun.spawnSync({
		cmd: command,
		stdout: "pipe",
		stderr: "pipe",
	});
	if (result.exitCode === 0) return true;

	const detail = result.stderr.toString().trim();
	console.error(`${command[0]} failed${detail ? `: ${detail}` : ""}`);
	return false;
}

let method = "extracted embedded PNG";
const embedded = flags.has("--render") ? undefined : extractWrapperPng(svg);

if (embedded) {
	await Bun.write(outputPath, embedded);
} else {
	const renderers: Array<[string, string[]]> = [
		["rsvg-convert", ["rsvg-convert", inputPath, "-o", outputPath]],
		[
			"inkscape",
			[
				"inkscape",
				inputPath,
				"--export-type=png",
				`--export-filename=${outputPath}`,
			],
		],
		["magick", ["magick", inputPath, outputPath]],
		["convert", ["convert", inputPath, outputPath]],
	];
	const renderer = renderers.find(([name]) => Bun.which(name));
	if (!renderer) {
		throw new Error(
			"SVG needs rasterization, but no supported renderer was found. Install rsvg-convert, inkscape, or ImageMagick.",
		);
	}
	if (!runRenderer(renderer[1])) {
		throw new Error(`Failed to render SVG with ${renderer[0]}`);
	}
	method = `rendered with ${renderer[0]}`;
}

const png = Buffer.from(await Bun.file(outputPath).arrayBuffer());
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
if (png.length < 24 || !png.subarray(0, 8).equals(signature)) {
	throw new Error(`Output is not a valid PNG: ${outputPath}`);
}

const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
console.log(`${outputPath}: ${width}x${height}, ${method}`);
