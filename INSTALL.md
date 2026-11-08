# Install ContextCore: a guide for the AI agent

You are an AI agent. A person (in this guide: **the owner**) gave you this repo and asked you to set ContextCore up
for them. Do the whole install yourself; ask the owner only what only they know or decide. Talk to the owner in
their language, in plain words, with no commands or paths unless they ask.

What the owner gets: one memory for all their AI agents, on their own server. Every agent (in Claude, ChatGPT, a
coding agent, any app that supports remote MCP servers) reads the same rules, facts about the owner, notes, tasks,
projects and skills, and saves there. Every change is a git version, so nothing is lost.

## 0. Ask the owner (one message)

- Server: a Linux server you can reach by SSH (Ubuntu or Debian; 1 GB RAM is enough). None → help them rent one.
- Address: a domain or subdomain pointing to the server, or none (then use `<server IP with dashes>.sslip.io`).
- The first agent's name: the owner's main, system agent (for example "assistant"). It gets every right and
  sets up everything else.
- Off-site backup to a private GitHub repo: yes or no (recommended: yes).

## 1. The server

As root:
```
apt-get update && apt-get install -y git curl build-essential python3 caddy
curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs   # Node 24 or newer
useradd --system --create-home --home-dir /opt/contextcore --shell /usr/sbin/nologin contextcore
git clone https://github.com/maximnikmazin/contextcore.git /opt/contextcore/code
cd /opt/contextcore/code && npm install --omit=dev
NM_STATE=/opt/contextcore/state node server/init.mjs --first-agent <name>
chown -R contextcore:contextcore /opt/contextcore
```
`init` prints the MCP path `/<token>/mcp`. The token is also in `/opt/contextcore/state/token`.
`isolated-vm` builds native code: if `npm install` fails, the build tools above are missing.

## 2. Run it

```
cp deploy/contextcore.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now contextcore
```
HTTPS: add the block from `deploy/Caddyfile.example` to `/etc/caddy/Caddyfile` with the owner's host, then
`systemctl reload caddy`. Caddy gets the certificate by itself (ports 80 and 443 must be open).

The link: `https://<host>/<token>/mcp`.

## 3. Check

```
node server/check.mjs https://<host>/<token>/mcp <name>
```
Every line must say `ok`. A `FAIL` names the step: fix it before you go on (`journalctl -u contextcore` shows
the server log).

## 4. Backup (if the owner said yes)

Make a private GitHub repo for the data, add a deploy key with write access (the private key in
`/opt/contextcore/.ssh/backup_key`, owned by contextcore), add the remote as `deploy/backup.sh` says, then:
```
cp deploy/backup.service deploy/backup.timer /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now backup.timer
```

## 5. Give the owner the link

Give the full link privately and say: it is a password. Anyone who has it can read and change everything. Never
put it in a public place. A new token: stop the service, write a new random hex string to `state/token`, start it.

The owner's read-only page for phones (tasks and notes): `https://<host>/r/<the key in state/reader-token>`.

## 6. Connect the owner's apps

The same link in each app the owner uses; no sign-in is needed (the link holds the secret). Menus change; look
for "custom connector", "MCP server" or "developer mode":
- Claude (web and desktop): Settings → Connectors → Add custom connector → the link.
- ChatGPT: Settings → Apps and connectors → Advanced → Developer mode on → Create → the link, no authentication.
- Claude Code: `claude mcp add --transport http contextcore <link>`.
- Cursor and other coding tools: an MCP server entry with `"url": "<link>"`.

## 7. Each agent's instruction in its app

Every agent is a name plus a job, for example "assistant: the owner's main helper" or "planner: keeps the owner's
tasks". For each agent, put the text of `app-instruction.md` into that app's instructions for it (Claude: a
project's instructions; ChatGPT: a project's or a custom GPT's instructions; a coding agent: its CLAUDE.md or
AGENTS.md), with `{name}` and `{job}` filled in. One app can hold several agents, one per project or bot.

Then the owner opens a new chat with that agent and says "create yourself". The agent calls start, gets "unknown
agent", and sets itself up with the skill contextcore-agent-1-setup: it writes its rules and memory, copies its
app's memory word for word, and moves its app's routines.

The first agent (from step 1) already exists: in its first chat it just calls start.

## 8. First chat with the system agent

Ask the owner, in one message, what every agent should know:
- About the owner: name, where they live, timezone, reply language, work, how they like answers. Save it to
  `user.md`, one line each, ending with the source and date ("owner, DD.MM"). The timezone line sets the time
  every agent sees; the reply-language line sets the language agents write in.
- Rights: which agents may write notes, tasks and notices (contextcore-system-1-rules).
- The routines, if the agent's app can run scheduled tasks: the daily review of what agents saved
  (contextcore-review-1-memory) and the two weekly reviews (contextcore-review-2-agents-and-projects,
  contextcore-review-3-brain). Set each up with contextcore-routine-1-create.

## 9. Move what the owner already has

- Each app's own memory: moved by each agent at its setup (step 7).
- Notes and knowledge kept elsewhere (a notes folder or vault, a notes app export, another memory server,
  documents): the skill contextcore-move-1-memory. The owner sees one short list before anything is written.
- Projects: each project the owner works on gets a card (contextcore-projects-1-new), so agents know it.

## Updating

```
cd /opt/contextcore/code && git pull && npm install --omit=dev && systemctl restart contextcore
```
The store (`/opt/contextcore/state`) is never touched by an update. New skills and shared rules in a new version
of `seed/` are not copied into an existing store: show the owner what changed and add what the owner wants.

## How it works, in short

- Three tools: `start` (an agent's rules, memory, rights and the time), `whats_new` (changes since a point in
  time), `run` (a small program with `nm.read / list / find / write / save_task` for every read and write; it runs
  in a sandbox with no network or files).
- The store is plain Markdown and YAML files in a git repo: `user.md` (About the owner), `agents.md` (shared
  rules), `access.yaml` (rights), `agents/<name>/` (each agent's rules, memory and records), `brain/` (notes),
  `projects/<id>/card.md`, `skills/`, `todo.json` (tasks), `system/dictionaries/` (note types, task values).
- The server checks rights and formats; the rules tell agents what to save where. The tool texts agents see
  are in `core/AGENT-VIEW.md`.
