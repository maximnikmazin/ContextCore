#!/usr/bin/env node
// init.mjs: makes a new, empty ContextCore store from seed/, with a secret link token and the first agent.
//   NM_STATE=/var/lib/contextcore/state node server/init.mjs --first-agent <name>
// The first agent gets every right (notes, tasks, notices, types, system): it is the owner's system agent,
// which sets up the rest. The store is a git repo: the server makes one version for every change.
// It never touches a store that already exists.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.resolve(process.env.NM_STATE || path.join(HERE, 'state'));
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const first = String(arg('--first-agent') || '').trim().toLowerCase();

if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(first)) {
  console.error('Give the first agent a name: --first-agent <name> (lowercase letters, digits, hyphens). It becomes the system agent.');
  process.exit(1);
}
if (fs.existsSync(path.join(STATE, '_server.json'))) {
  console.error(`A store already exists in ${STATE}. Nothing changed.`);
  process.exit(1);
}

fs.mkdirSync(STATE, { recursive: true });
fs.cpSync(path.join(HERE, '../seed'), STATE, { recursive: true });
for (const keep of ['brain', 'projects', 'agents', 'system/notices']) fs.rmSync(path.join(STATE, keep, '.gitkeep'), { force: true });

const now = new Date().toISOString();
fs.writeFileSync(path.join(STATE, '_server.json'), JSON.stringify({ now, search_down: false, changes: [], chats: {}, use_seen: {}, uses: {}, ops: {}, redirects: {} }, null, 1) + '\n');

const agentDir = path.join(STATE, 'agents', first);
fs.mkdirSync(agentDir, { recursive: true });
fs.writeFileSync(path.join(agentDir, 'agent.md'), `# ${first}\nThe owner's system agent: sets up ContextCore, the other agents and the owner's shared rules, and runs the reviews of what agents saved.\n`);
fs.writeFileSync(path.join(agentDir, 'memory.md'), `# ${first} memory\n`);
const acc = path.join(STATE, 'access.yaml');
fs.writeFileSync(acc, fs.readFileSync(acc, 'utf8').replace(/^(notes|tasks|notices|types|system): \[\]$/gm, `$1: [${first}]`));

const token = crypto.randomBytes(16).toString('hex');
fs.writeFileSync(path.join(STATE, 'token'), token + '\n', { mode: 0o600 });
fs.writeFileSync(path.join(STATE, '.gitignore'), ['token', 'reader-token', 'calls.jsonl', 'requests.jsonl', '_calls.jsonl', ''].join('\n'));

const git = (...a) => execFileSync('git', ['-C', STATE, ...a], { encoding: 'utf8' });
git('init', '-q', '-b', 'main');
git('add', '-A');
git('-c', 'user.name=ContextCore', '-c', 'user.email=server@contextcore.invalid', 'commit', '-q', '-m', `New store, system agent ${first}`);
git('config', 'user.name', 'ContextCore');
git('config', 'user.email', 'server@contextcore.invalid');

console.log(`Store ready in ${STATE}
System agent: ${first} (every right)
MCP path: /${token}/mcp
Keep the full link secret: anyone with it can read and change everything in the store.`);
