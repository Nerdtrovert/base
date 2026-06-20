// Load JSZip dynamically when needed to keep the initial bundle lightweight
const loadJSZip = async () => {
  const module = await import('jszip');
  return module.default;
};

// Fast XML entity decoder
const decodeXmlEntities = (str: string): string => {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
};

// Extremely fast and light regex-based XML text content extractor
const extractTextByTagName = (xmlText: string, tagName: 'w:t' | 'a:t'): string => {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\/${tagName}>`, 'g');
  let match;
  let text = '';
  while ((match = regex.exec(xmlText)) !== null) {
    text += match[1] + ' ';
  }
  return decodeXmlEntities(text.trim());
};

/**
 * Extracts raw text from a Word document (.docx) ArrayBuffer
 */
export const extractTextFromDocx = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  try {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) return '';

    const xmlText = await docXmlFile.async('text');
    return extractTextByTagName(xmlText, 'w:t');
  } catch (error) {
    console.error('[OfficeParser] Failed to extract text from DOCX:', error);
    throw error;
  }
};

/**
 * Extracts raw text from a PowerPoint presentation (.pptx) ArrayBuffer
 */
export const extractTextFromPptx = async (arrayBuffer: ArrayBuffer): Promise<string> => {
  try {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(arrayBuffer);
    let text = '';
    
    // Gather all slide XML files
    const slideFiles = Object.keys(zip.files).filter(
      name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
    );

    // Sort slide files numerically (e.g. slide1.xml, slide2.xml, slide10.xml)
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.replace(/[^\d]/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/[^\d]/g, ''), 10) || 0;
      return numA - numB;
    });

    for (const slidePath of slideFiles) {
      const slideFile = zip.file(slidePath);
      if (slideFile) {
        const xmlText = await slideFile.async('text');
        const slideText = extractTextByTagName(xmlText, 'a:t');
        if (slideText) {
          text += slideText + '\n';
        }
      }
    }
    return text.trim();
  } catch (error) {
    console.error('[OfficeParser] Failed to extract text from PPTX:', error);
    throw error;
  }
};
