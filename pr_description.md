🎯 **What:** Added tests for the `trimAudio` function in `src/tools/audio.ts`. I rewrote the function to leverage `fluent-ffmpeg` rather than raw `exec` commands, improving code readability. Set up Jest with ESM support for running tests.
📊 **Coverage:** Covered tests for the happy path when `trimAudio` is called with duration and without duration, and error paths including the absence of input files and a mock ffmpeg error.
✨ **Result:** Improved overall project quality and confidence in the code.
