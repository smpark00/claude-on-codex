#!/usr/bin/env node
import fs from 'node:fs';
import { doctor } from './lib/claude.mjs';
import { getJob, MAX_INPUT, TERMINAL } from './lib/core.mjs';
import { cancel, runWorker, start, waitFor } from './lib/jobs.mjs';
import { cleanupJob, listJobs } from './lib/retention.mjs';

const [command = 'help', ...args] = process.argv.slice(2);
function options(values) {
  const result = {};
  if (values.length % 2) throw new Error('Options require --name value pairs.');
  for (let i = 0; i < values.length; i += 2) {
    if (!['--workspace', '--job', '--request', '--discard'].includes(values[i]) || result[values[i]]) throw new Error(`Invalid/duplicate option: ${values[i]}`);
    result[values[i]] = values[i + 1];
  }
  return result;
}
async function readRequest(file) {
  let data = '';
  const stream = file ? fs.createReadStream(file) : process.stdin;
  stream.setEncoding('utf8');
  for await (const chunk of stream) {
    data += chunk.toString('utf8');
    if (Buffer.byteLength(data) > MAX_INPUT) { stream.destroy(); throw new Error('Request exceeds 512 KiB.'); }
  }
  return JSON.parse(data);
}
try {
  if (command === '_worker') {
    if (args.length !== 1) throw new Error('Worker requires one private job directory.');
    await runWorker(args[0]);
  } else {
    const opts = options(args);
    let result;
    if (command === 'doctor') result = doctor();
    else if (command === 'start') result = await start(await readRequest(opts['--request']));
    else if (command === 'list') result = listJobs(opts['--workspace']);
    else if (command === 'cleanup') result = cleanupJob(opts['--workspace'], opts['--job'], opts['--discard']);
    else if (['status', 'result', 'cancel', 'wait'].includes(command)) {
      if (!opts['--workspace'] || !opts['--job']) throw new Error('Both --workspace and --job are required.');
      result = command === 'cancel' ? await cancel(opts['--workspace'], opts['--job'])
        : command === 'wait' ? await waitFor(opts['--workspace'], opts['--job']) : getJob(opts['--workspace'], opts['--job']).job;
      if (command === 'result' && !TERMINAL.has(result.status)) result = { id: result.id, status: result.status, ready: false };
    } else if (command === 'help') result = {
      commands: { doctor: 'Check official Claude CLI capabilities and login without inference.',
        start: 'Read JSON from stdin or --request FILE. Fields: workspace, mode (advise/review/edit), prompt, background, base, adversarial, allowedPaths, resumeJobId, model, effort, timeoutMs, maxTurns, maxBudgetUsd.',
        status: '--workspace ABSOLUTE_PATH --job UUID', result: '--workspace ABSOLUTE_PATH --job UUID',
        wait: '--workspace ABSOLUTE_PATH --job UUID', cancel: '--workspace ABSOLUTE_PATH --job UUID',
        list: '--workspace ABSOLUTE_PATH (current thread when present)',
        cleanup: '--workspace ABSOLUTE_PATH --job UUID --discard true (permanently deletes finished job data and worktree)' },
      limits: { platforms: ['darwin', 'linux'], promptBytes: 131072, combinedInputBytes: MAX_INPUT, outputBytes: 4194304, timeoutMs: 600000 },
      notice: 'Independent community plugin; not endorsed by OpenAI or Anthropic.' };
    else throw new Error(`Unknown command: ${command}`);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if ((TERMINAL.has(result.status) && result.status !== 'completed') || result.ready === false && command === 'doctor') process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = 1;
}
