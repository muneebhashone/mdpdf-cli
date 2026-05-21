import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type PdfTextItem = {
  str: string;
  x: number;
  y: number;
  fontSize: number;
  fontName: string;
  pageIndex: number;
  pageHeight: number;
};

export async function extractPdfItems(buf: Buffer): Promise<PdfTextItem[]> {
  const data = new Uint8Array(buf);
  const doc = await getDocument({ data, disableFontFace: true, useSystemFonts: false }).promise;
  const items: PdfTextItem[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    for (const raw of content.items as any[]) {
      if (typeof raw.str !== "string" || raw.str.length === 0) continue;
      const tr = raw.transform as number[];
      const x = tr[4];
      const y = tr[5];
      const fontSize = Math.hypot(tr[2], tr[3]);
      items.push({
        str: raw.str,
        x,
        y,
        fontSize: Math.round(fontSize * 100) / 100,
        fontName: raw.fontName || "",
        pageIndex: p - 1,
        pageHeight: viewport.height,
      });
    }
  }

  await doc.cleanup();
  await doc.destroy();
  return items;
}
