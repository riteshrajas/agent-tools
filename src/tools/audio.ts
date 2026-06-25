import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Runs a command line execution of FFmpeg.
 */
function runFFmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -y ${args.join(' ')}`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`FFmpeg failed: ${stderr || error.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Trims an audio file.
 */
export async function trimAudio(
  inputPath: string,
  outputPath: string,
  startTime: string,
  duration?: string
): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) {
    throw new Error(`Input audio not found: ${inputPath}`);
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  const args: string[] = [];
  args.push(`-ss`, startTime);
  args.push(`-i`, `"${resolvedIn}"`);
  if (duration) {
    args.push(`-t`, duration);
  }
  args.push(`-acodec`, `copy`); // Fast copy if possible
  args.push(`"${resolvedOut}"`);

  await runFFmpeg(args);
  return resolvedOut;
}

/**
 * Merges multiple audio files into one.
 */
export async function mergeAudio(inputPaths: string[], outputPath: string): Promise<string> {
  const resolvedOut = path.resolve(outputPath);
  if (inputPaths.length === 0) {
    throw new Error('No input audio files provided.');
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  // For ffmpeg concat, we create a temporary file list
  const tempFileListPath = path.resolve(`temp_concat_audio_${Date.now()}.txt`);
  const fileContent = inputPaths
    .map((p) => `file '${path.resolve(p).replace(/\\/g, '/')}'`)
    .join('\n');
  fs.writeFileSync(tempFileListPath, fileContent);

  try {
    const args = [
      `-f`,
      `concat`,
      `-safe`,
      `0`,
      `-i`,
      `"${tempFileListPath}"`,
      `-c`,
      `copy`,
      `"${resolvedOut}"`,
    ];
    await runFFmpeg(args);
  } finally {
    if (fs.existsSync(tempFileListPath)) {
      fs.unlinkSync(tempFileListPath);
    }
  }

  return resolvedOut;
}

/**
 * Changes audio speed.
 */
export async function changeAudioSpeed(
  inputPath: string,
  outputPath: string,
  speed: number
): Promise<string> {
  if (speed <= 0) {
    throw new Error("Speed must be greater than 0.");
  }
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) {
    throw new Error(`Input audio not found: ${inputPath}`);
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  let audioFilter = '';
  if (speed >= 0.5 && speed <= 2.0) {
    audioFilter = `atempo=${speed}`;
  } else {
    let remainingSpeed = speed;
    const filters: string[] = [];
    while (remainingSpeed > 2.0) {
      filters.push(`atempo=2.0`);
      remainingSpeed /= 2.0;
    }
    while (remainingSpeed < 0.5) {
      filters.push(`atempo=0.5`);
      remainingSpeed /= 0.5;
    }
    if (remainingSpeed !== 1.0) {
      filters.push(`atempo=${remainingSpeed}`);
    }
    audioFilter = filters.join(',');
  }

  const args = [
    `-i`,
    `"${resolvedIn}"`,
    `-filter:a`,
    `"${audioFilter}"`,
    `"${resolvedOut}"`,
  ];

  await runFFmpeg(args);
  return resolvedOut;
}

/**
 * Adjusts audio volume.
 */
export async function changeAudioVolume(
  inputPath: string,
  outputPath: string,
  volume: number
): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) {
    throw new Error(`Input audio not found: ${inputPath}`);
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  const args = [
    `-i`,
    `"${resolvedIn}"`,
    `-filter:a`,
    `"volume=${volume}"`,
    `"${resolvedOut}"`,
  ];

  await runFFmpeg(args);
  return resolvedOut;
}

/**
 * Reverses an audio file.
 */
export async function reverseAudio(inputPath: string, outputPath: string): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) {
    throw new Error(`Input audio not found: ${inputPath}`);
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  const args = [
    `-i`,
    `"${resolvedIn}"`,
    `-filter_complex`,
    `"areverse"`,
    `"${resolvedOut}"`,
  ];

  await runFFmpeg(args);
  return resolvedOut;
}
