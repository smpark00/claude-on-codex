import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { git } from '../plugins/claude-on-codex/scripts/lib/git.mjs';
import { digest } from '../plugins/claude-on-codex/scripts/lib/core.mjs';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../plugins/claude-on-codex/scripts/companion.mjs', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/claude.mjs', import.meta.url));
fs.chmodSync(fixture, 0o755);
async function waitForWorkerExit(pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0, 'Expected a worker PID');
  const deadline = Date.now() + 5000;
  while (true) {
    try { process.kill(pid, 0); }
    catch (error) { if (error.code === 'ESRCH') return; throw error; }
    assert.ok(Date.now() < deadline, `Worker ${pid} did not exit before fixture cleanup`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
function context(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'claude-on-codex-test-')));
  const workspace = path.join(root, 'workspace'), home = path.join(root, 'private-state');
  fs.mkdirSync(workspace);
  const env = { ...process.env, CLAUDE_ON_CODEX_HOME: home, CLAUDE_ON_CODEX_CLI: fixture, CODEX_THREAD_ID: 'thread-a', MOCK_PRIVATE_SECRET: 'not-for-child' };
  delete env.CLAUDE_ON_CODEX_DEPTH;
  const workerPids = new Set();
  t.after(async () => {
    // Terminal job state can precede the worker's final diagnostic write.
    await Promise.all([...workerPids].map(waitForWorkerExit));
    fs.rmSync(root, { recursive: true, force: true });
  });
  async function invoke(command, options = [], acceptFailure = false, extraEnv = {}) {
    let result;
    try { result = await exec(process.execPath, [cli, command, ...options], { env: { ...env, ...extraEnv }, timeout: 20000 }); }
    catch (error) { if (!acceptFailure) throw error; result = error; }
    return JSON.parse(result.stdout || result.stderr);
  }
  async function start(request, acceptFailure = false) {
    const file = path.join(root, `${randomUUID()}.json`);
    fs.writeFileSync(file, JSON.stringify({ workspace, ...request }));
    const result = await invoke('start', ['--request', file], acceptFailure);
    if (result.workerPid) workerPids.add(result.workerPid);
    return result;
  }
  const query = (command, job, acceptFailure = false, extraEnv) => invoke(command, ['--workspace', workspace, '--job', job.id], acceptFailure, extraEnv);
  const jobDir = id => path.join(home, digest(workspace).slice(0, 24), id);
  function init() {
    git(workspace, ['init', '-b', 'main']);
    git(workspace, ['config', 'user.name', 'Test']); git(workspace, ['config', 'user.email', 'test@example.invalid']);
    fs.writeFileSync(path.join(workspace, 'source.txt'), 'base\n');
    fs.writeFileSync(path.join(workspace, '.gitignore'), 'ignored.txt\n');
    git(workspace, ['add', '.']); git(workspace, ['commit', '-m', 'base']);
  }
  return { root, workspace, home, env, invoke, start, query, jobDir, init };
}
test('doctor filters account details and never calls inference', async t => {
  const c = context(t), result = await c.invoke('doctor');
  assert.equal(result.ready, true); assert.equal(result.authMethod, 'mock');
  assert.equal(result.authStatus, 'authenticated');
  assert.doesNotMatch(JSON.stringify(result), /never-expose/);
});
test('advice uses constrained official CLI, sanitized environment, private state, and resumes', async t => {
  const c = context(t);
  const result = await c.start({ prompt: 'TEST:ARGS', background: false });
  assert.equal(result.status, 'completed');
  assert.equal(result.requestedModel, null);
  assert.deepEqual(result.models, ['claude-fixture-primary', 'claude-fixture-secondary']);
  const payload = JSON.parse(result.result);
  assert.equal(payload.secret, null);
  for (const flag of ['--safe-mode', '--restricted', '--strict-mcp-config']) assert.ok(payload.args.includes(flag));
  assert.equal(payload.args[payload.args.indexOf('--tools') + 1], 'Read,Glob,Grep');
  assert.ok(!payload.args.includes('--dangerously-skip-permissions'));
  assert.equal(fs.statSync(path.join(c.jobDir(result.id), 'request.json')).mode & 0o777, 0o600);
  const resumed = await c.start({ prompt: 'Continue', resumeJobId: result.id, background: false });
  assert.equal(resumed.status, 'completed'); assert.equal(resumed.sessionId, result.sessionId);
  const foreign = await c.query('status', result, true, { CODEX_THREAD_ID: 'thread-b' });
  assert.match(foreign.error, /different Codex thread/);
});
test('review sends every change and receives structured output', async t => {
  const c = context(t); c.init();
  fs.writeFileSync(path.join(c.workspace, 'source.txt'), 'staged-body\n'); git(c.workspace, ['add', '.']);
  fs.appendFileSync(path.join(c.workspace, 'source.txt'), 'unstaged-body\n');
  fs.writeFileSync(path.join(c.workspace, 'new.txt'), 'untracked-body\n');
  const result = await c.start({ mode: 'review', adversarial: true, background: false });
  assert.equal(result.status, 'completed'); assert.deepEqual(result.result.findings, []);
  assert.equal(result.review.complete, true);
  const request = JSON.parse(fs.readFileSync(path.join(c.jobDir(result.id), 'request.json')));
  for (const text of ['staged-body', 'unstaged-body', 'untracked-body', 'adversarial']) assert.ok(request.prompt.includes(text));
});
test('provider failures, malformed JSON, max turns, and output overflow never become success', async t => {
  const c = context(t);
  for (const prompt of ['TEST:EXIT', 'TEST:INVALID', 'TEST:MAXTURNS', 'TEST:OVERFLOW']) {
    const result = await c.start({ prompt, background: false }, true);
    assert.equal(result.status, 'failed', JSON.stringify(result));
  }
});
test('timeout stops the process and is recorded as timed_out', async t => {
  const c = context(t);
  const result = await c.start({ prompt: 'TEST:SLOW', timeoutMs: 200, background: false }, true);
  assert.equal(result.status, 'timed_out');
  assert.throws(() => process.kill(result.claudePid, 0), { code: 'ESRCH' });
});
test('cancellation waits for SIGTERM-resistant process and child process to terminate', async t => {
  const c = context(t);
  const started = await c.start({ prompt: 'TEST:SLOW TEST:CHILD' });
  for (let i = 0; i < 100 && !fs.existsSync(path.join(c.workspace, 'child-pid.txt')); i++) await new Promise(r => setTimeout(r, 20));
  const childPid = Number(fs.readFileSync(path.join(c.workspace, 'child-pid.txt'), 'utf8'));
  const result = await c.query('cancel', started, true);
  assert.equal(result.status, 'cancelled'); assert.equal(result.cancellationConfirmed, true);
  assert.throws(() => process.kill(result.claudePid, 0), { code: 'ESRCH' });
  assert.throws(() => process.kill(childPid, 0), { code: 'ESRCH' });
});
test('lost worker is interrupted and cancellation is never falsely confirmed', async t => {
  const c = context(t), id = randomUUID(), dir = c.jobDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const deadPid = Number(execFileSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' }).trim());
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({ id, workspace: c.workspace, threadId: 'thread-a', status: 'running', workerPid: deadPid }));
  const result = await c.query('cancel', { id }, true);
  assert.equal(result.status, 'interrupted'); assert.equal(result.cancellationConfirmed, false);
});
test('edit leaves original files untouched and returns a valid patch', async t => {
  const c = context(t); c.init();
  git(c.workspace, ['config', 'color.ui', 'always']);
  git(c.workspace, ['config', 'diff.noprefix', 'true']);
  const result = await c.start({ mode: 'edit', prompt: 'TEST:EDIT', allowedPaths: ['source.txt', 'new.txt'], background: false });
  assert.equal(result.status, 'completed'); assert.equal(result.changedFiles.length, 2);
  assert.equal(result.patchVerified, true);
  assert.equal(fs.readFileSync(path.join(c.workspace, 'source.txt'), 'utf8'), 'base\n');
  assert.equal(fs.existsSync(path.join(c.workspace, 'new.txt')), false);
  git(c.workspace, ['apply', '--check', result.patchPath]);
});
test('out-of-scope edit fails, preserving worktree for inspection', async t => {
  const c = context(t); c.init();
  for (const prompt of ['TEST:ESCAPE', 'TEST:IGNORED']) {
    const result = await c.start({ mode: 'edit', prompt, allowedPaths: ['source.txt'], background: false }, true);
    assert.equal(result.status, 'failed'); assert.match(result.error, /escaped requested path scope/);
    assert.ok(fs.existsSync(result.worktree));
    assert.equal(git(c.workspace, ['status', '--porcelain']).trim(), '');
  }
});
test('malformed and recursive requests fail before calling Claude', async t => {
  const c = context(t);
  for (const request of [{ prompt: 'x', surprise: true }, { prompt: 'x', mode: 'edit', allowedPaths: ['../escape'] }, { prompt: 'x', model: '--help' }]) {
    const result = await c.start(request, true); assert.ok(result.error);
  }
  const file = path.join(c.root, 'recursive.json'); fs.writeFileSync(file, JSON.stringify({ workspace: c.workspace, prompt: 'x' }));
  const result = await c.invoke('start', ['--request', file], true, { CLAUDE_ON_CODEX_DEPTH: '1' });
  assert.match(result.error, /Recursive/);
});
test('concurrent jobs preserve independent state and result identities', async t => {
  const c = context(t);
  const jobs = await Promise.all(Array.from({ length: 4 }, (_, i) => c.start({ prompt: `Independent request ${i}`, background: false })));
  assert.equal(new Set(jobs.map(j => j.id)).size, 4);
  assert.equal(new Set(jobs.map(j => j.sessionId)).size, 4);
  for (const job of jobs) {
    assert.equal(job.status, 'completed');
    assert.equal((await c.query('result', job)).id, job.id);
  }
});
test('concurrent resume of the same session is rejected until cancellation completes', async t => {
  const c = context(t);
  const first = await c.start({ prompt: 'Initial advice', background: false });
  const resumed = await c.start({ prompt: 'TEST:SLOW', resumeJobId: first.id });
  const collision = await c.start({ prompt: 'Another resume', resumeJobId: first.id }, true);
  assert.match(collision.error, /session is busy/);
  const cancelled = await c.query('cancel', resumed, true);
  assert.equal(cancelled.cancellationConfirmed, true);
});
test('large Korean requests preserve UTF-8 across file stream boundaries', async t => {
  const c = context(t), prompt = '가'.repeat(30000);
  const result = await c.start({ prompt, background: false });
  const saved = JSON.parse(fs.readFileSync(path.join(c.jobDir(result.id), 'request.json'), 'utf8'));
  assert.equal(saved.request.prompt, prompt);
});

