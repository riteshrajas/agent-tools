import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { convertMdToPdf, extractPptxText, searchPdf, extractDocxParagraphs } from './tools/doc.js';
// @ts-ignore
import { PdfReader } from 'pdfreader';

async function testConvertMdToPdf(testDir: string): Promise<{ mdPath: string; pdfPath: string }> {
  console.log('\n1. Testing convertMdToPdf...');
  const mdPath = path.join(testDir, 'test.md');
  const pdfPath = path.join(testDir, 'test.pdf');

  const mdContent = `# Document Tools Test File
## Section 1: Intro
This is **bold** text in a paragraph.

* List item 1 with **bold** text.
* List item 2.

---
## Section 2: Outro
Another paragraph here.
`;
  fs.writeFileSync(mdPath, mdContent, 'utf8');
  
  const convertSuccess = await convertMdToPdf(mdPath, pdfPath);
  console.log('convertMdToPdf success:', convertSuccess);
  if (!convertSuccess || !fs.existsSync(pdfPath)) {
    throw new Error('convertMdToPdf failed to produce a PDF file');
  }
  return { mdPath, pdfPath };
}

async function testSearchPdf(pdfPath: string): Promise<void> {
  console.log('\n2. Testing searchPdf...');
  const searchResults1 = await searchPdf(pdfPath, 'Section 1');
  console.log('Search for "Section 1" results:', searchResults1);
  if (searchResults1.length === 0) {
    throw new Error('searchPdf failed to find "Section 1" in generated PDF');
  }
  // Verify return keys
  const firstMatch = searchResults1[0];
  if (typeof firstMatch.page !== 'number') {
    throw new Error('Expected "page" field to be a number');
  }
  if (typeof firstMatch.text !== 'string') {
    throw new Error('Expected "text" field to be a string');
  }
  if (typeof firstMatch.snippet !== 'string') {
    throw new Error('Expected "snippet" field to be a string');
  }
  if (!firstMatch.snippet.toLowerCase().includes('section 1')) {
    throw new Error('Expected snippet to contain query term');
  }

  const searchResults2 = await searchPdf(pdfPath, 'bold');
  console.log('Search for "bold" results:', searchResults2);
  if (searchResults2.length === 0) {
    throw new Error('searchPdf failed to find "bold" in generated PDF');
  }

  const searchResults3 = await searchPdf(pdfPath, 'nonexistent');
  console.log('Search for "nonexistent" results:', searchResults3);
  if (searchResults3.length > 0) {
    throw new Error('searchPdf found a nonexistent query term');
  }
}

async function testExtractDocxParagraphs(testDir: string): Promise<string> {
  console.log('\n3. Testing extractDocxParagraphs...');
  const docxPath = path.join(testDir, 'test.docx');
  const docxZip = new AdmZip();
  // word/document.xml content
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Hello from </w:t>
      </w:r>
      <w:r>
        <w:t>paragraph 1.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>This is paragraph 2 with &lt;span&gt; &amp; &quot;other&quot; XML entities.</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
  docxZip.addFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
  docxZip.writeZip(docxPath);

  const paragraphs = await extractDocxParagraphs(docxPath);
  console.log('Extracted DOCX paragraphs:', paragraphs);
  if (paragraphs.length !== 2) {
    throw new Error(`Expected 2 paragraphs, got ${paragraphs.length}`);
  }
  if (paragraphs[0] !== 'Hello from paragraph 1.') {
    throw new Error(`Unexpected paragraph 1 text: "${paragraphs[0]}"`);
  }
  if (paragraphs[1] !== 'This is paragraph 2 with <span> & "other" XML entities.') {
    throw new Error(`Unexpected paragraph 2 text: "${paragraphs[1]}"`);
  }
  return docxPath;
}

