import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import assert from 'assert';
import AdmZip from 'adm-zip';

const testDir = path.resolve('./stress-test-temp');

function setupTestDir() {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
}

function cleanTestDir() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// Helper to create a ZIP file and flip the encryption bit in headers
function createEncryptedZipMock(destPath: string, files: { [name: string]: string }) {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content, 'utf8'));
  }
  const zipBuffer = zip.toBuffer();

  // Flip bit 0 of the general purpose bit flag in local headers and central directory headers.
  for (let i = 0; i < zipBuffer.length - 4; i++) {
    if (zipBuffer[i] === 0x50 && zipBuffer[i + 1] === 0x4B) {
      if (zipBuffer[i + 2] === 0x03 && zipBuffer[i + 3] === 0x04) {
        // Local header: flag is at offset 6
        const flag = zipBuffer.readUInt16LE(i + 6);
        zipBuffer.writeUInt16LE(flag | 1, i + 6);
      } else if (zipBuffer[i + 2] === 0x01 && zipBuffer[i + 3] === 0x02) {
        // Central directory header: flag is at offset 8
        const flag = zipBuffer.readUInt16LE(i + 8);
        zipBuffer.writeUInt16LE(flag | 1, i + 8);
      }
    }
  }
  fs.writeFileSync(destPath, zipBuffer);
}

