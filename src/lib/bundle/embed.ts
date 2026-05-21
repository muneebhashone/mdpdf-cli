import { PDFDocument, PDFName, PDFDict, PDFArray, PDFHexString, PDFString, PDFStream, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import type { Vfs } from "./extract";

const ATTACHMENT_NAME = "mdpdf-source.json";

export type SourcePayload = {
  v: 1;
  entry: string;
  files: Record<string, string>;
};

export function vfsToPayload(vfs: Vfs, entry: string): SourcePayload {
  const files: Record<string, string> = {};
  for (const [p, buf] of vfs) {
    if (/\.(md|markdown)$/i.test(p)) files[p] = buf.toString("utf8");
  }
  return { v: 1, entry, files };
}

export async function embedSourceInPdf(pdfBuf: Buffer, payload: SourcePayload): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBuf);
  const json = JSON.stringify(payload);
  await doc.attach(new TextEncoder().encode(json), ATTACHMENT_NAME, {
    mimeType: "application/json",
    description: "mdpdf source markdown bundle",
  });
  const out = await doc.save({ useObjectStreams: false });
  return Buffer.from(out);
}

export async function extractSourceFromPdf(pdfBuf: Buffer): Promise<SourcePayload | null> {
  const doc = await PDFDocument.load(pdfBuf, { throwOnInvalidObject: false });
  const catalog = doc.catalog;
  const names = catalog.lookup(PDFName.of("Names"), PDFDict);
  if (!names) return null;
  const ef = names.lookup(PDFName.of("EmbeddedFiles"), PDFDict);
  if (!ef) return null;
  const namesArr = ef.lookup(PDFName.of("Names"), PDFArray);
  if (!namesArr) return null;

  for (let i = 0; i < namesArr.size(); i += 2) {
    const key = namesArr.lookup(i);
    let nameStr: string | null = null;
    if (key instanceof PDFString || key instanceof PDFHexString) nameStr = key.decodeText();
    if (nameStr !== ATTACHMENT_NAME) continue;

    const fileSpec = namesArr.lookup(i + 1, PDFDict);
    if (!fileSpec) continue;
    const efDict = fileSpec.lookup(PDFName.of("EF"), PDFDict);
    if (!efDict) continue;
    const stream = efDict.lookup(PDFName.of("F"), PDFStream) as PDFStream | undefined;
    if (!stream) continue;
    const bytes =
      stream instanceof PDFRawStream
        ? decodePDFRawStream(stream).decode()
        : ((stream as any).getContents() as Uint8Array);
    try {
      const json = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(json) as SourcePayload;
      if (parsed && parsed.v === 1 && parsed.files) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}
