import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cp from 'child_process';
import { deleteRepo } from './git.js';

vi.mock('child_process', async (importOriginal) => {
  const mod: any = await importOriginal();
  return {
    ...mod,
    // Mock both execSync and spawnSync.
    // The codebase currently uses spawnSync securely via runGhCommand,
    // but we mock execSync as well to satisfy safety constraints in case
    // the code is reverted to the older, more vulnerable execSync implementation.
    execSync: vi.fn(),
    spawnSync: vi.fn(),
  };
});

describe('deleteRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls gh repo delete safely using spawnSync array arguments', () => {
    vi.mocked(cp.spawnSync).mockReturnValue({
      status: 0,
      stdout: 'Successfully deleted repo\n',
      stderr: '',
      pid: 1,
      output: [],
      signal: null,
      error: undefined
    } as any);

    // Provide a dummy return value for execSync if it were to be called
    vi.mocked(cp.execSync).mockReturnValue(Buffer.from('Successfully deleted repo'));

    const result = deleteRepo('test/repo');

    // Assert exactly what the current secure implementation does
    expect(cp.spawnSync).toHaveBeenCalledWith('gh', ['repo', 'delete', 'test/repo', '--yes'], { encoding: 'utf8' });
    expect(result).toBe('Successfully deleted repo');
  });

  it('throws an error if the command fails (non-zero exit)', () => {
    vi.mocked(cp.spawnSync).mockReturnValue({
      status: 1,
      stdout: '',
      stderr: 'gh command failed',
      pid: 1,
      output: [],
      signal: null,
      error: undefined
    } as any);

    expect(() => deleteRepo('test/repo')).toThrowError('gh command failed');
  });

  it('throws an error if gh command is not found', () => {
    vi.mocked(cp.spawnSync).mockReturnValue({
      error: new Error('ENOENT'),
      pid: 1,
      output: [],
      signal: null,
      status: null,
      stderr: '',
      stdout: ''
    } as any);

    expect(() => deleteRepo('test/repo')).toThrowError('gh not found: ENOENT');
  });
});
