#!/usr/bin/env bun
import { readFile, writeFile, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import { singleMd, pickEntry } from "./lib/bundle/extract";
import { renderBundle } from "./lib/render/mdToHtml";
import { buildHtml } from "./lib/render/template";
import { htmlToPdf } from "./lib/pdf/renderPdf";
import { closeBrowser } from "./lib/pdf/browser";
import { walkFolder } from "./walkFolder";
import { pdfBufferToMarkdown } from "./lib/pdf2md";
import { embedSourceInPdf, extractSourceFromPdf, vfsToPayload, type SourcePayload } from "./lib/bundle/embed";

const USAGE = `Usage: mdpdf <input> [-o <output>]

  <input>   .md file, folder of .md files, or .pdf file
            - .md / folder  ->  PDF (with embedded source for lossless reverse)
            - .pdf          ->  Markdown (uses embedded source if present, else heuristic extraction)
  -o, --output  output path (extension auto-derived if omitted)
  -h, --help    show this help`;

function parseArgs(argv: string[]): { input: string; output?: string } {
  let input: string | undefined;
  let output: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      console.log(USAGE);
      process.exit(0);
    } else if (a === "-o" || a === "--output") {
      output = argv[++i];
      if (!output) throw new Error("-o requires a path");
    } else if (a.startsWith("-")) {
      throw new Error(`Unknown flag: ${a}`);
    } else if (!input) {
      input = a;
    } else {
      throw new Error(`Unexpected argument: ${a}`);
    }
  }
  if (!input) throw new Error("Missing <input>");
  return { input, output };
}

async function restorePayload(payload: SourcePayload, inputAbs: string, output: string | undefined): Promise<string> {
  const fileCount = Object.keys(payload.files).length;
  const stem = path.basename(inputAbs).replace(/\.pdf$/i, "");
  const wantsDir = !!output && !/\.(md|markdown)$/i.test(output);

  if (fileCount === 1 || (!wantsDir && !output)) {
    if (fileCount === 1) {
      const [only] = Object.keys(payload.files);
      const outPath = output ? path.resolve(output) : path.resolve(`${stem}.md`);
      await writeFile(outPath, payload.files[only]);
      return outPath;
    }
    if (output && /\.(md|markdown)$/i.test(output)) {
      const outPath = path.resolve(output);
      await writeFile(outPath, payload.files[payload.entry]);
      return outPath;
    }
    const dirPath = path.resolve(stem);
    await writeBundle(dirPath, payload);
    return dirPath;
  }

  const dirPath = output ? path.resolve(output) : path.resolve(stem);
  await writeBundle(dirPath, payload);
  return dirPath;
}

async function writeBundle(dirPath: string, payload: SourcePayload): Promise<void> {
  await mkdir(dirPath, { recursive: true });
  for (const [rel, content] of Object.entries(payload.files)) {
    const full = path.join(dirPath, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content);
  }
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));
  const inputAbs = path.resolve(input);
  const s = await stat(inputAbs).catch(() => null);
  if (!s) throw new Error(`Not found: ${input}`);

  if (s.isFile() && /\.pdf$/i.test(inputAbs)) {
    const buf = await readFile(inputAbs);
    const embedded = await extractSourceFromPdf(buf).catch(() => null);
    if (embedded) {
      const outPath = await restorePayload(embedded, inputAbs, output);
      console.log(outPath);
      return;
    }
    const md = await pdfBufferToMarkdown(buf);
    const stem = path.basename(inputAbs).replace(/\.pdf$/i, "");
    const outPath = output ? path.resolve(output) : path.resolve(`${stem}.md`);
    await writeFile(outPath, md);
    console.log(outPath);
    return;
  }

  let vfs;
  if (s.isDirectory()) {
    vfs = await walkFolder(inputAbs);
  } else if (s.isFile() && /\.(md|markdown)$/i.test(inputAbs)) {
    const buf = await readFile(inputAbs);
    vfs = singleMd(path.basename(inputAbs), buf);
  } else {
    throw new Error("Input must be a .md file, a folder, or a .pdf file");
  }

  const entry = pickEntry(vfs);
  const { html: body, title } = await renderBundle(vfs, entry);
  const html = buildHtml({ title, body });
  const pdf = await htmlToPdf(html);

  const payload = vfsToPayload(vfs, entry);
  const pdfWithSource = await embedSourceInPdf(pdf, payload);

  const stem = path.basename(entry).replace(/\.(md|markdown)$/i, "");
  const outPath = output ? path.resolve(output) : path.resolve(`${stem}.pdf`);
  await writeFile(outPath, pdfWithSource);
  console.log(outPath);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeBrowser().catch(() => {});
  });