async function testExtractPptxText(testDir: string): Promise<string> {
  console.log('\n4. Testing extractPptxText...');
  const pptxPath = path.join(testDir, 'test.pptx');
  const pptxZip = new AdmZip();
  
  // slide1.xml
  const slide1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p>
            <a:r>
              <a:t>Slide 1 Title</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:r>
              <a:t>Slide 1 Subtitle &amp; content</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  // slide2.xml
  const slide2Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p>
            <a:r>
              <a:t>Slide 2 Header</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:r>
              <a:t>Point 1</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:r>
              <a:t>Point 2</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

  // Add slides out of order to verify sorting
  pptxZip.addFile('ppt/slides/slide2.xml', Buffer.from(slide2Xml, 'utf8'));
  pptxZip.addFile('ppt/slides/slide1.xml', Buffer.from(slide1Xml, 'utf8'));
  pptxZip.writeZip(pptxPath);

  const pptxText = await extractPptxText(pptxPath);
  console.log('Extracted PPTX Text:\n', pptxText);

  const expectedPptxText = `Slide 1:\nSlide 1 Title\nSlide 1 Subtitle & content\n\nSlide 2:\nSlide 2 Header\nPoint 1\nPoint 2`;
  if (pptxText !== expectedPptxText) {
    throw new Error(`Unexpected PPTX extracted text:\nExpected:\n"${expectedPptxText}"\n\nGot:\n"${pptxText}"`);
  }
  return pptxPath;
}

async function testErrorHandling(testDir: string): Promise<Record<string, string>> {
  console.log('\n5. Testing error handling (corrupt, encrypted, malformed files)...');
  const paths: Record<string, string> = {};

  // Corrupt DOCX
  const corruptDocxPath = path.join(testDir, 'corrupt.docx');
  paths.corruptDocxPath = corruptDocxPath;
  fs.writeFileSync(corruptDocxPath, 'not a zip file');
  try {
    await extractDocxParagraphs(corruptDocxPath);
    throw new Error('Expected extractDocxParagraphs to fail on corrupt file');
  } catch (err: any) {
    console.log('Successfully caught DOCX corrupt error:', err.message);
  }

  // Malformed XML DOCX
  const malformedDocxPath = path.join(testDir, 'malformed.docx');
  paths.malformedDocxPath = malformedDocxPath;
  const malformedDocxZip = new AdmZip();
  malformedDocxZip.addFile('word/document.xml', Buffer.from('<invalid-xml><w:t>Open tag mismatch', 'utf8'));
  malformedDocxZip.writeZip(malformedDocxPath);
  try {
    await extractDocxParagraphs(malformedDocxPath);
    throw new Error('Expected extractDocxParagraphs to fail on malformed XML');
  } catch (err: any) {
    console.log('Successfully caught DOCX malformed XML error:', err.message);
  }

  // Corrupt PDF
  const corruptPdfPath = path.join(testDir, 'corrupt.pdf');
  paths.corruptPdfPath = corruptPdfPath;
  fs.writeFileSync(corruptPdfPath, 'not a pdf');
  try {
    await searchPdf(corruptPdfPath, 'test');
    throw new Error('Expected searchPdf to fail on corrupt PDF');
  } catch (err: any) {
    console.log('Successfully caught PDF corrupt error:', err.message);
  }

  // Malformed XML PPTX
  const malformedPptxPath = path.join(testDir, 'malformed.pptx');
  paths.malformedPptxPath = malformedPptxPath;
  const malformedPptxZip = new AdmZip();
  malformedPptxZip.addFile('ppt/slides/slide1.xml', Buffer.from('<invalid-xml><a:t>Open tag mismatch', 'utf8'));
  malformedPptxZip.writeZip(malformedPptxPath);
  try {
    await extractPptxText(malformedPptxPath);
    throw new Error('Expected extractPptxText to fail on malformed XML');
  } catch (err: any) {
    console.log('Successfully caught PPTX malformed XML error:', err.message);
  }

  return paths;
}

async function runTests() {
  console.log('--- Starting Document Tools Tests ---');

  const testDir = path.resolve('./test-temp');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }

  const { mdPath, pdfPath } = await testConvertMdToPdf(testDir);
  await testSearchPdf(pdfPath);
  const docxPath = await testExtractDocxParagraphs(testDir);
  const pptxPath = await testExtractPptxText(testDir);
  const errorPaths = await testErrorHandling(testDir);

  // Clean up
  console.log('\nCleaning up temp files...');
  fs.unlinkSync(mdPath);
  fs.unlinkSync(pdfPath);
  fs.unlinkSync(docxPath);
  fs.unlinkSync(pptxPath);
  fs.unlinkSync(errorPaths.corruptDocxPath);
  fs.unlinkSync(errorPaths.malformedDocxPath);
  fs.unlinkSync(errorPaths.corruptPdfPath);
  fs.unlinkSync(errorPaths.malformedPptxPath);
  fs.rmdirSync(testDir);

  console.log('\n--- All Tests Passed Successfully! ---');
}


runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
