import fs from 'node:fs';
import path from 'node:path';

export function releaseFiles(root) {
  const files = JSON.parse(fs.readFileSync(path.join(root, 'release-files.json'), 'utf8'));
  if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length) throw new Error('Release inventory must be a nonempty, unique file list.');
  for (const file of files) {
    if (typeof file !== 'string' || !file || path.posix.isAbsolute(file) || /[\\\0\r\n]/.test(file) ||
        file.split('/').some(part => !part || part === '..' || part === '.' ||
          (part.startsWith('.') && !['.agents', '.github', '.githooks', '.gitignore'].includes(part))) ||
        /(^|\/)(node_modules|dist|coverage|ko)(\/|$)|\.(log|pem|key)$/i.test(file)) throw new Error(`Unsafe release inventory entry: ${file}`);
    let current = root;
    for (const component of file.split('/')) {
      current = path.join(current, component);
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Release inputs must not be symlinks: ${file}`);
    }
    if (!fs.lstatSync(current).isFile()) throw new Error(`Release input must be a regular file: ${file}`);
  }
  return files.sort();
}

export const isDocumentation = file => /\.(md|mdx|rst|txt)$/i.test(file) || file.startsWith('docs/');
export function checkDocument(file, text) {
  if (/\p{Script=Hangul}/u.test(file) || /\p{Script=Hangul}/u.test(text)) throw new Error(`Public documentation must be English; move Korean notes outside Git: ${file}`);
  if (/(?:\/Users\/|\/home\/)[a-zA-Z0-9._-]+\//.test(text)) throw new Error(`Public documentation contains a machine-specific home path: ${file}`);
  if (/\.mdx?$/i.test(file) && !/^#\s+\S/m.test(text.replace(/^---\n[\s\S]*?\n---\n/, ''))) throw new Error(`Markdown needs a top-level heading: ${file}`);
}
