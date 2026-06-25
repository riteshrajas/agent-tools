import { jest } from '@jest/globals';

const mockSpawnSync = jest.fn();
jest.unstable_mockModule('child_process', () => ({
  spawnSync: mockSpawnSync,
  execSync: jest.fn()
}));

const { deleteRepo } = await import('./git.js');

describe('deleteRepo', () => {
  beforeEach(() => {
    mockSpawnSync.mockReset();
  });

  it('successfully deletes a repo', () => {
    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: 'Successfully deleted\n',
      stderr: ''
    });

    const result = deleteRepo('riteshrajas/test-repo');

    expect(result).toBe('Successfully deleted');
    expect(mockSpawnSync).toHaveBeenCalledTimes(1);
    expect(mockSpawnSync).toHaveBeenCalledWith('gh', ['repo', 'delete', 'riteshrajas/test-repo', '--yes'], expect.any(Object));
  });

  it('throws an error if the command fails', () => {
    mockSpawnSync.mockReturnValue({
      status: 1,
      stdout: '',
      stderr: 'Repository not found'
    });

    expect(() => deleteRepo('riteshrajas/error-repo')).toThrow('Repository not found');
  });

  it('throws an error if gh is not found', () => {
    mockSpawnSync.mockReturnValue({
      error: new Error('ENOENT')
    });

    expect(() => deleteRepo('riteshrajas/error-repo')).toThrow('gh not found: ENOENT');
  });
});
