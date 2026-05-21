import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Vfs } from "./lib/bundle/extract";

const MAX_TOTAL = 50 * 1024 * 1024;
const MAX_ENTRIES = 500;

const INCLUDE_EXT = new Set([
  ".md", ".markdown",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico",
]);

const SKIP_DIRS = new Set(["node_modules", ".git"]);

export async function walkFolder(root: string): Promise<Vfs> {
  const vfs: Vfs = new Map();
  let total = 0;
  let count = 0;

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        await walk(path.join(dir, e.name));
        continue;
      }
      if (!e.isFile()) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (!INCLUDE_EXT.has(ext)) continue;
      const abs = path.join(dir, e.name);
      const rel = path.relative(root, abs).split(path.sep).join("/");
      const buf = await readFile(abs);
      if (++count > MAX_ENTRIES) throw new Error("Folder has too many entries (max 500)");
      total += buf.length;
      if (total > MAX_TOTAL) throw new Error("Folder content too large (max 50 MB)");
      vfs.set(rel, buf);
    }
  }

  const s = await stat(root);
  if (!s.isDirectory()) throw new Error(`Not a directory: ${root}`);
  await walk(root);
  return vfs;
}
