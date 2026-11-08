---
description: "Start a new project only when the owner clearly asks: agree its name and folders, make a private GitHub repo with README, CRITERIA and STATUS, and save its card in ContextCoreMCP; also pause, finish or archive a project."
use_cases: ["Start a new project with its own private repo","Agree the project's name and folders","Pause, finish or archive a project","Mark that a new project replaced an old one"]
triggers: ["давай начнём проект","заведи новый проект","создай проект","проект на паузу","закрой проект","start a new project","create a project","archive this project","pause the project"]
tags: ["contextcore","projects","repo","setup","github"]
not_for: ["an idea that is not a project yet → save it with contextcore-notes-1-rules","one piece of work or a task with steps → use contextcore-tasks-1-rules"]
requires: ["github"]
created: 2026-10-25T03:00:00.000Z
by: owner
---

# Start a new project
1. Only on the owner's clear ask. An idea alone is not a project: save it to the owner's notes.
2. Look at the project lines start gave you. The same or a close project exists → say so; ask once whether to use it.
3. Folders: every project has context/project-ideas/ and context/research/. Start from them and propose the
   project's own folders in context/ from what it is for, one line each with what goes there. Folders the owner's
   projects use, to model on: materials/ — documents and files sent in (contracts, official papers, decks from
   others); docs/ — how the product works (projects with code); reviews/ — reviews and critique of the project.
   Only folders it will use soon. context/ holds what the project knows as a whole, only in subfolders: never a
   file at its root. What a task makes (a mockup,
   a draft, a plan, questions) stays in that task's folder.
   Ask ONE question: the name (lowercase, hyphens) and these folders ("Make home-gym with these folders: …?"), and
   what it is for only if the owner gave nothing. Never ask whether it is work or fun: you, the agent, pick the
   vector (step 5). After the owner's answer, make it with the confirmed folders. Don't ask again.
4. Do it by your tools:
   - Mac (shell + gh): make ~/Desktop/<name> next to the owner's other projects, never inside the current repo;
     git init; write the files below; git add -A; git commit -m "Start <name>";
     gh repo create <the owner's account>/<name> --private --source . --push.
   - GitHub only (a connector): create the PRIVATE repo <the owner's account>/<name> with the files below in one commit
     on main.
   - Chat only (no GitHub): you can't make it; save nothing yet. Tasks right → offer one task with subtasks on the
     owner's list ("Home gym" with its steps). Else notes right → offer to save it to the owner's notes. Else →
     tell the owner an agent with GitHub can make it.
5. Files (short, in English):
   README.md
     # <name>
     <What and why: one or two lines, from the owner's words.>
     Vector: <endeavor | maintenance | wellbeing | growth | joy>   (your pick from what it is for; don't ask)
     Status: active
     ## Where things go
     - context/project-ideas/ — ideas about this project itself (its process, tools, goals).
     - context/research/ — research for this project: sources, comparisons, findings.
     - one line for each confirmed folder (step 3).
     - tasks/ — agent tasks, one folder each: tasks/<YYMMDD-name>/task.md. Everything a task makes (mockups,
       drafts, plans, questions) stays in its folder. A task that changes the project's own files (code, docs,
       materials) changes them where they are.
     If you want to save data and there seems to be no suitable folder for it in `context/`: 1. Ask the owner
     whether you can create a new folder at `context/<new_folder>`. 2. Get permission. 3. Save the data.
     4. Add its description here in the README.
   CRITERIA.md   "# <name> criteria" + what counts as success, from the owner's words; none given → "- to agree with the owner".
   STATUS.md     "# <name> status (DD.MM)" + "Started."
   CLAUDE.md     (Mac only) the project's own rules; no ContextCoreMCP line.
6. Never a public repo. Never inside a shared repo.
   The project's own private repo holds its tasks, notes and criteria, and it is the repo of the card. When the
   code lives in another repo (a public app, or the team's code repo), the README says where the code lives and
   how it gets there, and the card may repeat it as free text after its fields; the card's repo is never the
   code repo.
7. After the push, in one run: write("projects/<name>/card.md", {text: "name: <name>\nwhat: <the README's
   first line>\nrepo: github.com/<the owner's account>/<name>\nmac: ~/Desktop/<name>\nvector: <the README's>"})
   (mac empty with no Mac).
   Anything more agents should know (where the code lives): after the fields, one empty line, then free text.
   Write only the card to ContextCoreMCP; never README, STATUS, CRITERIA, tasks/ or context/.
8. Reply: "Made the private project <name>." Say the vector in its plain words ("filed under your main work"),
   so the owner can correct it. No paths, commands or repo names.
9. The owner pauses, finishes or drops a project, or another project replaces it → change only its card:
   status: paused | done | archive; successor: <the id of the project that replaced it>, if one did;
   aliases: its other and old names, comma separated, so an agent finds it by any of them.
   Start shows only active projects; the others stay findable with list("projects").
