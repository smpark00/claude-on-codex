import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { releaseFiles } from './lib/distribution.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const json = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const plugin = json('plugins/claude-on-codex/plugin.json');
const marketplace = json('.agents/plugins/marketplace.json');
assert.equal(plugin.name, 'claude-on-codex');
assert.equal(plugin.version, json('package.json').version);
assert.equal(plugin.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
assert.equal(plugin.extensions['com.openai'].requires_local_executor, true);
assert.equal(marketplace.plugins[0].name, plugin.name);
assert.equal(path.resolve(root, marketplace.plugins[0].source.path), path.join(root, 'plugins/claude-on-codex'));
assert.ok(fs.existsSync(path.join(root, 'plugins/claude-on-codex', plugin.extensions['com.openai'].onboardingSkill)));
for (const skill of ['delegate', 'setup']) {
  const text = fs.readFileSync(path.join(root, 'plugins/claude-on-codex/skills', skill, 'SKILL.md'), 'utf8');
  assert.match(text, /^---\nname: [a-z-]+\ndescription: .+\n---\n/);
  assert.ok(fs.existsSync(path.join(root, 'plugins/claude-on-codex/skills', skill, '../../scripts/companion.mjs')));
}
let checked = 0;
for (const file of releaseFiles(root).filter(file => file.endsWith('.mjs'))) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' }); checked++;
}
console.log(`Manifest paths, skill discovery, package versions, and syntax of ${checked} JavaScript files validated. This is not vendor approval or full upstream schema validation.`);
