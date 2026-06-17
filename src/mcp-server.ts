import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { mergePDFs, splitPDF, rotatePDF } from './tools/pdf.js';
import { trimVideo, mergeVideos, changeVideoSpeed, changeVideoVolume } from './tools/video.js';
import { trimAudio, mergeAudio, changeAudioSpeed, changeAudioVolume, reverseAudio } from './tools/audio.js';
import { convertImage, convertAudio, convertVideo } from './tools/converter.js';

export async function startMCPServer(): Promise<void> {
  // Silence console logs and redirects them to stderr to avoid corrupting stdout stdio transport channel.
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => console.warn('[INFO]', ...args);
  console.error = (...args) => console.warn('[ERROR]', ...args);

  const server = new Server(
    {
      name: 'agent-tools',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Define tools list
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // PDF Tools
        {
          name: 'pdf_merge',
          description: 'Merge multiple PDF files into a single PDF.',
          inputSchema: {
            type: 'object',
            properties: {
              inputs: { type: 'array', items: { type: 'string' }, description: 'Paths to PDF files to merge' },
              output: { type: 'string', description: 'Path to save the merged PDF file' },
            },
            required: ['inputs', 'output'],
          },
        },
        {
          name: 'pdf_split',
          description: 'Split a PDF into multiple files or extract specific pages.',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Path to input PDF file' },
              outputDir: { type: 'string', description: 'Directory to save output PDF pages' },
              pages: { type: 'string', description: 'Optional: comma-separated pages/ranges to extract (e.g., "1-3,5,7")' },
            },
            required: ['input', 'outputDir'],
          },
        },
        {
          name: 'pdf_rotate',
          description: 'Rotate specific pages of a PDF by a given angle (90, 180, 270 degrees).',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Path to input PDF file' },
              output: { type: 'string', description: 'Path to save the rotated PDF file' },
              angle: { type: 'number', enum: [0, 90, 180, 270], description: 'Rotation angle in degrees' },
              pages: { type: 'string', description: 'Optional: comma-separated pages/ranges to rotate' },
            },
            required: ['input', 'output', 'angle'],
          },
        },

        // Video Tools
        {
          name: 'video_trim',
          description: 'Trim a video from start time to end/duration.',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Path to input video file' },
              output: { type: 'string', description: 'Path to save the trimmed video' },
              startTime: { type: 'string', description: 'Start time (e.g. "00:01:20" or seconds like "80")' },
              duration: { type: 'string', description: 'Optional: duration of trim (e.g. "10" or "00:00:10")' },
            },
            required: ['input', 'output', 'startTime'],
          },
        },
        {
          name: 'video_merge',
          description: 'Merge multiple video files into a single video file.',
          inputSchema: {
            type: 'object',
            properties: {
              inputs: { type: 'array', items: { type: 'string' }, description: 'Paths to video files to merge' },
              output: { type: 'string', description: 'Path to save the merged video file' },
            },
            required: ['inputs', 'output'],
          },
        },
        {
          name: 'video_speed',
          description: 'Change video playback speed (speeds up or slows down video and audio).',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Path to input video file' },
              output: { type: 'string', description: 'Path to save the speed-adjusted video' },
              speed: { type: 'number', description: 'Speed multiplier (e.g. 1.5, 0.5)' },
            },
            required: ['input', 'output', 'speed'],
          },
        },
        {
          name: 'video_volume',
          description: 'Change video volume.',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Path to input video file' },
              output: { type: 'string', description: 'Path to save the volume-adjusted video' },
              volume: { type: 'number', description: 'Volume multiplier (e.g. 1.5, 0.5)' },
            },
            required: ['input', 'output', 'volume'],
          },
        },

        // Audio Tools
        {
          name: 'audio_trim',
          description: 'Trim an audio file.',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Path to input audio file' },
              output: { type: 'string', description: 'Path to save the trimmed audio' },
              startTime: { type: 'string', description: 'Start time (e.g. "00:01:20" or seconds)' },
              duration: { type: 'string', description: 'Optional: duration of trim' },
            },
            required: ['input', 'output', 'startTime'],
          },
        },
        {
          name: 'audio_merge',
          description: 'Merge multiple audio files into a single audio file.',
          inputSchema: {
            type: 'object',
            properties: {
              inputs: { type: 'array', items: { type: 'string' }, description: 'Paths to audio files to merge' },
              output: { type: 'string', description: 'Path to save the merged audio file' },
            },
            required: ['inputs', 'output'],
          },
        },
        {
          name: 'audio_speed',
          description: 'Change audio speed.',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Path to input audio file' },
              output: { type: 'string', description: 'Path to save the speed-adjusted audio' },
              speed: { type: 'number', description: 'Speed multiplier (e.g. 1.5, 0.5)' },
            },
            required: ['input', 'output', 'speed'],
          },
        },
        {
          name: 'audio_volume',
          description: 'Change audio volume.',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Path to input audio file' },
              output: { type: 'string', description: 'Path to save the volume-adjusted audio' },
              volume: { type: 'number', description: 'Volume multiplier (e.g. 1.5, 0.5)' },
            },
            required: ['input', 'output', 'volume'],
          },
        },
        {
          name: 'audio_reverse',
          description: 'Reverse an audio track.',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Path to input audio file' },
              output: { type: 'string', description: 'Path to save the reversed audio' },
            },
            required: ['input', 'output'],
          },
        },

        // Universal Converters
        {
          name: 'convert_image',
          description: 'Convert image format and resize.',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Path to input image file' },
              output: { type: 'string', description: 'Path to save the converted image' },
              width: { type: 'number', description: 'Optional: resize width' },
              height: { type: 'number', description: 'Optional: resize height' },
              quality: { type: 'number', description: 'Optional: output quality (1-100)' },
            },
            required: ['input', 'output'],
          },
        },
        {
          name: 'convert_audio',
          description: 'Convert audio format.',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Path to input audio file' },
              output: { type: 'string', description: 'Path to save the converted audio' },
            },
            required: ['input', 'output'],
          },
        },
        {
          name: 'convert_video',
          description: 'Convert video format.',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Path to input video file' },
              output: { type: 'string', description: 'Path to save the converted video' },
            },
            required: ['input', 'output'],
          },
        },
      ],
    };
  });

  // Handle tool invocation requests
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let resultText = '';

      switch (name) {
        // PDF Tools
        case 'pdf_merge': {
          const { inputs, output } = args as { inputs: string[]; output: string };
          const out = await mergePDFs(inputs, output);
          resultText = `Merged PDF successfully saved to: ${out}`;
          break;
        }
        case 'pdf_split': {
          const { input, outputDir, pages } = args as { input: string; outputDir: string; pages?: string };
          const files = await splitPDF(input, outputDir, pages);
          resultText = `Split PDF successfully. Created ${files.length} files:\n${files.map((f) => `- ${f}`).join('\n')}`;
          break;
        }
        case 'pdf_rotate': {
          const { input, output, angle, pages } = args as { input: string; output: string; angle: number; pages?: string };
          const out = await rotatePDF(input, output, angle, pages);
          resultText = `Rotated PDF successfully saved to: ${out}`;
          break;
        }

        // Video Tools
        case 'video_trim': {
          const { input, output, startTime, duration } = args as { input: string; output: string; startTime: string; duration?: string };
          const out = await trimVideo(input, output, startTime, duration);
          resultText = `Trimmed video successfully saved to: ${out}`;
          break;
        }
        case 'video_merge': {
          const { inputs, output } = args as { inputs: string[]; output: string };
          const out = await mergeVideos(inputs, output);
          resultText = `Merged videos successfully saved to: ${out}`;
          break;
        }
        case 'video_speed': {
          const { input, output, speed } = args as { input: string; output: string; speed: number };
          const out = await changeVideoSpeed(input, output, speed);
          resultText = `Speed changed successfully. Saved to: ${out}`;
          break;
        }
        case 'video_volume': {
          const { input, output, volume } = args as { input: string; output: string; volume: number };
          const out = await changeVideoVolume(input, output, volume);
          resultText = `Volume changed successfully. Saved to: ${out}`;
          break;
        }

        // Audio Tools
        case 'audio_trim': {
          const { input, output, startTime, duration } = args as { input: string; output: string; startTime: string; duration?: string };
          const out = await trimAudio(input, output, startTime, duration);
          resultText = `Trimmed audio successfully saved to: ${out}`;
          break;
        }
        case 'audio_merge': {
          const { inputs, output } = args as { inputs: string[]; output: string };
          const out = await mergeAudio(inputs, output);
          resultText = `Merged audios successfully saved to: ${out}`;
          break;
        }
        case 'audio_speed': {
          const { input, output, speed } = args as { input: string; output: string; speed: number };
          const out = await changeAudioSpeed(input, output, speed);
          resultText = `Audio speed changed successfully. Saved to: ${out}`;
          break;
        }
        case 'audio_volume': {
          const { input, output, volume } = args as { input: string; output: string; volume: number };
          const out = await changeAudioVolume(input, output, volume);
          resultText = `Audio volume changed successfully. Saved to: ${out}`;
          break;
        }
        case 'audio_reverse': {
          const { input, output } = args as { input: string; output: string };
          const out = await reverseAudio(input, output);
          resultText = `Reversed audio saved successfully to: ${out}`;
          break;
        }

        // Converters
        case 'convert_image': {
          const { input, output, width, height, quality } = args as { input: string; output: string; width?: number; height?: number; quality?: number };
          const out = await convertImage(input, output, { width, height, quality });
          resultText = `Image converted successfully. Saved to: ${out}`;
          break;
        }
        case 'convert_audio': {
          const { input, output } = args as { input: string; output: string };
          const out = await convertAudio(input, output);
          resultText = `Audio converted successfully. Saved to: ${out}`;
          break;
        }
        case 'convert_video': {
          const { input, output } = args as { input: string; output: string };
          const out = await convertVideo(input, output);
          resultText = `Video converted successfully. Saved to: ${out}`;
          break;
        }

        default:
          throw new Error(`Tool not found: ${name}`);
      }

      return {
        content: [{ type: 'text', text: resultText }],
      };
    } catch (err: any) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Make sure we log to stderr that server is running
  originalError('[INFO] agent-tools MCP server running on stdio');
}
