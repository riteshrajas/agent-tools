import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { splitPDF } from './pdf.js';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import * as os from 'os';

describe('splitPDF range parsing', () => {
  let tempDir: string;
  let testPdfPath: string;

  before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-test-'));
    testPdfPath = path.join(tempDir, 'test-10-pages.pdf');

    const pdfDoc = await PDFDocument.create();
    for (let i = 0; i < 10; i++) {
      pdfDoc.addPage([100, 100]);
    }
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(testPdfPath, pdfBytes);
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('valid single page', async () => {
    const outDir = path.join(tempDir, 'out1');
    const outFiles = await splitPDF(testPdfPath, outDir, '5');
    assert.strictEqual(outFiles.length, 1);

    // Check page count of output
    const pdfDoc = await PDFDocument.load(fs.readFileSync(outFiles[0]));
    assert.strictEqual(pdfDoc.getPageCount(), 1);
  });

  test('valid simple range', async () => {
    const outDir = path.join(tempDir, 'out2');
    const outFiles = await splitPDF(testPdfPath, outDir, '1-3');
    assert.strictEqual(outFiles.length, 1);

    const pdfDoc = await PDFDocument.load(fs.readFileSync(outFiles[0]));
    assert.strictEqual(pdfDoc.getPageCount(), 3);
  });

  test('valid complex combinations', async () => {
    const outDir = path.join(tempDir, 'out3');
    const outFiles = await splitPDF(testPdfPath, outDir, '1-3,5,7-9');
    assert.strictEqual(outFiles.length, 1);

    const pdfDoc = await PDFDocument.load(fs.readFileSync(outFiles[0]));
    assert.strictEqual(pdfDoc.getPageCount(), 7); // 1,2,3,5,7,8,9
  });

  test('valid unsorted/overlapping ranges', async () => {
    const outDir = path.join(tempDir, 'out4');
    const outFiles = await splitPDF(testPdfPath, outDir, '5,1-3,2-4');
    assert.strictEqual(outFiles.length, 1);

    const pdfDoc = await PDFDocument.load(fs.readFileSync(outFiles[0]));
    // Expected: 1, 2, 3, 4, 5 (unique, sorted)
    assert.strictEqual(pdfDoc.getPageCount(), 5);
  });

  test('error: out-of-bounds page (0)', async () => {
    const outDir = path.join(tempDir, 'err1');
    await assert.rejects(
      () => splitPDF(testPdfPath, outDir, '0'),
      /Invalid page number: 0\. Total pages: 10/
    );
  });

  test('error: out-of-bounds page (11)', async () => {
    const outDir = path.join(tempDir, 'err2');
    await assert.rejects(
      () => splitPDF(testPdfPath, outDir, '11'),
      /Invalid page number: 11\. Total pages: 10/
    );
  });

  test('error: reversed range (3-1)', async () => {
    const outDir = path.join(tempDir, 'err3');
    await assert.rejects(
      () => splitPDF(testPdfPath, outDir, '3-1'),
      /Invalid page range: 3-1\. Total pages: 10/
    );
  });

  test('error: invalid non-numeric string (a)', async () => {
    const outDir = path.join(tempDir, 'err4');
    await assert.rejects(
      () => splitPDF(testPdfPath, outDir, 'a'),
      /Invalid page number: a\. Total pages: 10/
    );
  });

  test('error: invalid non-numeric string (1-a)', async () => {
    const outDir = path.join(tempDir, 'err5');
    await assert.rejects(
      () => splitPDF(testPdfPath, outDir, '1-a'),
      /Invalid page range: 1-a\. Total pages: 10/
    );
  });
});