// Helper to create a minimal PDF containing an Encrypt dictionary
function createEncryptedPdfMock(destPath: string) {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 0 >>
stream
endstream
endobj
5 0 obj
<< /Filter /Standard /V 1 /R 2 /O (12345678901234567890123456789012) /U (12345678901234567890123456789012) /P -4 >>
endobj
trailer
<< /Size 6 /Root 1 0 R /Encrypt 5 0 R >>
startxref
300
%%EOF
`;
  fs.writeFileSync(destPath, Buffer.from(pdfContent, 'utf8'));
}

// Intercept child_process.execFile to inspect generated HTML and mock timeouts
let shouldSimulateTimeout = false;
let lastGeneratedHtml: string | null = null;
let lastExecOptions: any = null;

const originalExecFile = child_process.execFile;
(child_process as any).execFile = function (file: string, args: string[], options: any, callback: any) {
  lastExecOptions = options;
  // Capture HTML content if passed as file:/// path
  const htmlArg = args.find(arg => arg.includes('md_to_pdf_') && arg.endsWith('.html'));
  if (htmlArg) {
    const filePath = htmlArg.replace(/^file:\/\/\/?/, '');
    // Resolve path for Windows/Unix compatibility
    const resolvedPath = path.resolve(filePath);
    if (fs.existsSync(resolvedPath)) {
      lastGeneratedHtml = fs.readFileSync(resolvedPath, 'utf8');
    }
  }

  if (shouldSimulateTimeout) {
    const err = new Error(`Command failed: ${file} ${args.join(' ')}\nETIMEDOUT`);
    (err as any).killed = true;
    (err as any).code = null;
    (err as any).signal = 'SIGTERM';
    process.nextTick(() => callback(err, '', ''));
    return;
  }

  return originalExecFile.apply(this, arguments as any);
};

// Dynamically import doc tools so monkey patch is applied before module execution
const { convertMdToPdf, extractPptxText, searchPdf, extractDocxParagraphs } = await import('./tools/doc.js');

async function testConvertMdToPdf() {
  console.log('\n--- Stress Testing: convertMdToPdf ---');

  // Case 1.1: Large Markdown File (10,000 lines, ~400KB)
  console.log('Case 1.1: Large Markdown File (10k lines)...');
  const largeMdPath = path.join(testDir, 'large.md');
  const largePdfPath = path.join(testDir, 'large.pdf');
  const largeContent = Array.from({ length: 10000 }, (_, i) => `This is line **${i}** in our large document.`).join('\n');
  fs.writeFileSync(largeMdPath, largeContent, 'utf8');

  const start = Date.now();
  const success = await convertMdToPdf(largeMdPath, largePdfPath);
  console.log(`Large MD to PDF status: ${success}, Time taken: ${Date.now() - start}ms`);
  assert.strictEqual(success, true, 'Should convert large markdown successfully');
  assert.ok(fs.existsSync(largePdfPath), 'PDF file must be created');
  assert.ok(fs.statSync(largePdfPath).size > 0, 'PDF file must not be empty');

  // Case 1.2: Markdown with odd/unclosed asterisks (performance & correctness check)
  console.log('Case 1.2: Markdown with many unclosed asterisks...');
  const oddStarsMdPath = path.join(testDir, 'odd_stars.md');
  const oddStarsPdfPath = path.join(testDir, 'odd_stars.pdf');
  const oddStarsContent = Array.from({ length: 1000 }, (_, i) => `Line ${i}: **bold **bold **bold`).join('\n');
  fs.writeFileSync(oddStarsMdPath, oddStarsContent, 'utf8');

  const oddStarsStart = Date.now();
  const oddStarsSuccess = await convertMdToPdf(oddStarsMdPath, oddStarsPdfPath);
  console.log(`Odd stars MD to PDF status: ${oddStarsSuccess}, Time taken: ${Date.now() - oddStarsStart}ms`);
  assert.strictEqual(oddStarsSuccess, true, 'Should convert odd stars markdown successfully');

  // Case 1.3: HTML Injection Sanitization
  console.log('Case 1.3: HTML Injection test...');
  const injectMdPath = path.join(testDir, 'inject.md');
  const injectPdfPath = path.join(testDir, 'inject.pdf');
  const injectContent = `# Injection Test
This has HTML: <script>console.log("INJECTED SCRIPT EXECUTED");</script><iframe src="https://example.com" width="600" height="400"></iframe>
And event handlers: <div onclick="alert(1)" class="my-div">Content</div>
And javascript URIs: <a href="javascript:alert(2)">Link</a>
And spaces in scheme: <a href="  javascript:alert(3)">Link 2</a>
And html entities in scheme: <a href="java&#x09;script:alert(4)">Link 3</a>
`;
  fs.writeFileSync(injectMdPath, injectContent, 'utf8');
  lastGeneratedHtml = "" as string;
  const injectSuccess = await convertMdToPdf(injectMdPath, injectPdfPath);
  assert.strictEqual(injectSuccess, true, 'Should convert injection markdown successfully');
  assert.ok(lastGeneratedHtml, 'Should have captured generated HTML');

  console.log('Verifying HTML sanitization rules in intermediate HTML...');
  // 1. Script tag should be escaped
  assert.ok(!lastGeneratedHtml.includes('<script>'), 'Script tag should not be present');
  assert.ok(lastGeneratedHtml.includes('&lt;script&gt;'), 'Script tag must be escaped');
  // 2. Iframe tag should be escaped
  assert.ok(!lastGeneratedHtml.includes('<iframe'), 'Iframe tag should not be present');
  assert.ok(lastGeneratedHtml.includes('&lt;iframe'), 'Iframe tag must be escaped');
  // 3. Event handler should be stripped
  assert.ok(!lastGeneratedHtml.includes('onclick'), 'onclick attribute must be stripped');
  assert.ok(lastGeneratedHtml.includes('<div  class="my-div">Content</div>'), 'div content should remain');
  // 4. javascript: links should be stripped
  assert.ok(!lastGeneratedHtml.includes('javascript:'), 'javascript URL must be stripped');
  assert.ok(lastGeneratedHtml.includes('href=""') || !lastGeneratedHtml.includes('href="javascript'), 'javascript URL should be stripped');

  // Case 1.4: Edge Timeout Handling
  console.log('Case 1.4: Edge timeout test...');
  shouldSimulateTimeout = true;
  lastExecOptions = null;
  const timeoutMdPath = path.join(testDir, 'timeout.md');
  const timeoutPdfPath = path.join(testDir, 'timeout.pdf');
  fs.writeFileSync(timeoutMdPath, 'Some content', 'utf8');
  
  const timeoutSuccess = await convertMdToPdf(timeoutMdPath, timeoutPdfPath);
  shouldSimulateTimeout = false; // Restore
  
  assert.strictEqual(timeoutSuccess, false, 'Should return false when conversion times out');
  assert.strictEqual(lastExecOptions?.timeout, 30000, 'Exec timeout options must be 30 seconds');
  console.log('Timeout handled successfully (returned false, no crash).');

  // Case 1.5: Non-existent input file
  console.log('Case 1.5: Non-existent input file...');
  const missingSuccess = await convertMdToPdf(path.join(testDir, 'missing.md'), path.join(testDir, 'missing.pdf'));
  assert.strictEqual(missingSuccess, false, 'Should return false for non-existent input file');
}

async function testExtractPptxText() {
  console.log('\n--- Stress Testing: extractPptxText ---');

  // Case 2.1: Corrupt ZIP file
  console.log('Case 2.1: Corrupt PPTX (random bytes)...');
  const corruptPptxPath = path.join(testDir, 'corrupt.pptx');
  fs.writeFileSync(corruptPptxPath, Buffer.from('not a zip file at all', 'utf8'));
  await assert.rejects(
    extractPptxText(corruptPptxPath),
    /Failed to read PPTX file \(possibly corrupt or encrypted\)/,
    'Should throw error on corrupt PPTX'
  );
  console.log('Correctly rejected corrupt PPTX.');

  // Case 2.2: Password protected PPTX
  console.log('Case 2.2: Password protected PPTX...');
  const encryptedPptxPath = path.join(testDir, 'encrypted.pptx');
  createEncryptedZipMock(encryptedPptxPath, {
    'ppt/slides/slide1.xml': `<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Secret</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
  });
  await assert.rejects(
    extractPptxText(encryptedPptxPath),
    /Failed to read data for slide 1/,
    'Should throw error on encrypted PPTX'
  );
  console.log('Correctly rejected password protected PPTX.');

  // Case 2.3: PPTX with malformed XML slide
  console.log('Case 2.3: Malformed XML slide PPTX...');
  const malformedPptxPath = path.join(testDir, 'malformed.pptx');
  const zip = new AdmZip();
  zip.addFile('ppt/slides/slide1.xml', Buffer.from('<invalid-xml><a:p><a:t>Open tag mismatch', 'utf8'));
  zip.writeZip(malformedPptxPath);
  await assert.rejects(
    extractPptxText(malformedPptxPath),
    /Malformed XML in slide 1/,
    'Should throw error on malformed XML slide'
  );
  console.log('Correctly rejected malformed XML slide.');

  // Case 2.4: PPTX missing slide root element
  console.log('Case 2.4: PPTX missing slide root element...');
  const missingRootPptxPath = path.join(testDir, 'missing_root.pptx');
  const zip2 = new AdmZip();
  zip2.addFile('ppt/slides/slide1.xml', Buffer.from('<wrongRoot><a:p><a:t>No sld tag</a:t></a:p></wrongRoot>', 'utf8'));
  zip2.writeZip(missingRootPptxPath);
  await assert.rejects(
    extractPptxText(missingRootPptxPath),
    /Malformed slide XML in slide 1: missing slide root element/,
    'Should throw error when slide root element is missing'
  );
  console.log('Correctly rejected slide missing root element.');
}

