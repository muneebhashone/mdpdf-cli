# mdpdf

Convert a Markdown file or folder of Markdown into one beautifully-styled PDF.

## Install

```
bun install
```

### Global `mdpdf` command (optional)

Register this package globally so you can run `mdpdf` from anywhere:

```
bun link
```

From any other project or directory:

```
mdpdf <input> [-o output.pdf]
```

To unlink later: `bun unlink` (run inside this repo).

## Usage

```
bun run src/cli.ts <input> [-o output.pdf]
```

Or, after `bun link`:

```
mdpdf <input> [-o output.pdf]
```

- `<input>` — a `.md` file, or a folder containing `.md` files (recursive). For folders, the entry is picked in this order: `README.md`, `index.md`, then shallowest `.md` alphabetically.
- `-o`, `--output` — output PDF path (default: `<entry-stem>.pdf` in cwd).

### Examples

```
bun run src/cli.ts notes.md
bun run src/cli.ts ./docs -o handbook.pdf
```

## Use as an agent skill (skills.sh)

This repo ships an [Agent Skill](https://agentskills.io) at `skills/mdpdf/`, installable via the [skills.sh](https://www.skills.sh) CLI:

```
npx skills add muneebhashone/mdpdf-cli --skill mdpdf
```

After installing, AI agents (Claude Code, Cursor, etc.) will know when to invoke `mdpdf` and how to use it.

## What it does

- Renders Markdown (GFM) → HTML with Shiki syntax highlighting and Mermaid diagrams.
- Inlines local images as data URIs.
- Rewrites cross-document `.md` links into in-PDF anchors.
- Prints to A4 via headless Chromium (Puppeteer).
