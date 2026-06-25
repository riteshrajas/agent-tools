import test from 'node:test';
import assert from 'node:assert';
import { mergeAudio } from './audio.ts';

test('mergeAudio should reject empty input array', async () => {
  await assert.rejects(
    async () => {
      await mergeAudio([], 'output.mp3');
    },
    (err: any) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /No input.*files provided/);
      return true;
    }
  );
});