async function testSearchPdf() {
  console.log('\n--- Stress Testing: searchPdf ---');

  // Case 3.1: Corrupt PDF
  console.log('Case 3.1: Corrupt PDF...');
  const corruptPdfPath = path.join(testDir, 'corrupt.pdf');
  fs.writeFileSync(corruptPdfPath, Buffer.from('not a pdf', 'utf8'));
  await assert.rejects(
    searchPdf(corruptPdfPath, 'test'),
    /Failed to parse PDF file/,
    'Should throw error on corrupt PDF'
  );
  console.log('Correctly rejected corrupt PDF.');

  // Case 3.2: Password protected PDF
  console.log('Case 3.2: Password protected PDF...');
  const encryptedPdfPath = path.join(testDir, 'encrypted.pdf');
  createEncryptedPdfMock(encryptedPdfPath);
  await assert.rejects(
    searchPdf(encryptedPdfPath, 'test'),
    /Failed to parse PDF file/,
    'Should throw error on encrypted PDF'
  );
  console.log('Correctly rejected password protected PDF.');

  // Case 3.3: Large/Multi-page PDF Search (stressing memory)
  console.log('Case 3.3: Large PDF search...');
  const largePdfPath = path.join(testDir, 'large.pdf');
  if (fs.existsSync(largePdfPath)) {
    const start = Date.now();
    const results = await searchPdf(largePdfPath, 'line 9999');
    console.log(`Search result count: ${results.length}, Time taken: ${Date.now() - start}ms`);
    assert.ok(results.length > 0, 'Should find the match');
    assert.strictEqual(results[0].page, 435, 'Match should be on the expected page');
    assert.ok(results[0].text.includes('line 9999'), 'Returned text must contain query');
  } else {
    console.log('Skipping Case 3.3 (large.pdf not found)');
  }
}

