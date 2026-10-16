import { spawnSync } from 'node:child_process';
import { childEnvironment, claudeBinary } from './core.mjs';

export const reviewSchema = {
  type: 'object', additionalProperties: false, required: ['summary', 'findings'],
  properties: {
    summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['severity', 'file', 'line', 'title', 'description'], properties: {
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        file: { type: 'string' }, line: { type: 'integer', minimum: 1 }, title: { type: 'string' }, description: { type: 'string' }
      } } }
  }
};
export function doctor() {
  const env = childEnvironment();
  const diagnostics = [];
  const probe = (command, args) => spawnSync(command, args, { env, encoding: 'utf8', timeout: 15_000,
    maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const failure = (check, result, fallback = 'COMMAND_FAILED') => diagnostics.push({ check,
    code: ['ENOENT', 'EACCES', 'EPERM', 'ETIMEDOUT', 'ENOBUFS'].includes(result.error?.code) ? result.error.code : fallback,
    exitCode: result.status, signal: result.signal || null });
  const versionResult = probe(claudeBinary(), ['--version']);
  const helpResult = probe(claudeBinary(), ['--help']);
  if (versionResult.error || versionResult.status !== 0) failure('claudeVersion', versionResult);
  if (helpResult.error || helpResult.status !== 0) failure('claudeCapabilities', helpResult);
  const version = versionResult.status === 0 ? versionResult.stdout.trim() : null;
  const help = helpResult.status === 0 ? helpResult.stdout : '';
  const requiredFlags = ['--restricted', '--safe-mode', '--permission-prompts', '--strict-mcp-config', '--json-schema'];
  const missingFlags = requiredFlags.filter(flag => !help.includes(flag));
  let loggedIn = null, authMethod = null, authStatus = 'unavailable';
  const authResult = probe(claudeBinary(), ['auth', 'status']);
  try {
    const auth = JSON.parse(authResult.stdout);
    // The CLI may use exit 1 with a valid logged-out response.
    if (authResult.error || typeof auth?.loggedIn !== 'boolean' ||
        (authResult.status !== 0 && !(authResult.status === 1 && auth.loggedIn === false))) throw new Error('Unavailable');
    loggedIn = auth.loggedIn;
    authStatus = loggedIn ? 'authenticated' : 'unauthenticated';
    authMethod = typeof auth.authMethod === 'string' && /^[a-zA-Z0-9._-]{1,40}$/.test(auth.authMethod) ? auth.authMethod : null;
  } catch { failure('authentication', authResult, authResult.status === 0 ? 'INVALID_RESPONSE' : 'COMMAND_FAILED'); }
  // Never echo authentication stdout/stderr: even an error can contain credentials.
  const gitResult = probe('git', ['--version']);
  if (gitResult.error || gitResult.status !== 0) failure('git', gitResult);
  const gitVersion = gitResult.status === 0 ? gitResult.stdout.trim() : null;
  const supportedRuntime = Number(process.versions.node.split('.')[0]) >= 22 && ['darwin', 'linux'].includes(process.platform);
  return { ready: diagnostics.length === 0 && missingFlags.length === 0 && loggedIn === true && supportedRuntime, node: process.version,
    platform: process.platform, supportedRuntime, claudeVersion: version, gitVersion, loggedIn, authStatus, authMethod, missingFlags, diagnostics,
    note: 'No model request was made. Authentication remains with the official Claude CLI.' };
}
export function argsFor(request, sessionId, resumeSessionId) {
  const tools = request.mode === 'review' ? '' : request.mode === 'edit' ? 'Read,Glob,Grep,Edit,Write' : 'Read,Glob,Grep';
  const args = ['-p', '--output-format', 'json', '--safe-mode', '--restricted', '--strict-mcp-config',
    '--mcp-config', '{"mcpServers":{}}', '--no-chrome', '--disable-slash-commands',
    '--tools', tools, '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--max-turns', String(request.maxTurns)];
  if (tools) args.push('--allowedTools', tools);
  if (resumeSessionId) args.push('--resume', resumeSessionId);
  else args.push('--session-id', sessionId);
  if (request.model) args.push('--model', request.model);
  if (request.effort) args.push('--effort', request.effort);
  if (request.maxBudgetUsd) args.push('--max-budget-usd', String(request.maxBudgetUsd));
  if (request.mode === 'review') args.push('--json-schema', JSON.stringify(reviewSchema));
  return args;
}
export function parseResult(raw, mode) {
  let envelope;
  try { envelope = JSON.parse(raw.trim()); } catch { throw new Error('Claude returned invalid JSON.'); }
  if (!envelope || envelope.type !== 'result' || envelope.is_error || envelope.subtype !== 'success') throw new Error(`Claude did not report success (${envelope?.subtype || 'missing result envelope'}).`);
  if (typeof envelope.session_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(envelope.session_id)) throw new Error('Claude result has no valid session ID.');
  let result = envelope.result;
  if (mode === 'review') {
    result = envelope.structured_output;
    if (!result && typeof envelope.result === 'string') {
      try { result = JSON.parse(envelope.result); } catch { throw new Error('Review did not contain structured JSON.'); }
    }
    if (!result || typeof result.summary !== 'string' || !Array.isArray(result.findings)) throw new Error('Invalid structured review.');
    for (const finding of result.findings) {
      if (!finding || !['critical', 'high', 'medium', 'low'].includes(finding.severity) || !Number.isInteger(finding.line) || finding.line < 1 || ['file', 'title', 'description'].some(k => typeof finding[k] !== 'string' || !finding[k].trim())) throw new Error('Invalid review finding.');
    }
  } else if (typeof result !== 'string') throw new Error('Claude result text is missing.');
  const models = envelope.modelUsage && typeof envelope.modelUsage === 'object' && !Array.isArray(envelope.modelUsage)
    ? Object.keys(envelope.modelUsage).filter(model => /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(model)) : [];
  return { result, sessionId: envelope.session_id, numTurns: envelope.num_turns ?? null, models,
    costUsd: Number.isFinite(envelope.total_cost_usd) ? envelope.total_cost_usd : null };
}
