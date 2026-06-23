import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { convertMdToPdf, extractPptxText, searchPdf, extractDocxParagraphs } from './tools/doc.js';
import {
  mergePDFs,
  splitPDF,
  rotatePDF,
  compressPDF,
  protectPDF,
  unlockPDF,
  addPageNumbers,
  pdfToOffice,
  officeToPDF,
  imagesToPDF
} from './tools/pdf.js';

interface TestResult {
  category: string;
  name: string;
  expected: string;
  outcome: 'PASS' | 'FAIL' | 'CRASH';
  details: string;
}

const results: TestResult[] = [];

function logResult(category: string, name: string, expected: string, outcome: 'PASS' | 'FAIL' | 'CRASH', details: string) {
  results.push({ category, name, expected, outcome, details });
  console.log(`[${outcome}] ${category} - ${name}`);
  console.log(`  Expected: ${expected}`);
  console.log(`  Details:  ${details}\n`);
}

async function runAdversarialTests() {
  console.log('=== STARTING ADVERSARIAL & BOUNDARY TESTS ===\n');

  const testDir = path.resolve('./adversarial-temp');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }

  // Helper files
  const emptyFilePath = path.join(testDir, 'empty.txt');
  fs.writeFileSync(emptyFilePath, '');

  const dummyFilePath = path.join(testDir, 'dummy.txt');
  fs.writeFileSync(dummyFilePath, 'Just some text');

  const dummyDir = path.join(testDir, 'dummy-dir');
  if (!fs.existsSync(dummyDir)) {
    fs.mkdirSync(dummyDir);
  }

  // --- CATEGORY: convertMdToPdf ---
  const catMd = 'convertMdToPdf';
  
  // Test 1: Non-existent markdown path
  try {
    const success = await convertMdToPdf(path.join(testDir, 'non-existent.md'), path.join(testDir, 'out.pdf'));
    if (success === false) {
      logResult(catMd, 'Non-existent input path', 'Return false', 'PASS', 'Returned false as expected.');
    } else {
      logResult(catMd, 'Non-existent input path', 'Return false', 'FAIL', `Returned ${success} instead of false.`);
    }
  } catch (err: any) {
    logResult(catMd, 'Non-existent input path', 'Return false', 'CRASH', `Threw error: ${err.message}`);
  }

  // Test 2: Input path is a directory
  try {
    const success = await convertMdToPdf(dummyDir, path.join(testDir, 'out.pdf'));
    if (success === false) {
      logResult(catMd, 'Input path is directory', 'Return false / handle gracefully', 'PASS', 'Returned false as expected.');
    } else {
      logResult(catMd, 'Input path is directory', 'Return false / handle gracefully', 'FAIL', `Returned ${success} instead of false.`);
    }
  } catch (err: any) {
    logResult(catMd, 'Input path is directory', 'Return false / handle gracefully', 'CRASH', `Process crashed with error: ${err.message}`);
  }

  // Test 3: Output path is a directory
  const tempMd = path.join(testDir, 'temp.md');
  fs.writeFileSync(tempMd, '# Hello');
  try {
    const success = await convertMdToPdf(tempMd, dummyDir);
    if (success === false) {
      logResult(catMd, 'Output path is directory', 'Return false / handle gracefully', 'PASS', 'Returned false as expected.');
    } else {
      logResult(catMd, 'Output path is directory', 'Return false / handle gracefully', 'FAIL', `Returned ${success} instead of false.`);
    }
  } catch (err: any) {
    logResult(catMd, 'Output path is directory', 'Return false / handle gracefully', 'CRASH', `Process crashed with error: ${err.message}`);
  }

  // Test 4: Odd asterisks (bold) rendering
  try {
    const oddAsteriskMd = path.join(testDir, 'odd-asterisks.md');
    fs.writeFileSync(oddAsteriskMd, 'This has **odd asterisks in it.');
    const oddPdf = path.join(testDir, 'odd.pdf');
    const success = await convertMdToPdf(oddAsteriskMd, oddPdf);
    if (success) {
      logResult(catMd, 'Odd asterisks in Markdown', 'Succeed but output might have unclosed strong tags', 'PASS', 'Returned true. PDF generated.');
    } else {
      logResult(catMd, 'Odd asterisks in Markdown', 'Succeed but output might have unclosed strong tags', 'FAIL', 'Failed to generate PDF.');
    }
  } catch (err: any) {
    logResult(catMd, 'Odd asterisks in Markdown', 'Handle gracefully', 'CRASH', `Process crashed: ${err.message}`);
  }

  // --- CATEGORY: extractPptxText ---
  const catPptx = 'extractPptxText';

  // Test 5: Non-existent pptx path
  try {
    await extractPptxText(path.join(testDir, 'non-existent.pptx'));
    logResult(catPptx, 'Non-existent file', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catPptx, 'Non-existent file', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 6: Input path is directory
  try {
    await extractPptxText(dummyDir);
    logResult(catPptx, 'Input path is directory', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catPptx, 'Input path is directory', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 7: Empty file (invalid ZIP format)
  try {
    await extractPptxText(emptyFilePath);
    logResult(catPptx, 'Empty file', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catPptx, 'Empty file', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 8: Valid ZIP file but not PowerPoint (missing slides)
  try {
    const dummyZipPath = path.join(testDir, 'dummy.pptx');
    const zip = new AdmZip();
    zip.addFile('not-powerpoint.txt', Buffer.from('hello'));
    zip.writeZip(dummyZipPath);

    const text = await extractPptxText(dummyZipPath);
    if (text === '') {
      logResult(catPptx, 'Valid ZIP but missing slides', 'Return empty string or throw', 'PASS', 'Returned empty string.');
    } else {
      logResult(catPptx, 'Valid ZIP but missing slides', 'Return empty string or throw', 'FAIL', `Returned: "${text}"`);
    }
  } catch (err: any) {
    logResult(catPptx, 'Valid ZIP but missing slides', 'Return empty string or throw', 'PASS', `Threw error: ${err.message}`);
  }

  // --- CATEGORY: searchPdf ---
  const catSearch = 'searchPdf';
  const samplePdf = path.join(testDir, 'odd.pdf'); // We generated this earlier

  // Test 9: Non-existent PDF file
  try {
    await searchPdf(path.join(testDir, 'non-existent.pdf'), 'query');
    logResult(catSearch, 'Non-existent PDF file', 'Throw/Reject Error', 'FAIL', 'Resolved successfully instead of rejecting.');
  } catch (err: any) {
    logResult(catSearch, 'Non-existent PDF file', 'Throw/Reject Error', 'PASS', `Rejected with error: ${err.message}`);
  }

  // Test 10: Input path is directory
  try {
    await searchPdf(dummyDir, 'query');
    logResult(catSearch, 'Input path is directory', 'Throw/Reject Error', 'FAIL', 'Resolved successfully instead of rejecting.');
  } catch (err: any) {
    logResult(catSearch, 'Input path is directory', 'Throw/Reject Error', 'PASS', `Rejected with error: ${err.message}`);
  }

  // Test 11: Empty file / invalid PDF
  try {
    await searchPdf(emptyFilePath, 'query');
    logResult(catSearch, 'Empty file (corrupt PDF)', 'Throw/Reject Error', 'FAIL', 'Resolved successfully instead of rejecting.');
  } catch (err: any) {
    logResult(catSearch, 'Empty file (corrupt PDF)', 'Throw/Reject Error', 'PASS', `Rejected with error: ${err.message}`);
  }

  // Test 12: Empty search query
  try {
    if (fs.existsSync(samplePdf)) {
      const resultsList = await searchPdf(samplePdf, '');
      logResult(catSearch, 'Empty search query', 'Match everything or handle gracefully', 'PASS', `Matched and returned ${resultsList.length} pages.`);
    } else {
      logResult(catSearch, 'Empty search query', 'N/A', 'FAIL', 'Sample PDF not found to run test.');
    }
  } catch (err: any) {
    logResult(catSearch, 'Empty search query', 'Handle gracefully', 'CRASH', `Crashed with error: ${err.message}`);
  }

  // --- CATEGORY: extractDocxParagraphs ---
  const catDocx = 'extractDocxParagraphs';

  // Test 13: Non-existent docx path
  try {
    await extractDocxParagraphs(path.join(testDir, 'non-existent.docx'));
    logResult(catDocx, 'Non-existent file', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catDocx, 'Non-existent file', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 14: Input path is directory
  try {
    await extractDocxParagraphs(dummyDir);
    logResult(catDocx, 'Input path is directory', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catDocx, 'Input path is directory', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 15: Empty file
  try {
    await extractDocxParagraphs(emptyFilePath);
    logResult(catDocx, 'Empty file', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catDocx, 'Empty file', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 16: Valid ZIP but missing document.xml
  try {
    const dummyZipPath = path.join(testDir, 'dummy.docx');
    const zip = new AdmZip();
    zip.addFile('not-word.txt', Buffer.from('hello'));
    zip.writeZip(dummyZipPath);

    await extractDocxParagraphs(dummyZipPath);
    logResult(catDocx, 'Valid ZIP but missing document.xml', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catDocx, 'Valid ZIP but missing document.xml', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }


  // --- CATEGORY: mergePDFs ---
  const catMerge = 'mergePDFs';

  // Test 17: Empty input array
  try {
    const outMerge = path.join(testDir, 'merged_empty.pdf');
    await mergePDFs([], outMerge);
    logResult(catMerge, 'Empty inputs array', 'Throw Error / Handle gracefully', 'PASS', `Created PDF at ${outMerge}`);
  } catch (err: any) {
    logResult(catMerge, 'Empty inputs array', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 18: One non-existent input file
  try {
    const outMerge = path.join(testDir, 'merged_fail.pdf');
    await mergePDFs([samplePdf, path.join(testDir, 'non-existent.pdf')], outMerge);
    logResult(catMerge, 'One non-existent input', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catMerge, 'One non-existent input', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 19: Input is a directory
  try {
    const outMerge = path.join(testDir, 'merged_fail.pdf');
    await mergePDFs([dummyDir], outMerge);
    logResult(catMerge, 'Input is directory', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catMerge, 'Input is directory', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 20: Input is corrupted/not PDF
  try {
    const outMerge = path.join(testDir, 'merged_fail.pdf');
    await mergePDFs([dummyFilePath], outMerge);
    logResult(catMerge, 'Input is corrupt/not PDF', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catMerge, 'Input is corrupt/not PDF', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }


  // --- CATEGORY: splitPDF ---
  const catSplit = 'splitPDF';

  // Test 21: Non-existent input
  try {
    await splitPDF(path.join(testDir, 'non-existent.pdf'), testDir);
    logResult(catSplit, 'Non-existent input', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catSplit, 'Non-existent input', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 22: Output directory is a file
  try {
    await splitPDF(samplePdf, dummyFilePath);
    logResult(catSplit, 'Output dir is file', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catSplit, 'Output dir is file', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 23: Invalid pages range "abc"
  try {
    await splitPDF(samplePdf, testDir, 'abc');
    logResult(catSplit, 'Invalid pages string "abc"', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catSplit, 'Invalid pages string "abc"', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 24: Invalid pages range "0"
  try {
    await splitPDF(samplePdf, testDir, '0');
    logResult(catSplit, 'Invalid pages string "0"', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catSplit, 'Invalid pages string "0"', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 25: Invalid pages range "2-1"
  try {
    await splitPDF(samplePdf, testDir, '2-1');
    logResult(catSplit, 'Invalid pages range "2-1"', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catSplit, 'Invalid pages range "2-1"', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 26: Pages range exceeds total pages (PDF generated has 1 page, request "2")
  try {
    await splitPDF(samplePdf, testDir, '2');
    logResult(catSplit, 'Pages range out of bounds', 'Throw Error', 'FAIL', 'Returned successfully instead of throwing.');
  } catch (err: any) {
    logResult(catSplit, 'Pages range out of bounds', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }


  // --- CATEGORY: rotatePDF ---
  const catRotate = 'rotatePDF';

  // Test 27: Non-existent input
  try {
    await rotatePDF(path.join(testDir, 'non-existent.pdf'), path.join(testDir, 'rot.pdf'), 90);
    logResult(catRotate, 'Non-existent input', 'Throw Error', 'FAIL', 'Returned successfully.');
  } catch (err: any) {
    logResult(catRotate, 'Non-existent input', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 28: Invalid angle
  try {
    await rotatePDF(samplePdf, path.join(testDir, 'rot.pdf'), 45);
    logResult(catRotate, 'Invalid angle 45', 'Throw Error', 'FAIL', 'Returned successfully.');
  } catch (err: any) {
    logResult(catRotate, 'Invalid angle 45', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 29: Negative pages option (e.g. "-2") - Unintended behavior validation
  try {
    const rotOut = path.join(testDir, 'rot_neg.pdf');
    await rotatePDF(samplePdf, rotOut, 90, '-2');
    logResult(catRotate, 'Pages range with negative number "-2"', 'Reject / Throw Error', 'FAIL', `Rotated successfully and saved to ${rotOut}. (Unintended split and map behavior didn't block it)`);
  } catch (err: any) {
    logResult(catRotate, 'Pages range with negative number "-2"', 'Reject / Throw Error', 'PASS', `Threw error: ${err.message}`);
  }


  // --- CATEGORY: compressPDF / protectPDF / unlockPDF ---
  const catQpdf = 'qpdf-tools';

  // Test 30: compressPDF with missing qpdf binary
  try {
    await compressPDF(samplePdf, path.join(testDir, 'compressed.pdf'));
    logResult(catQpdf, 'compressPDF missing qpdf binary', 'Throw Error', 'FAIL', 'Returned successfully.');
  } catch (err: any) {
    logResult(catQpdf, 'compressPDF missing qpdf binary', 'Throw Error', 'PASS', `Threw expected error: ${err.message}`);
  }

  // Test 31: protectPDF with missing qpdf binary
  try {
    await protectPDF(samplePdf, path.join(testDir, 'protected.pdf'), 'pass123');
    logResult(catQpdf, 'protectPDF missing qpdf binary', 'Throw Error', 'FAIL', 'Returned successfully.');
  } catch (err: any) {
    logResult(catQpdf, 'protectPDF missing qpdf binary', 'Throw Error', 'PASS', `Threw expected error: ${err.message}`);
  }

  // Test 32: unlockPDF with missing qpdf binary
  try {
    await unlockPDF(samplePdf, path.join(testDir, 'unlocked.pdf'), 'pass123');
    logResult(catQpdf, 'unlockPDF missing qpdf binary', 'Throw Error', 'FAIL', 'Returned successfully.');
  } catch (err: any) {
    logResult(catQpdf, 'unlockPDF missing qpdf binary', 'Throw Error', 'PASS', `Threw expected error: ${err.message}`);
  }


  // --- CATEGORY: addPageNumbers ---
  const catPageNum = 'addPageNumbers';

  // Test 33: Non-existent input
  try {
    await addPageNumbers(path.join(testDir, 'non-existent.pdf'), path.join(testDir, 'numbered.pdf'));
    logResult(catPageNum, 'Non-existent input', 'Throw Error', 'FAIL', 'Returned successfully.');
  } catch (err: any) {
    logResult(catPageNum, 'Non-existent input', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }


  // --- CATEGORY: pdfToOffice / officeToPDF ---
  const catLibre = 'libreoffice-tools';

  // Test 34: pdfToOffice missing soffice binary
  try {
    await pdfToOffice(samplePdf, testDir, 'docx');
    logResult(catLibre, 'pdfToOffice missing soffice', 'Throw Error', 'FAIL', 'Returned successfully.');
  } catch (err: any) {
    logResult(catLibre, 'pdfToOffice missing soffice', 'Throw Error', 'PASS', `Threw expected error: ${err.message}`);
  }

  // Test 35: officeToPDF missing soffice binary
  try {
    await officeToPDF(dummyFilePath, testDir);
    logResult(catLibre, 'officeToPDF missing soffice', 'Throw Error', 'FAIL', 'Returned successfully.');
  } catch (err: any) {
    logResult(catLibre, 'officeToPDF missing soffice', 'Throw Error', 'PASS', `Threw expected error: ${err.message}`);
  }


  // --- CATEGORY: imagesToPDF ---
  const catImages = 'imagesToPDF';

  // Test 36: Empty image paths
  try {
    await imagesToPDF([], path.join(testDir, 'images.pdf'));
    logResult(catImages, 'Empty image paths', 'Throw Error', 'FAIL', 'Returned successfully.');
  } catch (err: any) {
    logResult(catImages, 'Empty image paths', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 37: Non-existent image file
  try {
    await imagesToPDF([path.join(testDir, 'non-existent.png')], path.join(testDir, 'images.pdf'));
    logResult(catImages, 'Non-existent image file', 'Throw Error', 'FAIL', 'Returned successfully.');
  } catch (err: any) {
    logResult(catImages, 'Non-existent image file', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }

  // Test 38: Unsupported image format (e.g. .txt or .bmp)
  try {
    await imagesToPDF([dummyFilePath], path.join(testDir, 'images.pdf'));
    logResult(catImages, 'Unsupported image format', 'Throw Error', 'FAIL', 'Returned successfully.');
  } catch (err: any) {
    logResult(catImages, 'Unsupported image format', 'Throw Error', 'PASS', `Threw error: ${err.message}`);
  }


  console.log('\n=== CLEANING UP TEMP FILES ===');
  try {
    // Delete test files manually
    fs.readdirSync(testDir).forEach((file) => {
      const curPath = path.join(testDir, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        fs.rmdirSync(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(testDir);
    console.log('Cleanup complete.');
  } catch (err: any) {
    console.error('Error during cleanup:', err.message);
  }

  // Summary
  console.log('\n=== ADVERSARIAL TEST SUMMARY ===');
  const passes = results.filter(r => r.outcome === 'PASS').length;
  const fails = results.filter(r => r.outcome === 'FAIL').length;
  const crashes = results.filter(r => r.outcome === 'CRASH').length;
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed:      ${passes}`);
  console.log(`Failed:      ${fails}`);
  console.log(`Crashed:     ${crashes}`);

  // Write a JSON or summary report file so we can parse it easily
  fs.writeFileSync('./adversarial-results.json', JSON.stringify(results, null, 2), 'utf8');
}

runAdversarialTests().catch(err => {
  console.error('Adversarial tests crashed:', err);
  process.exit(1);
});
