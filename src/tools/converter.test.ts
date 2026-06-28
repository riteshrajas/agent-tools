import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { convertImage } from './converter.js';

describe('convertImage', () => {
  const testDir = path.resolve('test-output-image');
  const inputImagePng = path.join(testDir, 'input.png');

  beforeAll(async () => {
    // Disable sharp cache to prevent file locking on Windows
    sharp.cache(false);

    // Create test directory if it doesn't exist
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a 10x10 test PNG image
    await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toFile(inputImagePng);
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should convert PNG to JPG', async () => {
    const outputPath = path.join(testDir, 'output.jpg');
    const result = await convertImage(inputImagePng, outputPath);

    expect(result).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    const metadata = await sharp(outputPath).metadata();
    expect(metadata.format).toBe('jpeg');
  });

  it('should convert PNG to WEBP', async () => {
    const outputPath = path.join(testDir, 'output.webp');
    const result = await convertImage(inputImagePng, outputPath);

    expect(result).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    const metadata = await sharp(outputPath).metadata();
    expect(metadata.format).toBe('webp');
  });

  it('should convert PNG to GIF', async () => {
    const outputPath = path.join(testDir, 'output.gif');
    const result = await convertImage(inputImagePng, outputPath);

    expect(result).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    const metadata = await sharp(outputPath).metadata();
    expect(metadata.format).toBe('gif');
  });

  it('should convert PNG to PNG (identity)', async () => {
    const outputPath = path.join(testDir, 'output2.png');
    const result = await convertImage(inputImagePng, outputPath);

    expect(result).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    const metadata = await sharp(outputPath).metadata();
    expect(metadata.format).toBe('png');
  });

  it('should resize the image', async () => {
    const outputPath = path.join(testDir, 'output-resized.jpg');
    const result = await convertImage(inputImagePng, outputPath, {
      width: 5,
      height: 5,
    });

    expect(result).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);

    const metadata = await sharp(outputPath).metadata();
    expect(metadata.width).toBe(5);
    expect(metadata.height).toBe(5);
  });

  it('should throw an error if input file does not exist', async () => {
    const nonExistentPath = path.join(testDir, 'does-not-exist.png');
    const outputPath = path.join(testDir, 'output-error.jpg');

    await expect(convertImage(nonExistentPath, outputPath)).rejects.toThrow(
      `Input image file not found: ${nonExistentPath}`
    );
  });
});
