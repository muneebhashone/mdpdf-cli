---
name: mdpdf
description: Convert a single Markdown file or a folder of Markdown files into one beautifully-styled PDF using the mdpdf CLI (this repo). Use when the user asks to "convert markdown to pdf", "md to pdf", "turn this README/docs into a PDF", "make a PDF from this markdown folder", or hands you a `.md` file or directory of `.md` files and wants a polished printable artifact. Produces A4 output with Shiki syntax highlighting, Mermaid diagrams, GFM tables, inlined local images, and cross-document `.md` links rewritten to in-PDF anchors. Do NOT use for arbitrary HTML→PDF, slide decks, or non-Markdown sources.
license: MIT
metadata:
  repo: muneebhashone/mdpdf-cli
  version: "0.1"
---

# mdpdf

A CLI that converts Markdown into one polished PDF via headless Chromium. Single file or whole folder — same command.

## When to use this skill

Trigger when the user:
- says "convert markdown to pdf" / "md to pdf" / ".md → .pdf"
- hands you a `.md` file or a folder of `.md` files and wants a single PDF out
- asks to "turn this README into a PDF", "make a PDF from these docs", etc.

Do not use for: HTML→PDF, DOCX/PPTX, slide-deck generation, or non-Markdown input.

## Setup (once per machine)

```bash
git clone https://github.com/muneebhashone/mdpdf-cli.git
cd mdpdf-cli
bun install
bun link
```

After `bun link`, `mdpdf` is on `$PATH` from any directory. Puppeteer downloads Chromium during `bun install` (~1–2 min, one time).

## Usage

```
mdpdf <input> [-o <output.pdf>]
```

- `<input>` — a `.md` file **or** a directory containing `.md` files (walked recursively; `node_modules`, `.git`, and dotfiles skipped).
- `-o`, `--output` — output path. Default: `<entry-stem>.pdf` in cwd.

### Entry-file selection (folder input)

When `<input>` is a folder, the entry is picked in this order:
1. `README.md` (any depth, shallowest preferred)
2. `index.md`
3. Shallowest remaining `.md` alphabetically

The entry renders first; other `.md` files in the folder follow, each on a new page, with cross-`.md` links rewritten to in-PDF anchors.

### Examples

Single file:
```bash
mdpdf notes.md
mdpdf ./report.md -o /tmp/report.pdf
```

Folder of docs:
```bash
mdpdf ./docs -o handbook.pdf
mdpdf ../my-project        # picks README.md, writes ./README.pdf
```

## What it renders

- Markdown: GFM (tables, task lists, strikethrough, autolinks)
- Code blocks: Shiki syntax highlighting (`github-light` theme)
- Mermaid diagrams (` ```mermaid ` fenced blocks) — fit-to-page, never overflow A4
- Local images: inlined as data URIs (relative paths from the input file/folder)
- Cross-document `.md` links: rewritten to in-PDF anchors when the target is in the bundle; otherwise rewritten to `.pdf` filenames
- Heading anchors: namespaced per-file so identical headings across docs don't collide

## Gotchas

- **External URLs in images are NOT inlined** — only relative paths within the input folder. Remote `https://…` `<img>` tags are left untouched and will fetch at render time (works, but requires network).
- **Mermaid loads from a CDN at render time.** Offline machines need to be online during the run (Puppeteer's Chromium fetches `cdn.jsdelivr.net/npm/mermaid`).
- **Google Fonts are fetched at render time** for the same reason. Output still renders without them (system fallbacks kick in), but typography won't match.
- **Folder safety caps**: 500 entries / 50 MB total. Pointing at a giant repo will error early — narrow the input.
- **No flags besides `-o`.** No `--title`, no `--preview`, no batch. Single in, single out.
- **First run is slow** because `bun install` downloads Chromium. Subsequent runs are fast.
- **Windows paths**: pass forward slashes or quote the path. `mdpdf ./docs` works; `mdpdf "C:\path\with spaces"` works.
- **Picking the entry**: if the folder has both a `README.md` at root and chapter files, the README leads. If you want a different entry, point `mdpdf` directly at that file instead of the folder.

## Verifying output

After running, open the produced `.pdf` and check:
1. Cover/first page renders the entry file's H1 as the document title.
2. Code blocks have syntax highlighting (colored tokens, not plain monospace).
3. Any Mermaid blocks rendered as SVG diagrams, not raw text.
4. Images appear inline (not broken icons).
5. Cross-`.md` links jump within the PDF (test by clicking one in a PDF viewer that supports internal links).

If a Mermaid block shows as plain text, the page likely timed out waiting on the CDN — re-run with a live connection.

## Failure modes & recovery

- `No markdown files found` → input folder has no `.md` files. Check path / recurse depth.
- `Folder has too many entries (max 500)` / `Folder content too large (max 50 MB)` → narrow the input (point at a subdirectory).
- `Not a directory` / `Not found` → bad path.
- Hangs > 60s on render → Chromium can't reach the CDN. Check network.
- PDF exits but Mermaid/fonts look wrong → same network cause; output is still produced.

## What this skill does NOT do

- No watch mode, no batch, no zip input, no `--preview` HTML emit, no `--title` override.
- No remote-file fetching (point at local files/folders).
- No DOCX / PPTX / HTML inputs.

Keep the surface small. If you need more, edit `src/cli.ts` in the repo.
