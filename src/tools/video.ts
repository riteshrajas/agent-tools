import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

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
 * Trims a video from start time to duration.
 * @param startTime Start time in seconds or HH:MM:SS format
 * @param duration Duration in seconds or HH:MM:SS format
 */
export async function trimVideo(
  inputPath: string,
  outputPath: string,
  startTime: string,
  duration?: string
): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) {
    throw new Error(`Input video not found: ${inputPath}`);
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  const args: string[] = [];
  args.push(`-ss`, startTime);
  args.push(`-i`, resolvedIn);
  if (duration) {
    args.push(`-t`, duration);
  }
  // Copy video and audio streams without re-encoding if possible, for speed.
  // Note: if precise frame trimming is needed, re-encoding is better, but copying is lightning fast.
  args.push(`-c:v`, `copy`, `-c:a`, `copy`);
  args.push(resolvedOut);

  await runFFmpeg(args);
  return resolvedOut;
}

/**
 * Merges multiple video files into a single video file.
 */
export async function mergeVideos(inputPaths: string[], outputPath: string): Promise<string> {
  const resolvedOut = path.resolve(outputPath);
  if (inputPaths.length === 0) {
    throw new Error('No input videos provided for merging.');
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  // For ffmpeg concat, we create a temporary file list
  const tempFileListPath = path.resolve(`temp_concat_list_${Date.now()}.txt`);
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
      tempFileListPath,
      `-c`,
      `copy`,
      resolvedOut,
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
 * Changes video playback speed.
 * Note: Changing speed requires re-encoding video and audio filters.
 */
export async function changeVideoSpeed(
  inputPath: string,
  outputPath: string,
  speed: number
): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) {
    throw new Error(`Input video not found: ${inputPath}`);
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  // For video speed, we use setpts filter. Speed up of 2x means setpts=0.5*PTS.
  // For audio speed, we use atempo. atempo only supports 0.5 to 2.0, so we might need multiple filters.
  const videoFilter = `setpts=${1 / speed}*PTS`;
  
  let audioFilter = '';
  if (speed >= 0.5 && speed <= 2.0) {
    audioFilter = `atempo=${speed}`;
  } else {
    // Chain atempo filters for speeds outside 0.5-2.0
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
    resolvedIn,
    `-filter_complex`,
    `[0:v]${videoFilter}[v];[0:a]${audioFilter}[a]`,
    `-map`,
    `[v]`,
    `-map`,
    `[a]`,
    resolvedOut,
  ];

  await runFFmpeg(args);
  return resolvedOut;
}

/**
 * Adjusts the volume of a video file.
 */
export async function changeVideoVolume(
  inputPath: string,
  outputPath: string,
  volume: number
): Promise<string> {
  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);
  if (!fs.existsSync(resolvedIn)) {
    throw new Error(`Input video not found: ${inputPath}`);
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });

  const args = [
    `-i`,
    resolvedIn,
    `-filter:a`,
    `volume=${volume}`,
    `-c:v`,
    `copy`, // keep video stream unchanged
    resolvedOut,
  ];

  await runFFmpeg(args);
  return resolvedOut;
}
