import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { splitPDF } from './pdf';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';

describe('splitPDF', () => {
  const testDir = path.join(__dirname, 'test-output');
  const dummyPdfPath = path.join(testDir, 'dummy.pdf');
  const outputDir = path.join(testDir, 'split-output');

  beforeAll(async () => {
    // Create test directories
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a 10-page dummy PDF
    const pdfDoc = await PDFDocument.create();
    for (let i = 0; i < 10; i++) {
      const page = pdfDoc.addPage([100, 100]);
      page.drawText(`Page ${i + 1}`, { x: 10, y: 50 });
    }
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(dummyPdfPath, pdfBytes);
  });

  afterAll(() => {
    // Clean up all test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up output directory after each test
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  describe('valid scenarios', () => {
    it('should split all pages individually when no range is provided', async () => {
      const files = await splitPDF(dummyPdfPath, outputDir);
      expect(files.length).toBe(10);
      files.forEach((file, index) => {
        expect(fs.existsSync(file)).toBe(true);
        expect(path.basename(file)).toBe(`dummy_page_${index + 1}.pdf`);
      });
    });

    it('should extract a single page', async () => {
      const files = await splitPDF(dummyPdfPath, outputDir, '5');
      expect(files.length).toBe(1);
      expect(fs.existsSync(files[0])).toBe(true);
      expect(path.basename(files[0])).toBe('dummy_extracted.pdf');

      const doc = await PDFDocument.load(fs.readFileSync(files[0]));
      expect(doc.getPageCount()).toBe(1);
    });

    it('should extract a list of specific pages', async () => {
      const files = await splitPDF(dummyPdfPath, outputDir, '1,3,5');
      expect(files.length).toBe(1);

      const doc = await PDFDocument.load(fs.readFileSync(files[0]));
      expect(doc.getPageCount()).toBe(3);
    });

    it('should extract a range of pages', async () => {
      const files = await splitPDF(dummyPdfPath, outputDir, '2-5');
      expect(files.length).toBe(1);

      const doc = await PDFDocument.load(fs.readFileSync(files[0]));
      expect(doc.getPageCount()).toBe(4);
    });

    it('should handle mixed lists and ranges', async () => {
      const files = await splitPDF(dummyPdfPath, outputDir, '1-3,7,9-10');
      expect(files.length).toBe(1);

      const doc = await PDFDocument.load(fs.readFileSync(files[0]));
      expect(doc.getPageCount()).toBe(6); // 1,2,3, 7, 9,10
    });

    it('should deduplicate and sort overlapping ranges', async () => {
      const files = await splitPDF(dummyPdfPath, outputDir, '1-4,3-5');
      expect(files.length).toBe(1);

      const doc = await PDFDocument.load(fs.readFileSync(files[0]));
      expect(doc.getPageCount()).toBe(5); // 1,2,3,4,5
    });
  });

  describe('error scenarios', () => {
    it('should throw an error for page out of upper bound', async () => {
      await expect(splitPDF(dummyPdfPath, outputDir, '11')).rejects.toThrow(/Invalid page number: 11/);
    });

    it('should throw an error for page out of lower bound (0)', async () => {
      await expect(splitPDF(dummyPdfPath, outputDir, '0')).rejects.toThrow(/Invalid page number: 0/);
    });

    it('should throw an error for range out of upper bound', async () => {
      await expect(splitPDF(dummyPdfPath, outputDir, '5-15')).rejects.toThrow(/Invalid page range: 5-15/);
    });

    it('should throw an error for range out of lower bound', async () => {
      await expect(splitPDF(dummyPdfPath, outputDir, '0-5')).rejects.toThrow(/Invalid page range: 0-5/);
    });

    it('should throw an error for invalid range format (start > end)', async () => {
      await expect(splitPDF(dummyPdfPath, outputDir, '5-3')).rejects.toThrow(/Invalid page range: 5-3/);
    });

    it('should throw an error for non-numeric single page', async () => {
      await expect(splitPDF(dummyPdfPath, outputDir, 'abc')).rejects.toThrow(/Invalid page number: abc/);
    });

    it('should throw an error for non-numeric range', async () => {
      await expect(splitPDF(dummyPdfPath, outputDir, '1-abc')).rejects.toThrow(/Invalid page range: 1-abc/);
    });
  });
});
