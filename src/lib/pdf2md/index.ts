import { extractPdfItems } from "./extractPdf";
import { itemsToMarkdown } from "./toMarkdown";

export async function pdfBufferToMarkdown(buf: Buffer): Promise<string> {
  const items = await extractPdfItems(buf);
  return itemsToMarkdown(items);
}
