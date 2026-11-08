---
description: "Weekly review, for an agent with the system right: sort each agent's data files by how their value changes with time, check project cards, and check that every app routine has its routine skill; propose every change for the owner's yes."
use_cases: ["Find files an agent no longer needs","Fold old outside material into short summaries","Check project cards for missing or outdated fields","Check that app routines match their routine skills"]
triggers: ["уборка файлов агентов","почисти файлы агентов","проверь карточки проектов","проверь рутины ботов","weekly cleanup of agent files","check project cards","check bot routines"]
tags: ["contextcore","review","routine","cleanup","files","projects"]
not_for: ["facts and rules in agents' memory → use contextcore-review-1-memory","brain notes → use contextcore-review-3-brain"]
requires: ["none"]
type: routine
schedule: every Saturday 20:00 (the owner's timezone)
created: 2026-11-08T12:00:00.000Z
by: owner
---

# contextcore-review-2-agents-and-projects

Weekly review of agents' files, project cards and routines
When: your app runs this routine, or the owner asks for it. Only an agent with the system right runs it.

Do: keep your record in data/weekly-review.md: the as_of of your last run, and the file groups (below) with the
kind and the freshness the owner confirmed for each. Call whats_new with that as_of: it shows what changed in
every agent's folder and in the project cards; no record yet → look at every agent once. Three parts, one list for the owner at the end.

1. Agents' data files. Agents save files as they find handy; you check them, they don't need to know these rules.
   Put files of one agent that hold the same kind of thing into a group. A group is named by what its files
   are for in that agent's job, never by a list of known cases. For each new group, ask: "a year from now, is
   one of these files still needed?" and pick its kind:
   - accumulating: needed whole, with its neighbours, because it shows how things changed (a record of the
     owner and the owner's work over time). Never remove or fold, however many files there are;
   - current: only what is true now matters (a state, settings, progress). Several copies of the same thing
     → propose keeping the newest; the server keeps every older version;
   - fading: outside material that matters for a while. Propose how long it stays fresh. Past that → propose
     folding it into one short summary per period ("what of this mattered"), then removing the folded files.
     Only a group the owner confirmed as fading is ever folded;
   - reusable: used again and again. Propose removing only near-duplicates, so one file per purpose stays;
   - leftover: drafts, temporary files, copies made in a move. Its result saved somewhere else → propose
     removing it.
   Ask the owner the kind (and freshness) of each new group once; write the answer in your record. Known
   groups: apply their kind to what is new or grew since your last run. File count and size are never the
   reason for a change; a file over 1 MB is worth one line to the owner. Before proposing to remove a file,
   ask its agent whether it still needs it, and put the answer in the line.
2. Project cards (list("projects")). Find: an empty field the card must have (name, what, repo, vector; mac
   when the project has a Mac folder); a repo or Mac folder that no longer exists; two cards for one project;
   an active card (no status means active) with no new task and no change in its repo for 30 days (check
   both); a repo or folder you cannot open is "not checked", not "gone"; free text
   that says something else than the project's README. For each, propose the exact change; what you found
   yourself (the repo, the folder) goes in the line as a proposal too.
3. Routines. Ask each of the owner's bots in the app for its routines: name, time, timezone, on or paused, the
   full app text. Compare both ways with the skills of type routine for that agent, under
   contextcore-routine-1-create: every app routine has its skill, the app text only points to the skill, the
   times match, and every active routine skill runs in the app. Paused routines, drafts and finished one-time
   routines are not drift. Drift → propose the fix; after the owner's yes, ask that same bot to fix its own;
   never change another bot's routine yourself. A bot that does not answer is "no answer", never "all fine".

Then show the owner one numbered list, each line: what you found → what you propose, and ask one question.
Change nothing before the owner's yes: removing, folding, a card change and a routine fix each wait for it.
After the yes, the agent that owns the file or routine, or has the right for that place, makes the change; you check it, then write the new as_of
and the groups to your record. Note each line the owner said no to; propose it again only when it changes.
Nothing to propose → write the new as_of all the same; in a routine say nothing, when asked say so in a line.

Because: agents keep what is useful without thinking about limits; one weekly check by the value of each kind
of file keeps the history the owner wants to analyse and drops what has lost its worth.
Not: removing or folding history; removing anything because of a file count; groups or limits made for one
bot; changing a file, card or routine before the owner's yes; fixing another bot's routine yourself.
Check: does every group have a kind the owner confirmed, did each owning agent answer before its files were
proposed for removal, and did the owner say yes to each change made?
