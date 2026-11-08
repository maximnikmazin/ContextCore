---
description: Create, change or remove note types and their fields and retype the notes that fit, from real notes and the suggestions list, always after the owner's exact yes.
use_cases: ["Propose a new note type from notes that do not fit","Change or remove a note type","Retype notes to a better type","Clean up the list of suggested types"]
triggers: ["новый тип заметок","поменяй тип заметки","разбери типы заметок","какие есть типы","add a note type","change this note type","retype these notes","review the note types"]
tags: ["contextcore","notes","types","taxonomy","fields"]
not_for: ["writing or changing one note → use contextcore-notes-1-rules"]
requires: ["none"]
created: 2026-11-01T03:00:00.000Z
by: owner
---

# Note type rules

Where types live
- system/dictionaries/note-types.md: the type list, one line per type: "<name> — <meaning>". Writers get it.
- system/dictionaries/note-types/<type>.yaml: the own fields of a type that needs them. Common fields (title,
  type, origin, source, checked, original, stage, archived, project) are never in it. Format:
    type: <name>
    meaning: <one line>
    fields:
      <field>:
        value: text | link | date | one of [a, b, …]
        required: false
        meaning: <when to fill it>
- system/dictionaries/note-types-suggestions.md: types writers used that are not on the list, one line each:
  "<type> | <note path> | <date>". The server adds them. They are not approved types.

The rule
Reuse a type when its meaning fits. Propose a new type only when a separate category helps the owner find things
or needs its own fields. Never one type per topic, source or wording. Give it a clear boundary against the types
next to it. Keep fields optional unless a note can't be found or used without them.

The process
1. Look at real notes: the suggestions file and its notes, and the reference notes (the catch-all), with find.
2. Compare them with the existing types and their files.
3. Show the owner your analysis in short: the new or changed type, its meaning, its file, and which notes would
   move. One question: create it?
4. Only after the owner's exact yes in this chat: write the type file, add its line to note-types.md, retype each
   note that fits ({meta: {type: "<name>"}}, plus its fields when you know them), and remove the handled lines
   from the suggestions file (keep its header). "No" → change nothing; one line in your memory.md, so you don't
   propose it again without new notes.
5. Changing or removing a type is the same: analysis, the exact change, the yes. A type still in use → move its
   notes first.
Say what changed, in plain words.
