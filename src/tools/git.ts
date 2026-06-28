import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import * as readline from 'readline';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface GitHubRepo {
  nameWithOwner: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  stargazerCount: number;
  updatedAt: string;
}

export type RepoAction = 'KEEP' | 'ARCHIVE' | 'DELETE';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function runGhCommand(args: string[]): string {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.error) throw new Error(`gh not found: ${result.error.message}`);
  if (result.status !== 0) throw new Error(result.stderr || 'gh command failed');
  return result.stdout.trim();
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

function ageDays(dateStr: string): number {
  const diff = Date.now() - parseDate(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function toggleAction(current: RepoAction): RepoAction {
  if (current === 'KEEP') return 'ARCHIVE';
  if (current === 'ARCHIVE') return 'DELETE';
  return 'KEEP';
}

function smartDefault(repo: GitHubRepo, whitelist: Set<string>): RepoAction {
  const name = repo.name.toLowerCase();
  const age = ageDays(repo.updatedAt);
  const tempKeywords = ['hello', 'hi', 'boom', 'temp', 'test', 'demo', 'draft'];

  if (repo.isArchived) return 'KEEP';
  if (whitelist.has(repo.nameWithOwner)) return 'KEEP';
  if (repo.stargazerCount > 0) return 'KEEP';
  if (age < 30) return 'KEEP';
  if (repo.isFork && age > 90) return 'DELETE';
  if (tempKeywords.some(kw => name.includes(kw)) && age > 60) return 'DELETE';
  if (age > 180) return 'ARCHIVE';
  return 'KEEP';
}

// ──────────────────────────────────────────────────────────────────────────────
// Fetch repos
// ──────────────────────────────────────────────────────────────────────────────

export function fetchGitHubRepos(): GitHubRepo[] {
  const json = runGhCommand([
    'repo', 'list',
    '--limit', '1000',
    '--json', 'name,nameWithOwner,description,isPrivate,isFork,isArchived,stargazerCount,updatedAt',
  ]);
  return JSON.parse(json) as GitHubRepo[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Execute actions (archive / delete) — for non-interactive use from MCP
// ──────────────────────────────────────────────────────────────────────────────

export interface BatchResult {
  repo: string;
  action: 'archived' | 'deleted' | 'error';
  message: string;
}

export function archiveRepo(nameWithOwner: string): string {
  return runGhCommand(['repo', 'archive', nameWithOwner, '--yes']);
}

export function deleteRepo(nameWithOwner: string): string {
  try {
    runGhCommand(['repo', 'delete', nameWithOwner, '--yes']);
    return `Successfully deleted ${nameWithOwner}`;
  } catch (error: any) {
    throw new Error(`Failed to delete repo ${nameWithOwner}: ${error.message}`);
  }
}

export function batchCleanRepos(
  toArchive: string[],
  toDelete: string[]
): BatchResult[] {
  const results: BatchResult[] = [];
  for (const r of toArchive) {
    try {
      archiveRepo(r);
      results.push({ repo: r, action: 'archived', message: 'OK' });
    } catch (e: any) {
      results.push({ repo: r, action: 'error', message: e.message });
    }
  }
  for (const r of toDelete) {
    try {
      deleteRepo(r);
      results.push({ repo: r, action: 'deleted', message: 'OK' });
    } catch (e: any) {
      results.push({ repo: r, action: 'error', message: e.message });
    }
  }
  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// TUI  (interactive terminal mode, invoked by CLI)
// ──────────────────────────────────────────────────────────────────────────────

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[91m',
  green: '\x1b[92m',
  yellow: '\x1b[93m',
  blue: '\x1b[94m',
  cyan: '\x1b[96m',
  clearScreen: '\x1b[H\x1b[2J',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
};

const WHITELIST = new Set([
  'riteshrajas/riteshrajas',
  'riteshrajas/APEX',
  'riteshrajas/FluentFlyout',
  'riteshrajas/agent-tools',
  'riteshrajas/AutoDRIVE-RoboRacer-Sim-Racing',
  'riteshrajas/roboracer-dashboard',
  'riteshrajas/ROS2_Learning',
]);

const PAGE_SIZE = 14;

function badge(action: RepoAction): string {
  if (action === 'KEEP')    return `${ANSI.green}[ KEEP ]${ANSI.reset}`;
  if (action === 'ARCHIVE') return `${ANSI.yellow}[ARCHIVE]${ANSI.reset}`;
  return                           `${ANSI.red}[DELETE ]${ANSI.reset}`;
}

function renderBoard(
  repos: GitHubRepo[],
  actions: Map<string, RepoAction>,
  cursor: number,
  startIdx: number
): void {
  const out: string[] = [];
  out.push(ANSI.clearScreen);
  out.push(`${ANSI.cyan}${ANSI.bold}🌌  GITHUB REPO CLEANUP BOARD${ANSI.reset}\n`);
  out.push(`  ${ANSI.bold}↑/↓${ANSI.reset} Navigate  |  ${ANSI.bold}Space${ANSI.reset} Cycle (KEEP→ARCHIVE→DELETE)  |  ${ANSI.bold}Enter${ANSI.reset} Finish  |  ${ANSI.bold}Esc/q${ANSI.reset} Quit\n`);

  const keep    = [...actions.values()].filter(v => v === 'KEEP').length;
  const archive = [...actions.values()].filter(v => v === 'ARCHIVE').length;
  const del     = [...actions.values()].filter(v => v === 'DELETE').length;
  out.push(`  Stats: ${ANSI.green}KEEP ${keep}${ANSI.reset}  ${ANSI.yellow}ARCHIVE ${archive}${ANSI.reset}  ${ANSI.red}DELETE ${del}${ANSI.reset}\n`);
  out.push(`  ${ANSI.bold}${'ACTION'.padEnd(10)} | ${'REPOSITORY'.padEnd(45)} | ${'★'.padEnd(3)} | UPDATED${ANSI.reset}`);
  out.push('  ' + '─'.repeat(75));

  const end = Math.min(startIdx + PAGE_SIZE, repos.length);
  for (let i = startIdx; i < end; i++) {
    const r = repos[i];
    const action = actions.get(r.nameWithOwner) ?? 'KEEP';
    const updated = parseDate(r.updatedAt).toISOString().slice(0, 10);
    const nameTrunc = r.nameWithOwner.length > 45 ? r.nameWithOwner.slice(0, 42) + '...' : r.nameWithOwner;
    const isSelected = i === cursor;
    const prefix = isSelected ? `${ANSI.cyan}➔ ${ANSI.reset}` : '  ';
    const namePart = isSelected ? `${ANSI.bold}${ANSI.cyan}${nameTrunc.padEnd(45)}${ANSI.reset}` : nameTrunc.padEnd(45);
    out.push(`${prefix}${badge(action)} | ${namePart} | ${String(r.stargazerCount).padEnd(3)} | ${updated}`);
  }

  out.push('  ' + '─'.repeat(75));
  out.push(`  Showing ${startIdx + 1}–${end} of ${repos.length}`);

  const selected = repos[cursor];
  const desc = selected?.description ?? 'No description.';
  out.push(`\n  ${ANSI.bold}Selected:${ANSI.reset} ${ANSI.blue}${desc.slice(0, 100)}${ANSI.reset}\n`);

  process.stdout.write(out.join('\n'));
}

export async function runInteractiveRepoCleanup(): Promise<void> {
  process.stdout.write(ANSI.hideCursor);

  let repos: GitHubRepo[];
  try {
    process.stdout.write(`${ANSI.cyan}⚡ Fetching repositories...${ANSI.reset}\n`);
    repos = fetchGitHubRepos();
  } catch (e: any) {
    process.stdout.write(ANSI.showCursor);
    console.error(`Failed to fetch repos: ${e.message}`);
    process.exit(1);
  }

  // Apply smart defaults
  const actions = new Map<string, RepoAction>();
  for (const r of repos) {
    actions.set(r.nameWithOwner, smartDefault(r, WHITELIST));
  }

  // Sort: DELETE first, then ARCHIVE, then KEEP
  repos.sort((a, b) => {
    const order: Record<RepoAction, number> = { DELETE: 0, ARCHIVE: 1, KEEP: 2 };
    return order[actions.get(a.nameWithOwner)!] - order[actions.get(b.nameWithOwner)!];
  });

  let cursor = 0;
  let startIdx = 0;

  // Enable raw mode for keypress capture
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  renderBoard(repos, actions, cursor, startIdx);

  await new Promise<void>((resolve) => {
    process.stdin.on('keypress', (_ch: string, key: readline.Key) => {
      if (!key) return;

      if (key.name === 'up' || key.name === 'k') {
        if (cursor > 0) {
          cursor--;
          if (cursor < startIdx) startIdx = cursor;
        }
      } else if (key.name === 'down' || key.name === 'j') {
        if (cursor < repos.length - 1) {
          cursor++;
          if (cursor >= startIdx + PAGE_SIZE) startIdx = cursor - PAGE_SIZE + 1;
        }
      } else if (key.name === 'space') {
        const r = repos[cursor];
        actions.set(r.nameWithOwner, toggleAction(actions.get(r.nameWithOwner) ?? 'KEEP'));
      } else if (key.name === 'return') {
        resolve();
        return;
      } else if (key.name === 'escape' || key.name === 'q') {
        process.stdout.write(ANSI.showCursor);
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        console.log('\nExited without changes.');
        process.exit(0);
      }

      renderBoard(repos, actions, cursor, startIdx);
    });
  });

  // Restore terminal
  process.stdout.write(ANSI.showCursor);
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdout.write(ANSI.clearScreen);

  // Summary
  const toDelete  = repos.filter(r => actions.get(r.nameWithOwner) === 'DELETE');
  const toArchive = repos.filter(r => actions.get(r.nameWithOwner) === 'ARCHIVE');

  if (!toDelete.length && !toArchive.length) {
    console.log('✅  No changes selected. All repositories kept!');
    return;
  }

  console.log(`\n${ANSI.bold}─── REVIEW PLANNED CHANGES ───${ANSI.reset}\n`);
  if (toDelete.length) {
    console.log(`${ANSI.red}${ANSI.bold}Permanently DELETE (${toDelete.length}):${ANSI.reset}`);
    toDelete.forEach(r => console.log(`  - ${r.nameWithOwner}`));
  }
  if (toArchive.length) {
    console.log(`\n${ANSI.yellow}${ANSI.bold}ARCHIVE / read-only (${toArchive.length}):${ANSI.reset}`);
    toArchive.forEach(r => console.log(`  - ${r.nameWithOwner}`));
  }

  console.log(`\n${ANSI.red}${ANSI.bold}⚠️  Deleting repos is permanent and cannot be undone!${ANSI.reset}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirm = await new Promise<string>(res => rl.question(`\nType CONFIRM to proceed: `, res));
  rl.close();

  if (confirm !== 'CONFIRM') {
    console.log(`${ANSI.yellow}Aborted. No changes made.${ANSI.reset}`);
    return;
  }

  console.log(`\n${ANSI.cyan}⚡ Executing...${ANSI.reset}`);
  const results = batchCleanRepos(
    toArchive.map(r => r.nameWithOwner),
    toDelete.map(r => r.nameWithOwner)
  );
  for (const r of results) {
    const icon = r.action === 'error' ? `${ANSI.red}✗${ANSI.reset}` : `${ANSI.green}✔${ANSI.reset}`;
    console.log(`${icon}  ${r.repo} → ${r.action}${r.action === 'error' ? ': ' + r.message : ''}`);
  }
  console.log(`\n${ANSI.green}Done!${ANSI.reset}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Codebase bundler  — bundles a directory into a single Markdown document
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_IGNORE = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '__pycache__',
  '.cache', 'coverage', '.pytest_cache', 'out', 'vendor',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.h',
  '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.dart',
  '.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.ini', '.env',
  '.sh', '.bash', '.zsh', '.ps1', '.css', '.scss', '.html', '.xml',
  '.sql', '.graphql', '.vue', '.svelte',
]);

function walkDir(dirPath: string, ignoreDirs: Set<string>): string[] {
  const files: string[] = [];
  function recurse(cur: string): void {
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const entry of entries) {
      if (ignoreDirs.has(entry.name)) continue;
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        recurse(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  }
  recurse(dirPath);
  return files;
}

export async function bundleCodebase(
  dirPath: string,
  outputPath: string,
  options: { maxFileSize?: number; extensions?: string[] } = {}
): Promise<{ outputFile: string; fileCount: number; totalBytes: number }> {
  const resolvedDir = path.resolve(dirPath);
  if (!fs.existsSync(resolvedDir)) throw new Error(`Directory not found: ${dirPath}`);

  const allowedExts = options.extensions
    ? new Set(options.extensions.map(e => (e.startsWith('.') ? e : `.${e}`)))
    : TEXT_EXTENSIONS;

  const maxSize = options.maxFileSize ?? 200 * 1024; // 200 KB default

  const files = walkDir(resolvedDir, DEFAULT_IGNORE);

  // Fast path filtering before I/O
  const validFiles = files.filter(f => allowedExts.has(path.extname(f).toLowerCase()));

  const lines: string[] = [];
  lines.push(`# Codebase Bundle: \`${path.basename(resolvedDir)}\``);
  lines.push(`\nGenerated: ${new Date().toISOString()}\n`);
  lines.push(`---\n`);

  let fileCount = 0;
  let totalBytes = 0;

  const CHUNK_SIZE = 1000;

  for (let i = 0; i < validFiles.length; i += CHUNK_SIZE) {
    const chunk = validFiles.slice(i, i + CHUNK_SIZE);

    const results = await Promise.all(chunk.map(async file => {
      try {
        const stat = await fs.promises.stat(file);
        if (stat.size > maxSize) return null;

        const content = await fs.promises.readFile(file, 'utf8');
        return { file, stat, content };
      } catch (err) {
        return null;
      }
    }));

    for (const result of results) {
      if (!result) continue;

      const ext = path.extname(result.file).toLowerCase();
      const lang = ext.replace('.', '') || 'text';
      const relPath = path.relative(resolvedDir, result.file);

      lines.push(`## \`${relPath}\``);
      lines.push('');
      lines.push('```' + lang);
      lines.push(result.content);
      lines.push('```');
      lines.push('');

      fileCount++;
      totalBytes += result.stat.size;
    }
  }

  const output = lines.join('\n');
  const resolvedOutput = path.resolve(outputPath);
  await fs.promises.mkdir(path.dirname(resolvedOutput), { recursive: true });
  await fs.promises.writeFile(resolvedOutput, output, 'utf8');

  return { outputFile: resolvedOutput, fileCount, totalBytes };
}
