import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { convertImage } from './converter.js';

describe('convertImage', () => {
  const testDir = path.resolve('test-output-image');
  const inputImagePng = path.join(testDir, 'input.png');

  before(async () => {
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

  after(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should convert PNG to JPG', async () => {
    const outputPath = path.join(testDir, 'output.jpg');
    const result = await convertImage(inputImagePng, outputPath);

    assert.strictEqual(result, outputPath);
    assert.ok(fs.existsSync(outputPath), 'Output file should exist');

    const metadata = await sharp(outputPath).metadata();
    assert.strictEqual(metadata.format, 'jpeg');
  });

  it('should convert PNG to WEBP', async () => {
    const outputPath = path.join(testDir, 'output.webp');
    const result = await convertImage(inputImagePng, outputPath);

    assert.strictEqual(result, outputPath);
    assert.ok(fs.existsSync(outputPath), 'Output file should exist');

    const metadata = await sharp(outputPath).metadata();
    assert.strictEqual(metadata.format, 'webp');
  });

  it('should convert PNG to GIF', async () => {
    const outputPath = path.join(testDir, 'output.gif');
    const result = await convertImage(inputImagePng, outputPath);

    assert.strictEqual(result, outputPath);
    assert.ok(fs.existsSync(outputPath), 'Output file should exist');

    const metadata = await sharp(outputPath).metadata();
    assert.strictEqual(metadata.format, 'gif');
  });

  it('should convert PNG to PNG (identity)', async () => {
    const outputPath = path.join(testDir, 'output2.png');
    const result = await convertImage(inputImagePng, outputPath);

    assert.strictEqual(result, outputPath);
    assert.ok(fs.existsSync(outputPath), 'Output file should exist');

    const metadata = await sharp(outputPath).metadata();
    assert.strictEqual(metadata.format, 'png');
  });

  it('should resize the image', async () => {
    const outputPath = path.join(testDir, 'output-resized.jpg');
    const result = await convertImage(inputImagePng, outputPath, {
      width: 5,
      height: 5,
    });

    assert.strictEqual(result, outputPath);
    assert.ok(fs.existsSync(outputPath), 'Output file should exist');

    const metadata = await sharp(outputPath).metadata();
    assert.strictEqual(metadata.width, 5);
    assert.strictEqual(metadata.height, 5);
  });

  it('should throw an error if input file does not exist', async () => {
    const nonExistentPath = path.join(testDir, 'does-not-exist.png');
    const outputPath = path.join(testDir, 'output-error.jpg');

    await assert.rejects(
      async () => {
        await convertImage(nonExistentPath, outputPath);
      },
      {
        message: `Input image file not found: ${nonExistentPath}`,
      }
    );
  });
});
