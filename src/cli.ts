import { Command } from 'commander';
import { mergePDFs, splitPDF, rotatePDF } from './tools/pdf.js';
import { trimVideo, mergeVideos, changeVideoSpeed, changeVideoVolume } from './tools/video.js';
import { trimAudio, mergeAudio, changeAudioSpeed, changeAudioVolume, reverseAudio } from './tools/audio.js';
import { convertImage, convertAudio, convertVideo } from './tools/converter.js';
import { convertMdToPdf, extractPptxText, searchPdf, extractDocxParagraphs } from './tools/doc.js';
import { runInteractiveRepoCleanup, bundleCodebase, fetchGitHubRepos } from './tools/git.js';

export function setupCLI(): Command {
  const program = new Command();

  program
    .name('agent-tools')
    .description('High-performance CLI tools for file, video, audio, PDF, document, and GitHub manipulation')
    .version('2.0.0');

  // ─── PDF ──────────────────────────────────────────────────────────────────
  const pdfCmd = program.command('pdf').description('PDF manipulation tools');

  pdfCmd
    .command('merge')
    .description('Merge multiple PDFs into one')
    .argument('<output>', 'output PDF file path')
    .argument('<inputs...>', 'input PDF file paths')
    .action(async (output, inputs) => {
      try {
        console.log(`Merging ${inputs.length} PDFs into ${output}...`);
        const result = await mergePDFs(inputs, output);
        console.log(`Success! Merged PDF saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  pdfCmd
    .command('split')
    .description('Split a PDF into single pages or extract specific pages')
    .argument('<input>', 'input PDF file path')
    .argument('<outputDir>', 'directory to save split PDFs')
    .option('-p, --pages <pages>', 'comma-separated pages/ranges (e.g. 1-3,5,7)')
    .action(async (input, outputDir, options) => {
      try {
        console.log(`Splitting ${input}...`);
        const results = await splitPDF(input, outputDir, options.pages);
        console.log(`Success! Split ${results.length} files into ${outputDir}:`);
        results.forEach((f) => console.log(` - ${f}`));
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  pdfCmd
    .command('rotate')
    .description('Rotate PDF pages (90, 180, 270 degrees)')
    .argument('<input>', 'input PDF file path')
    .argument('<output>', 'output PDF file path')
    .argument('<angle>', 'rotation angle in degrees (90, 180, 270)', parseInt)
    .option('-p, --pages <pages>', 'comma-separated pages/ranges to rotate')
    .action(async (input, output, angle, options) => {
      try {
        console.log(`Rotating pages in ${input} by ${angle} degrees...`);
        const result = await rotatePDF(input, output, angle, options.pages);
        console.log(`Success! Rotated PDF saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  pdfCmd
    .command('search')
    .description('Search for text within a PDF file')
    .argument('<input>', 'input PDF file path')
    .argument('<query>', 'search query string')
    .action(async (input, query) => {
      try {
        console.log(`Searching "${query}" in ${input}...`);
        const results = await searchPdf(input, query);
        if (results.length === 0) {
          console.log('No matches found.');
        } else {
          console.log(`Found ${results.length} matching page(s):`);
          results.forEach(r => {
            console.log(`\n--- Page ${r.page} ---`);
            console.log(r.text.slice(0, 500) + (r.text.length > 500 ? '...' : ''));
          });
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // ─── DOC ──────────────────────────────────────────────────────────────────
  const docCmd = program.command('doc').description('Document reading and conversion tools');

  docCmd
    .command('md-to-pdf')
    .description('Convert a Markdown file to a styled PDF (requires MS Edge)')
    .argument('<input>', 'input Markdown file path (.md)')
    .argument('<output>', 'output PDF file path (.pdf)')
    .action(async (input, output) => {
      try {
        console.log(`Converting ${input} to PDF...`);
        const success = await convertMdToPdf(input, output);
        if (success) {
          console.log(`Success! PDF saved to: ${output}`);
        } else {
          console.error('Conversion failed. Ensure Microsoft Edge is installed.');
          process.exit(1);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  docCmd
    .command('read-pptx')
    .description('Extract all text from a PowerPoint presentation slide-by-slide')
    .argument('<input>', 'input .pptx file path')
    .option('-o, --output <file>', 'save output to a text file instead of printing')
    .action(async (input, options) => {
      try {
        const text = await extractPptxText(input);
        if (options.output) {
          const fs = await import('fs');
          fs.writeFileSync(options.output, text, 'utf8');
          console.log(`Text saved to: ${options.output}`);
        }
        // extractPptxText already prints to stdout
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  docCmd
    .command('read-docx')
    .description('Extract all paragraphs from a Word document (.docx)')
    .argument('<input>', 'input .docx file path')
    .option('-o, --output <file>', 'save output to a text file instead of printing')
    .action(async (input, options) => {
      try {
        const paragraphs = await extractDocxParagraphs(input);
        const text = paragraphs.filter(p => p.trim()).join('\n\n');
        if (options.output) {
          const fs = await import('fs');
          fs.writeFileSync(options.output, text, 'utf8');
          console.log(`Text saved to: ${options.output}`);
        } else {
          console.log(text);
        }
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // ─── VIDEO ────────────────────────────────────────────────────────────────
  const videoCmd = program.command('video').description('Video manipulation tools');

  videoCmd
    .command('trim')
    .description('Trim a video')
    .argument('<input>', 'input video file path')
    .argument('<output>', 'output video file path')
    .argument('<startTime>', 'start time (e.g. 00:01:20 or seconds)')
    .option('-t, --duration <duration>', 'duration of the trim (e.g. 10 or 00:00:10)')
    .action(async (input, output, startTime, options) => {
      try {
        console.log(`Trimming video starting at ${startTime}...`);
        const result = await trimVideo(input, output, startTime, options.duration);
        console.log(`Success! Trimmed video saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  videoCmd
    .command('merge')
    .description('Merge multiple videos into one')
    .argument('<output>', 'output video file path')
    .argument('<inputs...>', 'input video file paths')
    .action(async (output, inputs) => {
      try {
        console.log(`Merging ${inputs.length} videos...`);
        const result = await mergeVideos(inputs, output);
        console.log(`Success! Merged video saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  videoCmd
    .command('speed')
    .description('Change video playback speed')
    .argument('<input>', 'input video file path')
    .argument('<output>', 'output video file path')
    .argument('<speed>', 'speed multiplier (e.g. 1.5 or 0.75)', parseFloat)
    .action(async (input, output, speed) => {
      try {
        console.log(`Changing video speed to ${speed}x...`);
        const result = await changeVideoSpeed(input, output, speed);
        console.log(`Success! Speed-modified video saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  videoCmd
    .command('volume')
    .description('Change video audio volume')
    .argument('<input>', 'input video file path')
    .argument('<output>', 'output video file path')
    .argument('<volume>', 'volume multiplier (e.g. 1.5 or 0.5)', parseFloat)
    .action(async (input, output, volume) => {
      try {
        console.log(`Changing video volume to ${volume}x...`);
        const result = await changeVideoVolume(input, output, volume);
        console.log(`Success! Volume-modified video saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // ─── AUDIO ───────────────────────────────────────────────────────────────
  const audioCmd = program.command('audio').description('Audio manipulation tools');

  audioCmd
    .command('trim')
    .description('Trim an audio file')
    .argument('<input>', 'input audio file path')
    .argument('<output>', 'output audio file path')
    .argument('<startTime>', 'start time (e.g. 00:01:20 or seconds)')
    .option('-t, --duration <duration>', 'duration of the trim')
    .action(async (input, output, startTime, options) => {
      try {
        console.log(`Trimming audio starting at ${startTime}...`);
        const result = await trimAudio(input, output, startTime, options.duration);
        console.log(`Success! Trimmed audio saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  audioCmd
    .command('merge')
    .description('Merge multiple audio files into one')
    .argument('<output>', 'output audio file path')
    .argument('<inputs...>', 'input audio file paths')
    .action(async (output, inputs) => {
      try {
        console.log(`Merging ${inputs.length} audio files...`);
        const result = await mergeAudio(inputs, output);
        console.log(`Success! Merged audio saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  audioCmd
    .command('speed')
    .description('Change audio playback speed')
    .argument('<input>', 'input audio file path')
    .argument('<output>', 'output audio file path')
    .argument('<speed>', 'speed multiplier (e.g. 1.5 or 0.75)', parseFloat)
    .action(async (input, output, speed) => {
      try {
        console.log(`Changing audio speed to ${speed}x...`);
        const result = await changeAudioSpeed(input, output, speed);
        console.log(`Success! Speed-modified audio saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  audioCmd
    .command('volume')
    .description('Change audio volume')
    .argument('<input>', 'input audio file path')
    .argument('<output>', 'output audio file path')
    .argument('<volume>', 'volume multiplier (e.g. 1.5 or 0.5)', parseFloat)
    .action(async (input, output, volume) => {
      try {
        console.log(`Changing audio volume to ${volume}x...`);
        const result = await changeAudioVolume(input, output, volume);
        console.log(`Success! Volume-modified audio saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  audioCmd
    .command('reverse')
    .description('Reverse an audio track')
    .argument('<input>', 'input audio file path')
    .argument('<output>', 'output audio file path')
    .action(async (input, output) => {
      try {
        console.log(`Reversing audio track ${input}...`);
        const result = await reverseAudio(input, output);
        console.log(`Success! Reversed audio saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // ─── CONVERT ──────────────────────────────────────────────────────────────
  const convertCmd = program.command('convert').description('Universal file format converters');

  convertCmd
    .command('image')
    .description('Convert image formats (PNG, JPG, WebP, GIF) with resizing options')
    .argument('<input>', 'input image path')
    .argument('<output>', 'output image path')
    .option('--width <width>', 'resize width', parseInt)
    .option('--height <height>', 'resize height', parseInt)
    .option('--quality <quality>', 'output quality (1-100)', parseInt)
    .action(async (input, output, options) => {
      try {
        console.log(`Converting image ${input} to ${output}...`);
        const result = await convertImage(input, output, {
          width: options.width,
          height: options.height,
          quality: options.quality,
        });
        console.log(`Success! Converted image saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  convertCmd
    .command('audio')
    .description('Convert audio format (MP3, WAV, FLAC, OGG, M4A)')
    .argument('<input>', 'input audio path')
    .argument('<output>', 'output audio path')
    .action(async (input, output) => {
      try {
        console.log(`Converting audio ${input} to ${output}...`);
        const result = await convertAudio(input, output);
        console.log(`Success! Converted audio saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  convertCmd
    .command('video')
    .description('Convert video format (MP4, WebM, MKV, MOV, AVI)')
    .argument('<input>', 'input video path')
    .argument('<output>', 'output video path')
    .action(async (input, output) => {
      try {
        console.log(`Converting video ${input} to ${output}...`);
        const result = await convertVideo(input, output);
        console.log(`Success! Converted video saved to: ${result}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  // ─── GIT ──────────────────────────────────────────────────────────────────
  const gitCmd = program.command('git').description('GitHub repository management tools');

  gitCmd
    .command('clean-repos')
    .description('Interactive TUI to review, archive, or delete GitHub repositories')
    .action(async () => {
      await runInteractiveRepoCleanup();
    });

  gitCmd
    .command('list-repos')
    .description('List all GitHub repositories (JSON)')
    .option('--filter <filter>', 'filter repos by name (case-insensitive)')
    .action(async (options) => {
      try {
        const repos = fetchGitHubRepos();
        const filtered = options.filter
          ? repos.filter(r => r.name.toLowerCase().includes(options.filter.toLowerCase()))
          : repos;
        console.log(JSON.stringify(filtered, null, 2));
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  gitCmd
    .command('bundle')
    .description('Bundle an entire codebase directory into a single Markdown file (useful for pasting to LLMs)')
    .argument('<dir>', 'source directory to bundle')
    .argument('<output>', 'output Markdown file path')
    .option('--max-size <bytes>', 'max file size in bytes to include (default: 204800)', parseInt)
    .option('--ext <extensions>', 'comma-separated list of extensions to include (e.g. .ts,.py,.md)')
    .action(async (dir, output, options) => {
      try {
        const extensions = options.ext ? options.ext.split(',') : undefined;
        console.log(`Bundling codebase at ${dir}...`);
        const result = bundleCodebase(dir, output, {
          maxFileSize: options.maxSize,
          extensions,
        });
        console.log(`✅  Bundled ${result.fileCount} files (${(result.totalBytes / 1024).toFixed(1)} KB) → ${result.outputFile}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  return program;
}
