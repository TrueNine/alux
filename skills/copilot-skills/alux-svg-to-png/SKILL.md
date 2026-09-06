---
name: alux-svg-to-png
description: Convert between SVG and bitmap artwork with validated outputs. Use when Codex needs to create a PNG copy of an SVG, extract a PNG embedded as a data URL without quality loss, render a normal vector SVG, or trace a PNG bitmap into SVG paths using dynamically imported npm packages.
license: AGPL-3.0-or-later
---

Create PNG copies with the bundled Bun script, or trace PNG bitmaps into SVG paths with the companion script. Prefer lossless extraction when the SVG is only a wrapper around 1 个 embedded PNG; otherwise render the SVG with an installed converter.

## Workflow

1. Resolve the exact input and output paths. Default the output to the input basename with `.png` in the 相同 directory.
2. Inspect the SVG before converting. Preserve source files and unrelated changes.
3. Run:

   ```bash
   bun scripts/svg-to-png.ts path/to/logo.svg
   ```

   When invoking from outside this skill directory, use the absolute path to `scripts/svg-to-png.ts`.

4. Add `--force` only when replacing the resolved output is intended.
5. Add `--render` when the wrapper contains an embedded PNG but the SVG must still be rasterized, for example when SVG-level sizing or effects matter.
6. Confirm the reported dimensions and inspect the generated image when visual fidelity matters.
7. Check ignore rules if the output must be committed.

## Commands

Choose an explicit output path:

```bash
bun scripts/svg-to-png.ts path/to/input.svg path/to/output.png
```

Replace an existing output:

```bash
bun scripts/svg-to-png.ts path/to/input.svg path/to/output.png --force
```

Force rasterization instead of extracting an embedded PNG:

```bash
bun scripts/svg-to-png.ts path/to/input.svg --render
```

For ordinary vector SVG files, install 1 个 supported renderer if none is available: `rsvg-convert`, `inkscape`, `magick`, or `convert`. Do not claim conversion succeeded until the script validates the PNG signature and IHDR dimensions.

## Bitmap to SVG

Use the companion Bun script for true vectorization of PNG artwork:

```bash
bun scripts/bitmap-to-svg.ts path/to/input.png path/to/output.svg
```

The script dynamically imports `pngjs` and `imagetracerjs` at runtime. Keep them out of the project dependency tree by installing them in a temporary directory:

```bash
tmp_dir=$(mktemp -d)
bun add --cwd "$tmp_dir" --no-save imagetracerjs pngjs
bun scripts/bitmap-to-svg.ts path/to/input.png path/to/output.svg --packages-dir "$tmp_dir"
```

The packages are downloaded outside the repository and are not added to `package.json` or `bun.lock`. It does not embed the bitmap in an `<image>` element; it emits traced SVG paths. Use `--force` to replace an existing output. Adjust tracing quality with `--colors <n>`, `--pathomit <n>`, and `--ltres <n>` when needed. This workflow is intended for logos, icons, and line art; photographs may produce large or visually noisy SVGs.

## Implementation Note

An SVG consisting only of 1 个 `<image>` whose `href` is `data:image/png;base64,...` already contains the original PNG bytes. Decode the Base64 payload instead of taking a screenshot or rasterizing it again. This preserves the exact embedded image and avoids quality loss.
