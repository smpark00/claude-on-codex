import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, collectReview, collectPatch, prepareWorktree } from '../plugins/claude-on-codex/scripts/lib/git.mjs';

function repo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-on-codex-git-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, ['init', '-b', 'main']);
  git(dir, ['config', 'user.name', 'Test']); git(dir, ['config', 'user.email', 'test@example.invalid']);
  fs.writeFileSync(path.join(dir, 'source.txt'), 'base\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'ignored.txt\n');
  git(dir, ['add', '.']); git(dir, ['commit', '-m', 'base']);
  return fs.realpathSync(dir);
}
test('working review includes staged, unstaged, and full untracked contents', t => {
  const dir = repo(t);
  fs.writeFileSync(path.join(dir, 'source.txt'), 'base\nstaged-marker\n'); git(dir, ['add', 'source.txt']);
  fs.appendFileSync(path.join(dir, 'source.txt'), 'unstaged-marker\n');
  fs.writeFileSync(path.join(dir, 'new file $(touch nope).txt'), 'untracked-body-marker\n');
  const snapshot = collectReview(dir);
  for (const value of ['+staged-marker', '+unstaged-marker', 'untracked-body-marker']) assert.ok(snapshot.content.includes(value));
  assert.equal(snapshot.complete, true); assert.equal(snapshot.files.length, 2);
  assert.equal(fs.existsSync(path.join(dir, 'nope')), false);
});
test('branch review compares actual merge-base revision range, excluding uncommitted changes', t => {
  const dir = repo(t);
  git(dir, ['checkout', '-b', 'feature']);
  fs.writeFileSync(path.join(dir, 'source.txt'), 'branch-marker\n'); git(dir, ['add', '.']); git(dir, ['commit', '-m', 'feature']);
  fs.writeFileSync(path.join(dir, 'source.txt'), 'dirty-marker\n');
  const snapshot = collectReview(dir, 'main');
  assert.match(snapshot.content, /\+branch-marker/); assert.doesNotMatch(snapshot.content, /dirty-marker/);
  assert.equal(snapshot.target.kind, 'branch'); assert.notEqual(snapshot.target.head, snapshot.target.mergeBase);
  assert.throws(() => collectReview(dir, '--help'), /Command failed/);
});
test('empty, binary, excessive, and external symlink review input fail closed', t => {
  const dir = repo(t);
  assert.throws(() => collectReview(dir), /No changes/);
  fs.writeFileSync(path.join(dir, 'binary'), Buffer.from([0, 1, 2]));
  assert.throws(() => collectReview(dir), /Binary/); fs.unlinkSync(path.join(dir, 'binary'));
  fs.writeFileSync(path.join(dir, 'large'), 'a'.repeat(129 * 1024));
  assert.throws(() => collectReview(dir), /small regular file/); fs.unlinkSync(path.join(dir, 'large'));
  fs.symlinkSync('/etc/hosts', path.join(dir, 'external'));
  assert.throws(() => collectReview(dir), /escapes workspace/);
});
test('isolated edits produce an applicable patch, including new files', t => {
  const dir = repo(t), destination = path.join(path.dirname(dir), `${path.basename(dir)}-worktree`);
  t.after(() => fs.rmSync(destination, { recursive: true, force: true }));
  const { baseHead } = prepareWorktree(dir, destination);
  fs.writeFileSync(path.join(destination, 'source.txt'), 'modified\n');
  fs.writeFileSync(path.join(destination, 'new file.txt'), 'new\n');
  const result = collectPatch(destination, baseHead, ['source.txt', 'new file.txt']);
  assert.equal(fs.readFileSync(path.join(dir, 'source.txt'), 'utf8'), 'base\n');
  git(dir, ['apply', '--check', '-'], { input: result.patch });
  assert.equal(result.files.length, 2);
  assert.throws(() => collectPatch(destination, baseHead, ['source.txt']), /escaped requested path scope/);
});
test('ignored files created by an edit cannot bypass scope checks', t => {
  const dir = repo(t), destination = `${dir}-ignored-worktree`;
  t.after(() => fs.rmSync(destination, { recursive: true, force: true }));
  const { baseHead } = prepareWorktree(dir, destination);
  fs.writeFileSync(path.join(destination, 'ignored.txt'), 'unexpected');
  assert.throws(() => collectPatch(destination, baseHead, ['source.txt']), /escaped requested path scope/);
});
test('edit refuses dirty original repository', t => {
  const dir = repo(t);
  fs.writeFileSync(path.join(dir, 'new.txt'), 'dirty');
  assert.throws(() => prepareWorktree(dir, `${dir}-dirty`), /clean working tree/);
});
test('literal binary/submodule markers in source are reviewable, actual binary diffs fail', t => {
  const dir = repo(t);
  fs.writeFileSync(path.join(dir, 'source.txt'), 'GIT binary patch\nSubproject commit\n');
  fs.writeFileSync(path.join(dir, 'documentation.txt'), 'GIT binary patch\nBinary files a and b differ\n');
  assert.equal(collectReview(dir).files.length, 2);
  fs.writeFileSync(path.join(dir, 'source.txt'), Buffer.from([0, 1, 2, 3]));
  assert.throws(() => collectReview(dir), /binary\/submodule/);
  git(dir, ['add', 'source.txt']);
  assert.throws(() => collectReview(dir), /binary\/submodule/);
});

