import child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import AdmZip from 'adm-zip';

// @ts-ignore
import { PdfReader } from 'pdfreader';

function execFilePromise(file: string, args: string[], options: any): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    child_process.execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Decodes standard XML entities.
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Validates XML well-formedness and throws a clean error if malformed.
 */
function validateXml(xml: string, context: string): void {
  if (!xml || xml.trim() === '') {
    throw new Error(`Malformed XML in ${context}: content is empty`);
  }
  const trimmed = xml.trim();
  if (!trimmed.startsWith('<') || !trimmed.endsWith('>')) {
    throw new Error(`Malformed XML in ${context}: does not start and end with XML brackets`);
  }
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '<') {
      depth++;
      if (depth > 1) {
        throw new Error(`Malformed XML in ${context}: nested '<' character`);
      }
    } else if (trimmed[i] === '>') {
      depth--;
      if (depth < 0) {
        throw new Error(`Malformed XML in ${context}: unmatched '>' character`);
      }
    }
  }
  if (depth !== 0) {
    throw new Error(`Malformed XML in ${context}: unclosed '<' character`);
  }
}

/**
 * Finds MS Edge application path on Windows.
 */
function getEdgePath(): string {
  const paths = [
    `C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe`,
    `C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe`,
  ];
  if (process.env.LOCALAPPDATA) {
    paths.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  }
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return 'msedge';
}

/**
 * Sanitizes markdown string to prevent script injection while preserving allowed/markdown HTML tags.
 */
function sanitizeUserMarkdown(text: string): string {
  const allowedTags = new Set([
    'p', 'br', 'hr', 'strong', 'em', 'code', 'pre', 'span', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'b', 'i', 'u', 'a'
  ]);

  let sanitized = text.replace(/&/g, '&amp;');

  sanitized = sanitized.replace(/<(\/?[a-zA-Z0-9]+)([^>]*)>/g, (match, tagName, attributes) => {
    const baseTagName = tagName.replace(/^\//, '').toLowerCase();
    if (allowedTags.has(baseTagName)) {
      let safeAttrs = attributes;
      if (safeAttrs) {
        safeAttrs = safeAttrs.replace(/\s+on[a-zA-Z]+\s*=\s*("[^"]*"|'[^']*'|[^>\s]+)/gi, '');
        safeAttrs = safeAttrs.replace(/\s+(href|src)\s*=\s*["']?\s*javascript:[^"'>]*["']?/gi, '');
      }
      return `<${tagName}${safeAttrs}>`;
    }
    return `&lt;${tagName}${attributes}&gt;`;
  });

  const placeholders: string[] = [];
  sanitized = sanitized.replace(/<(\/?[a-zA-Z0-9]+)([^>]*)>/g, (match, tagName, attributes) => {
    const baseTagName = tagName.replace(/^\//, '').toLowerCase();
    if (allowedTags.has(baseTagName)) {
      let safeAttrs = attributes;
      if (safeAttrs) {
        safeAttrs = safeAttrs.replace(/\s+on[a-zA-Z]+\s*=\s*("[^"]*"|'[^']*'|[^>\s]+)/gi, '');
        safeAttrs = safeAttrs.replace(/\s+(href|src)\s*=\s*["']?\s*javascript:[^"'>]*["']?/gi, '');
      }
      const token = `__HTML_TAG_PLACEHOLDER_${placeholders.length}__`;
      placeholders.push(`<${tagName}${safeAttrs}>`);
      return token;
    }
    return match;
  });

  sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  for (let i = 0; i < placeholders.length; i++) {
    sanitized = sanitized.replace(`__HTML_TAG_PLACEHOLDER_${i}__`, placeholders[i]);
  }

  return sanitized;
}

interface TextItem {
  text: string;
  x: number;
  y: number;
}

/**
 * Converts markdown string to HTML string following the styling and simple markdown parsing.
 */
export function markdownToHtml(markdownContent: string): string {
  const lines = markdownContent.split(/\r?\n/);
  const htmlLines: string[] = [];
  let inList = false;

  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      continue;
    }

    if (stripped.startsWith('# ')) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      const text = sanitizeUserMarkdown(stripped.substring(2));
      htmlLines.push(`<h1 class='title'>${text}</h1>`);
    } else if (stripped.startsWith('## ')) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      const text = sanitizeUserMarkdown(stripped.substring(3));
      htmlLines.push(`<h2>${text}</h2>`);
    } else if (stripped.startsWith('### ')) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      const text = sanitizeUserMarkdown(stripped.substring(4));
      htmlLines.push(`<h3>${text}</h3>`);
    } else if (stripped.startsWith('* ') || stripped.startsWith('- ')) {
      if (!inList) {
        htmlLines.push("<ul>");
        inList = true;
      }
      let itemText = sanitizeUserMarkdown(stripped.substring(2));
      while (itemText.includes('**')) {
        itemText = itemText.replace('**', '<strong>').replace('**', '</strong>');
      }
      htmlLines.push(`<li>${itemText}</li>`);
    } else if (stripped === '---') {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      htmlLines.push("<hr/>");
    } else {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      let pText = sanitizeUserMarkdown(stripped);
      while (pText.includes('**')) {
        pText = pText.replace('**', '<strong>').replace('**', '</strong>');
      }
      htmlLines.push(`<p>${pText}</p>`);
    }
  }

  if (inList) {
    htmlLines.push("</ul>");
  }

  const htmlBody = htmlLines.join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Georgia', serif;
      line-height: 1.6;
      color: #333333;
      margin: 1in;
      font-size: 12pt;
    }
    h1.title {
      font-family: 'Arial', sans-serif;
      font-size: 20pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 24pt;
    }
    h2 {
      font-family: 'Arial', sans-serif;
      font-size: 14pt;
      font-weight: bold;
      margin-top: 18pt;
      margin-bottom: 6pt;
      border-bottom: 1px solid #dddddd;
      padding-bottom: 3pt;
    }
    p {
      margin-bottom: 12pt;
      text-align: justify;
      text-indent: 0.5in;
    }
    /* Don't indent first paragraph or headings */
    h1 + p, h2 + p, h3 + p {
      text-indent: 0;
    }
    ul {
      margin-bottom: 12pt;
      padding-left: 20pt;
    }
    li {
      margin-bottom: 6pt;
    }
    hr {
      border: 0;
      border-top: 1px solid #dddddd;
      margin: 20pt 0;
    }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>
