#!/usr/bin/env node
// check.mjs: one short check after an install, against the real link.
//   node server/check.mjs https://<your host>/<token>/mcp <system agent name>
// It connects, lists the tools, calls start, saves one line in the agent's own working record
// (agents/<name>/data/install-check.md), reads it back and finds it. It changes nothing else.
const [url, agentArg] = process.argv.slice(2);
if (!url || !agentArg) { console.error('Usage: node server/check.mjs <MCP link> <system agent name>'); process.exit(1); }
const agent = agentArg.toLowerCase();
let id = 0;
async function rpc(method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}
const text = (r) => r.content.map((c) => c.text).join('\n');
const results = [];
const step = async (name, fn) => {
  try { const note = await fn(); results.push(`ok    ${name}${note ? ` (${note})` : ''}`); }
  catch (e) { results.push(`FAIL  ${name}: ${e.message}`); console.log(results.join('\n')); process.exit(1); }
};

await step('connect', async () => (await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'contextcore-check', version: '1' } })).serverInfo.name);
await step('tools', async () => {
  const names = (await rpc('tools/list', {})).tools.map((t) => t.name).sort().join(', ');
  if (names !== 'run, start, whats_new') throw new Error(`got ${names}`);
  return names;
});
let asOf;
await step('start', async () => {
  const r = await rpc('tools/call', { name: 'start', arguments: { agent } });
  const data = JSON.parse(r.content[r.content.length - 1].text);
  if (!data.as_of) throw new Error(`no as_of; the answer: ${text(r).slice(0, 200)}`);
  if (!(data.rights || []).length && !JSON.stringify(data).includes('system')) throw new Error('the agent has no rights; is it the first agent from init?');
  asOf = data.as_of;
  return `rules ${r.content[0].text.length} characters`;
});
const stamp = new Date().toISOString();
const run = async (code, op) => {
  const r = await rpc('tools/call', { name: 'run', arguments: { agent, code, op_id: `${asOf}-check-${op}` } });
  const out = JSON.parse(text(r));
  if (out.code) throw new Error(`${out.code}: ${out.message}`);
  return out.result ?? out;
};
await step('save', async () => {
  await run(`const p = "agents/${agent}/data/install-check.md";
let v; try { v = (await nm.read(p)).version; } catch {}
return await nm.write(p, { text: "# Install checks\\n- ${stamp}: the check after install saved this line.\\n" }, v);`, 'save');
});
await step('read back', async () => {
  const r = await run(`return (await nm.read("agents/${agent}/data/install-check.md")).text;`, 'read');
  if (!String(r).includes(stamp)) throw new Error('the saved line is not there');
});
await step('find', async () => {
  const r = await run(`return await nm.find({ query: "install checks", in: "agents" });`, 'find');
  if (!(r.items || []).some((i) => i.path.endsWith('install-check.md'))) throw new Error('search did not find the saved file');
  return `${r.total} hit(s)`;
});
console.log(results.join('\n') + '\nAll good: ContextCore works through this link.');
