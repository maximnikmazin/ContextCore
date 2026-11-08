# ContextCore

**One memory for all your AI agents, on your own server.**

Your agents in Claude, ChatGPT, coding tools and any app with remote MCP servers read and write one place: facts
about you, your rules, notes, tasks, projects and skills. Tell one agent something, and every agent knows it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/problem-dark.svg">
  <img alt="Today every app keeps its own memory; with ContextCore all apps read and save one memory on your server" src="docs/problem-light.svg" width="100%">
</picture>

## The problem

You now work with several AI agents: a chat app on the phone, another one on the laptop, a coding agent, a bot
for your language lessons. Each one keeps its own memory, so:

- **You repeat yourself.** Your timezone, your projects, how you like answers: told again in every app.
- **Rules drift apart.** You correct one agent; the others keep the old way.
- **Memory turns into a pile.** Apps save whatever looks useful. Nobody merges, dates or removes it, and after a
  few months an agent quotes a fact that stopped being true.
- **An agent's guess looks like your words.** A note you wrote and a line a bot made up come back with the same
  weight.
- **You can't move.** Switch apps, and your agent starts from zero.

ContextCore is the one place behind all of them. An agent is a name, not an app: start "planner" in any app, and
it has the same rules, memory and records.

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/turn-dark.svg">
  <img alt="One chat: you write, the agent calls start and gets its rules and memory, run reads and saves, the change becomes a git version" src="docs/turn-light.svg" width="100%">
</picture>

- **Three tools.** `start` gives the agent its rules, the facts about you, its memory, its rights and the time.
  `run` takes a short program (`nm.read / list / find / write / save_task`) that does all reading and saving in one
  step, in a sandbox with no network or files. `whats_new` shows what other agents changed.
- **Plain files.** Everything is Markdown and YAML in a git repo on your server. Every change is a version; you can
  read, move or back up your memory without ContextCore.
- **The agent decides, the server guards.** Rules tell agents what goes where. The server checks rights and
  formats, and a refused save is never half-done.

## What is inside

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/inside-dark.svg">
  <img alt="Three spaces with different weight: your notes, agents' records, projects; and the rules every agent reads at start" src="docs/inside-light.svg" width="100%">
</picture>

Three spaces, and an agent always knows which one a thing came from. Your own notes weigh most. An agent's memory
and logs are useful, but never your words. Project material counts only for its project. Around them sit the rules
every agent reads at start: about you, the shared rules, the agent's own rules, skills for each kind of work, and
rights (which agents may write notes, tasks or rules).

## It stays tidy

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/tidy-dark.svg">
  <img alt="Agents save freely; a review agent reads what changed and proposes one short list; nothing changes before you say yes" src="docs/tidy-light.svg" width="100%">
</picture>

Agents don't need to be careful about what they save. One agent with the system right runs reviews: daily for what
agents put in memory (duplicates, outdated facts, a fact several agents need), weekly for agents' files and project
cards, and weekly for the notes (links, hub notes for big topics, duplicates, new note types). You get one short
list and answer once. History, like your past plans or lessons, is never removed.

## How it differs from other approaches

**Built-in app memory** (the memory of a chat app). Easy, and it works inside one app. It stays there: other apps
can't read it, you can't see or fix it as a whole, and nothing cleans it. ContextCore moves each app's memory in
at setup, and from then on the app keeps one line that points to ContextCore.

**Rules files** (CLAUDE.md, AGENTS.md, custom instructions). Clear and versioned, but one per tool or project,
copied by hand, and an agent can't save what it learns into them safely. In ContextCore the rules live in one
place, each agent reads only the rules of its own job and rights, and changes to shared rules wait for your yes.

**Vector memory services** (they extract snippets from chats and return similar ones). Good at recall, but the
memory is a cloud of fragments: no clear place for a rule, a task or a project, no idea which fragment is your word
and which is a model's guess, and usually someone else's server. ContextCore stores whole, readable files in
places you know, says where each item came from and when, and runs on your own server.

**A notes vault with an MCP server** (a folder of Markdown files that agents can read). Your files and your
structure, but every agent invents its own way to write there, so the vault slowly turns into a mix of styles,
duplicates and orphan notes. ContextCore gives every agent the same rules for where things go, types for notes,
dates and sources on facts, and a review that keeps it in order.

**ContextCore** is for a person who works with several agents across apps and wants one memory that they own, can
read, and that doesn't rot. It is not a team knowledge base and not a vector search engine.

## Install

Give your AI agent (one that can use a terminal and SSH, for example Claude Code) the link to this repo and say:

> Install ContextCore for me on my server. Follow INSTALL.md.

The agent asks you a few things (your server, an address, a name for your main agent), installs and checks the
server, connects your apps, and then helps you move in what you already have: each app's memory, your notes and
your projects.

## What is in this repo

- `server/`: the MCP server (three tools: start, whats_new, run) and a read-only page for your phone.
- `core/`: the rules engine: rights, formats, search, and the tool texts agents see.
- `seed/`: the starting store: shared rules, note types, task values and the skills the memory works by.
- `deploy/`: systemd and Caddy templates, an optional off-site backup.
- `docs/`: the diagrams above.
- `INSTALL.md`: the install guide, written for the agent.

License: MIT.
