import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteRepo } from '../../src/tools/git';
import * as child_process from 'child_process';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawnSync: vi.fn(),
  };
});

describe('deleteRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully delete a repository and return success message', () => {
    const spawnSyncMock = vi.mocked(child_process.spawnSync);
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: 'Successfully deleted repo\n',
      stderr: '',
      pid: 1,
      output: [],
      signal: null,
      error: undefined
    } as any);

    const repoName = 'testuser/testrepo';
    const result = deleteRepo(repoName);

    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenCalledWith('gh', ['repo', 'delete', repoName, '--yes'], { encoding: 'utf8' });
    expect(result).toBe(`Successfully deleted ${repoName}`);
  });

  it('should throw an error if the command fails', () => {
    const errorMessage = 'Command failed: gh repo delete';
    const spawnSyncMock = vi.mocked(child_process.spawnSync);
    spawnSyncMock.mockReturnValue({
      status: 1,
      stdout: '',
      stderr: errorMessage,
      pid: 1,
      output: [],
      signal: null,
      error: undefined
    } as any);

    const repoName = 'testuser/nonexistent';

    expect(() => deleteRepo(repoName)).toThrowError(`Failed to delete repo ${repoName}: ${errorMessage}`);
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenCalledWith('gh', ['repo', 'delete', repoName, '--yes'], { encoding: 'utf8' });
  });
});
