import type { PdfTextItem } from "./extractPdf";

type Line = {
  text: string;
  fontSize: number;
  fontName: string;
  x: number;
  y: number;
  pageIndex: number;
  pageHeight: number;
  isMono: boolean;
  isBold: boolean;
  isItalic: boolean;
};

const Y_TOLERANCE = 2;
const MONO_RE = /mono|courier|consolas|menlo|jetbrains/i;
const BOLD_RE = /bold|black|heavy/i;
const ITALIC_RE = /italic|oblique/i;
const PAGE_NUM_RE = /^\s*\d+\s*\/\s*\d+\s*$/;
const LIST_BULLET_RE = /^[•·▪●◦‣⁃]\s+/;
const LIST_ORDERED_RE = /^(\d+)[.)]\s+/;

function groupItemsIntoLines(items: PdfTextItem[]): Line[] {
  const byPage = new Map<number, PdfTextItem[]>();
  for (const it of items) {
    if (!byPage.has(it.pageIndex)) byPage.set(it.pageIndex, []);
    byPage.get(it.pageIndex)!.push(it);
  }

  const lines: Line[] = [];
  for (const [pageIndex, pageItems] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    pageItems.sort((a, b) => b.y - a.y || a.x - b.x);

    const buckets: PdfTextItem[][] = [];
    for (const it of pageItems) {
      const last = buckets[buckets.length - 1];
      if (last && Math.abs(last[0].y - it.y) <= Y_TOLERANCE) {
        last.push(it);
      } else {
        buckets.push([it]);
      }
    }

    for (const bucket of buckets) {
      bucket.sort((a, b) => a.x - b.x);
      let text = "";
      let prevEndX: number | null = null;
      for (const it of bucket) {
        if (prevEndX !== null && it.x - prevEndX > it.fontSize * 0.25 && !text.endsWith(" ")) {
          text += " ";
        }
        text += it.str;
        prevEndX = it.x + it.str.length * it.fontSize * 0.5;
      }
      text = text.replace(/\s+/g, " ").trim();
      if (!text) continue;

      const dominant = bucket.reduce((a, b) => (b.str.length > a.str.length ? b : a), bucket[0]);
      lines.push({
        text,
        fontSize: dominant.fontSize,
        fontName: dominant.fontName,
        x: bucket[0].x,
        y: bucket[0].y,
        pageIndex,
        pageHeight: dominant.pageHeight,
        isMono: MONO_RE.test(dominant.fontName),
        isBold: BOLD_RE.test(dominant.fontName),
        isItalic: ITALIC_RE.test(dominant.fontName),
      });
    }
  }
  return lines;
}

function dropPageFurniture(lines: Line[]): Line[] {
  return lines.filter((l) => {
    if (PAGE_NUM_RE.test(l.text)) return false;
    if (l.y < l.pageHeight * 0.06 && /^\d+$/.test(l.text)) return false;
    return true;
  });
}

function classifyHeadingSizes(lines: Line[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const l of lines) {
    const k = Math.round(l.fontSize * 2) / 2;
    counts.set(k, (counts.get(k) || 0) + l.text.length);
  }
  const body = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 12;
  const heading = [...counts.keys()].filter((s) => s > body + 0.5).sort((a, b) => b - a);
  const map = new Map<number, number>();
  for (let i = 0; i < heading.length && i < 6; i++) {
    map.set(heading[i], i + 1);
  }
  return map;
}

function shouldJoinSoftWrap(prev: string, next: string): boolean {
  if (/[.!?:][")\]]?$/.test(prev)) return false;
  if (/^[A-Z]/.test(next) && /[.!?]$/.test(prev)) return false;
  if (LIST_BULLET_RE.test(next) || LIST_ORDERED_RE.test(next)) return false;
  return true;
}

export function linesToMarkdown(rawLines: Line[]): string {
  const lines = dropPageFurniture(rawLines);
  const headingMap = classifyHeadingSizes(lines);

  const out: string[] = [];
  let inCodeBlock = false;
  let prevPage = -1;

  const closeCode = () => {
    if (inCodeBlock) {
      out.push("```");
      inCodeBlock = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];

    if (line.pageIndex !== prevPage && prevPage !== -1) {
      closeCode();
      if (out.length && out[out.length - 1] !== "") out.push("");
    }
    prevPage = line.pageIndex;

    const sizeKey = Math.round(line.fontSize * 2) / 2;
    const headingLevel = headingMap.get(sizeKey);

    if (headingLevel) {
      closeCode();
      if (out.length && out[out.length - 1] !== "") out.push("");
      out.push("#".repeat(headingLevel) + " " + line.text);
      out.push("");
      continue;
    }

    if (line.isMono) {
      if (!inCodeBlock) {
        if (out.length && out[out.length - 1] !== "") out.push("");
        out.push("```");
        inCodeBlock = true;
      }
      out.push(line.text);
      continue;
    } else if (inCodeBlock) {
      closeCode();
      out.push("");
    }

    let text = line.text;
    const bulletMatch = text.match(LIST_BULLET_RE);
    const orderedMatch = text.match(LIST_ORDERED_RE);
    if (bulletMatch) {
      text = "- " + text.slice(bulletMatch[0].length);
    } else if (orderedMatch) {
      text = orderedMatch[1] + ". " + text.slice(orderedMatch[0].length);
    }

    if (line.isBold && line.isItalic) text = `***${text}***`;
    else if (line.isBold) text = `**${text}**`;
    else if (line.isItalic) text = `*${text}*`;

    const lastIdx = out.length - 1;
    const prev = lastIdx >= 0 ? out[lastIdx] : "";
    const canMerge =
      prev &&
      prev !== "" &&
      !prev.startsWith("#") &&
      !prev.startsWith("```") &&
      !LIST_BULLET_RE.test(line.text) &&
      !LIST_ORDERED_RE.test(line.text) &&
      next &&
      next.pageIndex === line.pageIndex &&
      shouldJoinSoftWrap(prev, text);

    if (canMerge) {
      out[lastIdx] = prev + " " + text;
    } else {
      out.push(text);
      if (!next || next.pageIndex !== line.pageIndex || Math.abs(next.y - line.y) > line.fontSize * 1.8) {
        out.push("");
      }
    }
  }

  closeCode();

  const cleaned: string[] = [];
  for (const l of out) {
    if (l === "" && cleaned[cleaned.length - 1] === "") continue;
    cleaned.push(l);
  }
  while (cleaned.length && cleaned[cleaned.length - 1] === "") cleaned.pop();
  return cleaned.join("\n") + "\n";
}

export function itemsToMarkdown(items: PdfTextItem[]): string {
  const lines = groupItemsIntoLines(items);
  return linesToMarkdown(lines);
}
