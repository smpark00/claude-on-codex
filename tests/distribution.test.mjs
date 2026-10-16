import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { buildPackages } from '../scripts/package.mjs';
import { releaseFiles } from '../scripts/lib/distribution.mjs';
import { checkDocs } from '../scripts/check-docs.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-on-codex-distribution-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function copyRelease(t) {
  const dir = temporary(t);
  for (const file of releaseFiles(root)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(dir, file));
  }
  return dir;
}

test('both archives contain exactly the release inventory and exclude ignored secret canaries', t => {
  const dir = copyRelease(t), canary = `SYNTHETIC_SECRET_${randomUUID()}`;
  for (const file of ['plugins/claude-on-codex/scripts/.env', 'plugins/claude-on-codex/scripts/unlisted-secret.json', '.local-notes/private.md']) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), canary);
  }
  const outputs = buildPackages(dir), inventory = releaseFiles(dir), prefix = 'plugins/claude-on-codex/';
  for (const [index, output] of outputs.entries()) {
    const names = execFileSync('unzip', ['-Z1', output.archive], { encoding: 'utf8' }).trim().split('\n').sort();
    const expected = index === 0 ? inventory.map(file => `claude-on-codex/${file}`) : inventory.filter(file => file.startsWith(prefix)).map(file => file.slice(prefix.length));
    assert.deepEqual(names, expected.sort());
    assert.equal(execFileSync('unzip', ['-p', output.archive], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }).includes(canary), false);
    assert.equal(createHash('sha256').update(fs.readFileSync(output.archive)).digest('hex'), output.sha256);
  }
});

test('release inventory rejects symlinks and secret file entries', t => {
  const dir = copyRelease(t), readme = path.join(dir, 'README.md');
  fs.unlinkSync(readme); fs.symlinkSync(path.join(root, 'README.md'), readme);
  assert.throws(() => buildPackages(dir), /symlinks/);
  fs.unlinkSync(readme); fs.copyFileSync(path.join(root, 'README.md'), readme);
  const inventory = releaseFiles(dir);
  fs.writeFileSync(path.join(dir, 'release-files.json'), JSON.stringify([...inventory, 'plugins/claude-on-codex/scripts/.env']));
  assert.throws(() => buildPackages(dir), /Unsafe release/);
});

test('document gate reads the index, not a changed working copy, and rejects forced local notes', t => {
  const dir = temporary(t);
  const git = args => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  git(['init']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# Documentation\n\n한국어 문서\n');
  git(['add', 'README.md']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# Documentation\n\nEnglish working copy.\n');
  assert.throws(() => checkDocs(dir, true), /must be English/);
  git(['add', 'README.md']);
  assert.equal(checkDocs(dir, true), 1);
  fs.mkdirSync(path.join(dir, '.local-notes'));
  fs.writeFileSync(path.join(dir, '.local-notes/private.md'), '# Private\n');
  git(['add', '-f', '.local-notes']);
  assert.throws(() => checkDocs(dir, true), /must not be staged/);
});
