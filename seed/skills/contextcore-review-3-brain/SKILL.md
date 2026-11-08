---
description: "Weekly review of the brain, for an agent with the notes and types rights: link notes nothing points to, propose hub notes for big topics, fix broken links, merge duplicates and propose note types; every change after the owner's yes."
use_cases: ["Find notes no other note links to","Propose a hub for a topic with many notes","Fix links to notes that do not exist","Find two notes about the same thing","Propose a new note type or a retype"]
triggers: ["наведи порядок в мозге","разбери базу знаний","проставь связи","сделай хабы","проверь типы заметок","review the brain","link the notes","make hub notes"]
tags: ["contextcore","review","routine","brain","links","hubs","types"]
not_for: ["one note → use contextcore-notes-1-rules","one type change the owner asked for → use contextcore-types-1-rules","agents' files and project cards → use contextcore-review-2-agents-and-projects"]
requires: ["none"]
type: routine
schedule: every Sunday 20:00 (the owner's timezone)
created: 2026-11-08T12:00:00.000Z
by: owner
---

# contextcore-review-3-brain

Weekly review of the brain
When: your app runs this routine, or the owner asks for it. Only an agent with the notes and types rights runs
it.

Do: keep your record in data/brain-review.md: the as_of of your last run and the last older note you looked at.
Each run, look at the notes new or changed since that as_of (whats_new), and then at the next older notes in
path order, about 40, so that in a few weeks every note gets looked at; after the last note start from the
first again. A note's topic is what the owner would search for to find it, never its source or one word in it. Count a
topic's notes and look for duplicates with find across all notes, not only this run's batch.
For each note you look at, find:
1. Nothing links to it (its linked_from is empty) and it is not a hub → propose adding it to the hub of its
   topic. A note may be in several hubs.
2. Its topic has 10 notes or more and no hub → propose a hub: a note of type hub, named by the topic, a few
   lines on what the topic is, and a link to each note of the topic, grouped when that helps. A hub that grew
   too long to read → propose splitting it by sub-topic.
3. A link to a note that does not exist → propose the note it should point to, or removing the link.
4. Another note about the same thing (the same outside thing or link, the same idea in other words) → propose
   merging them, under contextcore-notes-1-rules (read both, name the notes that link to them).
5. A type that does not fit its meaning in note-types.md → propose the right type.
Types: once a run, look at the type list as a whole, under contextcore-types-1-rules. Ten notes or more of one
type that are one kind of thing, which the owner would look for by that kind, and the type's meaning is wider
(the catch-all reference first) → propose a new type: its one-line meaning, its boundary against the types
next to it, and the notes that would move. Two types that mean the same in use → propose merging them. Read the
suggestions file too.

Then show the owner one numbered list, one line per change (a hub: its name and how many notes it links; a
merge: both notes; a type: its meaning and how many notes move), and ask one question. Change nothing before the
owner's yes. After the yes: make the changes, with move for renames so links follow, then write the new as_of
and your place in the notes to your record. Note each line the owner said no to; propose it again only when it
changes. Nothing to propose → update the record all the same; in a routine say nothing, when asked say so in a
line.

Because: links and hubs let the owner and the agents find every note on a topic from one place; one look at
each note in turn keeps the brain tidy without a big clean-up.
Not: a hub per source, author or one word; a type per topic; changing, merging or retyping before the owner's
yes; removing a note to clean up (merge or archive it, under contextcore-notes-1-rules).
Check: did the owner say yes to each change, does every new hub link each note of its topic, and do all links
point to notes that exist?