`;
}

/**
 * Uses MS Edge in headless mode to print HTML content to PDF.
 */
export async function htmlToPdf(htmlContent: string, pdfPath: string): Promise<boolean> {
  const tempHtmlPath = path.join(
    os.tmpdir(),
    `md_to_pdf_${crypto.randomUUID()}.html`
  );
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

  try {
    const edgePath = getEdgePath();
    const resolvedPdfPath = path.resolve(pdfPath);
    fs.mkdirSync(path.dirname(resolvedPdfPath), { recursive: true });

    const args = [
      '--headless',
      '--disable-gpu',
      `--print-to-pdf=${resolvedPdfPath}`,
      `file:///${path.resolve(tempHtmlPath)}`
    ];

    await execFilePromise(edgePath, args, { timeout: 30000 });
    return true;
  } catch (err) {
    console.error(`Error during PDF conversion: ${err}`);
    return false;
  } finally {
    if (fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath);
    }
  }
}

/**
 * Converts a Markdown file to HTML, writes to a temp file, and uses MS Edge in headless mode
 * to print it to PDF. Follows the styling and simple markdown parsing from md_to_pdf.py.
 */
export async function convertMdToPdf(mdPath: string, pdfPath: string): Promise<boolean> {
  const resolvedMdPath = path.resolve(mdPath);
  if (!fs.existsSync(resolvedMdPath)) {
    console.error(`Error: ${mdPath} does not exist`);
    return false;
  }

  try {
    const content = fs.readFileSync(resolvedMdPath, 'utf8');
    const htmlContent = markdownToHtml(content);
    const success = await htmlToPdf(htmlContent, pdfPath);
    if (success) {
      console.log(`Successfully converted ${mdPath} to ${pdfPath}`);
    }
    return success;
  } catch (err) {
    console.error(`Error processing Markdown conversion: ${err}`);
    return false;
  }
}

