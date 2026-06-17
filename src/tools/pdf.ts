import { PDFDocument, degrees } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Merges multiple PDF files into a single PDF.
 */
export async function mergePDFs(inputPaths: string[], outputPath: string): Promise<string> {
  const mergedPdf = await PDFDocument.create();

  for (const inputPath of inputPaths) {
    const resolvedPath = path.resolve(inputPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }
    const pdfBytes = fs.readFileSync(resolvedPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedPdfBytes = await mergedPdf.save();
  const resolvedOutputPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(resolvedOutputPath, mergedPdfBytes);
  return resolvedOutputPath;
}

/**
 * Splits a PDF file. Can extract a range of pages or split it into single page files.
 */
export async function splitPDF(
  inputPath: string,
  outputDir: string,
  pages?: string // comma-separated list or range e.g. "1-3,5,7" (1-indexed)
): Promise<string[]> {
  const resolvedInputPath = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const pdfBytes = fs.readFileSync(resolvedInputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  let targetIndices: number[] = [];

  if (pages) {
    // Parse page selections like "1-3,5,7"
    const parts = pages.split(',');
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
          throw new Error(`Invalid page range: ${part}. Total pages: ${totalPages}`);
        }
        for (let i = start; i <= end; i++) {
          targetIndices.push(i - 1);
        }
      } else {
        const num = Number(part);
        if (isNaN(num) || num < 1 || num > totalPages) {
          throw new Error(`Invalid page number: ${part}. Total pages: ${totalPages}`);
        }
        targetIndices.push(num - 1);
      }
    }
    // Remove duplicates and sort
    targetIndices = Array.from(new Set(targetIndices)).sort((a, b) => a - b);
  } else {
    // If no pages specified, default to splitting all pages individually
    for (let i = 0; i < totalPages; i++) {
      targetIndices.push(i);
    }
  }

  const resolvedOutputDir = path.resolve(outputDir);
  fs.mkdirSync(resolvedOutputDir, { recursive: true });
  const createdFiles: string[] = [];

  if (pages) {
    // Extract specified pages into a single new document
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdfDoc, targetIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));
    const newPdfBytes = await newPdf.save();
    
    const baseName = path.basename(resolvedInputPath, '.pdf');
    const outPath = path.join(resolvedOutputDir, `${baseName}_extracted.pdf`);
    fs.writeFileSync(outPath, newPdfBytes);
    createdFiles.push(outPath);
  } else {
    // Split into individual pages
    const baseName = path.basename(resolvedInputPath, '.pdf');
    for (const index of targetIndices) {
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [index]);
      newPdf.addPage(copiedPage);
      const newPdfBytes = await newPdf.save();

      const outPath = path.join(resolvedOutputDir, `${baseName}_page_${index + 1}.pdf`);
      fs.writeFileSync(outPath, newPdfBytes);
      createdFiles.push(outPath);
    }
  }

  return createdFiles;
}

/**
 * Rotates specific pages of a PDF by a given angle (90, 180, 270 degrees).
 */
export async function rotatePDF(
  inputPath: string,
  outputPath: string,
  angle: number,
  pages?: string // comma-separated or range. If omitted, rotates all pages.
): Promise<string> {
  if (angle !== 90 && angle !== 180 && angle !== 270 && angle !== 0) {
    throw new Error('Rotation angle must be 90, 180, or 270 degrees.');
  }

  const resolvedInputPath = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const pdfBytes = fs.readFileSync(resolvedInputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  let targetIndices: number[] = [];
  if (pages) {
    const parts = pages.split(',');
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        for (let i = start; i <= end; i++) {
          targetIndices.push(i - 1);
        }
      } else {
        targetIndices.push(Number(part) - 1);
      }
    }
  } else {
    for (let i = 0; i < totalPages; i++) {
      targetIndices.push(i);
    }
  }

  for (const index of targetIndices) {
    if (index >= 0 && index < totalPages) {
      const page = pdfDoc.getPage(index);
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees((currentRotation + angle) % 360));
    }
  }

  const rotatedPdfBytes = await pdfDoc.save();
  const resolvedOutputPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(resolvedOutputPath, rotatedPdfBytes);
  return resolvedOutputPath;
}
