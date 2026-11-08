---
description: "Make something run on a schedule: write its steps as a routine skill with its time, after the owner's yes, then make the app's routine that only names that skill; also move a routine the app already runs."
use_cases: ["Set up a job that runs every day or every week","Turn the owner's schedule request into a routine skill","Move a routine the app already runs into a skill","Change when a routine runs"]
triggers: ["каждое утро делай","раз в день проверяй","поставь на расписание","сделай рутину","напоминай каждую неделю","every morning do","run this daily","set up a routine","schedule this"]
tags: ["contextcore","routine","schedule","automation","recurring"]
not_for: ["a one-off reminder or a repeating task on the list → use contextcore-tasks-1-rules"]
requires: ["none"]
created: 2026-11-04T17:30:00.000Z
by: owner
updated: 2026-11-07T16:36:18.635Z
---

# contextcore-routine-1-create

Making a routine
When: the owner asks for something done on a schedule ("every morning …", "once a day check …"), or names a
  routine skill and asks you to run it in your app.
Do:
1. A skill of type routine already does it (the owner named it, or one fits) → go to step 4.
2. Write the steps into a new skill, skills/<agent or topic>-<1-9>-<what-it-does>/SKILL.md, with meta type
   "routine", schedule (when it runs, with the time zone) and description (one line: what it does). Its text says,
   in When / Do / Because / Not / Check form, what to read, what to check, where to save what, what needs the
   owner's yes and what to tell the owner. A run changes nothing that needs a yes: it keeps the proposals in your
   data/ and asks in the chat; the change waits for the yes. Nothing to report → the run says nothing.
3. Show the owner the skill's lines and the schedule and ask ("Ask first"). Save after the yes. The owner asked to
   move a routine your app already runs → its steps and time are the owner's: save them without asking, and say
   what you saved.
4. In your app, make the routine with the skill's schedule and only this text: "Call ContextCoreMCP start as
   <your agent name>. Read skills/<skill name>/SKILL.md and do what it says. If start fails, tell the owner the
   routine <skill name> did not run because ContextCoreMCP is down, and stop." Your app can't schedule → say so,
   and give the owner that text and the schedule. The app had the same routine already → change its text to this
   one, and remove any other copy of its steps in the app (an app skill, a memory).
5. Later changes to what it does → change the skill, never the routine text. A new time → change the skill's
   schedule and the app's routine together.
Because: the skill is the one current version; any app builds the same routine from
  the skill's name.
Not: steps or rules in the app's routine text; renaming a routine skill (every routine that names it breaks);
  a run that changes something before the owner's yes.
Check: does the app's routine text name only the skill, and does the skill hold the schedule?
