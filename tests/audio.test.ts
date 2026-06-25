import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as child_process from 'child_process';
import { changeAudioSpeed } from '../src/tools/audio';
import * as fs from 'fs';

vi.mock('child_process', () => {
  return {
    exec: vi.fn((cmd, callback) => {
      callback(null, 'mock stdout', '');
    }),
  };
});

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
  };
});

describe('changeAudioSpeed', () => {
  let execMock: any;

  beforeEach(() => {
    execMock = vi.mocked(child_process.exec);
    execMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const extractFilter = (cmd: string): string | null => {
    const match = cmd.match(/-filter:a "(.*?)"/);
    return match ? match[1] : null;
  };

  it('should use single atempo filter for speed between 0.5 and 2.0', async () => {
    await changeAudioSpeed('input.mp3', 'output.mp3', 1.5);
    expect(execMock).toHaveBeenCalledTimes(1);
    const cmd = execMock.mock.calls[0][0];
    expect(extractFilter(cmd)).toBe('atempo=1.5');
  });

  it('should chain atempo=0.5 for speed < 0.5', async () => {
    await changeAudioSpeed('input.mp3', 'output.mp3', 0.25);
    expect(execMock).toHaveBeenCalledTimes(1);
    const cmd = execMock.mock.calls[0][0];
    expect(extractFilter(cmd)).toBe('atempo=0.5,atempo=0.5');
  });

  it('should chain atempo=2.0 for speed > 2.0', async () => {
    await changeAudioSpeed('input.mp3', 'output.mp3', 4.0);
    expect(execMock).toHaveBeenCalledTimes(1);
    const cmd = execMock.mock.calls[0][0];
    expect(extractFilter(cmd)).toBe('atempo=2.0,atempo=2');
  });

  it('should handle complex chaining (e.g., speed=3.0)', async () => {
    await changeAudioSpeed('input.mp3', 'output.mp3', 3.0);
    expect(execMock).toHaveBeenCalledTimes(1);
    const cmd = execMock.mock.calls[0][0];
    expect(extractFilter(cmd)).toBe('atempo=2.0,atempo=1.5');
  });

  it('should handle exact edge values (0.5 and 2.0)', async () => {
    await changeAudioSpeed('input.mp3', 'output.mp3', 0.5);
    expect(extractFilter(execMock.mock.calls[0][0])).toBe('atempo=0.5');

    execMock.mockClear();
    await changeAudioSpeed('input.mp3', 'output.mp3', 2.0);
    expect(extractFilter(execMock.mock.calls[0][0])).toBe('atempo=2'); // or 'atempo=2.0'
  });

  it('should throw error for speed <= 0', async () => {
    await expect(changeAudioSpeed('input.mp3', 'output.mp3', 0)).rejects.toThrow('Speed must be greater than 0.');
    await expect(changeAudioSpeed('input.mp3', 'output.mp3', -1)).rejects.toThrow('Speed must be greater than 0.');
  });
});
