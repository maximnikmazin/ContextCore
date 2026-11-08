---
description: "Daily review, for an agent with the system right: read what agents saved (memory, app memory copies, agent rules, skills, expired facts) and propose, for the owner's yes, where each fact or rule belongs."
use_cases: ["Review what agents saved since the last review","Move a fact several agents need to About the owner","Find duplicate or conflicting facts and rules","Remove facts that are past their date","Sort an app's copied memory into the right places"]
triggers: ["разбери память агентов","что агенты сохранили","наведи порядок в памяти","ревью памяти","почисти дубли","review what agents saved","clean up agent memory","memory review","find duplicate rules"]
tags: ["contextcore","memory","review","routine","cleanup","rules"]
not_for: ["one change to the shared rules or About the owner → use contextcore-system-1-rules"]
requires: ["none"]
type: routine
schedule: every day 21:00 (the owner's timezone)
created: 2026-11-04T17:30:00.000Z
by: owner
---

# contextcore-review-1-memory

Review of what agents saved
When: your app runs this routine, or the owner asks you to review what agents saved. Only an agent with the
  system right runs it.
Do: call whats_new with the as_of of your last review (kept in your data/review.md; no review yet → read every
  agent's memory.md and agent.md once instead). For each change in another agent's memory.md, agent.md or data/<app name>-memory.md (a copy of an app's
  memory: read all of it, piece by piece, in as many runs as it takes), each new or changed skill, and each line in whats_new's expired list, ask the "Where things go" questions:
  - a fact two or more agents need → propose moving it to About the owner and removing it from every agent
    memory that holds it. The line keeps its date; the same fact from two agents keeps the earlier date;
  - a line in one agent's memory.md that About the owner, the shared rules or that agent's own skills already
    say → propose removing it; the agent's line is newer and says something else → propose updating that place
    with it and removing the line;
  - one fact in two versions → the same source with a newer date → propose keeping the newer line and removing
    the older; two agents disagree → ask the owner which one is true, then fix both;
  - a fact line with no date → propose its date: when the owner said it, or else when it entered ContextCoreMCP;
  - a rule in a memory → propose its place (that agent's agent.md, a skill, the shared rules); another right's
    skill → name the agent with that right;
  - the same rule in two or more agents' agent.md → propose moving it to the shared rules;
  - a new or changed skill that contradicts another skill or the shared rules → name both and ask which one wins;
  - a fact past its "until" date → propose removing it.
  Show the owner one numbered list, each line old → new, and ask one question. After the owner's yes: save each
  line's new place first (About the owner, the shared rules, a skill, or that agent's agent.md), then remove those
  lines from the agents' memory.md, then call whats_new and write its as_of to your data/review.md. Note there
  each line the owner said no to; propose it again only when it changes. Nothing to propose → write the new as_of
  to data/review.md all the same; in a routine say nothing, when asked say so in a line.
Because: each fact lives once, dated, where the agents who use it look for it; the newer line wins.
Not: moving or removing anything before the owner's yes; promoting a fact that only one agent's job uses;
  a moved line with a new date.
Check: did the owner say yes to each line you change, and does every line you wrote have its date?
