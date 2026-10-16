import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const packageVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-on-codex-install-'));
const env = { ...process.env, CODEX_HOME: temp };
const run = args => execFileSync('codex', args, { cwd: root, env, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
async function discoverSkills() {
  const server = spawn('codex', ['app-server', '--stdio'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  server.stderr.resume();
  const pending = new Map(); let nextId = 0;
  const lines = createInterface({ input: server.stdout });
  lines.on('line', line => {
    let message; try { message = JSON.parse(line); } catch { return; }
    if (message.id === undefined || !pending.has(message.id)) return;
    const { resolve, reject, timer } = pending.get(message.id); pending.delete(message.id); clearTimeout(timer);
    if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
  });
  server.on('error', error => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); } pending.clear(); });
  function call(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 20000);
      pending.set(id, { resolve, reject, timer });
      server.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }
  try {
    await call('initialize', { clientInfo: { name: 'claude-on-codex-install-smoke', version: packageVersion } });
    server.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`);
    return await call('skills/list', { cwds: [root], forceReload: true });
  } finally {
    lines.close(); server.stdin.end();
    const closed = new Promise(resolve => server.once('close', resolve));
    server.kill('SIGTERM'); await closed;
  }
}
try {
  const version = run(['--version']).trim();
  const marketplace = JSON.parse(run(['plugin', 'marketplace', 'add', root, '--json']));
  const installed = JSON.parse(run(['plugin', 'add', 'claude-on-codex@claude-on-codex', '--json']));
  const listed = run(['plugin', 'list', '--json']);
  if (!listed.includes('claude-on-codex')) throw new Error('Installed plugin is absent from list.');
  const fixture = path.join(root, 'tests/fixtures/claude.mjs'); fs.chmodSync(fixture, 0o755);
  const doctor = JSON.parse(execFileSync(process.execPath, [path.join(installed.installedPath, 'scripts/companion.mjs'), 'doctor'], {
    env: { ...env, CLAUDE_ON_CODEX_CLI: fixture }, encoding: 'utf8', timeout: 15000 }));
  if (!doctor.ready) throw new Error('Installed runtime failed fixture-based diagnostic.');
  const discovered = await discoverSkills();
  const skills = (discovered.data || []).flatMap(entry => entry.skills || []).filter(skill => String(skill.path).startsWith(installed.installedPath));
  if (!skills.some(skill => skill.name === 'claude-on-codex:delegate' && skill.enabled) || !skills.some(skill => skill.name === 'claude-on-codex:setup' && skill.enabled)) throw new Error(`Plugin skill discovery failed: ${JSON.stringify(skills.map(skill => ({ name: skill.name, enabled: skill.enabled })))}`);
  console.log(JSON.stringify({ version, isolated: true, marketplace, installed, list: JSON.parse(listed),
    installedRuntimeReady: doctor.ready, discoveredSkills: skills.map(skill => ({ name: skill.name, enabled: skill.enabled, path: skill.path })) }, null, 2));
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
