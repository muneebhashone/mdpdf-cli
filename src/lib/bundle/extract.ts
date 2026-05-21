export type VFile = { path: string; bytes: Buffer };
export type Vfs = Map<string, Buffer>;

export function singleMd(name: string, buf: Buffer): Vfs {
  const vfs: Vfs = new Map();
  vfs.set(name || "index.md", buf);
  return vfs;
}

export function pickEntry(vfs: Vfs): string {
  const mdFiles = [...vfs.keys()].filter((p) => /\.(md|markdown)$/i.test(p));
  if (mdFiles.length === 0) throw new Error("No markdown files found");
  const byName = (n: string) =>
    mdFiles.find((p) => p.toLowerCase() === n) ??
    mdFiles.find((p) => p.toLowerCase().endsWith("/" + n));
  return (
    byName("readme.md") ||
    byName("index.md") ||
    mdFiles.sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0]
  );
}
