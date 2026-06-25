import { changeAudioSpeed } from '../tools/audio.js';
import * as cp from 'child_process';
import * as fs from 'fs';

jest.mock('child_process');
jest.mock('fs');

describe('changeAudioSpeed', () => {
  let capturedCmd = '';

  beforeEach(() => {
    jest.clearAllMocks();
    capturedCmd = '';

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);

    (cp.exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
      capturedCmd = cmd;
      cb(null, 'stdout', '');
    });
  });

  it('should use atempo=1 for speed 1.0 (no chain)', async () => {
    await changeAudioSpeed('in.mp3', 'out.mp3', 1.0);
    expect(capturedCmd).toMatch(/-filter:a "atempo=1"/);
  });

  it('should use atempo=2 for speed 2.0 (no chain)', async () => {
    await changeAudioSpeed('in.mp3', 'out.mp3', 2.0);
    expect(capturedCmd).toMatch(/-filter:a "atempo=2"/);
  });

  it('should chain atempo=2.0 for speed 4.0', async () => {
    await changeAudioSpeed('in.mp3', 'out.mp3', 4.0);
    expect(capturedCmd).toMatch(/-filter:a "atempo=2.0,atempo=2"/); // 4 / 2.0 = 2 => atempo=2
  });

  it('should chain correctly for speed 3.0', async () => {
    await changeAudioSpeed('in.mp3', 'out.mp3', 3.0);
    expect(capturedCmd).toMatch(/-filter:a "atempo=2.0,atempo=1.5"/); // 3 / 2.0 = 1.5 => atempo=1.5
  });

  it('should chain atempo=0.5 for speed 0.25', async () => {
    await changeAudioSpeed('in.mp3', 'out.mp3', 0.25);
    expect(capturedCmd).toMatch(/-filter:a "atempo=0.5,atempo=0.5"/); // 0.25 / 0.5 = 0.5 => atempo=0.5
  });

  it('should chain correctly for speed 0.3', async () => {
    await changeAudioSpeed('in.mp3', 'out.mp3', 0.3);
    // 0.3 / 0.5 = 0.6 => atempo=0.6
    expect(capturedCmd).toMatch(/-filter:a "atempo=0.5,atempo=0.6"/);
  });

  it('should reject if speed is 0 or negative', async () => {
    await expect(changeAudioSpeed('in.mp3', 'out.mp3', 0.0)).rejects.toThrow('Speed must be greater than 0.');
    await expect(changeAudioSpeed('in.mp3', 'out.mp3', -1.0)).rejects.toThrow('Speed must be greater than 0.');
  });
});
