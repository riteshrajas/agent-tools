import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteRepo } from '../../src/tools/git';
import * as child_process from 'child_process';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

describe('deleteRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully delete a repository and return success message', () => {
    // Arrange
    const execSyncMock = vi.mocked(child_process.execSync);
    execSyncMock.mockReturnValue(Buffer.from(''));

    const repoName = 'testuser/testrepo';

    // Act
    const result = deleteRepo(repoName);

    // Assert
    expect(execSyncMock).toHaveBeenCalledTimes(1);
    expect(execSyncMock).toHaveBeenCalledWith(`gh repo delete ${repoName} --yes`);
    expect(result).toBe(`Successfully deleted ${repoName}`);
  });

  it('should throw an error if the command fails', () => {
    // Arrange
    const errorMessage = 'Command failed: gh repo delete';
    const execSyncMock = vi.mocked(child_process.execSync);
    execSyncMock.mockImplementation(() => {
      throw new Error(errorMessage);
    });

    const repoName = 'testuser/nonexistent';

    // Act & Assert
    expect(() => deleteRepo(repoName)).toThrowError(`Failed to delete repo ${repoName}: ${errorMessage}`);
    expect(execSyncMock).toHaveBeenCalledTimes(1);
    expect(execSyncMock).toHaveBeenCalledWith(`gh repo delete ${repoName} --yes`);
  });
});
