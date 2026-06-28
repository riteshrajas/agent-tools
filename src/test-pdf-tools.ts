import * as fs from 'fs';
import * as path from 'path';
import { mergePDFs } from './tools/pdf.js';
import { PDFDocument } from 'pdf-lib';

async function runTests() {
  console.log('--- Starting PDF Tools Tests ---');

  const testDir = path.resolve('./test-pdf-temp');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }

  // Generate dummy PDFs
  console.log('\nGenerating dummy PDFs...');
  const pdf1Path = path.join(testDir, 'dummy1.pdf');
  const pdf2Path = path.join(testDir, 'dummy2.pdf');
  const outputPath = path.join(testDir, 'merged.pdf');

  const doc1 = await PDFDocument.create();
  const page1 = doc1.addPage([500, 500]);
  page1.drawText('This is PDF 1');
  fs.writeFileSync(pdf1Path, await doc1.save());

  const doc2 = await PDFDocument.create();
  const page2 = doc2.addPage([500, 500]);
  page2.drawText('This is PDF 2');
  fs.writeFileSync(pdf2Path, await doc2.save());

  // 1. Test mergePDFs (Happy path)
  console.log('\n1. Testing mergePDFs (Happy path)...');
  const resultPath = await mergePDFs([pdf1Path, pdf2Path], outputPath);
  console.log('mergePDFs result path:', resultPath);

  if (!fs.existsSync(resultPath)) {
    throw new Error('mergePDFs failed to produce the output PDF file');
  }

  const mergedBytes = fs.readFileSync(resultPath);
  const mergedDoc = await PDFDocument.load(mergedBytes);
  if (mergedDoc.getPageCount() !== 2) {
    throw new Error(`Expected merged PDF to have 2 pages, but got ${mergedDoc.getPageCount()}`);
  }

  // 2. Test mergePDFs (Empty array)
  console.log('\n2. Testing mergePDFs (Empty input array)...');
  try {
    await mergePDFs([], path.join(testDir, 'empty_merge.pdf'));
    throw new Error('Expected mergePDFs to fail with empty input array');
  } catch (err: any) {
    if (err.message === 'Expected mergePDFs to fail with empty input array') {
        throw err;
    }
    console.log('Successfully caught expected error:', err.message);
    if (!err.message.includes('No input files provided for merging.')) {
      throw new Error(`Unexpected error message: ${err.message}`);
    }
  }

  // 3. Test mergePDFs (Non-existent files)
  console.log('\n3. Testing mergePDFs (Non-existent files)...');
  try {
    await mergePDFs([path.join(testDir, 'non-existent.pdf')], path.join(testDir, 'error_merge.pdf'));
    throw new Error('Expected mergePDFs to fail with non-existent file');
  } catch (err: any) {
    if (err.message === 'Expected mergePDFs to fail with non-existent file') {
        throw err;
    }
    console.log('Successfully caught expected error:', err.message);
    if (!err.message.includes('Input file not found')) {
      throw new Error(`Unexpected error message: ${err.message}`);
    }
  }

  // Clean up
  console.log('\nCleaning up temp files...');
  if (fs.existsSync(pdf1Path)) fs.unlinkSync(pdf1Path);
  if (fs.existsSync(pdf2Path)) fs.unlinkSync(pdf2Path);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  const emptyMergePath = path.join(testDir, 'empty_merge.pdf');
  if (fs.existsSync(emptyMergePath)) fs.unlinkSync(emptyMergePath);
  const errorMergePath = path.join(testDir, 'error_merge.pdf');
  if (fs.existsSync(errorMergePath)) fs.unlinkSync(errorMergePath);

  // fallback for arbitrary files
  const files = fs.readdirSync(testDir);
  for (const file of files) {
      fs.unlinkSync(path.join(testDir, file));
  }

  fs.rmdirSync(testDir);

  console.log('\n--- All Tests Passed Successfully! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
