# agent-tools

A high-performance command-line interface (CLI) and Model Context Protocol (MCP) server for media manipulation and document conversion. It enables both developers (via CLI) and AI agents (via MCP) to perform video, audio, image, and PDF editing tasks.

## Features & Planned Tools

This project aims to replicate and extend the suite of features from platforms like 123apps, accessible programmatically:

### Video Tools
- **Trim Video**: Cut and slice video files.
- **Merge Videos**: Combine multiple video files.
- **Change Speed**: Adjust video playback speed.
- **Change Volume**: Increase or decrease video audio.
- *Planned*: Screen Recorder, Text to Speech, Crop, Rotate, Loop, Stabilize, Remove Logo, Add Watermark.

### Audio Tools
- **Trim Audio**: Extract segments of audio.
- **Merge Audio**: Combine multiple audio tracks.
- **Change Speed**: Speed up or slow down audio playback.
- **Change Volume**: Adjust audio levels.
- **Reverse Audio**: Play audio backward.
- *Planned*: Voice Recorder, Equalizer, Pitch Changer, Audio Joiner.

### PDF Tools
- **Merge**: Combine multiple PDFs.
- **Split**: Extract ranges or split into individual pages.
- **Rotate**: Rotate selected pages by 90/180/270 degrees.
- *Planned*: PDF to Word/Excel/JPG/PNG/HTML, Word/JPG/Excel/PPT to PDF, Protect, Unlock, Add Page Numbers, Compress.

### Converters
- **Image Converter**: Transcode and resize PNG, JPG, WebP, GIF.
- **Audio Converter**: Convert between MP3, WAV, FLAC, OGG, M4A.
- **Video Converter**: Convert between MP4, WebM, MKV, MOV, AVI.
- *Planned*: Document Converter, Font Converter, Archive Converter, Ebook Converter, Archive Extractor.

---

## Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [FFmpeg](https://ffmpeg.org/) installed and available in your system's `PATH`.

### Local Installation
1. Clone the repository:
   ```bash
   git clone <repo_url>
   cd agent-tools
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the TypeScript source:
   ```bash
   npm run build
   ```

---

## Usage

### 1. Command Line Interface (CLI)

Use the CLI to perform tasks directly from your shell:

```bash
# General help
node dist/index.js --help

# PDF Operations
node dist/index.js pdf merge output.pdf doc1.pdf doc2.pdf
node dist/index.js pdf split input.pdf ./output_folder --pages 1-3,5
node dist/index.js pdf rotate input.pdf output.pdf 90 --pages 1

# Video Operations
node dist/index.js video trim input.mp4 output.mp4 00:00:10 -t 5
node dist/index.js video speed input.mp4 output.mp4 1.5

# Audio Operations
node dist/index.js audio reverse input.mp3 output.mp3

# Conversions
node dist/index.js convert image input.png output.jpg --width 800 --quality 90
```

### 2. Model Context Protocol (MCP) Server

To run `agent-tools` as an MCP server, pass the `mcp` subcommand or the `--mcp` flag:

```bash
node dist/index.js mcp
```

#### Configuring with Claude Desktop / Gemini CLI
Add the server configuration to your MCP config file (e.g. `mcp_config.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agent-tools": {
      "command": "node",
      "args": ["/absolute/path/to/agent-tools/dist/index.js", "mcp"]
    }
  }
}
```

---

## Contributing & Development

We welcome contributions to implement the remaining tools! 
- Source files are located in `src/tools/` (e.g. `pdf.ts`, `video.ts`, `audio.ts`, `converter.ts`).
- Command parsing is done in `src/cli.ts`.
- MCP registrations are located in `src/mcp-server.ts`.

To compile changes automatically during development:
```bash
npm run dev
```

License: MIT
