# ContextCore

One memory for all your AI agents, on your own server.

Your agents in Claude, ChatGPT, coding tools and any app with remote MCP servers share one place: your rules,
facts about you, notes, tasks, projects and skills. Tell one agent something, and every agent knows it. Each
agent keeps its own job and memory; a review agent keeps it all tidy and asks you before it changes anything.
Every change is a git version, so nothing is ever lost.

## Install

Give your AI agent (one that can use a terminal and SSH, for example Claude Code) the link to this repo
and say:

> Install ContextCore for me on my server. Follow INSTALL.md.

The agent asks you a few things (your server, an address, a name for your main agent), installs and checks the
server, connects your apps, and then helps you move in what you already have: each app's memory, your notes and
your projects.

## What is inside

- `server/`: the MCP server (three tools: start, whats_new, run) and a read-only page for your phone.
- `core/`: the rules engine: rights, formats, search, and the tool texts agents see.
- `seed/`: the starting store: shared rules, note types, task values and the skills the memory works by.
- `deploy/`: systemd and Caddy templates, an optional off-site backup.
- `INSTALL.md`: the install guide, written for the agent.

License: MIT.