test('patches override color and prefix configuration and leave real indexes untouched', t => {
  const dir = repo(t), destination = `${dir}-configured-worktree`;
  t.after(() => fs.rmSync(destination, { recursive: true, force: true }));
  for (const [key, value] of [['color.ui', 'always'], ['diff.noprefix', 'true'], ['diff.mnemonicPrefix', 'true'], ['diff.relative', 'true'], ['diff.outputIndicatorNew', '!'], ['diff.outputIndicatorOld', '?'], ['diff.outputIndicatorContext', '_']]) git(dir, ['config', key, value]);
  const { baseHead } = prepareWorktree(dir, destination);
  fs.writeFileSync(path.join(destination, 'source.txt'), 'modified\n');
  fs.writeFileSync(path.join(destination, 'new file.txt'), 'new\n');
  git(destination, ['add', 'source.txt']);
  const indexFile = git(destination, ['rev-parse', '--path-format=absolute', '--git-path', 'index']).trim();
  const indexBefore = fs.readFileSync(indexFile);
  const result = collectPatch(destination, baseHead, ['source.txt', 'new file.txt']);
  assert.equal(result.verified, true);
  assert.doesNotMatch(result.patch, /\u001b\[/);
  assert.match(result.patch, /diff --git a\/source.txt b\/source.txt/);
  git(dir, ['apply', '--check', '-'], { input: result.patch });
  assert.deepEqual(fs.readFileSync(indexFile), indexBefore);
  assert.equal(git(dir, ['status', '--porcelain']).trim(), '');
});

test('dangling edited symlinks are rejected and ordinary deletions remain applicable', t => {
  const dir = repo(t), destination = `${dir}-symlink-worktree`;
  t.after(() => fs.rmSync(destination, { recursive: true, force: true }));
  const { baseHead } = prepareWorktree(dir, destination);
  const file = path.join(destination, 'source.txt');
  fs.unlinkSync(file);
  for (const target of ['missing-inside.txt', path.join(dir, 'missing-outside.txt')]) {
    fs.symlinkSync(target, file);
    assert.throws(() => collectPatch(destination, baseHead, ['source.txt']), /Unsupported edited symlink/);
    fs.unlinkSync(file);
  }
  const deletion = collectPatch(destination, baseHead, ['source.txt']);
  assert.equal(deletion.verified, true);
  git(dir, ['apply', '--check', '-'], { input: deletion.patch });
});

function submoduleRepo(t) {
  const dir = repo(t), dependency = repo(t);
  git(dir, ['-c', 'protocol.file.allow=always', 'submodule', 'add', dependency, 'deps/library']);
  git(dir, ['config', '-f', '.gitmodules', 'submodule.deps/library.ignore', 'all']);
  git(dir, ['add', '.']); git(dir, ['commit', '-m', 'Add dependency']);
  git(dir, ['config', 'diff.ignoreSubmodules', 'all']);
  git(dir, ['config', 'submodule.deps/library.ignore', 'all']);
  return { dir, module: path.join(dir, 'deps/library') };
}

test('dirty tracked and untracked submodule files cannot hide behind ignore settings', t => {
  const { dir, module } = submoduleRepo(t);
  fs.writeFileSync(path.join(dir, 'source.txt'), 'visible change\n');
  fs.writeFileSync(path.join(module, 'source.txt'), 'hidden change\n');
  assert.throws(() => collectReview(dir), /[Ss]ubmodule/);
  git(module, ['checkout', '--', 'source.txt']);
  fs.writeFileSync(path.join(module, 'untracked.txt'), 'hidden untracked\n');
  assert.throws(() => collectReview(dir), /[Ss]ubmodule/);
  git(dir, ['checkout', '--', 'source.txt']);
  assert.throws(() => prepareWorktree(dir, `${dir}-unsafe`), /clean working tree/);
});

test('staged and committed submodule updates are rejected despite ignore settings', t => {
  const { dir, module } = submoduleRepo(t);
  const base = git(dir, ['rev-parse', 'HEAD']).trim();
  git(module, ['config', 'user.name', 'Test']); git(module, ['config', 'user.email', 'test@example.invalid']);
  fs.writeFileSync(path.join(module, 'source.txt'), 'dependency update\n');
  git(module, ['add', '.']); git(module, ['commit', '-m', 'Update dependency']);
  git(dir, ['add', 'deps/library']);
  assert.throws(() => collectReview(dir), /[Ss]ubmodule/);
  git(dir, ['commit', '-m', 'Update gitlink']);
  assert.throws(() => collectReview(dir, base), /[Ss]ubmodule/);
});

test('patch verification uses the recorded base even after the original checkout advances', t => {
  const dir = repo(t), destination = `${dir}-advanced-worktree`;
  t.after(() => fs.rmSync(destination, { recursive: true, force: true }));
  const { baseHead } = prepareWorktree(dir, destination);
  fs.writeFileSync(path.join(destination, 'source.txt'), 'worktree edit\n');
  fs.writeFileSync(path.join(dir, 'source.txt'), 'independent original change\n');
  git(dir, ['add', '.']); git(dir, ['commit', '-m', 'Advance original']);
  const result = collectPatch(destination, baseHead, ['source.txt']);
  assert.equal(result.verified, true);
  assert.throws(() => git(dir, ['apply', '--check', '-'], { input: result.patch, stdio: 'pipe' }));
  assert.equal(fs.readFileSync(path.join(dir, 'source.txt'), 'utf8'), 'independent original change\n');
});