/**
 * Extracts and parses slide XMLs (ppt/slides/slide*.xml) from a .pptx file.
 * Numerically sorts the slide files. Extracts text from <a:t> tags.
 * Prints and returns a formatted slide-by-slide text.
 */
export async function extractPptxText(pptxPath: string): Promise<string> {
  const resolvedPptxPath = path.resolve(pptxPath);
  if (!fs.existsSync(resolvedPptxPath)) {
    throw new Error(`PowerPoint file not found: ${pptxPath}`);
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(resolvedPptxPath);
  } catch (err: any) {
    throw new Error(`Failed to read PPTX file (possibly corrupt or encrypted): ${err?.message || err}`);
  }

  let entries;
  try {
    entries = zip.getEntries();
  } catch (err: any) {
    throw new Error(`Failed to read ZIP entries from PPTX file: ${err?.message || err}`);
  }

  const slideEntries = entries.filter(entry => 
    /^ppt[/\\]slides[/\\]slide\d+\.xml$/i.test(entry.entryName)
  );

  slideEntries.sort((a, b) => {
    const matchA = a.entryName.match(/slide(\d+)\.xml/i);
    const matchB = b.entryName.match(/slide(\d+)\.xml/i);
    const numA = matchA ? parseInt(matchA[1], 10) : 0;
    const numB = matchB ? parseInt(matchB[1], 10) : 0;
    return numA - numB;
  });

  let output = '';
  for (const entry of slideEntries) {
    const match = entry.entryName.match(/slide(\d+)\.xml/i);
    const slideNum = match ? match[1] : '?';
    
    let slideXml: string;
    try {
      slideXml = entry.getData().toString('utf8');
    } catch (err: any) {
      throw new Error(`Failed to read data for slide ${slideNum}: ${err?.message || err}`);
    }

    validateXml(slideXml, `slide ${slideNum}`);
    if (!slideXml.includes('<p:sld') && !slideXml.includes('<sld')) {
      throw new Error(`Malformed slide XML in slide ${slideNum}: missing slide root element`);
    }

    const paragraphRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
    const paragraphs: string[] = [];
    let pMatch;
    while ((pMatch = paragraphRegex.exec(slideXml)) !== null) {
      const pContent = pMatch[1];
      const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
      const tTexts: string[] = [];
      let tMatch;
      while ((tMatch = tRegex.exec(pContent)) !== null) {
        tTexts.push(decodeXmlEntities(tMatch[1]));
      }
      if (tTexts.length > 0) {
        paragraphs.push(tTexts.join(''));
      }
    }

    // Fallback if no paragraph tags matched
    if (paragraphs.length === 0) {
      const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
      const tTexts: string[] = [];
      let tMatch;
      while ((tMatch = tRegex.exec(slideXml)) !== null) {
        tTexts.push(decodeXmlEntities(tMatch[1]));
      }
      if (tTexts.length > 0) {
        paragraphs.push(tTexts.join(' '));
      }
    }

    output += `Slide ${slideNum}:\n`;
    if (paragraphs.length > 0) {
      output += paragraphs.map(p => p.trim()).filter(p => p.length > 0).join('\n') + '\n';
    } else {
      output += '[No text]\n';
    }
    output += '\n';
  }

  const formattedText = output.trim();
  console.log(formattedText);
  return formattedText;
}

/**
 * Searches a PDF file page-by-page using pdfreader.
 * For each page, searches for the case-insensitive query term.
 * Returns a list of matches including page (1-indexed), text, and snippet.
 */
