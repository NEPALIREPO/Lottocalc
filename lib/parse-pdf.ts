/**
 * Extract text from a PDF file (text-based PDFs). Used for POS terminal receipt parsing.
 * Uses dynamic import so pdfjs-dist loads only when parsing a PDF (client-side).
 */

export async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const { getDocument } = pdfjs;
  // Set worker source (required by pdfjs-dist). Use CDN so worker loads in browser.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }
  const loadingTask = getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const parts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    parts.push(pageText);
  }

  return parts.join('\n');
}

export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