async function testExtractDocxParagraphs() {
  console.log('\n--- Stress Testing: extractDocxParagraphs ---');

  // Case 4.1: Corrupt DOCX
  console.log('Case 4.1: Corrupt DOCX...');
  const corruptDocxPath = path.join(testDir, 'corrupt.docx');
  fs.writeFileSync(corruptDocxPath, Buffer.from('corrupt', 'utf8'));
  await assert.rejects(
    extractDocxParagraphs(corruptDocxPath),
    /Failed to read DOCX file/,
    'Should throw error on corrupt DOCX'
  );
  console.log('Correctly rejected corrupt DOCX.');

  // Case 4.2: Password protected DOCX
  console.log('Case 4.2: Password protected DOCX...');
  const encryptedDocxPath = path.join(testDir, 'encrypted.docx');
  createEncryptedZipMock(encryptedDocxPath, {
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:t>Secret Doc</w:t></w:p></w:body></w:document>`
  });
  await assert.rejects(
    extractDocxParagraphs(encryptedDocxPath),
    /Failed to read word\/document\.xml content/,
    'Should throw error on encrypted DOCX'
  );
  console.log('Correctly rejected password protected DOCX.');

  // Case 4.3: DOCX without word/document.xml
  console.log('Case 4.3: DOCX missing word/document.xml...');
  const missingXmlDocxPath = path.join(testDir, 'missing.docx');
  const zip = new AdmZip();
  zip.addFile('some-other-file.txt', Buffer.from('hello', 'utf8'));
  zip.writeZip(missingXmlDocxPath);
  await assert.rejects(
    extractDocxParagraphs(missingXmlDocxPath),
    /Could not find word\/document\.xml inside docx ZIP/,
    'Should throw error when word/document.xml is missing'
  );
  console.log('Correctly rejected DOCX missing word/document.xml.');

  // Case 4.4: DOCX malformed XML
  console.log('Case 4.4: DOCX malformed XML...');
  const malformedDocxPath = path.join(testDir, 'malformed.docx');
  const zip2 = new AdmZip();
  zip2.addFile('word/document.xml', Buffer.from('<invalid-xml><w:p><w:t>Open tag mismatch', 'utf8'));
  zip2.writeZip(malformedDocxPath);
  await assert.rejects(
    extractDocxParagraphs(malformedDocxPath),
    /Malformed XML in word\/document\.xml/,
    'Should throw error when XML is malformed'
  );
  console.log('Correctly rejected DOCX with malformed XML.');
}

async function main() {
  setupTestDir();
  try {
    await testConvertMdToPdf();
    await testExtractPptxText();
    await testSearchPdf();
    await testExtractDocxParagraphs();
    console.log('\nALL STRESS TESTS PASSED SUCCESSFULLY!');
  } catch (err: any) {
    console.error('\nSTRESS TESTS FAILED!');
    console.error(err);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up stress test temp directory...');
    cleanTestDir();
    console.log('Done!');
  }
}

main().catch(err => {
  console.error('Stress test suite failed:', err);
  process.exit(1);
});
