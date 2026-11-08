---
description: "Write the owner's notes in ContextCoreMCP: find the topic, add to it or make a new note with the right type, origin and source, rename, archive or merge, and change the note rules after the owner's yes."
use_cases: ["Save something the owner wants to keep as a note","Add to a note that already exists on the topic","Rename, archive or restore a note","Merge two notes and fix the links to them","Mark a note as processed after the owner confirms it"]
triggers: ["запиши в заметки","сохрани это","добавь в заметку","удали заметку","переименуй заметку","save this to my notes","add to the note","archive this note","remember this idea"]
tags: ["contextcore","notes","knowledge","saving","archive"]
not_for: ["a piece of work to do → use contextcore-tasks-1-rules","creating or changing note types → use contextcore-types-1-rules"]
requires: ["none"]
created: 2026-10-25T03:00:00.000Z
by: owner
updated: 2026-11-07T13:15:12.756Z
---

# Note rules

Before writing, apply the shared placement rule. This skill controls how to write material that belongs here.
Find the topic first (find). One note per topic: it exists → read it and add to it; keep its type and origin.
The owner's remark on a note → append it; don't rewrite earlier text.
A new note → pick a type from the type list (start gives it with this layer), by what you save, not by the
medium it came from. An outside thing with no more specific type → reference.
Read the chosen type's file (system/dictionaries/note-types/<type>.yaml) once per chat, again when a change is
reported. Its fields go into meta, by its format; leave out an optional field you don't know. A type with no file
has only the common fields.
nm.write("brain/", {text, meta: {title, type, origin, …}}). Every key but text goes in meta.
origin: you = the owner's exact words · source = outside material · agent = your conclusion · mixed = your summary
  of the owner's words or of sources. An addition keeps the origin.
Not the owner's words → source: [links or "chat DD.MM"] and checked. checked is true only when you opened every
  source; the owner's words in this chat count as opened, a claim the owner heard from others does not.
  Adding an unchecked source makes checked false.
Title and text in English. The owner's exact words in meta.original when they matter (names, quotes, reflections),
  unchanged. Replacing the text → update original or set it to null.
New notes are raw. Only the owner's confirmation makes a note processed: ONE write {meta: {stage: "processed"}};
  set origin "you" with it only when the note is now fully the owner's words.
Delete → archive: {meta: {archived: true}}; undo: find in "archive", then {meta: {archived: false}}.
  Rename → {meta: {title}}. Changing an existing note needs the version you read.
Before archiving or merging a note, read it: linked_from lists the notes that point to it. Name them to the
  owner with the change; after a merge, point their links to the note that stays. Renaming or moving a note
  with move updates the links to it by itself (links_updated).
Say where it went in plain words ("saved to your notes: <title>").

Changing these rules
A rule about how notes are kept → this skill, for every agent, by the shared "Ask first". Replace only those lines:
nm.write("skills/contextcore-notes-1-rules/SKILL.md", {replace: [old, new]}, version).
