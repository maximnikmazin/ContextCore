const ROOT_LINES = [
  ["brain/", "the owner's notes on no project, one note per topic; each note has a type from system/dictionaries/note-types.md."],
  ["projects/", "one folder per project (the owner's private repos): card.md (name, what, repo, mac, vector) and the repo's README.md, STATUS.md, CRITERIA.md, tasks/, context/. Code stays only in the repo."],
  ["agents/", "one folder per agent: agent.md (the agent's job and rules), memory.md (the agent's short memory), data/ (growing records). Your agent folder (agents/<your agent name>/): full access; other agents' folders: read only."],
  ["skills/", "how-tos shared by agents, one folder each: skills/<name>/SKILL.md, with meta description (one line: when to use it)."],
  ["system/", "dictionaries/ (allowed values and note types), notices/ (notices right only)"],
  ["user.md", "About the owner: name, timezone, how every agent talks to the owner. Start gives its text. Changed by the system right."],
  ["agents.md", "the shared rules for every agent. Start gives its text. Changed by the system right."],
  ["access.yaml", "who has which right: notes, tasks, notices, types, system. Its first lines say who may change it."]
];
const PROJECTS_HEADER = `One folder per project. A thing goes to a project only if it serves that project's what; a shared word is not enough. What and why, status, success, tasks, where things go → list("projects/<id>") and read its README.md.`;
const START_PROJECTS_TITLE = 'Active projects (anything more: list("projects/<id>")):';
const START_PROJECTS_OTHERS = (n, by) => `${n} more ${n === 1 ? "project" : "projects"} (${by}). A project name you don't see above (also an old name) → list("projects") shows every card, with what replaced an old one, before you say you don't know it.`;
const DICT_LINES = {
  "note-types": `one line per type: "<name> — <meaning>"; a type with its own fields has note-types/<type>.yaml. Types and system rights. A value in use can't be removed.`,
  "task-statuses": 'one line per status: "<name> — <meaning>"; "(default)" on one line; "(closed)" if it counts as closed. Tasks right.',
  "task-priority": 'one line per level, top level first: "<name> — <meaning>"; "(default)" on one line. Tasks right.',
  "note-types-suggestions": 'note types used in notes but not in note-types.md, one line "<type> | <note path> | <date>"; the server adds the lines. Types right.'
};
const SYSTEM_LINES = [
  ["dictionaries/", "allowed values: note types and their files note-types/<type>.yaml (types and system rights), task statuses and priority (tasks right)"],
  ["notices/", "server notices for agents with the notices right; only told may change"]
];
const AGENT_LINES = {
  "agent.md": "the agent's job and rules",
  "memory.md": "the agent's short memory",
  "data/": "growing records, one file each"
};
const MSG = {
  skillsNote: (own, others) => [
    own ? "Your own skills are listed in the data (skills.own), each with when to use it. When one fits the work, read it with nm.read before acting, and follow it." : "",
    others ? `${others} other skills exist: how-tos for kinds of work. When the owner asks you to look for skills, or a task needs a way of working you do not have, search them by what the owner wants done: nm.find({query: "<the owner's request in the owner's words>", in: "skills"}); read the best match with nm.read before acting. The owner asks you to keep a skill for your work → add your own name to its agents list: nm.write("skills/<name>/SKILL.md", {meta: {agents: [<the names already there>, "<your name>"]}}, <version>); from the next start it is one of your own. Remove only your own name the same way.` : ""
  ].filter(Boolean).join("\n"),
  unknownAgent: (name) => `No agent "${name}" in ContextCoreMCP. Read skills/contextcore-agent-1-setup/SKILL.md first. The owner already asked you to create yourself under this name → that is the yes. Otherwise offer the owner to create you, the agent, and create nothing before the owner says yes. After the yes: write agents/${name}/agent.md (your job as the agent and the owner's rules for you, the agent; nothing about one app) and agents/${name}/memory.md as that skill says, then call start again and go on with the owner's request.`,
  nothingNew: "nothing new",
  instructionsHead: "These are the owner's managed instructions for this agent. Apply them throughout this chat, before actions and in every message to the owner. Where a rule requires the owner's yes, that approval comes before completing the change; do all other clear work now, without asking. Use the checks below silently.",
  instructionsTag: "owner_rules",
  layerHeading: { tasks: "Tasks", notes: "Notes", system: "System", types: "Types" },
  rightsHeading: "Your rights",
  rightsAlways: "You read everything. Your own rules and memory: you change them from what the owner tells you, with no extra yes; no other agent can change them. Without a right, save nothing elsewhere instead: say which agent holds it, and do the rest of the request. A one-time exception from the owner doesn't replace a right.",
  rightTexts: {
    notes: {
      has: "Notes: you write the owner's notes and the projects' cards and files, by their rules, with no extra yes. The notes skill changes only after the owner's yes in this chat.",
      not: (who) => `Notes: you can't write the owner's notes or the projects' cards and files, or change the notes skill; ${who}.`
    },
    tasks: {
      has: "Tasks: you change the owner's task list, by its rules, with no extra yes. The task skill (statuses, levels, the brief) changes only after the owner's yes in this chat.",
      not: (who) => `Tasks: you can't change the owner's task list or the task skill; ${who}.`
    },
    types: {
      has: "Note types: you change the note types, their files and their rules, only after your analysis and the owner's yes to the exact change in this chat."
    },
    system: {
      has: "System: you change About the owner, the shared rules and the shared skills (no other right owns them, no agent made them for itself), after the owner's yes to the exact change in this chat. With the same yes, you give or take away any right for any agent (types goes only with system), and move lines out of other agents' memory.md, into About the owner, the shared rules or that agent's agent.md, when the review moves them.",
      not: (who, names) => `System: you can't change About the owner, the shared rules or the shared skills; ${who}. You may add a skill of your own after the owner's yes, and change only skills you made. Rights: you may add only yourself, and only to notes, tasks or notices, after the owner's yes in this chat. ${names ? `${names} gives every other right and takes rights away.` : "No agent can give other rights now."}`
    },
    notices: {
      has: "Notices: tell the owner each notice from start or whats_new once, in plain words, before your question; then mark it told in this turn's run (nm.write(path, {meta: {told: true}}, version)). If it comes back, tell it again."
    }
  },
  rightsWho: (names) => names ? `${names} can` : "no agent holds this right now",
  nextAction: "Now do what the owner asked; connecting is not the answer.",
  tasksNotCovered: "This does not cover the owner's tasks: list them again before showing them.",
  searchDownSkills: "Search is down: this is the full skill list instead of search results.",
  staleFix: "use these changes",
  inRepo: (id, p) => [`This place of ${p.name || id} is not on this server; only README.md, STATUS.md, CRITERIA.md, tasks/ and context/ are.`, `Places on this server: allowed (below). Everything else of ${p.name || id} is in its repo (${p.repo || "no repo on its card"}).`],
  untoldFix: "shown to you, not marked told yet",
  readFirstFix: "read it now; check this run's change by it and fix what breaks it, before you answer or make more changes of this kind"
};
const CARD_FIELDS = ["name", "what", "repo", "mac", "vector", "status", "successor", "aliases"];
const CARD_STATUSES = ["active", "paused", "done", "archive"];
const CARD_FORMAT = "name: <name>\nwhat: <the README's first line>\nrepo: <github.com/… of the project's own (private) repo, or empty>\nmac: <~/Desktop/… or empty>\nvector: <endeavor | maintenance | wellbeing | growth | joy>\nstatus: <active | paused | done | archive; empty = active>\nsuccessor: <id of the project that replaced it, or empty>\naliases: <other or old names, comma separated, or empty>\n\n<optional, after one empty line: anything more agents should know, free text (e.g. where the code lives)>";
const cardStatus = (p) => p.status || "active";
const CARD_WHAT_MAX = 150;
function parseCard(text = "") {
  const out = { name: "", what: "", repo: "", mac: "", vector: "", status: "", successor: "", aliases: "", notes: "", bad: [] };
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) {
      if (Object.values(out).some((v) => typeof v === "string" && v)) {
        out.notes = lines.slice(i + 1).join("\n").trim();
        break;
      }
      continue;
    }
    const m = l.match(/^([A-Za-z]+):[ \t]*(.*)$/);
    if (m) m[1] = m[1].toLowerCase();
    if (!m || !CARD_FIELDS.includes(m[1])) {
      out.bad.push(m ? m[1] : l.trim());
      continue;
    }
    out[m[1]] = m[2].trim();
  }
  return out;
}
function cutAtWord(t, max) {
  if (t.length <= max) return t;
  const c = t.slice(0, max - 1);
  const i = c.lastIndexOf(" ");
  return (i > max / 2 ? c.slice(0, i) : c).replace(/[\s,;:.·-]+$/, "") + "…";
}
function projectLine(id, p) {
  const head = (p.name || id).toLowerCase() === id ? p.name || id : `${p.name} (${id})`;
  const st = cardStatus(p);
  return [`${head}: ${cutAtWord(p.what || "(no description)", CARD_WHAT_MAX)}`, st !== "active" && st, p.successor && `replaced by ${p.successor}`, p.aliases && `also called ${p.aliases}`, p.repo, p.mac, p.notes && `more: ${cutAtWord(p.notes.replace(/\s+/g, " "), CARD_WHAT_MAX)}`].filter(Boolean).join(" · ");
}
const it = (path, title, line, extra = {}) => ({ path, title, line, ...extra });
const kb = (n) => `${(n / 1e3).toFixed(1)}k`;
function listRoot() {
  return ROOT_LINES.map(([n, w]) => it(n, n, w));
}
function listBrain(view) {
  const out = [];
  for (const p of view.paths()) {
    if (!p.startsWith("brain/")) continue;
    const f = view.file(p);
    if (f.meta.archived) continue;
    out.push(it(p, f.meta.title || p, [f.meta.type, f.meta.stage, f.meta.checked === false && "not checked", f.meta.unused && "unused"].filter(Boolean).join(", "), { version: view.version(p) }));
  }
  return out;
}
function listProjects(view) {
  return [it("projects/", "projects/", PROJECTS_HEADER), ...Object.entries(view.projects()).map(([id, p]) => it(`projects/${id}/card.md`, p.name || id, projectLine(id, p), { version: view.version(`projects/${id}/card.md`) }))];
}
function startProjects(view) {
  const all = Object.entries(view.projects());
  const others = all.filter(([, p]) => cardStatus(p) !== "active");
  const out = { title: START_PROJECTS_TITLE, cards: all.filter(([, p]) => cardStatus(p) === "active").map(([id, p]) => projectLine(id, p)) };
  if (others.length) out.others = START_PROJECTS_OTHERS(others.length, CARD_STATUSES.slice(1).map((st) => [st, others.filter(([, p]) => cardStatus(p) === st).length]).filter(([, n]) => n).map(([st, n]) => `${st} ${n}`).join(", "));
  return out;
}
function listFiles(view, prefix) {
  const out = [];
  const seen = new Set();
  for (const p of view.paths()) {
    if (!p.startsWith(prefix + "/")) continue;
    const rest = p.slice(prefix.length + 1);
    const slash = rest.indexOf("/");
    if (slash >= 0) {
      const d = rest.slice(0, slash + 1);
      if (!seen.has(d)) {
        seen.add(d);
        out.push(it(`${prefix}/${d}`, d, "folder"));
      }
      continue;
    }
    const f = view.file(p);
    out.push(it(p, f.meta.title || rest, firstLine(f.text), { version: view.version(p) }));
  }
  return out;
}
function listAgents(view) {
  return view.agents().map((a) => it(`agents/${a}/`, a, firstLine(view.file(`agents/${a}/agent.md`)?.text || "")));
}
function listAgent(view, name, caps) {
  const out = [];
  for (const f of ["agent.md", "memory.md"]) {
    const p = `agents/${name}/${f}`;
    const d = view.file(p);
    out.push(it(p, f, `${AGENT_LINES[f]} · ${kb(d ? d.text.length : 0)} of ${kb(caps[f])}`, d ? { version: view.version(p) } : {}));
  }
  const data = view.paths().filter((p) => p.startsWith(`agents/${name}/data/`)).map((p) => {
    const d = view.file(p);
    return it(p, d.meta.title || p.split("/").pop(), firstLine(d.text), { version: view.version(p) });
  });
  out.push(it(`agents/${name}/data/`, "data/", AGENT_LINES["data/"], { children: data }));
  return out;
}
const skillLine = (s) => `when: ${(s.when || s.description).replace(/\.+$/, "")}.`;
const SKILL_LINE_MAX = 150;
function ownSkillLine(s) {
  const marks = [s.type === "routine" && `routine, ${s.schedule}`, s.mac_only && "Mac only"].filter(Boolean);
  return `${s.name}: ${String(s.description || s.when || "").replace(/\s+/g, " ").trim()}${marks.length ? ` (${marks.join(", ")})` : ""}`;
}
function startSkillLine(s) {
  const own = s.installed ? "" : !s.by || s.by === "owner" ? "the owner's own" : `made by ${s.by}`;
  const marks = [s.type === "routine" && `routine, ${s.schedule}`, s.mac_only && "Mac only", own].filter(Boolean);
  const tail = marks.length ? ` (${marks.join(", ")})` : "";
  const desc = String(s.description || s.when || "").replace(/\s+/g, " ").trim();
  const first = (desc.match(/^.*?(?<!\b(?:e\.g|i\.e|etc|vs))[.!?](?=\s+["'(]?[A-Z]|$)/) || [desc])[0];
  let line = `${s.name}: ${first}`;
  const room = SKILL_LINE_MAX - tail.length;
  if (line.length > room) line = `${line.slice(0, room - 1).replace(/\s+\S*$/, "")}…`;
  return line + tail;
}
function listSkills(view) {
  return view.skills().map((s) => it(`skills/${s.name}/`, s.name, skillLine(s)));
}
function listSkill(view, name) {
  const s = view.skills().find((x) => x.name === name);
  const files = view.paths().filter((p) => p.startsWith(`skills/${name}/`));
  return [it(`skills/${name}/`, name, `${skillLine(s)} Files: ${files.map((p) => p.split("/").pop()).join(", ")}`, { children: files.map((p) => it(p, p.split("/").pop(), firstLine(view.file(p).text), { version: view.version(p) })) })];
}
function listSystem() {
  return SYSTEM_LINES.map(([n, w]) => it(`system/${n}`, n, w));
}
function listDictionaries(view, agent) {
  const out = Object.entries(DICT_LINES).filter(([d]) => view.file(`system/dictionaries/${d}.md`) && (d !== "note-types-suggestions" || view.has(agent, "types"))).map(([d, w]) => it(`system/dictionaries/${d}.md`, `${d}.md`, w, { version: view.version(`system/dictionaries/${d}.md`) }));
  const files = view.paths().filter((p) => /^system\/dictionaries\/note-types\/[^/]+\.yaml$/.test(p));
  if (files.length) out.push(it("system/dictionaries/note-types/", "note-types/", `one file per note type with its own fields: ${files.map((p) => p.split("/").pop()).join(", ")}`));
  return out;
}
function skillListAsHits(view) {
  return view.skills().map((s) => ({ path: `skills/${s.name}/SKILL.md`, space: "skills", title: s.name, meta: { when: s.when }, snippet: "", version: view.version(`skills/${s.name}/SKILL.md`) }));
}
const VECTOR_HEADINGS = { endeavor: "Endeavor", maintenance: "Maintenance", wellbeing: "Wellbeing", growth: "Growth", joy: "Joy" };
function todoSections(view, isOpen, posOf, levelOrder, vectorOrder, over, topCount = (l) => l.length) {
  const open = view.tasks().filter(isOpen);
  const ids = new Set(open.map((t) => t.id));
  const byOrder = (a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.id - b.id;
  const node = (t) => {
    const o = { id: t.id, position: posOf(t), short: t.short ?? null, title: t.title, status: t.status, priority: t.priority, project: t.project ?? null, vector: t.vector ?? null, description: t.description ?? null, deadline: t.deadline ?? null, day: t.day ?? null, has_comment: !!(t.comment && t.comment.trim()), version: view.taskVersion(t) };
    const kids = open.filter((c) => c.parent === t.id).sort(byOrder);
    if (kids.length) o.children = kids.map(node);
    return o;
  };
  const tops = open.filter((t) => t.parent == null || !ids.has(t.parent));
  const groups = new Map();
  for (const t of tops) {
    const k = view.sectionOf(t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const projects = view.projects();
  const keys = [...groups.keys()];
  const projKeys = keys.filter((k) => projects[k]).sort((a, b) => groups.get(b).length - groups.get(a).length || a.localeCompare(b));
  const vecKeys = vectorOrder.filter((k) => groups.has(k));
  const rest = keys.filter((k) => !projects[k] && !vectorOrder.includes(k));
  return [...projKeys, ...vecKeys, ...rest].map((k) => {
    const list = groups.get(k).sort(byOrder);
    const sec = { section: k, heading: projects[k] ? projects[k].name || k : VECTOR_HEADINGS[k] || k, count: list.length };
    if (topCount(list) > over) {
      const known = levelOrder.filter((p) => list.some((t) => t.priority === p));
      const other = [...new Set(list.map((t) => t.priority).filter((p) => !levelOrder.includes(p)))];
      sec.levels = [...known, ...other].map((p) => ({ priority: p, tasks: list.filter((t) => t.priority === p).map(node) }));
    } else sec.tasks = list.map(node);
    return sec;
  });
}
function firstLine(text) {
  return (text.split("\n").find((l) => l.trim() && !/^---/.test(l)) || "").replace(/^#+\s*/, "").trim().slice(0, 140);
}
export {
  AGENT_LINES,
  CARD_FIELDS,
  CARD_FORMAT,
  CARD_STATUSES,
  CARD_WHAT_MAX,
  DICT_LINES,
  MSG,
  PROJECTS_HEADER,
  ROOT_LINES,
  SKILL_LINE_MAX,
  START_PROJECTS_OTHERS,
  START_PROJECTS_TITLE,
  SYSTEM_LINES,
  VECTOR_HEADINGS,
  cardStatus,
  firstLine,
  it,
  listAgent,
  listAgents,
  listBrain,
  listDictionaries,
  listFiles,
  listProjects,
  listRoot,
  listSkill,
  listSkills,
  listSystem,
  ownSkillLine,
  parseCard,
  projectLine,
  skillListAsHits,
  startProjects,
  startSkillLine,
  todoSections
};
