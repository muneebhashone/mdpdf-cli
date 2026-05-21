#!/usr/bin/env bun
import { readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { singleMd, pickEntry } from "./lib/bundle/extract";
import { renderBundle } from "./lib/render/mdToHtml";
import { buildHtml } from "./lib/render/template";
import { htmlToPdf } from "./lib/pdf/renderPdf";
import { closeBrowser } from "./lib/pdf/browser";
import { walkFolder } from "./walkFolder";

const USAGE = `Usage: mdpdf <input> [-o <output.pdf>]

  <input>   .md file or folder containing .md files
  -o, --output  output PDF path (default: <entry-stem>.pdf in cwd)
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

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));
  const inputAbs = path.resolve(input);
  const s = await stat(inputAbs).catch(() => null);
  if (!s) throw new Error(`Not found: ${input}`);

  let vfs;
  if (s.isDirectory()) {
    vfs = await walkFolder(inputAbs);
  } else if (s.isFile() && /\.(md|markdown)$/i.test(inputAbs)) {
    const buf = await readFile(inputAbs);
    vfs = singleMd(path.basename(inputAbs), buf);
  } else {
    throw new Error("Input must be a .md file or a folder");
  }

  const entry = pickEntry(vfs);
  const { html: body, title } = await renderBundle(vfs, entry);
  const html = buildHtml({ title, body });
  const pdf = await htmlToPdf(html);

  const stem = path.basename(entry).replace(/\.(md|markdown)$/i, "");
  const outPath = output ? path.resolve(output) : path.resolve(`${stem}.pdf`);
  await writeFile(outPath, pdf);
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
