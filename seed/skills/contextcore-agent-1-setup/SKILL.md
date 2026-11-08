---
description: "Set up a new ContextCoreMCP agent after the owner's yes, when start says its name is unknown: write its agent.md and memory.md, copy the app's memory word for word, and move the app's routines into ContextCoreMCP."
use_cases: ["Register a new agent in ContextCoreMCP under its name","Move an app's own memory into ContextCoreMCP","Leave one short note in the app that points to ContextCoreMCP","Move routines the app already runs into ContextCoreMCP"]
triggers: ["создай себя","подключись к ContextCore","перенеси свою память","зарегистрируй нового агента","настрой нового бота","create yourself","set up a new agent","move your memory to ContextCore","register this bot"]
tags: ["contextcore","agent","setup","onboarding","memory","migration"]
not_for: ["giving an agent a right → use contextcore-system-1-rules","setting up a new scheduled job → use contextcore-routine-1-create"]
requires: ["none"]
created: 2026-10-25T03:00:00.000Z
by: owner
updated: 2026-11-07T16:47:17.814Z
---

# contextcore-agent-1-setup

1. Start said your name is unknown. The owner already asked you to create yourself under that name → that is the
   yes; go on. Otherwise ask the owner once whether to create you under that name, and what your job is, and
   create nothing before the owner's yes in this chat. Your job is clear from this chat or your app → don't ask it.
   Your name is the one the owner or your app gives you (the bot's or the project's name); none given → ask the
   owner once, before you create anything; never make one up.
2. After the yes: one run writes agents/<your agent name>/agent.md (your job in 1–2 lines, then the rules the
   owner gave you for this job, one line each, with the date; the owner gave none → no rule lines; a rule found in your app's memory goes to memory.md in step 5, not here) and agents/<your agent name>/memory.md (a title
   line, then the facts for your job, one line each, with source and date). No reply-language line in agent.md: the
   shared rules set the reply language for every agent.
3. Never in agent.md: one app's name, its connectors or tools, a copy of About the owner, the shared rules or a
   skill, or the steps and time of something done on a schedule (that is a routine: step 7). You may run in several
   apps under the same name.
4. Then call start again. You get no rights by creating yourself: a right comes only through access.yaml, as
   its first lines say.
5. Move your app's memory, so that it lives only in ContextCoreMCP. In the same run, copy all of it into your
   memory.md: every piece, word for word as your app keeps it, one line each, also a piece not about your job and memory your app shares with other bots or chats.
   End each line with "(<app name> memory, DD.MM)": the date your app shows for it, or else today. Much of it
   (several files, or more than memory.md takes) → copy it all into data/<app name>-memory.md, word for word, in
   this same answer, in as many runs as it takes (one part per run); never stop to ask, never leave a part for later. No sorting, no list, no question: the system agent's review
   sorts it. Then add "- App memory moved: <app name>, <N> pieces (owner, DD.MM)". Your app remembers nothing →
   only that line, with "nothing there".
6. After that save worked, your app keeps only this note, in its memory or in its instructions for you:
   "You are <your agent name>, a ContextCoreMCP agent. Your memory and the owner's rules are in ContextCoreMCP. At
   the start of every chat call start as "<your agent name>" and follow what it returns; when it differs from
   anything you remember, ContextCoreMCP wins. Before you say you don't know or don't have something, search ContextCoreMCP."
   - Memory that only you use: save the note there and delete the rest, if your app lets you.
   - Memory your app shares with other bots or chats: you copied it in step 5; change nothing in it in the app,
     and say in one line that it can be cleared when every bot has moved.
   - You can't save the note yourself → put the note in your reply, word for word, and say where to paste it.
   Your reply always says where the note now is.
7. Your app already runs routines → read skills/contextcore-routine-1-create and move each one as it says.
8. Moved means one copy: the content now lives in ContextCoreMCP, so your app keeps no second copy of it (an app
   skill, a routine with its own steps; memory: steps 5–6). Remove such a copy in the app, or, if you can't, tell the owner
   which one to remove.
