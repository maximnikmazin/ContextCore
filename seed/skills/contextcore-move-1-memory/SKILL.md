---
description: "Move the owner's existing notes, memory and knowledge from another place (a notes folder or vault, a notes app export, another memory server, files) into ContextCore by general rules: sort each item to its place, translate to English with the original kept, show the owner one short list, then write."
use_cases: ["Move a notes folder or vault into the owner's notes","Move another memory server's data into ContextCore","Sort old notes into notes, project files, facts about the owner and rules","Find duplicates of notes already moved"]
triggers: ["перенеси мои заметки","перенеси память","импортируй заметки","move my notes","import my notes","move my memory to ContextCore","migrate my vault"]
tags: ["contextcore","migration","import","notes","memory","setup"]
not_for: ["one app's own built-in memory → use contextcore-agent-1-setup step 5","one new note → use contextcore-notes-1-rules"]
requires: ["none"]
created: 2026-11-08T12:00:00.000Z
by: owner
---

# contextcore-move-1-memory

Move existing material into ContextCore
When: the owner asks to move notes, memory or knowledge kept somewhere else (a folder of Markdown files, a notes
app export, another memory server, documents) into ContextCore. Run it as the agent with the notes and system
rights; a large move can be split across helper agents, each with this skill and one batch.

Do:
1. Read first: contextcore-notes-1-rules (the note format), the note types (system/dictionaries/note-types.md),
   the project cards (list("projects")) and the notes already there (find in "brain"). Ask the owner only what
   only the owner knows: where the material is, and whether some of it must stay out.
2. Work on a copy. Never change, move or delete anything in the old place.
3. Read every item whole and give it one place, by what it is, never by the folder it sat in or one word in it:
   - a note: material the owner may reread that no single project owns (the default);
   - facts about the owner: who the owner is, life episodes, typologies, traits, values, health, style, how to
     work with the owner → notes of type owner-data, the kind in the note; the few facts every agent needs (name,
     where the owner lives, timezone, work, how to reach the owner) → a short list for About the owner;
   - a project's material (its plan, decisions, research done for it) → that project's folder, under the
     project's README placement index; a project with no card → propose the card;
   - a rule for agents (how an agent must work, prompts that set behaviour) → not a note: a list for the owner,
     who decides where each rule goes (the shared rules, one agent's agent.md, a skill);
   - the same as a note already there, with nothing new → skip it and name that note; something new → merge it
     into that note;
   - no value as a note (empty, a placeholder, an empty template, tool debris) → skip it, with the reason. Never
     skip an item for being old or long;
   - you cannot decide → ask the owner, with the reason.
4. For each note: a short English title for the subject; the type from note-types.md that fits its meaning;
   origin (the owner's own words, outside material, an agent's conclusion, or a mix); the links in it as its
   sources; its old creation date. Text in another language → a full, faithful English translation (nothing
   added, nothing dropped, links, numbers, names and dates unchanged), and the exact original in meta.original.
   Old wiki links → the new note names, so no link is lost.
5. Topics with many notes → a hub note per topic that links them (contextcore-review-3-brain, check 2).
6. Show the owner one short list: how many items go to each place, the facts for About the owner, the rules,
   the items you could not decide, and every guess. Change nothing before the owner's yes; the owner may answer
   only the important points, the rest stays as you proposed.
7. After the yes: write in batches (one run each, with op_ids), then check that every item has its place, every
   link points to a note that exists, and the count matches the list. Tell the owner in a line what moved and
   what was skipped.

Because: the owner's old knowledge is found and used by every agent only when each piece sits where its kind
belongs, in one language for search, with the owner's own words kept.
Not: rules made for one source or one folder layout; sorting by folder names; a summary instead of a translation;
writing before the owner's yes; deleting or changing the old place.
Check: does every item have a place or a reason it was skipped, is every original kept, and did the owner say yes?
