---
description: "Change and show the owner's tasks: new, done, cancelled, level, order, steps, dates, short names, reminder or task, the brief and the full list; also change the task rules after the owner's yes."
use_cases: ["Add a task or a step to an existing task","Mark a task done or cancelled","Change a task's level, date or order","Show today's brief or the full task list","Make a reminder instead of a task when the owner asks for one","Merge duplicate tasks"]
triggers: ["добавь задачу","покажи задачи","что на сегодня","сделано","напомни мне","это важно, подними","add a task","show my tasks","mark it done","move it to low"]
tags: ["contextcore","tasks","todo","priorities","brief","reminders"]
not_for: ["an idea or something to keep → use contextcore-notes-1-rules","a new project → use contextcore-projects-1-new","a job that runs on a schedule → use contextcore-routine-1-create"]
requires: ["none"]
created: 2026-10-25T03:00:00.000Z
by: owner
updated: 2026-11-07T16:17:54.671Z
---

# Task rules

Before writing, apply the shared placement rule. This skill controls how to write material that belongs here.
Do all the clear changes in one run. After saving, don't offer to do the work.
Everything you save (titles, descriptions, steps, comments) is in English, whatever language the owner writes in;
keep the owner's exact words in their language only where they matter.
Before any change (new, status, level, date): find({query, in: "todo"}) for each thing, by its work, not its
words, and read the status of every hit.

Reminder or task.
When: the owner's message asks to remember something or to be reminded about it.
Do: first find what the reminder is about: the work the owner wants to remember. It is often in another sentence or paragraph of the same message, before or after the request; work the owner says needs doing later is that subject. Then decide by the words the owner used.
- The owner asks for a reminder → make only the reminder in the Reminders app. Put the work and all its details in it, with links whole. Make no task.
- The owner asks for a reminder and a task → make both.
- The owner asks for neither → make a task. This is the default.
Because: the owner chooses where each piece of work lives. A task next to the reminder puts the same work in two places, and the owner must close it twice.
Not: adding a task to a requested reminder because the reminder's work looks like a task (download, analyse, prepare, call). That work is in the reminder already.
Check: did you make a reminder? Then did the owner also say "task"? If not, you made no new task.

Capture
1. The same work is already an open task → change that task and say so; never add a copy. A step of an open task
   → its subtask. A done or cancelled task is not a match → a new task (unless rule 10).
2. Section. A task that serves one of the owner's projects (start gives its "what") → that project,
   even when the owner doesn't name it. Two fit → ask which. None fits → a vector:
   endeavor — the owner's main activity: work and business for income, everything that belongs to it.
   maintenance — only household upkeep: what keeps life running (documents, bills, repairs, cleaning).
     Doing it for the first time doesn't change it.
   wellbeing — restoring or keeping the owner's basic physical and mental state, without training load.
   growth — load and growth: hard and new for the owner (learning, workouts, a new side project).
   joy — pure pleasure with no tie to a result.
   A project has one vector; its tasks take it. A truly unclear case → one question.
3. Level and missing fields.
   When: creating a task or reading a level change, including a short follow-up.
   Do: interpret level words across spelling and alphabet changes. Use this vocabulary:
   high: high, hight, хай, critical, критикал, критично, important, важно, "сегодня нужно" (this is a level, not a date);
   medium: medium, медиум, мед, средний, обычный;
   low: low, лоу, низкий.
   By meaning, not single words: not important, or waiting on someone else → low.
   No level supplied means medium for a new task. No date supplied means no date unless the date rule provides one.
   Apply the level-limit rule before saving.
   Because: the owner adds details when needed; missing optional fields do not require a question.
   Not: asking for a missing level or date, or changing level from a date.
   Check: did you apply the stated value or default without an unasked field question?
4. Level limit.
   When: a change adds an open top task to high or medium, including a new task, move, reopen or section change.
   Do: read the current list. Count the destination level in its section after all approved changes in this
   message. The limit is seven; repeated copies of one repeating task count as one. Low has no limit. If the
   change exceeds the limit, keep that change pending, do independent clear changes, show the full destination
   level numbered with short names, and ask which task moves down. After approval, apply both changes together.
   Because: the limit keeps each level readable.
   Not: saving above the limit, choosing a demotion yourself, or asking without the list.
   Check: will the destination count remain within the limit?
5. Work and its context.
   When: saving the owner's details in any task change.
   Do: find each detail's work by the shared rule "Every part of the message". A detail about a new task goes into
   its description. A detail about an existing task, open or being closed, goes into add_comment on each task it
   is about. Preserve relevant relationships even when a date is already supplied.
   Because: choosing a date does not preserve the work's context.
   Not: creating a task from a progress detail, or applying that detail to unrelated work found by search.
   Check: is each of the owner's details on its task?
   Two names, both required on a new task: short — the 2-3 words the owner knows the task by (up to 40
   characters; lists and briefs show only it), and title — the full name: what to do and with what (up to 100).
   Keep the short name when the work stays the same; change it only when the work changes or the owner renames it.
   Description: up to 120 characters (who, why, the next step). Links, paths, longer notes → add_comment.
