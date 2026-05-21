---
name: mdpdf
description: Convert Markdown ↔ PDF using the mdpdf CLI (this repo). Forward direction (.md or folder → PDF) produces A4 output with Shiki syntax highlighting, Mermaid diagrams, GFM tables, inlined local images, and cross-document `.md` links rewritten to in-PDF anchors. Reverse direction (PDF → .md) restores the original source losslessly for PDFs produced by mdpdf (embedded source attachment), and falls back to heuristic text extraction for foreign PDFs. Use when the user asks to "convert markdown to pdf", "md to pdf", "pdf to md", "extract markdown from pdf", "turn this PDF back into markdown", or hands you a `.md`/folder/`.pdf` and wants the other format. Do NOT use for arbitrary HTML→PDF, slide decks, DOCX/PPTX, or scanned-image PDFs (no OCR).
license: MIT
metadata:
  repo: muneebhashone/mdpdf-cli
  version: "0.2"
---

# mdpdf

A CLI that converts Markdown ↔ PDF. Forward: Markdown (file or folder) → polished A4 PDF via headless Chromium. Reverse: PDF → Markdown — lossless when the PDF was produced by mdpdf (source is embedded inside the PDF), best-effort heuristic otherwise.

## When to use this skill

Trigger when the user:
- says "convert markdown to pdf" / "md to pdf" / ".md → .pdf"
- says "pdf to md" / "pdf to markdown" / "extract markdown from this pdf" / "reverse this pdf"
- hands you a `.md` file, a folder of `.md` files, or a `.pdf` file and wants the other format
- asks to "turn this README into a PDF", "make a PDF from these docs", "get the markdown back from this PDF", etc.

Direction is auto-detected from the input file extension. No flag needed.

Do not use for: HTML→PDF, DOCX/PPTX, slide-deck generation, non-Markdown input on the forward path, or scanned-image PDFs on the reverse path (no OCR — the PDF must have a real text layer).

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
mdpdf <input> [-o <output>]
```

- `<input>` — a `.md` file, a directory containing `.md` files (walked recursively; `node_modules`, `.git`, and dotfiles skipped), **or** a `.pdf` file.
- `-o`, `--output` — output path. Extension auto-derived from input direction:
  - `.md` / folder → PDF (default `<entry-stem>.pdf` in cwd)
  - `.pdf` → Markdown (default `<stem>.md`, or a directory if the embedded source is a multi-file bundle)

### Entry-file selection (folder input)

When `<input>` is a folder, the entry is picked in this order:
1. `README.md` (any depth, shallowest preferred)
2. `index.md`
3. Shallowest remaining `.md` alphabetically

The entry renders first; other `.md` files in the folder follow, each on a new page, with cross-`.md` links rewritten to in-PDF anchors.

### Examples

Forward — single file:
```bash
mdpdf notes.md
mdpdf ./report.md -o /tmp/report.pdf
```

Forward — folder of docs:
```bash
mdpdf ./docs -o handbook.pdf
mdpdf ../my-project        # picks README.md, writes ./README.pdf
```

Reverse — PDF → Markdown:
```bash
mdpdf report.pdf                    # -> report.md
mdpdf report.pdf -o out.md
mdpdf handbook.pdf -o ./restored    # multi-file bundle restored into a directory
```

## Reverse direction (PDF → Markdown)

Two paths, picked automatically:

1. **PDFs produced by mdpdf** carry the original source as an embedded attachment (`mdpdf-source.json` — a JSON `{ v, entry, files }` payload). Reverse mode reads this and restores the source **byte-identical**, including tables, fenced code blocks, and the full folder structure for multi-file bundles. This is the recommended workflow when you control both ends of the pipeline.
2. **Foreign PDFs** (any PDF without that attachment) fall back to a heuristic extractor built on `pdfjs-dist`: groups text items into lines by y-coordinate, infers heading levels from font size clustering, detects lists/bold/italic from font names, collapses soft-wraps, strips page-number footers. Output quality is "decent for prose, lossy for structure."

### Reverse output rules

- Single-file embedded source → write `<stem>.md` (or `-o` path).
- Multi-file embedded source → write a directory named `<stem>/` (or `-o` path), recreating subfolders.
- If `-o` ends in `.md` even for a multi-file bundle, only the entry file is written there (other files are dropped — pass a directory `-o` to preserve them).
- No embedded source → heuristic extraction, always single `.md` output.

### Foreign-PDF heuristic limitations

- **Tables** flatten to space-joined text rows. No `|` grid reconstruction.
- **Images** are not extracted.
- **Code blocks** are detected by monospaced font name (`Mono`, `Courier`, `Consolas`, `Menlo`, `JetBrains`) — if the PDF embeds code in a non-monospaced font or doesn't expose the font name, code reverts to plain paragraphs.
- **Headings** are inferred from font-size clustering relative to the dominant body size; very short documents or table-heavy documents can occasionally misclassify ordinary paragraphs as headings.
- **No OCR**: scanned PDFs without a text layer produce empty output.

## What it renders (forward path)

- Markdown: GFM (tables, task lists, strikethrough, autolinks)
- Code blocks: Shiki syntax highlighting (`github-light` theme)
- Mermaid diagrams (` ```mermaid ` fenced blocks) — fit-to-page, never overflow A4
- Local images: inlined as data URIs (relative paths from the input file/folder)
- Cross-document `.md` links: rewritten to in-PDF anchors when the target is in the bundle; otherwise rewritten to `.pdf` filenames
- Heading anchors: namespaced per-file so identical headings across docs don't collide
- Embedded source: original `.md` content attached inside the PDF for lossless reverse

