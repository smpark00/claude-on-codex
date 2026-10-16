import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkDocument, isDocumentation, releaseFiles } from './lib/distribution.mjs';

export function checkDocs(root, staged = false) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  let files;
  if (staged) files = git(['ls-files', '--cached', '-z']).split('\0').filter(Boolean);
  else {
    files = releaseFiles(root);
    if (fs.existsSync(path.join(root, '.git'))) files.push(...git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean));
  }
  let count = 0;
  for (const file of new Set(files)) {
    if (/^(?:\.local-notes|docs\/ko)\//.test(file)) throw new Error(`Local notes must not be staged or distributed: ${file}`);
    if (!isDocumentation(file)) continue;
    const text = staged ? git(['show', `:${file}`]) : fs.readFileSync(path.join(root, file), 'utf8');
    checkDocument(file, text); count++;
  }
  return count;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`Checked ${checkDocs(process.cwd(), process.argv.includes('--staged'))} public documents (English policy and structure).`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
