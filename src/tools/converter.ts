import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

/**
 * Runs a command line execution of FFmpeg.
 */
function runFFmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-y', ...args], (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`FFmpeg failed: ${stderr || error.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Converts an image file from one format to another and supports resizing.
 */
export async function convertImage(
  inputPath: string,
  outputPath: string,
  options?: { width?: number; height?: number; quality?: number }
): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) {
    throw new Error(`Input image file not found: ${inputPath}`);
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  let pipeline = sharp(resolvedIn);

  if (options?.width || options?.height) {
    pipeline = pipeline.resize({
      width: options.width,
      height: options.height,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const ext = path.extname(resolvedOut).toLowerCase().replace('.', '');
  
  if (ext === 'jpg' || ext === 'jpeg') {
    pipeline = pipeline.jpeg({ quality: options?.quality ?? 80 });
  } else if (ext === 'png') {
    pipeline = pipeline.png({ quality: options?.quality ?? 80 });
  } else if (ext === 'webp') {
    pipeline = pipeline.webp({ quality: options?.quality ?? 80 });
  } else if (ext === 'gif') {
    pipeline = pipeline.gif();
  }

  await pipeline.toFile(resolvedOut);
  return resolvedOut;
}

/**
 * Converts audio from one format to another.
 */
export async function convertAudio(inputPath: string, outputPath: string): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) {
    throw new Error(`Input audio file not found: ${inputPath}`);
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  // Use ffmpeg for audio transcoding
  const args = [`-i`, resolvedIn, resolvedOut];
  await runFFmpeg(args);
  return resolvedOut;
}

/**
 * Converts video from one format to another.
 */
export async function convertVideo(inputPath: string, outputPath: string): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) {
    throw new Error(`Input video file not found: ${inputPath}`);
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  // Use ffmpeg for video transcoding
  const args = [`-i`, resolvedIn, resolvedOut];
  await runFFmpeg(args);
  return resolvedOut;
}