6. Dates, from start's "now" (night hours: the shared rules):
   deadline — done by that day (any "by when", exact or relative; "today" too, for every thing it is said about).
   day — done on that day (an event, an appointment).
   A period, not a day → no deadline, no day; add_comment "approx: DD.MM–DD.MM" with that period's real dates.
   A day the owner names wins. Otherwise, work needed before an event takes that event's day from the calendar as
   its deadline; no matching event means no inferred date. Never a date from a level.
7. Repeating → one task per day, 4 weeks ahead. End with "Until DD.MM; ask me near then to add more."
8. Order: the server keeps it (no position → the end). Only when the owner says so: "critical" or "first" →
   position: 1, level unchanged; a place in a level → that position; a whole new order → map it to the list you
   showed, then ONE save_task({order: [ids, top first]}). An item the owner sets apart below such a list goes
   down a level.
Status
9. Done or cancelled.
   When: selecting done or cancelled.
   Do: judge the work named by the task, in this order. Completed work is done. Unfinished work that is no longer
   needed or cannot happen is cancelled. Record a changed outside event as context. For a removal request, use
   done if completed, otherwise cancelled. Ask only if the work's outcome remains unclear.
   Because: status records what happened to the task's work.
   Not: using an outside event's cancellation as the status of work already completed.
   Check: was this task's work completed? If yes, use done.
10. Closed work isn't finished after all → reopen that closed task where it was (same section and level), with
    the remaining work as steps.
11. Closing a parent.
    When: planning to close a parent or its last open steps.
    Do: read the parent and its steps first (nm.read("todo/<id>"); search can miss steps). If the owner reports steps complete, close those steps only. When none remain open, ask whether
    to close the parent. When the owner closes the parent, close it: its open steps close with it (the save
    result lists them in closed_steps); name those steps in your answer.
    Because: completed steps do not by themselves establish that the whole task is finished; a closed task
    keeps no open steps.
    Not: inferring parent approval from its title matching the completed steps.
    Check: did the owner close the parent or approve closing it?
12. Not a task: an idea, something to look into someday, a thing to keep (the owner's notes, by the placement
    rule). An event already in the owner's calendar → not a task.
13. Existing open tasks cover the same work → name them and ask whether to merge; during capture, rule 1 first.
    After a yes: cancel the smaller one, add_comment "merged: <its title>" on the main one.
14. Never change dates, levels, statuses or order the owner did not ask for. Prefer no dates on tasks unless the owner
    asks; the owner moves personal projects.
15. Steps are parent links (task → step → sub-step), never a checklist in a comment. "Group these under X" → a
    new task X, then link them, in one run. One level too deep → save what fits, then ask once where the rest goes.
Showing tasks
16. Any ask to see the tasks → the brief. Read the list fresh (list("todo")). Plain text, never a code block.
    Bold groups: today's events from the owner's calendar in your app, each as its start time and 2-3 words
    ("12:00 DM review"; none → no group); then
    "Today": every task due today or overdue (deadline or day), whatever its level, with its section's name;
    then each section in order, without those tasks; a section with levels gets one group per level
    ("<project> high"). Number tasks from 1 again in each group. Don't continue the numbers across groups. Every top task, no steps: its number and its short name (a task with none yet: its 2-3 most meaningful words), with its
    open-step count: "2. Pricing page [3]". A deadline past or within 3 days → "(due DD.MM)"; a day of today →
    "(today)". Empty groups are left out. No closing line. Waiting tasks stay in low; no separate Wait group.
    A task whose description or comment has "start: YYYY-MM-DD" after the current week (Mon to Sun) is left out of
    the brief until that week; a start date is not a deadline. The current week is Monday to Sunday and includes today. Leave out a task if its start date is after this Sunday. The full list shows it with "(starts DD.MM)".
    After the brief, a second short message only when something is urgent: a clash, or a deadline today or overdue.
17. Only when the owner asks for all of it (all the task info, the details) → the full list: every open task and
    step at every level, full titles, "H1 · …", "H1.2 · …", "H1.2.1 · …" (no levels: "1 · …"). One message,
    however long. Plain text, no closing line.
18. The owner's numbers refer to the list you showed last. List "todo" fresh before acting; moved since → one
    line saying so. Conflicting references → ask before changing it.
19. "Not this project" → project: null + its vector, and one line in your memory.md. A new project: only on the
    owner's clear ask, by contextcore-projects-1-new.
Changing these rules
20. A rule about how tasks, the list or the brief work → this skill, for every agent, by the shared "Ask first".
    Replace only those lines; never send the whole file.
API
  nm.save_task(task) → the saved task (these fields, id, section, version, children?, parent_all_done?); no id =
    new; a change needs its version; the server sets section, never send it
  status: planned (default) | done | cancelled · priority: high | medium (default) | low
  parent: task id, up to 2 levels below a top task; a step takes its parent's project and vector
  project: project id | null · vector: endeavor | maintenance | wellbeing | growth | joy
  deadline, day: YYYY-MM-DD · add_comment: adds one dated line · comment: replaces all
  this skill: nm.write("skills/contextcore-tasks-1-rules/SKILL.md", {replace: [old, new]}, version)
