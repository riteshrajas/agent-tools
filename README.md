# 🛠️ agent-tools

A personal all-in-one **CLI** and **MCP server** for daily productivity — media manipulation, document conversion, PDF tools, and GitHub repo management. Compiles to a single standalone `agent-tools.exe` binary.

> **v2.0** — now includes document tools, PDF search, interactive GitHub repo cleaner TUI, and a codebase bundler.

---

## 📋 Table of Contents

- [Installation](#installation)
- [Building the Binary](#building-the-binary)
- [CLI Usage](#cli-usage)
  - [PDF Tools](#pdf-tools)
  - [Document Tools](#document-tools)
  - [Video Tools](#video-tools)
  - [Audio Tools](#audio-tools)
  - [Convert Tools](#convert-tools)
  - [Git / GitHub Tools](#git--github-tools)
- [MCP Server Usage](#mcp-server-usage)
- [Development](#development)

---

## Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v22+
- [FFmpeg](https://ffmpeg.org/) on your `PATH` (for video/audio tools)
- [Microsoft Edge](https://www.microsoft.com/edge) (for `doc md-to-pdf`)
- [GitHub CLI (`gh`)](https://cli.github.com/) authenticated (for `git` commands)

### Setup
```bash
git clone https://github.com/riteshrajas/agent-tools
cd agent-tools
npm install
```

---

## Building the Binary

```bash
# Step 1: Bundle TypeScript → single CJS file
npm run bundle

# Step 2: Package into standalone .exe
npx @yao-pkg/pkg . --targets node22-win-x64 --output agent-tools.exe
```

> The `.exe` is ~124 MB (includes the Node runtime) and is gitignored. Rebuild locally whenever you make changes.

---

## CLI Usage

```
agent-tools <group> <subcommand> [arguments] [options]
```

### PDF Tools

```bash
# Merge multiple PDFs into one
agent-tools pdf merge output.pdf file1.pdf file2.pdf file3.pdf

# Split a PDF into individual pages (optionally extract specific pages/ranges)
agent-tools pdf split input.pdf ./output_dir
agent-tools pdf split input.pdf ./output_dir --pages 1-3,5,7

# Rotate pages (90, 180, or 270 degrees)
agent-tools pdf rotate input.pdf output.pdf 90
agent-tools pdf rotate input.pdf output.pdf 180 --pages 1,3

# Search for text inside a PDF
agent-tools pdf search report.pdf "quarterly revenue"
```

---

### Document Tools

```bash
# Convert a Markdown file to a styled PDF (requires Microsoft Edge)
agent-tools doc md-to-pdf README.md README.pdf

# Extract all text from a PowerPoint presentation (slide-by-slide)
agent-tools doc read-pptx presentation.pptx
agent-tools doc read-pptx presentation.pptx --output extracted.txt

# Extract all paragraphs from a Word document
agent-tools doc read-docx report.docx
agent-tools doc read-docx report.docx --output extracted.txt
```

---

### Video Tools

```bash
# Trim a video (start time + optional duration)
agent-tools video trim input.mp4 output.mp4 00:01:30
agent-tools video trim input.mp4 output.mp4 00:01:30 -t 00:00:45

# Merge multiple videos into one
agent-tools video merge output.mp4 clip1.mp4 clip2.mp4 clip3.mp4

# Change playback speed (1.5 = 50% faster, 0.5 = half speed)
agent-tools video speed input.mp4 output.mp4 1.5

# Change audio volume (2.0 = double, 0.5 = half)
agent-tools video volume input.mp4 output.mp4 2.0
```

---

### Audio Tools

```bash
# Trim an audio file
agent-tools audio trim input.mp3 output.mp3 00:00:30
agent-tools audio trim input.mp3 output.mp3 00:00:30 -t 00:01:00

# Merge multiple audio files
agent-tools audio merge output.mp3 track1.mp3 track2.mp3

# Change playback speed
agent-tools audio speed input.mp3 output.mp3 1.25

# Change volume
agent-tools audio volume input.mp3 output.mp3 1.5

# Reverse an audio track
agent-tools audio reverse input.mp3 output.mp3
```

---

### Convert Tools

```bash
# Convert image formats with optional resize and quality
agent-tools convert image input.png output.jpg
agent-tools convert image input.png output.webp --width 1920 --height 1080 --quality 85

# Convert audio formats
agent-tools convert audio input.wav output.mp3
agent-tools convert audio input.flac output.ogg

# Convert video formats
agent-tools convert video input.mov output.mp4
agent-tools convert video input.mkv output.webm
```

---

### Git / GitHub Tools

```bash
# Interactive TUI — review all your repos, mark as KEEP / ARCHIVE / DELETE
# Arrow keys to navigate, Space to cycle action, Enter to confirm, Esc to quit
agent-tools git clean-repos

# List all repos as JSON (optionally filter by name)
agent-tools git list-repos
agent-tools git list-repos --filter "old-project"

# Bundle an entire codebase into a single Markdown file (great for LLM context)
agent-tools git bundle ./my-project bundle.md
agent-tools git bundle ./my-project bundle.md --ext .ts,.py,.md
agent-tools git bundle ./my-project bundle.md --max-size 102400
```

#### `git clean-repos` TUI Controls

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate the list |
| `Space` | Cycle: `[ KEEP ]` → `[ARCHIVE]` → `[DELETE ]` |
| `Enter` | Proceed to review & confirm |
| `Esc` / `q` | Quit without changes |

The TUI auto-detects sensible defaults (forks older than 90 days → DELETE, repos not updated in 180 days → ARCHIVE, whitelisted important repos → KEEP).

---

## MCP Server Usage

Start the MCP server (communicates over stdio):

```bash
agent-tools mcp
# or via node
node dist/index.cjs mcp
```

### Configuring with Antigravity / Claude Desktop

Add to your MCP config (e.g. `C:\Users\<you>\.gemini\config\mcp.json`):

```json
{
  "mcpServers": {
    "agent-tools": {
      "command": "P:\\Data\\Personal\\agent-tools\\agent-tools.exe",
      "args": ["mcp"]
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `pdf_merge` | Merge multiple PDFs |
| `pdf_split` | Split or extract pages from a PDF |
| `pdf_rotate` | Rotate PDF pages |
| `pdf_search` | Search text in a PDF, returns matching pages |
| `markdown_to_pdf` | Convert Markdown to styled PDF |
| `read_pptx` | Extract text from a PowerPoint (.pptx) |
| `read_docx` | Extract text from a Word document (.docx) |
| `video_trim` | Trim a video |
| `video_merge` | Merge multiple videos |
| `video_speed` | Change video speed |
| `video_volume` | Change video volume |
| `audio_trim` | Trim an audio file |
| `audio_merge` | Merge audio files |
| `audio_speed` | Change audio speed |
| `audio_volume` | Change audio volume |
| `audio_reverse` | Reverse an audio track |
| `convert_image` | Convert & resize images |
| `convert_audio` | Convert audio format |
| `convert_video` | Convert video format |
| `github_list_repos` | List GitHub repos (with optional filter) |
| `github_batch_clean` | Archive/delete a list of GitHub repos |
| `bundle_codebase` | Bundle a directory into a single Markdown file |

---

## Development

```bash
# Watch mode (tsc)
npm run dev

# Bundle (esbuild → dist/index.cjs)
npm run bundle

# Rebuild the .exe
npx @yao-pkg/pkg . --targets node22-win-x64 --output agent-tools.exe
```

### Project Structure

```
src/
├── index.ts          # Entry point — routes to CLI or MCP
├── cli.ts            # Commander CLI definitions
├── mcp-server.ts     # MCP server & tool schemas
└── tools/
    ├── pdf.ts        # PDF merge/split/rotate (pdf-lib)
    ├── doc.ts        # Markdown→PDF, PPTX/DOCX readers, PDF search
    ├── video.ts      # FFmpeg video tools
    ├── audio.ts      # FFmpeg audio tools
    ├── converter.ts  # sharp + FFmpeg converters
    └── git.ts        # GitHub TUI cleaner + codebase bundler
```

---

License: MIT
