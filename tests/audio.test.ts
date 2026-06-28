import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as child_process from 'child_process';
import { changeAudioSpeed, mergeAudio } from '../src/tools/audio';
import * as fs from 'fs';

vi.mock('child_process', () => {
  return {
    execFile: vi.fn((file, args, callback) => {
      if (typeof callback === 'function') {
        callback(null, 'mock stdout', '');
      } else if (typeof args === 'function') {
        args(null, 'mock stdout', '');
      }
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
  let execFileMock: any;

  beforeEach(() => {
    execFileMock = vi.mocked(child_process.execFile);
    execFileMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const getFilter = (mockCallArgs: any[]): string | null => {
    const argsArray = mockCallArgs[1];
    const filterIdx = argsArray.indexOf('-filter:a');
    if (filterIdx !== -1 && filterIdx + 1 < argsArray.length) {
      return argsArray[filterIdx + 1];
    }
    return null;
  };

  it('should use single atempo filter for speed between 0.5 and 2.0', async () => {
    await changeAudioSpeed('input.mp3', 'output.mp3', 1.5);
    expect(execFileMock).toHaveBeenCalledTimes(1);
    const filter = getFilter(execFileMock.mock.calls[0]);
    expect(filter).toBe('atempo=1.5');
  });

  it('should chain atempo=0.5 for speed < 0.5', async () => {
    await changeAudioSpeed('input.mp3', 'output.mp3', 0.25);
    expect(execFileMock).toHaveBeenCalledTimes(1);
    const filter = getFilter(execFileMock.mock.calls[0]);
    expect(filter).toBe('atempo=0.5,atempo=0.5');
  });

  it('should chain atempo=2.0 for speed > 2.0', async () => {
    await changeAudioSpeed('input.mp3', 'output.mp3', 4.0);
    expect(execFileMock).toHaveBeenCalledTimes(1);
    const filter = getFilter(execFileMock.mock.calls[0]);
    expect(filter).toBe('atempo=2.0,atempo=2');
  });

  it('should handle complex chaining (e.g., speed=3.0)', async () => {
    await changeAudioSpeed('input.mp3', 'output.mp3', 3.0);
    expect(execFileMock).toHaveBeenCalledTimes(1);
    const filter = getFilter(execFileMock.mock.calls[0]);
    expect(filter).toBe('atempo=2.0,atempo=1.5');
  });

  it('should handle exact edge values (0.5 and 2.0)', async () => {
    await changeAudioSpeed('input.mp3', 'output.mp3', 0.5);
    expect(getFilter(execFileMock.mock.calls[0])).toBe('atempo=0.5');

    execFileMock.mockClear();
    await changeAudioSpeed('input.mp3', 'output.mp3', 2.0);
    expect(getFilter(execFileMock.mock.calls[0])).toBe('atempo=2');
  });

  it('should throw error for speed <= 0', async () => {
    await expect(changeAudioSpeed('input.mp3', 'output.mp3', 0)).rejects.toThrow('Speed must be greater than 0.');
    await expect(changeAudioSpeed('input.mp3', 'output.mp3', -1)).rejects.toThrow('Speed must be greater than 0.');
  });
});

describe('mergeAudio', () => {
  it('should reject empty input array', async () => {
    await expect(mergeAudio([], 'output.mp3')).rejects.toThrow(/No input.*files provided/);
  });
});