export function searchPdf(
  pdfPath: string,
  query: string
): Promise<{ page: number; text: string; snippet: string }[]> {
  return new Promise((resolve, reject) => {
    const resolvedPath = path.resolve(pdfPath);
    if (!fs.existsSync(resolvedPath)) {
      return reject(new Error(`PDF file not found: ${pdfPath}`));
    }

    const pages: { [pageNumber: number]: TextItem[] } = {};
    let currentPage = 0;

    try {
      const reader = new PdfReader();
      reader.parseFileItems(resolvedPath, (err: any, item: any) => {
        if (err) {
          reject(new Error(`Failed to parse PDF file (possibly corrupt, encrypted, or invalid format): ${err?.message || err}`));
          return;
        }
        
        try {
          if (!item) {
            // EOF
            const results: { page: number; text: string; snippet: string }[] = [];
            const sortedPageNumbers = Object.keys(pages)
              .map(Number)
              .sort((a, b) => a - b);

            for (const pageNum of sortedPageNumbers) {
              const items = pages[pageNum];
              
              // Sort items: y coordinate (vertical) and then x coordinate (horizontal)
              items.sort((a, b) => {
                if (Math.abs(a.y - b.y) < 1.0) {
                  return a.x - b.x;
                }
                return a.y - b.y;
              });

              // Reconstruct page text
              const pageTextParts: string[] = [];
              let lastY = -1;
              for (const it of items) {
                if (lastY !== -1 && Math.abs(it.y - lastY) >= 1.0) {
                  pageTextParts.push('\n');
                }
                pageTextParts.push(it.text);
                lastY = it.y;
              }
              const pageText = pageTextParts.join('');

              // Case-insensitive query check
              const queryIndex = pageText.toLowerCase().indexOf(query.toLowerCase());
              if (queryIndex !== -1) {
                let start = queryIndex - 50;
                if (start < 0) start = 0;
                let end = start + 100;
                if (end > pageText.length) {
                  end = pageText.length;
                  start = Math.max(0, end - 100);
                }
                const snippet = pageText.substring(start, end);

                results.push({
                  page: pageNum,
                  text: pageText,
                  snippet: snippet,
                });
              }
            }
            resolve(results);
          } else if (item.page) {
            currentPage = item.page;
            pages[currentPage] = [];
          } else if (item.text && currentPage > 0) {
            pages[currentPage].push({
              text: item.text,
              x: item.x,
              y: item.y,
            });
          }
        } catch (innerErr: any) {
          reject(new Error(`Error while processing PDF items: ${innerErr?.message || innerErr}`));
        }
      });
    } catch (err: any) {
      reject(new Error(`Failed to initialize PDF parsing: ${err?.message || err}`));
    }
  });
}

/**
 * Uses adm-zip to read word/document.xml from a .docx file.
 * Extracts paragraphs (<w:p>) and runs (<w:t>).
 * Returns a list of paragraphs.
 */
export async function extractDocxParagraphs(docxPath: string): Promise<string[]> {
  const resolvedDocxPath = path.resolve(docxPath);
  if (!fs.existsSync(resolvedDocxPath)) {
    throw new Error(`Word document not found: ${docxPath}`);
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(resolvedDocxPath);
  } catch (err: any) {
    throw new Error(`Failed to read DOCX file (possibly corrupt or encrypted): ${err?.message || err}`);
  }

  let entries;
  try {
    entries = zip.getEntries();
  } catch (err: any) {
    throw new Error(`Failed to read ZIP entries from DOCX file: ${err?.message || err}`);
  }

  const docEntry = entries.find(entry => 
    /^word[/\\]document\.xml$/i.test(entry.entryName)
  );

  if (!docEntry) {
    throw new Error(`Could not find word/document.xml inside docx ZIP`);
  }

  let docXml: string;
  try {
    docXml = docEntry.getData().toString('utf8');
  } catch (err: any) {
    throw new Error(`Failed to read word/document.xml content: ${err?.message || err}`);
  }

  validateXml(docXml, 'word/document.xml');
  if (!docXml.includes('<w:document') && !docXml.includes('<document')) {
    throw new Error(`Malformed DOCX XML: missing document root element`);
  }

  const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  const paragraphs: string[] = [];
  let pMatch;
  while ((pMatch = paragraphRegex.exec(docXml)) !== null) {
    const pContent = pMatch[1];
    const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    const tTexts: string[] = [];
    let tMatch;
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      tTexts.push(decodeXmlEntities(tMatch[1]));
    }
    paragraphs.push(tTexts.join(''));
  }

  return paragraphs;
}
