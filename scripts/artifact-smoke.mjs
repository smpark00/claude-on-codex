import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPackages } from './package.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-on-codex-artifact-'));
try {
  const [source, plugin] = buildPackages(root);
  execFileSync('unzip', ['-q', source.archive, '-d', temp]);
  const extracted = path.join(temp, 'claude-on-codex');
  const standalone = path.join(temp, 'standalone');
  execFileSync('unzip', ['-q', plugin.archive, '-d', standalone]);
  const fixture = path.join(extracted, 'tests/fixtures/claude.mjs');
  const doctor = JSON.parse(execFileSync(process.execPath, [path.join(standalone, 'scripts/companion.mjs'), 'doctor'], {
    env: { ...process.env, CLAUDE_ON_CODEX_CLI: fixture }, encoding: 'utf8', timeout: 20_000 }));
  assert.equal(doctor.ready, true);
  execFileSync(process.execPath, [path.join(extracted, 'scripts/install-smoke.mjs')], { cwd: extracted, stdio: 'pipe', timeout: 120_000 });
  console.log(JSON.stringify({ sourceArchiveInstallation: 'passed', standaloneRuntime: 'passed', inferenceRequests: 0 }, null, 2));
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
