import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'timed_out', 'interrupted']);
export const MAX_INPUT = 512 * 1024;
export const MAX_OUTPUT = 4 * 1024 * 1024;
export const digest = value => createHash('sha256').update(value).digest('hex');
export const now = () => new Date().toISOString();
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function checked(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', timeout: 15_000, maxBuffer: MAX_OUTPUT, ...options });
}
export function privateDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (!fs.lstatSync(dir).isDirectory() || fs.lstatSync(dir).isSymbolicLink()) throw new Error('State path must be a real directory.');
  fs.chmodSync(dir, 0o700);
  return dir;
}
export function atomic(file, value) {
  privateDir(path.dirname(file));
  const temp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  fs.renameSync(temp, file);
}
export const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function canonicalWorkspace(workspace) {
  if (typeof workspace !== 'string' || !path.isAbsolute(workspace)) throw new Error('workspace must be an absolute directory path.');
  const resolved = fs.realpathSync(workspace);
  if (!fs.statSync(resolved).isDirectory()) throw new Error('workspace must be a directory.');
  return resolved;
}
export function stateRoot() {
  return path.resolve(process.env.CLAUDE_ON_CODEX_HOME || path.join(os.homedir(), '.codex', 'claude-on-codex'));
}
export function jobDirectory(workspace, jobId) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(jobId)) throw new Error('Invalid job ID.');
  return path.join(stateRoot(), digest(canonicalWorkspace(workspace)).slice(0, 24), jobId);
}
export function getJob(workspace, jobId) {
  const dir = jobDirectory(workspace, jobId);
  let job = readJSON(path.join(dir, 'job.json'));
  if (!job.workerPid && fs.existsSync(path.join(dir, 'worker.json'))) job = { ...job, workerPid: readJSON(path.join(dir, 'worker.json')).pid };
  if (job.workspace !== canonicalWorkspace(workspace)) throw new Error('Workspace mismatch.');
  const thread = process.env.CODEX_THREAD_ID || null;
  if (thread && job.threadId && thread !== job.threadId) throw new Error('Job belongs to a different Codex thread.');
  if (!TERMINAL.has(job.status) && job.workerPid) {
    try { process.kill(job.workerPid, 0); }
    catch (error) {
      if (error.code === 'ESRCH') return { dir, job: { ...job, status: 'interrupted', error: 'Worker exited without recording a terminal result; cancellation is not confirmed.' } };
      throw error;
    }
  }
  return { dir, job };
}
export function claudeBinary() {
  const binary = process.env.CLAUDE_ON_CODEX_CLI || 'claude';
  if (binary !== 'claude' && !path.isAbsolute(binary)) throw new Error('CLAUDE_ON_CODEX_CLI must be an absolute executable path.');
  return binary;
}
export function childEnvironment() {
  const env = {};
  const names = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL',
    'XDG_CONFIG_HOME', 'CLAUDE_CONFIG_DIR', 'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_OAUTH_TOKEN',
    'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'CLAUDECODE'];
  for (const key of names) if (process.env[key] !== undefined) env[key] = process.env[key];
  return { ...env, NO_COLOR: '1', CLAUDE_ON_CODEX_DEPTH: '1' };
}
export function validateRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected a JSON object.');
  const allowed = new Set(['workspace', 'prompt', 'mode', 'base', 'adversarial', 'background', 'timeoutMs', 'maxTurns', 'model', 'effort', 'maxBudgetUsd', 'allowedPaths', 'resumeJobId']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new Error(`Unknown request field: ${key}`);
  const request = { mode: 'advise', background: true, timeoutMs: 300_000, maxTurns: 8, ...input };
  request.workspace = canonicalWorkspace(input.workspace);
  if (!['advise', 'review', 'edit'].includes(request.mode)) throw new Error('mode must be advise, review, or edit.');
  if (typeof request.background !== 'boolean') throw new Error('background must be boolean.');
  if (request.adversarial !== undefined && typeof request.adversarial !== 'boolean') throw new Error('adversarial must be boolean.');
  if (request.base !== undefined && (request.mode !== 'review' || typeof request.base !== 'string' || !request.base || request.base.length > 200)) throw new Error('base is a review-only Git reference.');
  if (request.prompt === undefined && request.mode === 'review') request.prompt = '';
  if (typeof request.prompt !== 'string' || (request.mode !== 'review' && !request.prompt.trim()) || Buffer.byteLength(request.prompt) > 128 * 1024) throw new Error('prompt must be text, at most 128 KiB.');
  if (!Number.isInteger(request.timeoutMs) || request.timeoutMs < 100 || request.timeoutMs > 600_000) throw new Error('timeoutMs must be 100..600000.');
  if (!Number.isInteger(request.maxTurns) || request.maxTurns < 1 || request.maxTurns > 30) throw new Error('maxTurns must be 1..30.');
  if (request.model !== undefined && (typeof request.model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(request.model))) throw new Error('Invalid model identifier.');
  if (request.effort !== undefined && !['low', 'medium', 'high', 'xhigh', 'max'].includes(request.effort)) throw new Error('Invalid effort.');
  if (request.maxBudgetUsd !== undefined && (!Number.isFinite(request.maxBudgetUsd) || request.maxBudgetUsd <= 0 || request.maxBudgetUsd > 100)) throw new Error('maxBudgetUsd must be >0 and <=100.');
  if (request.resumeJobId !== undefined && (typeof request.resumeJobId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(request.resumeJobId))) throw new Error('resumeJobId must be a job UUID.');
  if (request.mode === 'edit') {
    if (request.resumeJobId) throw new Error('Edit-session resume is not supported.');
    if (!Array.isArray(request.allowedPaths) || request.allowedPaths.length < 1 || request.allowedPaths.length > 100) throw new Error('Edit requires 1..100 explicit allowedPaths.');
    for (const item of request.allowedPaths) {
      if (typeof item !== 'string' || !item || item === '.' || path.isAbsolute(item) || item.includes('\\') || item.split('/').some(s => s === '..' || s === '.' || s === '.git' || s === '.claude' || s === '.codex' || s === '.agents') || /[\0\r\n*?]/.test(item)) throw new Error(`Invalid allowed path: ${item}`);
    }
  } else if (request.allowedPaths !== undefined) throw new Error('allowedPaths is only valid for edit.');
  if (request.resumeJobId && request.mode !== 'advise') throw new Error('Only advise sessions can resume.');
  return request;
}
