#!/usr/bin/env node
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
const value = flag => args[args.indexOf(flag) + 1];
if (args.includes('--version')) { console.log('2.1.301 (mock Claude Code)'); process.exit(0); }
if (args.includes('--help')) { console.log('--restricted --safe-mode --permission-prompts --strict-mcp-config --json-schema'); process.exit(0); }
if (args[0] === 'auth') { console.log(JSON.stringify({ loggedIn: true, authMethod: 'mock', email: 'never-expose@example.invalid', accessToken: 'never-expose' })); process.exit(0); }
let prompt = '';
for await (const chunk of process.stdin) prompt += chunk.toString();
if (prompt.includes('TEST:EXIT')) { console.error('provider unavailable'); process.exit(7); }
if (prompt.includes('TEST:INVALID')) { console.log('not-json'); process.exit(0); }
if (prompt.includes('TEST:OVERFLOW')) { process.stdout.write('x'.repeat(5 * 1024 * 1024)); await new Promise(r => setTimeout(r, 10000)); }
if (prompt.includes('TEST:SLOW')) {
  process.on('SIGTERM', () => {});
  if (prompt.includes('TEST:CHILD')) {
    const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM",()=>{}); setInterval(()=>{},1000)'], { stdio: 'ignore' });
    fs.writeFileSync('child-pid.txt', String(child.pid));
  }
  await new Promise(r => setTimeout(r, 30000));
}
if (prompt.includes('TEST:EDIT')) {
  fs.writeFileSync('source.txt', 'edited by Claude fixture\n');
  fs.writeFileSync('new.txt', 'new file\n');
}
if (prompt.includes('TEST:ESCAPE')) fs.writeFileSync('outside.txt', 'out of scope\n');
if (prompt.includes('TEST:IGNORED')) fs.writeFileSync('ignored.txt', 'out of scope ignored\n');
const result = { type: 'result', subtype: prompt.includes('TEST:MAXTURNS') ? 'error_max_turns' : 'success',
  session_id: args.includes('--resume') ? value('--resume') : value('--session-id') || randomUUID(),
  result: prompt.includes('TEST:ARGS') ? JSON.stringify({ args, cwd: process.cwd(), secret: process.env.MOCK_PRIVATE_SECRET || null }) : 'Fixture completed.',
  num_turns: 1, total_cost_usd: 0, modelUsage: { 'claude-fixture-primary': { inputTokens: 10 }, 'claude-fixture-secondary': { inputTokens: 1 } } };
if (args.includes('--json-schema')) result.structured_output = { summary: 'Fixture review complete.', findings: [] };
console.log(JSON.stringify(result));
