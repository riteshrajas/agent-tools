#!/usr/bin/env node
import { setupCLI } from './cli.js';
import { startMCPServer } from './mcp-server.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--mcp') || args[0] === 'mcp') {
    // Start MCP Server
    await startMCPServer();
  } else {
    // Start CLI
    const program = setupCLI();
    program.parse(process.argv);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
