import { splitPDF } from '../src/tools/pdf';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';

describe('splitPDF ranges parsing', () => {
    let dummyPdfPath: string;
    let outDir: string;

    beforeAll(async () => {
        // create a dummy pdf with 10 pages
        outDir = path.join(__dirname, 'temp_out');
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir);
        }

        dummyPdfPath = path.join(__dirname, 'dummy.pdf');
        const pdfDoc = await PDFDocument.create();
        for (let i = 0; i < 10; i++) {
            pdfDoc.addPage([500, 500]);
        }
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(dummyPdfPath, pdfBytes);
    });

    afterAll(() => {
        if (fs.existsSync(dummyPdfPath)) {
            fs.unlinkSync(dummyPdfPath);
        }
        if (fs.existsSync(outDir)) {
            fs.rmSync(outDir, { recursive: true, force: true });
        }
    });

    it('should split all pages if no ranges are provided', async () => {
        const result = await splitPDF(dummyPdfPath, outDir);
        expect(result.length).toBe(10);
    });

    it('should parse single page correctly', async () => {
        const result = await splitPDF(dummyPdfPath, outDir, '1');
        expect(result.length).toBe(1);
    });

    it('should parse simple range correctly', async () => {
        const result = await splitPDF(dummyPdfPath, outDir, '1-3');
        expect(result.length).toBe(1); // extracts the pages to ONE file

        const extracted = await PDFDocument.load(fs.readFileSync(result[0]));
        expect(extracted.getPageCount()).toBe(3);
    });

    it('should parse multiple comma separated ranges correctly', async () => {
        const result = await splitPDF(dummyPdfPath, outDir, '1-3,5,7-8');
        expect(result.length).toBe(1); // extracts the pages to ONE file

        const extracted = await PDFDocument.load(fs.readFileSync(result[0]));
        expect(extracted.getPageCount()).toBe(6);
    });

    it('should throw an error for invalid page numbers', async () => {
        await expect(splitPDF(dummyPdfPath, outDir, '11')).rejects.toThrow('Invalid page number: 11');
    });

    it('should throw an error for out of bounds range', async () => {
        await expect(splitPDF(dummyPdfPath, outDir, '8-11')).rejects.toThrow('Invalid page range: 8-11');
    });

    it('should throw an error for inverted range', async () => {
        await expect(splitPDF(dummyPdfPath, outDir, '5-2')).rejects.toThrow('Invalid page range: 5-2');
    });

    it('should throw an error for invalid characters', async () => {
        await expect(splitPDF(dummyPdfPath, outDir, 'a')).rejects.toThrow('Invalid page number: a');
    });
});