## Gotchas

- **External URLs in images are NOT inlined** — only relative paths within the input folder. Remote `https://…` `<img>` tags are left untouched and will fetch at render time (works, but requires network).
- **Mermaid loads from a CDN at render time.** Offline machines need to be online during the run (Puppeteer's Chromium fetches `cdn.jsdelivr.net/npm/mermaid`).
- **Google Fonts are fetched at render time** for the same reason. Output still renders without them (system fallbacks kick in), but typography won't match.
- **Folder safety caps**: 500 entries / 50 MB total. Pointing at a giant repo will error early — narrow the input.
- **No flags besides `-o`.** No `--title`, no `--preview`, no batch. Single in, single out.
- **First run is slow** because `bun install` downloads Chromium. Subsequent runs are fast.
- **Windows paths**: pass forward slashes or quote the path. `mdpdf ./docs` works; `mdpdf "C:\path\with spaces"` works.
- **Picking the entry**: if the folder has both a `README.md` at root and chapter files, the README leads. If you want a different entry, point `mdpdf` directly at that file instead of the folder.
- **Embedded source travels with the PDF.** If you don't want to ship the source alongside the rendered output (e.g. distributing a public PDF whose `.md` is private), strip the attachment with `qpdf`, `pdftk`, or any PDF editor before sharing. The PDF still renders identically without it; only reverse mode is affected.
- **Reverse mode on foreign PDFs is best-effort.** If the user expects perfect Markdown back from a third-party PDF, set expectations: tables/images/code blocks are the lossy parts. The lossless path only works when mdpdf made the PDF.

## Verifying output

### Forward (`.md` → `.pdf`)

After running, open the produced `.pdf` and check:
1. Cover/first page renders the entry file's H1 as the document title.
2. Code blocks have syntax highlighting (colored tokens, not plain monospace).
3. Any Mermaid blocks rendered as SVG diagrams, not raw text.
4. Images appear inline (not broken icons).
5. Cross-`.md` links jump within the PDF (test by clicking one in a PDF viewer that supports internal links).

If a Mermaid block shows as plain text, the page likely timed out waiting on the CDN — re-run with a live connection.

### Reverse (`.pdf` → `.md`)

To verify lossless round-trip on an mdpdf-produced PDF:

```bash
mdpdf source.md -o /tmp/x.pdf
mdpdf /tmp/x.pdf -o /tmp/x.md
diff source.md /tmp/x.md     # should be empty
```

For a foreign PDF, eyeball the output: headings should reflect actual section breaks; paragraphs should not be split mid-sentence; lists should use `-` or `N.` prefixes. If output looks like raw concatenated text, the PDF probably has unusual font metadata — the heuristic depends on it.

## Failure modes & recovery

- `No markdown files found` → input folder has no `.md` files. Check path / recurse depth.
- `Folder has too many entries (max 500)` / `Folder content too large (max 50 MB)` → narrow the input (point at a subdirectory).
- `Not found` → bad path.
- `Input must be a .md file, a folder, or a .pdf file` → unsupported extension; rename or convert first.
- Hangs > 60s on render → Chromium can't reach the CDN. Check network.
- PDF exits but Mermaid/fonts look wrong → same network cause; output is still produced.
- Reverse produces empty `.md` → PDF has no text layer (scanned image). Out of scope; needs OCR.
- Reverse produces mangled structure on a foreign PDF → fonts don't expose useful metadata; heuristic ceiling reached.

## What this skill does NOT do

- No watch mode, no batch, no zip input, no `--preview` HTML emit, no `--title` override.
- No remote-file fetching (point at local files/folders).
- No DOCX / PPTX / HTML inputs.
- No OCR on the reverse path — scanned PDFs are out of scope.
- No table grid reconstruction for foreign PDFs — only the embedded-source path restores tables exactly.

Keep the surface small. If you need more, edit `src/cli.ts` in the repo.
