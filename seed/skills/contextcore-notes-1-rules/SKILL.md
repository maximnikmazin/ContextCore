---
description: "Write the owner's notes in ContextCoreMCP: find the topic, add to it or make a new note with the right type, origin and source, rename, archive or merge, and change the note rules after the owner's yes."
use_cases: ["Save something the owner wants to keep as a note","Add to a note that already exists on the topic","Rename, archive or restore a note","Merge two notes and fix the links to them","Help search find a long note: a summary and other names"]
triggers: ["запиши в заметки","сохрани это","добавь в заметку","удали заметку","переименуй заметку","save this to my notes","add to the note","archive this note","remember this idea"]
tags: ["contextcore","notes","knowledge","saving","archive"]
not_for: ["a piece of work to do → use contextcore-tasks-1-rules","creating or changing note types → use contextcore-types-1-rules"]
requires: ["none"]
created: 2026-10-25T03:00:00.000Z
by: owner
updated: 2026-11-25T11:12:05.718Z
---

# Note rules

Before writing, apply the shared placement rule. This skill controls how to write material that belongs here.
Find the topic first (find). One note per topic: it exists → read it and add to it; keep its type and origin.
The owner's remark on a note → append it; don't rewrite earlier text.
A new note → pick a type from the type list (start gives it with this layer), by what you save, not by the
medium it came from. Outside material kept for later (a post, video, message, article) with no more specific type
→ saved.
A reflection → title "Reflection DD.MM.YYYY: <theme>" (the day it was written), the period in the period field. To find the owner's reflections, thoughts or facts about his life: search types reflection, thought and owner-data together, newest first; a type is a hint, not a filter.
Read the chosen type's file (system/dictionaries/note-types/<type>.yaml) once per chat, again when a change is
reported. Its fields go into meta, by its format; leave out an optional field you don't know. A type with no file
has only the common fields.
nm.write("brain/", {text, meta: {title, type, origin, …}}). Every key but text goes in meta.
origin = what the note keeps, by its main purpose, not by who typed it. Search shows owner and agent notes first.
  owner: the owner's thoughts, decisions, plans, experience and life, also your retelling of the owner's words.
  agent: your own analysis, comparison or plan for the owner, with a conclusion.
  saved: outside material kept for later, or your summary or translation of it; a remark like "useful for X"
  doesn't change that. Saved material with the owner's own opinion or decision about it → owner, with the link.
  An addition keeps the origin.
source: [links or "chat DD.MM"]: required on saved notes (the way back to the post or chat), else when you have
  it. A source you did not open → say so next to that item in the text ("not opened, from the title").
Title and text in English. The owner's exact words in meta.original when they matter (names, quotes, reflections),
  unchanged. Replacing the text → update original or set it to null.
summary: when the title and the first lines don't say what the note contains (a long note that opens with
  context, a note in Russian), what exactly it contains: the specific method, decision or result, with names
  and numbers; then, if the note says it, which question it answers. English, one paragraph, at most 600
  characters. A sentence that would fit many other notes ("useful for AI agents") → make it specific or drop it.
  A short note that opens well needs none. Changing the text → check the summary in the same write.
other_names: other names of what the note is mainly about (another alphabet, a short form, an old name), when
  the owner may look for it by them. Not topics, not people the note only mentions. At most 10.
The owner confirmed a note → write that next to what was confirmed, with the date.
Delete → archive: {meta: {archived: true}}; undo: find in "archive", then {meta: {archived: false}}.
  Rename → {meta: {title}}. Changing an existing note needs the version you read.
Before archiving or merging a note, read it: linked_from lists the notes that point to it. Name them to the
  owner with the change; after a merge, point their links to the note that stays. Renaming or moving a note
  with move updates the links to it by itself (links_updated).
Say where it went in plain words ("saved to your notes: <title>").

Changing these rules
A rule about how notes are kept → this skill, for every agent, by the shared "Ask first". Replace only those lines:
nm.write("skills/contextcore-notes-1-rules/SKILL.md", {replace: [old, new]}, version).
