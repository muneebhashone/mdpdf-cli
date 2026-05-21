# mdpdf

Convert a Markdown file or folder of Markdown into one beautifully-styled PDF — or go the other way and turn a PDF back into Markdown.

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

- `<input>` — a `.md` file, a folder containing `.md` files (recursive), or a `.pdf` file. For folders, the entry is picked in this order: `README.md`, `index.md`, then shallowest `.md` alphabetically.
- `-o`, `--output` — output path. Extension is auto-derived from the input: `.md`/folder → `.pdf`, `.pdf` → `.md`.

### Reverse mode (PDF → Markdown)

Point `mdpdf` at a `.pdf` and it returns Markdown.

- **PDFs produced by mdpdf** carry the original source as an embedded attachment, so the reverse is **lossless** — tables, code blocks, and folder structure all come back exactly. Multi-file bundles are restored into a directory.
- **Other text-based PDFs** fall back to a heuristic extractor: headings inferred from font size, paragraphs, lists, and code blocks reconstructed best-effort. Tables flatten to space-joined rows; images are not reconstructed.

```
mdpdf paper.pdf                  # -> paper.md (or paper/ folder if multi-file source)
mdpdf paper.pdf -o out.md
mdpdf bundle.pdf -o ./restored   # restore a multi-file bundle into a directory
```

### Examples

```
bun run src/cli.ts notes.md                       # md  -> pdf
bun run src/cli.ts ./docs -o handbook.pdf         # folder -> pdf
bun run src/cli.ts handbook.pdf                   # pdf -> md (or restored folder)
bun run src/cli.ts handbook.pdf -o ./restored     # restore multi-file bundle
```

## How lossless round-trip works

When mdpdf produces a PDF, it attaches the original Markdown source (single file or full folder bundle) inside the PDF as an embedded file (`mdpdf-source.json`). On reverse, mdpdf checks for that attachment first and, if present, restores the source verbatim — tables, code fences, nested folders, everything. Only foreign PDFs (those not produced by mdpdf) fall through to the heuristic extractor.

You can inspect the attachment with any PDF viewer that exposes embedded files, or strip it with standard PDF tooling if you want to ship the rendered PDF without the source.

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
- Embeds the original Markdown source inside the PDF so `mdpdf <file>.pdf` reverses losslessly.
- Falls back to heuristic PDF-text extraction for foreign PDFs (no embedded source).
