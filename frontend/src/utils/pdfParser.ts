import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker for pdfjs-dist from cdnjs to ensure compatibility with Vite bundling
const pdfjsVersion = '4.0.370'; // Use version compatible with installed library
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || pdfjsVersion}/pdf.worker.min.mjs`;

/**
 * Extracts plain text from a PDF file represented as an ArrayBuffer.
 * @param arrayBuffer The ArrayBuffer of the PDF file.
 * @returns A promise resolving to the extracted text pages.
 */
export const extractTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    let extractedText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      
      extractedText += pageText + '\n\n';
    }

    return extractedText.trim();
  } catch (error) {
    console.error('[PDF Parser] Error parsing PDF buffer:', error);
    throw new Error('Failed to parse PDF file and extract text.');
  }
};
