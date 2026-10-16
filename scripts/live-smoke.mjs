import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { git } from '../plugins/claude-on-codex/scripts/lib/git.mjs';
// Explicitly invoked opt-in script: this makes real Claude requests and consumes account usage.
const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'claude-on-codex-live-')));
const cli = fileURLToPath(new URL('../plugins/claude-on-codex/scripts/companion.mjs', import.meta.url));
const workspace = path.join(temp, 'workspace'); fs.mkdirSync(workspace);
const env = { ...process.env, CLAUDE_ON_CODEX_HOME: path.join(temp, 'state') };
delete env.CLAUDE_ON_CODEX_DEPTH;
const mode = process.argv[2] || 'advise';
if (!['advise', 'review', 'edit'].includes(mode)) throw new Error('Use advise, review, or edit.');
const originalSource = 'export const add = (a, b) => a + b;\n';
let request = { workspace, mode, background: false, timeoutMs: 90000, maxTurns: 6,
  model: process.env.CLAUDE_ON_CODEX_SMOKE_MODEL || 'haiku', maxBudgetUsd: 0.2 };
if (mode === 'advise') request.prompt = 'Reply with exactly CLAUDE_ON_CODEX_OK. Do not use tools.';
else {
  git(workspace, ['init', '-b', 'main']);
  git(workspace, ['config', 'user.name', 'Smoke Test']); git(workspace, ['config', 'user.email', 'smoke@example.invalid']);
  fs.writeFileSync(path.join(workspace, 'add.mjs'), originalSource);
  git(workspace, ['add', '.']); git(workspace, ['commit', '-m', 'fixture']);
  if (mode === 'review') fs.writeFileSync(path.join(workspace, 'add.mjs'), 'export const add = (a, b) => a - b;\n');
  else { request.prompt = 'Change add.mjs to export const add = (a, b) => Number(a) + Number(b); Do not change any other files.'; request.allowedPaths = ['add.mjs']; }
}
const child = spawn(process.execPath, [cli, 'start'], { env, stdio: ['pipe', 'pipe', 'inherit'] });
let output = ''; child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { output += chunk; });
child.stdin.end(JSON.stringify(request));
const exit = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
if (exit !== 0) {
  console.error(output); console.error(`Failure artifacts preserved: ${temp}`); process.exitCode = 1;
} else {
  try {
    const result = JSON.parse(output);
    if (result.status !== 'completed') throw new Error(`Unexpected result: ${output}`);
    if (mode === 'advise') assert.equal(result.result.trim(), 'CLAUDE_ON_CODEX_OK', 'Unexpected smoke response.');
    if (mode === 'review') {
      assert.ok(result.result.findings.some(finding => finding.file === 'add.mjs' && finding.line === 1),
        'Review missed the deliberately broken add function.');
    }
    if (mode === 'edit') {
      assert.equal(fs.readFileSync(path.join(workspace, 'add.mjs'), 'utf8'), originalSource, 'Original file changed.');
      assert.deepEqual(result.changedFiles, ['add.mjs'], 'Unexpected files in edit patch.');
      if (!result.patchBytes) throw new Error('Expected a nonempty patch.');
      git(workspace, ['apply', '--check', result.patchPath]);
      // Apply and execute only this synthetic fixture in a separate temporary repository.
      const applied = path.join(temp, 'applied'); fs.mkdirSync(applied);
      git(applied, ['init', '-b', 'main']);
      fs.writeFileSync(path.join(applied, 'add.mjs'), originalSource);
      git(applied, ['apply', result.patchPath]);
      execFileSync(process.execPath, ['--input-type=module', '--eval', `
        import assert from 'node:assert/strict';
        import { add } from './add.mjs';
        for (const [a, b, expected] of [[2, 3, 5], ['2', '3', 5], [-2, 3, 1], ['1.5', '2.5', 4], [0, 0, 0]]) {
          assert.equal(add(a, b), expected);
        }
      `], { cwd: applied, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] });
    }
    console.log(JSON.stringify({ mode, status: result.status, result: result.result, numTurns: result.numTurns,
      costUsd: result.costUsd, requestedModel: result.requestedModel, models: result.models, patchVerified: result.patchVerified ?? null,
      patchBytes: result.patchBytes ?? null, originalUnchanged: mode === 'edit' ? true : null,
      bugDetected: mode === 'review' ? true : null, patchBehaviorVerified: mode === 'edit' ? true : null }, null, 2));
    fs.rmSync(temp, { recursive: true, force: true });
  } catch (error) {
    console.error(error.message); console.error(`Failure artifacts preserved: ${temp}`); process.exitCode = 1;
  }
}
