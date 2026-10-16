import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { checked, digest, MAX_INPUT } from './core.mjs';

export function git(cwd, args, options = {}) {
  return checked('git', ['--no-pager', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false',
    '-c', 'color.ui=false', '-c', 'diff.noprefix=false', '-c', 'diff.mnemonicPrefix=false', ...args], { cwd, ...options });
}
export const repoRoot = cwd => fs.realpathSync(git(cwd, ['rev-parse', '--show-toplevel']).trim());
export const head = cwd => git(cwd, ['rev-parse', '--verify', 'HEAD']).trim();
export const status = cwd => git(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none']);
const diffFlags = ['--no-ext-diff', '--no-textconv', '--binary', '--submodule=short', '--ignore-submodules=none',
  '--no-color', '--src-prefix=a/', '--dst-prefix=b/', '--no-relative', '--full-index',
  '--output-indicator-new=+', '--output-indicator-old=-', '--output-indicator-context= '];
const splitZ = text => text.split('\0').filter(Boolean);

function ensureText(text, label) {
  if (/^GIT binary patch$|^Binary files .* differ$|^[+-]Subproject commit [0-9a-f]{40,64}(?:-dirty)?$/m.test(text)) throw new Error(`${label}: binary/submodule changes require a separate review; refusing incomplete coverage.`);
  return text;
}
function rejectSubmodules(root, revisions = []) {
  const raw = git(root, ['diff', '--raw', '-z', '--no-abbrev', '--no-ext-diff', '--ignore-submodules=none', ...revisions, '--']);
  if (splitZ(raw).some(record => /^:(?:160000 \d{6}|\d{6} 160000) /.test(record))) {
    throw new Error('Submodule changes require a separate review; refusing incomplete coverage.');
  }
}
const outside = relative => relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
function readUntracked(root, file) {
  const absolute = path.join(root, file);
  const relative = path.relative(root, fs.realpathSync(absolute));
  if (outside(relative)) throw new Error(`Untracked file escapes workspace: ${file}`);
  const fd = fs.openSync(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > 128 * 1024) throw new Error(`Untracked file is not a small regular file: ${file}`);
    const data = fs.readFileSync(fd);
    if (data.includes(0)) throw new Error(`Binary untracked file: ${file}`);
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } finally { fs.closeSync(fd); }
}
function collectOnce(workspace, base) {
  const root = repoRoot(workspace);
  const targetHead = head(root);
  let sections, files, target;
  if (base) {
    const baseCommit = git(root, ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]).trim();
    const mergeBase = git(root, ['merge-base', baseCommit, targetHead]).trim();
    const range = `${mergeBase}..${targetHead}`;
    rejectSubmodules(root, [range]);
    files = splitZ(git(root, ['diff', ...diffFlags, '--name-only', '-z', range, '--']));
    sections = [`BRANCH DIFF (${range})\n${ensureText(git(root, ['diff', ...diffFlags, range, '--']), 'Branch review')}`];
    target = { kind: 'branch', base, baseCommit, mergeBase, head: targetHead };
  } else {
    rejectSubmodules(root, ['--cached']);
    rejectSubmodules(root);
    const staged = ensureText(git(root, ['diff', ...diffFlags, '--cached', '--']), 'Staged review');
    const unstaged = ensureText(git(root, ['diff', ...diffFlags, '--']), 'Unstaged review');
    const untracked = splitZ(git(root, ['ls-files', '--others', '--exclude-standard', '-z']));
    files = [...new Set([...splitZ(git(root, ['diff', ...diffFlags, '--cached', '--name-only', '-z'])), ...splitZ(git(root, ['diff', ...diffFlags, '--name-only', '-z'])), ...untracked])];
    sections = [`STAGED DIFF\n${staged}`, `UNSTAGED DIFF\n${unstaged}`];
    for (const file of untracked) sections.push(`UNTRACKED ${JSON.stringify(file)}\n${readUntracked(root, file)}`);
    target = { kind: 'working-tree', head: targetHead };
  }
  if (!files.length) throw new Error('No changes in the requested review scope.');
  const content = sections.join('\n\n');
  if (Buffer.byteLength(content) > MAX_INPUT - 16 * 1024) throw new Error('Review exceeds input limit; narrow the changes. Nothing was sent to Claude.');
  return { root, target, files, content, sha256: digest(content), complete: true };
}
export function collectReview(workspace, base) {
  const first = collectOnce(workspace, base);
  const second = collectOnce(workspace, base);
  if (first.sha256 !== second.sha256 || JSON.stringify(first.target) !== JSON.stringify(second.target)) throw new Error('Repository changed while collecting review input; retry.');
  return second;
}
export function prepareWorktree(workspace, destination) {
  const root = repoRoot(workspace);
  if (root !== workspace) throw new Error('Edit workspace must be the Git repository root.');
  if (status(root)) throw new Error('Edit requires a clean working tree, including untracked files. Commit or stash changes first.');
  const baseHead = head(root);
  git(root, ['worktree', 'add', '--detach', destination, baseHead]);
  return { worktree: destination, baseHead };
}
export function collectPatch(worktree, baseHead, allowedPaths) {
  if (head(worktree) !== baseHead) throw new Error('Claude changed worktree HEAD unexpectedly.');
  rejectSubmodules(worktree, [baseHead]);
  const tracked = splitZ(git(worktree, ['diff', ...diffFlags, '--name-only', '-z', baseHead, '--']));
  // Include ignored additions: ignored files must not bypass post-edit scope validation.
  const untracked = splitZ(git(worktree, ['ls-files', '--others', '-z']));
  const files = [...new Set([...tracked, ...untracked])];
  for (const file of files) {
    if (!allowedPaths.some(p => file === p.replace(/\/$/, '') || file.startsWith(`${p.replace(/\/$/, '')}/`))) throw new Error(`Edit escaped requested path scope: ${file}. Worktree preserved; original unchanged.`);
    let full = worktree;
    for (const component of file.split('/')) {
      full = path.join(full, component);
      let stat;
      try { stat = fs.lstatSync(full); }
      catch (error) { if (error.code === 'ENOENT') break; throw error; } // A real deletion is allowed.
      if (stat.isSymbolicLink() || outside(path.relative(worktree, fs.realpathSync(full)))) throw new Error(`Unsupported edited symlink: ${file}`);
    }
  }
  let patch = git(worktree, ['diff', ...diffFlags, baseHead, '--']);
  for (const file of untracked) {
    readUntracked(worktree, file);
    try { patch += git(worktree, ['diff', ...diffFlags, '--no-index', '--', '/dev/null', file]); }
    catch (error) { if (error.status === 1 && typeof error.stdout === 'string') patch += error.stdout; else throw error; }
  }
  if (Buffer.byteLength(patch) > MAX_INPUT) throw new Error('Patch exceeds limit; inspect the preserved worktree.');
  // Verify against the recorded commit without touching either real Git index.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-on-codex-index-'));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: path.join(temp, 'index') };
    git(worktree, ['read-tree', baseHead], { env });
    if (patch) git(worktree, ['apply', '--cached', '--check', '--whitespace=nowarn', '-'], { env, input: patch });
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  return { patch, files, sha256: digest(patch), verified: true };
}