test('doctor distinguishes logged-out, unavailable, malformed, and missing CLI without leaking output', async t => {
  const c = context(t);
  for (const [body, expectedStatus, expectedCode] of [
    ['console.log(JSON.stringify({loggedIn:false,email:"never-expose"}));process.exit(1)', 'unauthenticated', null],
    ['console.error("never-expose access denied");process.exit(77)', 'unavailable', 'COMMAND_FAILED'],
    ['console.log("never-expose invalid json")', 'unavailable', 'INVALID_RESPONSE']
  ]) {
    const stub = path.join(c.root, 'claude-auth.mjs');
    fs.writeFileSync(stub, `#!/usr/bin/env node\nif(process.argv[2]==='auth'){${body};process.exit(0)}\nawait import(${JSON.stringify(new URL(`file://${fixture}`).href)});\n`, { mode: 0o755 });
    const result = await c.invoke('doctor', [], true, { CLAUDE_ON_CODEX_CLI: stub });
    assert.equal(result.ready, false); assert.equal(result.authStatus, expectedStatus);
    assert.equal(result.loggedIn, expectedStatus === 'unauthenticated' ? false : null);
    assert.equal(result.diagnostics.find(d => d.check === 'authentication')?.code || null, expectedCode);
    assert.doesNotMatch(JSON.stringify(result), /never-expose|access denied/);
  }
  const missing = await c.invoke('doctor', [], true, { CLAUDE_ON_CODEX_CLI: path.join(c.root, 'missing') });
  assert.equal(missing.authStatus, 'unavailable');
  assert.equal(missing.diagnostics[0].code, 'ENOENT');
});

test('list reports metadata only and respects the current thread', async t => {
  const c = context(t);
  const job = await c.start({ prompt: 'Private request', model: 'fixture-alias', background: false });
  const listed = await c.invoke('list', ['--workspace', c.workspace]);
  assert.equal(listed.jobs[0].id, job.id);
  assert.equal(listed.jobs[0].requestedModel, 'fixture-alias');
  assert.doesNotMatch(JSON.stringify(listed), /Private request|Fixture completed/);
  const foreign = await c.invoke('list', ['--workspace', c.workspace], false, { CODEX_THREAD_ID: 'other-thread' });
  assert.deepEqual(foreign.jobs, []);
});

test('cleanup requires explicit discard, refuses active jobs, and removes a finished worktree', async t => {
  const c = context(t); c.init();
  const active = await c.start({ prompt: 'TEST:SLOW' });
  const activeResult = await c.invoke('cleanup', ['--workspace', c.workspace, '--job', active.id, '--discard', 'true'], true);
  assert.match(activeResult.error, /finished job/);
  await c.query('cancel', active, true);
  const edited = await c.start({ mode: 'edit', prompt: 'TEST:EDIT', allowedPaths: ['source.txt', 'new.txt'], background: false });
  const refused = await c.query('cleanup', edited, true);
  assert.match(refused.error, /--discard true/);
  await waitForWorkerExit(edited.workerPid);
  const cleaned = await c.invoke('cleanup', ['--workspace', c.workspace, '--job', edited.id, '--discard', 'true']);
  assert.equal(cleaned.removed, true); assert.equal(cleaned.claudeHistoryRemoved, false);
  assert.equal(fs.existsSync(c.jobDir(edited.id)), false);
  assert.doesNotMatch(git(c.workspace, ['worktree', 'list', '--porcelain']), new RegExp(edited.id));
  assert.equal(fs.readFileSync(path.join(c.workspace, 'source.txt'), 'utf8'), 'base\n');
});

test('cleanup preserves interrupted jobs and rejects a resumed session lock', async t => {
  const c = context(t);
  const first = await c.start({ prompt: 'Initial advice', background: false });
  const resumed = await c.start({ prompt: 'TEST:SLOW', resumeJobId: first.id });
  const busy = await c.invoke('cleanup', ['--workspace', c.workspace, '--job', first.id, '--discard', 'true'], true);
  assert.match(busy.error, /active or has a stale lock/);
  assert.equal(fs.existsSync(c.jobDir(first.id)), true);
  await c.query('cancel', resumed, true);
  const id = randomUUID(), dir = c.jobDir(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({ id, workspace: c.workspace, threadId: 'thread-a', status: 'interrupted' }));
  const interrupted = await c.invoke('cleanup', ['--workspace', c.workspace, '--job', id, '--discard', 'true'], true);
  assert.match(interrupted.error, /interrupted jobs need manual inspection/);
  assert.equal(fs.existsSync(dir), true);
});
