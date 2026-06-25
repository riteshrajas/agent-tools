import { jest } from '@jest/globals';
import * as path from 'path';

// Create a chainable mock object for fluent-ffmpeg
const mockFfmpegChain = {
  setStartTime: jest.fn().mockReturnThis(),
  setDuration: jest.fn().mockReturnThis(),
  audioCodec: jest.fn().mockReturnThis(),
  output: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  run: jest.fn().mockReturnThis(),
};

// The main ffmpeg function mock
const mockFfmpeg = jest.fn(() => mockFfmpegChain);

// Mock the fluent-ffmpeg module
jest.unstable_mockModule('fluent-ffmpeg', () => ({
  default: mockFfmpeg,
}));

// Mock fs module
const mockExistsSync = jest.fn();
const mockMkdirSync = jest.fn();

jest.unstable_mockModule('fs', () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
}));

// Import the module under test *after* mocking
const { trimAudio } = await import('../audio');

describe('trimAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should trim audio successfully with duration', async () => {
    mockExistsSync.mockReturnValue(true);

    // Setup the 'on' mock to immediately trigger the 'end' event when 'run' is called
    mockFfmpegChain.run.mockImplementationOnce(() => {
      // Find the callback for the 'end' event and call it
      const endCall = mockFfmpegChain.on.mock.calls.find(call => call[0] === 'end');
      if (endCall && typeof endCall[1] === 'function') {
        endCall[1]();
      }
      return mockFfmpegChain;
    });

    const inputPath = 'input.mp3';
    const outputPath = 'output.mp3';
    const startTime = '00:00:10';
    const duration = '00:00:20';

    const result = await trimAudio(inputPath, outputPath, startTime, duration);

    // Assert that standard file system operations occurred
    expect(mockExistsSync).toHaveBeenCalledWith(path.resolve(inputPath));
    expect(mockMkdirSync).toHaveBeenCalledWith(path.dirname(path.resolve(outputPath)), { recursive: true });

    // Assert that ffmpeg was initialized with the resolved input path
    expect(mockFfmpeg).toHaveBeenCalledWith(path.resolve(inputPath));

    // Assert the chain was called correctly
    expect(mockFfmpegChain.setStartTime).toHaveBeenCalledWith(startTime);
    expect(mockFfmpegChain.setDuration).toHaveBeenCalledWith(duration);
    expect(mockFfmpegChain.audioCodec).toHaveBeenCalledWith('copy');
    expect(mockFfmpegChain.output).toHaveBeenCalledWith(path.resolve(outputPath));
    expect(mockFfmpegChain.on).toHaveBeenCalledWith('end', expect.any(Function));
    expect(mockFfmpegChain.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockFfmpegChain.run).toHaveBeenCalled();

    // Assert it returns the resolved output path
    expect(result).toBe(path.resolve(outputPath));
  });

  it('should trim audio successfully without duration', async () => {
    mockExistsSync.mockReturnValue(true);

    mockFfmpegChain.run.mockImplementationOnce(() => {
      const endCall = mockFfmpegChain.on.mock.calls.find(call => call[0] === 'end');
      if (endCall && typeof endCall[1] === 'function') {
        endCall[1]();
      }
      return mockFfmpegChain;
    });

    const inputPath = 'input.mp3';
    const outputPath = 'output.mp3';
    const startTime = '10';

    const result = await trimAudio(inputPath, outputPath, startTime);

    expect(mockFfmpeg).toHaveBeenCalledWith(path.resolve(inputPath));
    expect(mockFfmpegChain.setStartTime).toHaveBeenCalledWith(startTime);
    expect(mockFfmpegChain.setDuration).not.toHaveBeenCalled();
    expect(mockFfmpegChain.audioCodec).toHaveBeenCalledWith('copy');
    expect(mockFfmpegChain.output).toHaveBeenCalledWith(path.resolve(outputPath));
    expect(result).toBe(path.resolve(outputPath));
  });

  it('should throw an error if input file does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const inputPath = 'missing.mp3';
    const outputPath = 'output.mp3';
    const startTime = '00:00:00';

    await expect(trimAudio(inputPath, outputPath, startTime)).rejects.toThrow(`Input audio not found: ${inputPath}`);

    expect(mockFfmpeg).not.toHaveBeenCalled();
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  it('should reject if ffmpeg encounters an error', async () => {
    mockExistsSync.mockReturnValue(true);

    const errorMessage = 'Some internal ffmpeg error';

    // Setup the 'on' mock to immediately trigger the 'error' event when 'run' is called
    mockFfmpegChain.run.mockImplementationOnce(() => {
      const errorCall = mockFfmpegChain.on.mock.calls.find(call => call[0] === 'error');
      if (errorCall && typeof errorCall[1] === 'function') {
        errorCall[1](new Error(errorMessage));
      }
      return mockFfmpegChain;
    });

    const inputPath = 'input.mp3';
    const outputPath = 'output.mp3';
    const startTime = '00:00:00';

    await expect(trimAudio(inputPath, outputPath, startTime)).rejects.toThrow(`Failed to trim audio: ${errorMessage}`);
  });
});
