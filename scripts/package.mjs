import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkDocument, isDocumentation, releaseFiles } from './lib/distribution.mjs';

export function buildPackages(root) {
  const files = releaseFiles(root);
  for (const file of files.filter(isDocumentation)) checkDocument(file, fs.readFileSync(path.join(root, file), 'utf8'));
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version;
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Unsafe release version.');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-on-codex-package-'));
  const dist = path.join(root, 'dist'); fs.mkdirSync(dist, { recursive: true });
  try {
    const staging = path.join(temp, 'claude-on-codex'); fs.mkdirSync(staging);
    for (const name of files) {
      const destination = path.join(staging, name);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(root, name), destination);
      fs.chmodSync(destination, name.startsWith('.githooks/') || name === 'tests/fixtures/claude.mjs' ? 0o755 : 0o644);
      fs.utimesSync(destination, new Date(2000, 0, 1), new Date(2000, 0, 1));
    }
    const outputs = [];
    const prefix = 'plugins/claude-on-codex/';
    for (const artifact of [
      { name: `claude-on-codex-${version}.zip`, cwd: temp, entries: files.map(file => `claude-on-codex/${file}`) },
      { name: `claude-on-codex-plugin-${version}.zip`, cwd: path.join(staging, prefix), entries: files.filter(file => file.startsWith(prefix)).map(file => file.slice(prefix.length)) }
    ]) {
      const archive = path.join(dist, artifact.name);
      fs.rmSync(archive, { force: true });
      // Explicit files, no recursive directory copy or recursive ZIP traversal.
      execFileSync('zip', ['-X', '-q', archive, ...artifact.entries], { cwd: artifact.cwd });
      const sha256 = createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
      fs.writeFileSync(`${archive}.sha256`, `${sha256}  ${path.basename(archive)}\n`);
      outputs.push({ archive, sha256, bytes: fs.statSync(archive).size });
    }
    return outputs;
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(buildPackages(fileURLToPath(new URL('../', import.meta.url))), null, 2));
}
