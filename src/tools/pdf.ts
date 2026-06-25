import { execFile } from 'child_process';
import { PDFDocument, degrees, rgb } from 'pdf-lib';
// @ts-ignore
import qpdf from 'node-qpdf';
import * as fs from 'fs';
import * as path from 'path';


/**
 * Merges multiple PDF files into a single PDF.
 */
export async function mergePDFs(inputPaths: string[], outputPath: string): Promise<string> {
  if (inputPaths.length === 0) {
    throw new Error("No input files provided for merging.");
  }
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


export async function compressPDF(inputPath: string, outputPath: string): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) throw new Error(`Input file not found: ${inputPath}`);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  return new Promise((resolve, reject) => {
    execFile('qpdf', ['--linearize', resolvedIn, resolvedOut], (error, stdout, stderr) => {
      if (error) reject(new Error(`qpdf failed: ${stderr || error.message}`));
      else resolve(resolvedOut);
    });
  });
}

export async function protectPDF(inputPath: string, outputPath: string, userPass: string, ownerPass: string = userPass): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) throw new Error(`Input file not found: ${inputPath}`);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  const options = {
    keyLength: 256,
    password: userPass,
    ownerPassword: ownerPass
  };

  qpdf.encrypt(resolvedIn, options, resolvedOut);
  return resolvedOut;
}

export async function unlockPDF(inputPath: string, outputPath: string, password: string): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) throw new Error(`Input file not found: ${inputPath}`);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  qpdf.decrypt(resolvedIn, password, resolvedOut);
  return resolvedOut;
}

export async function addPageNumbers(inputPath: string, outputPath: string): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) throw new Error(`Input file not found: ${inputPath}`);

  const pdfBytes = fs.readFileSync(resolvedIn);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const text = `${i + 1}`;
    const fontSize = 12;
    page.drawText(text, {
      x: width / 2 - 5,
      y: 20,
      size: fontSize,
      color: rgb(0, 0, 0),
    });
  }

  const newPdfBytes = await pdfDoc.save();
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, newPdfBytes);
  return resolvedOut;
}

export async function pdfToOffice(inputPath: string, outputDir: string, format: 'docx' | 'xlsx' | 'html'): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOutDir = path.resolve(outputDir);
  if (!fs.existsSync(resolvedIn)) throw new Error(`Input file not found: ${inputPath}`);
  fs.mkdirSync(resolvedOutDir, { recursive: true });

  return new Promise((resolve, reject) => {
    execFile('soffice', ['--headless', '--infilter="writer_pdf_import"', '--convert-to', format, resolvedIn, '--outdir', resolvedOutDir], (error, stdout, stderr) => {
      if (error) reject(new Error(`soffice failed: ${stderr || error.message}`));
      else {
        const baseName = path.basename(inputPath, '.pdf');
        resolve(path.join(resolvedOutDir, `${baseName}.${format}`));
      }
    });
  });
}

export async function officeToPDF(inputPath: string, outputDir: string): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOutDir = path.resolve(outputDir);
  if (!fs.existsSync(resolvedIn)) throw new Error(`Input file not found: ${inputPath}`);
  fs.mkdirSync(resolvedOutDir, { recursive: true });

  return new Promise((resolve, reject) => {
    execFile('soffice', ['--headless', '--convert-to', 'pdf', resolvedIn, '--outdir', resolvedOutDir], (error, stdout, stderr) => {
      if (error) reject(new Error(`soffice failed: ${stderr || error.message}`));
      else {
        const ext = path.extname(inputPath);
        const baseName = path.basename(inputPath, ext);
        resolve(path.join(resolvedOutDir, `${baseName}.pdf`));
      }
    });
  });
}

export async function imagesToPDF(imagePaths: string[], outputPath: string): Promise<string> {
  const resolvedOut = path.resolve(outputPath);
  if (imagePaths.length === 0) throw new Error('No input images provided.');

  const pdfDoc = await PDFDocument.create();

  for (const p of imagePaths) {
    const resolvedPath = path.resolve(p);
    if (!fs.existsSync(resolvedPath)) throw new Error(`Image not found: ${p}`);

    const imageBytes = fs.readFileSync(resolvedPath);
    let pdfImage;
    if (p.toLowerCase().endsWith('.png')) {
      pdfImage = await pdfDoc.embedPng(imageBytes);
    } else if (p.toLowerCase().endsWith('.jpg') || p.toLowerCase().endsWith('.jpeg')) {
      pdfImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      throw new Error(`Unsupported image type for direct PDF conversion: ${p}`);
    }

    const { width, height } = pdfImage.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(pdfImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  const newPdfBytes = await pdfDoc.save();
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, newPdfBytes);
  return resolvedOut;
}
