import { Command } from 'commander';
import { mergePDFs, splitPDF, rotatePDF } from './tools/pdf.js';
import { trimVideo, mergeVideos, changeVideoSpeed, changeVideoVolume } from './tools/video.js';
import { trimAudio, mergeAudio, changeAudioSpeed, changeAudioVolume, reverseAudio } from './tools/audio.js';
import { convertImage, convertAudio, convertVideo } from './tools/converter.js';

export function setupCLI(): Command {
  const program = new Command();

  program
    .name('agent-tools')
    .description('High-performance CLI tools for file, video, audio, and PDF manipulation')
    .version('1.0.0');

  // PDF Subcommands
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

  // Video Subcommands
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

  // Audio Subcommands
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

  // Converter Subcommands
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

  return program;
}
