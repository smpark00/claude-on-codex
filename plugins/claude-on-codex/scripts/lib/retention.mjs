import fs from 'node:fs';
import path from 'node:path';
import { canonicalWorkspace, digest, getJob, privateDir, readJSON, stateRoot, TERMINAL } from './core.mjs';
import { git } from './git.mjs';

export function listJobs(workspace) {
  workspace = canonicalWorkspace(workspace);
  const parent = path.join(stateRoot(), digest(workspace).slice(0, 24));
  const jobs = [], unreadableJobs = [];
  let entries;
  try { entries = fs.readdirSync(parent, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return { workspace, jobs, unreadableJobs }; throw error; }
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(entry.name)) continue;
    try {
      const saved = readJSON(path.join(parent, entry.name, 'job.json'));
      if (process.env.CODEX_THREAD_ID && saved.threadId && saved.threadId !== process.env.CODEX_THREAD_ID) continue;
      const { job } = getJob(workspace, entry.name);
      jobs.push(Object.fromEntries(['id', 'mode', 'status', 'createdAt', 'finishedAt', 'requestedModel', 'models', 'patchBytes']
        .filter(key => job[key] !== undefined).map(key => [key, job[key]])));
    } catch { unreadableJobs.push(entry.name); }
  }
  jobs.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return { workspace, jobs, unreadableJobs };
}

function alive(pid, group = false) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(group ? -pid : pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

export function cleanupJob(workspace, id, discard) {
  if (discard !== 'true') throw new Error('Cleanup permanently deletes job data, patches, and its edit worktree. Pass --discard true to acknowledge this.');
  const { dir, job } = getJob(workspace, id);
  if (job.id !== id || !fs.lstatSync(dir).isDirectory() || fs.lstatSync(dir).isSymbolicLink()) throw new Error('Invalid job directory.');
  if (!TERMINAL.has(job.status) || job.status === 'interrupted') throw new Error('Cleanup requires a finished job with confirmed worker termination; interrupted jobs need manual inspection.');
  if (alive(job.workerPid) || alive(job.claudePid, true)) throw new Error('A recorded worker or process group is still alive; retry after it exits. No process was signalled.');
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(job.sessionId)) throw new Error('Invalid session identity; inspect this job manually.');
  const parent = privateDir(path.join(path.dirname(dir), 'sessions'));
  const lock = path.join(parent, job.sessionId);
  try { fs.mkdirSync(lock, { mode: 0o700 }); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Session is active or has a stale lock; cleanup refused.'); throw error; }
  try {
    if (job.worktree) {
      if (job.worktree !== path.join(dir, 'worktree') || fs.lstatSync(job.worktree).isSymbolicLink()) throw new Error('Unexpected worktree location; cleanup refused.');
      git(job.workspace, ['worktree', 'remove', '--force', job.worktree]);
    }
    fs.rmSync(dir, { recursive: true });
    return { id, removed: true, claudeHistoryRemoved: false };
  } finally { fs.rmSync(lock, { recursive: true, force: true }); }
}
