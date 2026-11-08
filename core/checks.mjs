import { ROOT_LINES, SYSTEM_LINES, DICT_LINES, AGENT_LINES, projectLine, parseCard, CARD_FIELDS, CARD_STATUSES, CARD_FORMAT, MSG } from "./labels.mjs";
const CONFIG = {
  MAX_FILE_BYTES: 10 * 1024 * 1024,
  CAPS: { "agent.md": 4e3, "memory.md": 4e3, "user.md": 1500 },
  MAX_TASK_DEPTH: 2,
  PROJECT_WRITE_RIGHT: "notes",
  CACHE_REFUSALS: true,
  NOTICE_REPEAT_DAYS: 7,
  UNUSED_AFTER_DAYS: 30,
  ARCHIVE_KEEP_DAYS: 30,
  EXISTS_ON_TEXT_WITHOUT_VERSION: true,
  OP_CACHE_MINUTES: 15
};
const ORIGINS = ["you", "source", "agent", "mixed"];
const STAGES = ["raw", "processed"];
const VECTORS = {
  endeavor: "the owner's main work for income",
  maintenance: "keeping life running: documents, bills, repairs",
  wellbeing: "sleep, doctor, rest, no training load",
  growth: "hard and new: learning, workouts",
  joy: "pure pleasure"
};
const VECTOR_SAY = { endeavor: "your main work", maintenance: "upkeep", wellbeing: "health and rest", growth: "learning", joy: "just for fun" };
const NM_FUNCTIONS = ["list", "read", "find", "write", "save_task"];
const BEFORE_NAMES = [...NM_FUNCTIONS, "list:todo"];
const VECTOR_ORDER = ["endeavor", "maintenance", "wellbeing", "growth", "joy"];
const LEVELS_OVER = 7;
const normTitle = (t) => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w && !["a", "an", "the", "my"].includes(w)).join(" ");
const topCount = (list) => new Set(list.map((t) => t.day ? `r:${normTitle(t.title)}` : `id:${t.id}`)).size;
const SKILL_PATH_FIX = 'Write "skills/<name>/SKILL.md" with meta.description.';
const BRAIN_META = ["title", "type", "origin", "source", "checked", "original", "stage", "archived", "project"];
const SERVER_META = ["unused", "created", "by", "updated", "last_hit", "archived_at", "told_at", "installed"];
const PROJECT_ROOT_FILES = ["README.md", "STATUS.md", "CRITERIA.md"];
const PROJECT_PLACES = [...PROJECT_ROOT_FILES, "tasks/<YYMMDD-name>/task.md", "context/<folder>/<file>.md"];
const DICTS = { "note-types": "types", "task-statuses": "tasks", "task-priority": "tasks" };
const DICT_MARKS = { "note-types": [], "task-statuses": ["default", "closed"], "task-priority": ["default"] };
const TASK_FIELDS = ["id", "version", "short", "title", "status", "priority", "position", "parent", "project", "vector", "description", "deadline", "day", "comment", "add_comment"];
const SHORT_MAX = 40;
const TITLE_MAX = 100;
const DESCRIPTION_MAX = 120;
const TASK_SERVER_FIELDS = ["created", "by", "updated", "closed_at", "children", "parent_all_done", "has_comment", "section"];
const SPACES = ["brain", "todo", "projects", "agents", "skills", "system", "archive"];
const CHANGE_KEYS = ["text", "replace", "append", "meta", "move_to"];
const SHAPE_CODES = ["UNKNOWN_FIELD", "MISSING_FIELD", "UNKNOWN_VALUE", "SERVER_FIELD", "BAD_LINE", "BAD_DATE", "NEEDS_SOURCE", "NEEDS_VECTOR", "VECTOR_FROM_PROJECT", "EMPTY_TEXT", "USE_SAVE_TASK", "UNKNOWN_FOLDER", "UNKNOWN_PROJECT", "IN_REPO", "UNKNOWN_PATH", "READ_ONLY", "TOO_DEEP", "MIXED_LISTS"];
function sameCodeRefused(earlier) {
  return refuse("SAME_CODE_REFUSED", `This exact code was refused before (${earlier.code}).`, `${String(earlier.fix || "").replace(/\.\s*$/, "")}. Change the code.`);
}
function refuse(code, message, fix, extra = {}) {
  const r = { code, message, fix };
  for (const [k, v] of Object.entries(extra)) if (v !== void 0) r[k] = v;
  r.committed = false;
  return r;
}
const isRefusal = (e) => e && typeof e === "object" && typeof e.code === "string" && e.committed === false;
function bad(message, fix) {
  return refuse("BAD_CALL", message, fix);
}
const has = (v) => v !== void 0 && v !== null && !(typeof v === "string" && !v.trim()) && !(Array.isArray(v) && !v.length);
const pairs = (list) => list.map(([n, w]) => `${n} — ${w}`);
const vectorLines = () => Object.entries(VECTORS).map(([k, v]) => `${k} (say: ${VECTOR_SAY[k]}) — ${v}`);
function normPath(p, { allowEmpty = true } = {}) {
  if (p === void 0 || p === null) p = "/";
  if (typeof p !== "string") throw bad("path must be a string.", 'Pass a path like "brain/" or "projects/ai-content".');
  const s = p.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/").replace(/^\/+/, "");
  if (s.split("/").some((x) => x === ".." || x === ".")) throw bad(`Path "${p}" has "." or ".." parts.`, "Use a plain path from list().");
  if (!allowEmpty && !s) throw bad("path is empty.", "Pass a file path.");
  return s;
}
function unknownRoot(path) {
  return refuse("UNKNOWN_FOLDER", `There is no top folder "${path.split("/")[0]}".`, "Use one of the top folders below. Not sure what a folder takes? nm.list(path).", { path, allowed: pairs(ROOT_LINES) });
}
function classify(path, agent, view) {
  const parts = path.split("/");
  const top = parts[0];
  if (top === "todo") throw refuse("USE_SAVE_TASK", "The owner's to-do list is changed only with nm.save_task.", "Call nm.save_task({short, title, ...}) for a new task, or nm.save_task({id, version, ...}) to change one.", { path });
  if (parts.length === 1) {
    if (top === "user.md") return { area: "user" };
    if (top === "agents.md") return { area: "agents-md" };
    if (top === "access.yaml") return { area: "access" };
    throw unknownRoot(path);
  }
  switch (top) {
    case "brain":
      if (parts.length !== 2) throw refuse("UNKNOWN_FOLDER", `brain/ has no subfolders ("${path}").`, 'Write to "brain/" (the server names the file from meta.title) or to brain/<name>.md.', { path, allowed: ["brain/"] });
      return { area: "brain", name: parts[1] };
    case "projects": {
      const ps = view.projects();
      const id = parts[1];
      if (parts.length === 3 && parts[2] === "card.md" && id) {
        if (!ps[id] && (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || id in VECTORS || id === "none")) throw refuse("BAD_CALL", `"${id}" is not a project id.`, 'A project id is its short name: lowercase letters, digits and hyphens ("home-studio"); not a vector key and not "none".', { path });
        return { area: "project-card", project: id, isNew: !ps[id] };
      }
      if (!id || !ps[id]) throw refuse("UNKNOWN_PROJECT", id ? `There is no project "${id}".` : "No project given.", 'nm.list("projects") shows all projects.', { path, allowed: Object.entries(ps).map(([i, p]) => `${i} — ${projectLine(i, p)}`) });
      const rest = parts.slice(2);
      if (rest.length === 1 && PROJECT_ROOT_FILES.includes(rest[0])) return { area: "project-file", project: id, kind: "root" };
      if (rest[0] === "tasks" && rest.length === 2 && rest[1] === "") return { area: "project-file", project: id, kind: "task", folder: null };
      if (rest[0] === "tasks" && rest.length === 3 && rest[1] && rest[2] === "task.md") return { area: "project-file", project: id, kind: "task", folder: rest[1] };
      if (rest[0] === "context" && rest.length === 3 && rest[1] && /^(|[^/]+\.md)$/.test(rest[2])) return { area: "project-file", project: id, kind: "context", folder: rest[1] };
      const [message, fix] = MSG.inRepo(id, ps[id]);
      throw refuse("IN_REPO", message, fix, { path, repo: ps[id].repo || null, allowed: PROJECT_PLACES.map((x) => `projects/${id}/${x}`) });
    }
    case "agents": {
      const owner = parts[1];
      if (!owner) throw refuse("UNKNOWN_FOLDER", "No agent folder given.", `Your agent folder is "agents/${agent}/".`, { path });
      if (owner !== agent && /\.md$/.test(owner)) throw refuse("UNKNOWN_PATH", `There is no "${path}".`, owner === "agents.md" || owner === "user.md" ? `The ${owner === "agents.md" ? "shared rules are" : "About the owner file is"} "${owner}" at the top level: nm.read("${owner}").` : `Your files are agents/${agent}/agent.md and agents/${agent}/memory.md.`, { path });
      const sysEdit = owner !== agent && parts.length === 3 && (parts[2] === "memory.md" || parts[2] === "agent.md") && view && (view.rights().system || []).includes(agent) && view.agents().includes(owner);
      if (sysEdit) return { area: "agent", owner, file: parts[2] };
      if (owner !== agent) throw refuse("NOT_YOURS", `agents/${owner}/ belongs to agent "${owner}". You may read it, not change it.`, `Write only to your agent folder "agents/${agent}/".`, { path, who_can: [owner] });
      if (parts.length === 3 && (parts[2] === "agent.md" || parts[2] === "memory.md")) return { area: "agent", owner, file: parts[2] };
      if (parts[2] === "data" && parts.length === 4) return { area: "agent", owner, file: "data", name: parts[3] };
      throw refuse("UNKNOWN_FOLDER", `"${path}" is not a place in an agent folder.`, "An agent folder has only agent.md, memory.md and data/<file>.", { path, allowed: Object.entries(AGENT_LINES).map(([n, w]) => `agents/${agent}/${n} — ${w}`) });
    }
    case "skills": {
      if (parts.length === 2) {
        if (parts[1] === "") return { area: "skill", skill: null, file: "" };
        throw refuse("UNKNOWN_FOLDER", "A skill is a folder with SKILL.md.", `Write to "skills/${parts[1]}/SKILL.md".`, { path, allowed: ["skills/<name>/SKILL.md", "skills/<name>/<other file>"] });
      }
      if (parts.length === 3) return { area: "skill", skill: parts[1], file: parts[2] };
      throw refuse("UNKNOWN_FOLDER", "Skill folders have no subfolders.", `Write to "skills/${parts[1]}/<file>".`, { path });
    }
    case "system": {
      if (parts[1] === "dictionaries" && parts[2] === "note-types-suggestions.md" && parts.length === 3) return { area: "tag-suggestions" };
      if (parts[1] === "dictionaries" && parts[2] === "note-types" && parts.length === 4) {
        if (!/^[a-z][a-z0-9-]*\.yaml$/.test(parts[3])) throw refuse("UNKNOWN_FOLDER", `"${parts[3]}" is not a type file name.`, "A type file is system/dictionaries/note-types/<type>.yaml.", { path });
        return { area: "type-file", type: parts[3].replace(/\.yaml$/, "") };
      }
      if (parts[1] === "dictionaries" && parts.length === 3) {
        const dict = parts[2].replace(/\.md$/, "");
        if (!DICTS[dict] || !view.file(path)) throw refuse("UNKNOWN_FOLDER", `There is no dictionary "${parts[2]}".`, "These are the dictionaries.", { path, allowed: Object.entries(DICT_LINES).map(([d, w]) => `system/dictionaries/${d}.md — ${w}`) });
        return { area: "dictionary", dict };
      }
      if (parts[1] === "notices" && parts.length === 3) return { area: "notice", name: parts[2] };
      throw refuse("UNKNOWN_FOLDER", `system/ has no place "${parts.slice(1).join("/")}".`, "Use one of the places below.", { path, allowed: pairs(SYSTEM_LINES).map((l) => "system/" + l) });
    }
    default:
      throw unknownRoot(path);
  }
}
function needRight(view, agent, right, what) {
  const who = view.rights()[right] || [];
  if (who.includes(agent)) return;
  throw refuse("NO_RIGHT", `You ("${agent}") have no "${right}" right, needed to ${what}.`, who.length ? `Agents with the "${right}" right: ${who.join(", ")}.` : `No agent has the "${right}" right yet.`, { right, who_can: who });
}
const needRights = (view, agent, rights, what) => {
  for (const r of rights) needRight(view, agent, r, what);
};
const LAYER_ORDER = ["tasks", "notes", "system", "types"];
const LAYER_SKILLS = { tasks: "contextcore-tasks-1-rules", notes: "contextcore-notes-1-rules", system: "contextcore-system-1-rules", types: "contextcore-types-1-rules" };
const isLayerSkill = (name) => Object.values(LAYER_SKILLS).includes(name);
function skillRights(skill) {
  if (skill === LAYER_SKILLS.tasks) return ["tasks"];
  if (skill === LAYER_SKILLS.notes) return ["notes"];
  if (skill === LAYER_SKILLS.types) return ["types", "system"];
  return ["system"];
}
const dictRights = (dict) => dict === "note-types" ? ["types", "system"] : [DICTS[dict]];
function checkVersion({ exists: exists2, version, currentVersion, current, path, exempt = false, madeInRun = false }) {
  if (!exists2 || exempt) return;
  if (!version) throw refuse("NEEDS_VERSION", `"${path}" already exists; changing it needs the version you read.`, "Pass the version from current (below) as the third argument, after checking that your change still fits. Nothing was overwritten.", { path, current });
  if (version !== currentVersion) {
    if (madeInRun) throw refuse("STALE_VERSION", `"${path}" was changed by an earlier call in this same run (it returned version ${currentVersion}). Use the version it returned.`, "Use the version that call returned, or read it again in this run. Nothing from this run is saved.", { path, current: { ...current, in_this_run: true } });
    throw refuse("STALE_VERSION", `"${path}" changed since you read it (yours ${version}, now ${currentVersion}).`, "Look at current (below), apply only the change you, the agent, intended to it, and write again with its version.", { path, current });
  }
}
function exists(path, version, current) {
  return refuse("EXISTS", `"${path}" already exists.`, "Append to it, or pick another title.", { path, version, current });
}
function checkSize(text, path) {
  const n = Buffer.byteLength(text || "", "utf8");
  if (n > CONFIG.MAX_FILE_BYTES) throw refuse("TOO_BIG", `The file is ${(n / 1048576).toFixed(1)} MB; the limit is 10 MB.`, "Files over 10 MB are not kept here.", { path });
}
function checkChange(change) {
  if (!change || typeof change !== "object" || Array.isArray(change)) throw bad("write needs a change object.", "nm.write(path, {text} | {append} | {replace: [old, new]} | {meta} | {move_to}, version?).");
  for (const k of Object.keys(change)) if (!CHANGE_KEYS.includes(k)) throw refuse("UNKNOWN_FIELD", `change has no key "${k}".`, `Use {text?} | {replace?: [old, new]} | {append?}, plus meta?; or {move_to}.${BRAIN_META.includes(k) ? " Meta keys go in change.meta: {text, meta: {title, original, …}}." : ""}`, { field: k, allowed: CHANGE_KEYS });
  const body = ["text", "replace", "append"].filter((k) => change[k] !== void 0);
  if (body.length > 1) throw bad(`Use only one of text, replace, append (got ${body.join(", ")}).`, "Send only what changes: append to add, replace for one spot.");
  if (change.meta !== void 0 && (typeof change.meta !== "object" || change.meta === null || Array.isArray(change.meta))) throw bad("meta must be an object.", 'meta: {title: "…", type: "idea", …}.');
  for (const k of ["text", "append"]) if (change[k] !== void 0 && typeof change[k] !== "string") throw bad(`${k} must be a string.`, `Pass ${k}: "…".`);
  if (change.replace !== void 0 && !(Array.isArray(change.replace) && change.replace.length === 2 && change.replace.every((x) => typeof x === "string"))) throw bad("replace must be [old, new] (two strings).", 'replace: ["old words", "new words"].');
  return body[0];
}
function serverFields(changeMeta, path) {
  for (const k of Object.keys(changeMeta || {})) if (SERVER_META.includes(k)) throw refuse("SERVER_FIELD", `"${k}" is set by the server only.`, `Leave out meta.${k}.`, { path, field: k });
}
function mergeMeta(oldMeta, changeMeta, path) {
  const meta = { ...oldMeta };
  for (const [k, v] of Object.entries(changeMeta || {})) {
    if (k === "asked_owner") continue;
    if (v === null) {
      delete meta[k];
      continue;
    }
    if (k === "source") {
      const cur = Array.isArray(meta.source) ? meta.source : meta.source ? [meta.source] : [];
      if (typeof v === "object" && !Array.isArray(v)) {
        if (!Array.isArray(v.remove) || Object.keys(v).length !== 1) throw refuse("UNKNOWN_VALUE", "source takes a link, a list of links, or {remove: [links]}.", "To add: source: [link]. To remove one: source: {remove: [link]}.", { path, field: "source" });
        meta.source = cur.filter((x) => !v.remove.includes(x));
      } else {
        const add = Array.isArray(v) ? v : [v];
        if (!add.every((x) => typeof x === "string" && x.trim())) throw refuse("UNKNOWN_VALUE", 'source must be a link or "chat DD.MM", or a list of them.', 'Pass source: ["https://…", "chat 25.10"].', { path, field: "source" });
        meta.source = [...new Set([...cur, ...add.map((x) => x.trim())])];
      }
      continue;
    }
    meta[k] = v;
  }
  return meta;
}
function processedOrigin(changeMeta, meta, path) {
  if (!changeMeta || changeMeta.stage !== "processed") return;
  if ("origin" in changeMeta) {
    if (!["mixed", "you"].includes(changeMeta.origin)) throw refuse("UNKNOWN_VALUE", `origin ${JSON.stringify(changeMeta.origin)} can't go with stage processed.`, `A processed note has origin "mixed", or "you" if it is now fully the owner's words.`, { path, field: "origin", allowed: ["mixed", "you"] });
    return;
  }
  if (meta.origin === "source" || meta.origin === "agent") meta.origin = "mixed";
}
function preCheck(c) {
  const { view, agent, cls } = c;
  switch (cls.area) {
    case "brain":
      return needRight(view, agent, "notes", "write the owner's notes");
    case "project-card":
      return needRight(view, agent, CONFIG.PROJECT_WRITE_RIGHT, cls.isNew ? "add a project card" : `change the card of "${cls.project}"`);
    case "project-file":
      return needRight(view, agent, CONFIG.PROJECT_WRITE_RIGHT, `change the files of "${cls.project}"`);
    case "notice":
      return needRight(view, agent, "notices", "change notices");
    case "user":
    case "agents-md":
    case "skill":
      return checkLayerFile(c);
    case "dictionary":
      return needRights(view, agent, dictRights(cls.dict), `change the ${cls.dict} dictionary`);
    case "type-file":
      return needRights(view, agent, ["types", "system"], "change note type files");
    case "tag-suggestions":
      return needRight(view, agent, "types", "change the note type suggestions");
    default:
      return;
  }
}
const isAppendOnly = (change) => change.append !== void 0 && change.text === void 0 && change.replace === void 0 && !change.meta;
function checkWrite(c) {
  checkSize(c.next.text, c.path);
  switch (c.cls.area) {
    case "brain":
      return checkBrain(c);
    case "project-card":
      return checkCard(c);
    case "project-file": {
      const extra = Object.keys(c.changeMeta || {}).filter((k) => k !== "title");
      if (extra.length) throw refuse("UNKNOWN_FIELD", `A project file has no meta ("${extra[0]}").`, "Send only text (and meta.title for a new file); put everything into the text, as the README says.", { path: c.path, field: extra[0] });
      return { setMeta: {} };
    }
    case "agent":
      return checkAgent(c);
    case "skill":
      return checkSkill(c);
    case "dictionary":
      return checkDictionary(c);
    case "tag-suggestions":
      return checkTagSuggestions(c);
    case "type-file":
      return checkTypeFile(c);
    case "notice":
      return checkNotice(c);
    case "user":
      serverFields(c.changeMeta, c.path);
      checkFactDates(c.path, c.existing, c.next);
      return { setMeta: {} };
    case "agents-md":
      serverFields(c.changeMeta, c.path);
      return { setMeta: {} };
    case "access":
      return checkAccess(c);
    default:
      throw refuse("UNKNOWN_FOLDER", `Unknown place "${c.path}".`, 'nm.list("/").', { path: c.path });
  }
}
function value(field, v, allowed, path, fix) {
  if (!allowed.includes(v)) throw refuse("UNKNOWN_VALUE", `${field} ${JSON.stringify(v)} is not allowed.`, fix || "Use one of allowed.", { path, field, allowed });
}
function checkBrain({ view, agent, path, next, changeMeta, isCreate }) {
  needRight(view, agent, "notes", "write the owner's notes");
  serverFields(changeMeta, path);
  const m = next.meta;
  const tf = typeof m.type === "string" ? view.typeFile(m.type) : null;
  const own = tf ? Object.keys(tf.fields) : [];
  const allowedMeta = [...BRAIN_META, ...own];
  for (const k of Object.keys(m)) if (!allowedMeta.includes(k) && !SERVER_META.includes(k)) throw refuse("UNKNOWN_FIELD", `A ${typeof m.type === "string" ? `"${m.type}" ` : ""}note has no field "${k}".`, `Fields: ${allowedMeta.join(", ")}. {${k}: null} removes it.`, { path, field: k, allowed: allowedMeta });
  const missing = ["title", "type", "origin"].filter((k) => !has(m[k]));
  if (missing.length) throw refuse("MISSING_FIELD", `A brain note needs ${missing.join(", ")}.`, `Add meta.${missing.join(", meta.")}.`, { path, field: missing[0] });
  if (typeof m.title !== "string") throw refuse("UNKNOWN_VALUE", "title must be text.", "Pass meta.title as a short string.", { path, field: "title" });
  if (typeof m.type !== "string" || m.type.length > 40 || /[|\n]/.test(m.type)) throw refuse("UNKNOWN_VALUE", "type must be a short name.", "Pass meta.type as one short word from the type list.", { path, field: "type" });
  const known = view.dict("note-types").map((d) => d.value).includes(m.type);
  for (const [f, def] of Object.entries(tf ? tf.fields : {})) {
    if (!has(m[f])) {
      if (def.required) throw refuse("MISSING_FIELD", `A "${m.type}" note needs ${f}.`, `Add meta.${f}: ${def.value}.`, { path, field: f });
      continue;
    }
    if (!fieldValueOk(def.spec, m[f])) throw refuse(def.spec.kind === "date" ? "BAD_DATE" : "UNKNOWN_VALUE", `${f} ${JSON.stringify(m[f])} is not ${def.value}.`, def.spec.kind === "one of" ? "Use one of allowed." : `${f}: ${FIELD_VALUE_HELP[def.spec.kind]}.`, { path, field: f, allowed: def.spec.values });
  }
  value("origin", m.origin, ORIGINS, path, `"you" = the owner's words · source = from a link, book or person · agent = the agent's conclusion · mixed = the agent's summary of the owner's words or of source material.`);
  if (has(m.stage)) value("stage", m.stage, STAGES, path);
  if (m.checked !== void 0 && typeof m.checked !== "boolean") throw refuse("UNKNOWN_VALUE", `checked must be true or false (got ${JSON.stringify(m.checked)}).`, "checked: true only if you, the agent, opened or watched every source; else false.", { path, field: "checked", allowed: [true, false] });
  if (m.archived !== void 0 && typeof m.archived !== "boolean") throw refuse("UNKNOWN_VALUE", "archived must be true or false.", "Pass {archived: true} to archive, {archived: false} to bring it back.", { path, field: "archived", allowed: [true, false] });
  if (has(m.project) && !view.projects()[m.project]) throw refuse("UNKNOWN_PROJECT", `There is no project "${m.project}".`, 'Use a project id from list("projects"), or leave project out.', { path, field: "project", allowed: Object.keys(view.projects()) });
  if (m.origin !== "you") {
    const miss = !has(m.source) ? "source" : typeof m.checked !== "boolean" ? "checked" : null;
    if (miss) throw refuse("NEEDS_SOURCE", `origin "${m.origin}" needs source and checked (missing: ${miss}).`, 'Add source (links or "chat DD.MM") and checked (true or false).', { path, field: miss });
  }
  if (!next.text.trim()) throw refuse("EMPTY_TEXT", "A note can't have empty text.", "Archive instead: {meta: {archived: true}}.", { path, field: "text" });
  return { setMeta: isCreate ? { stage: "raw" } : {}, suggestType: known ? null : m.type };
}
const TYPE_FILE_FORMAT = "type: <name>\nmeaning: <one line>\nfields:\n  <field>:\n    value: text | link | date | one of [a, b, …]\n    required: true | false\n    meaning: <one line, optional>";
const FIELD_VALUE_HELP = { text: "text", link: "a link (https://… or site.com/…)", date: "a date YYYY-MM-DD" };
const unq = (x) => x.replace(/^(["'])(.*)\1$/, "$2");
function parseValueSpec(v) {
  if (["text", "link", "date"].includes(v)) return { kind: v };
  const m = String(v).match(/^one of \[(.*)\]$/);
  if (!m) return null;
  const values = m[1].split(",").map((x) => unq(x.trim())).filter(Boolean);
  return values.length ? { kind: "one of", values } : null;
}
function parseTypeFile(text) {
  const out = { type: "", meaning: "", fields: {} };
  let cur = null;
  let inFields = false;
  text.split("\n").forEach((raw, i) => {
    const l = raw.replace(/\s+#.*$/, "").replace(/^\s*#.*$/, "");
    if (!l.trim()) return;
    let m;
    if (m = l.match(/^(type|meaning):\s*(.*)$/)) {
      out[m[1]] = unq(m[2].trim());
      inFields = false;
      cur = null;
      return;
    }
    if (/^fields:\s*(\{\s*\})?\s*$/.test(l)) {
      inFields = true;
      return;
    }
    if (inFields && (m = l.match(/^ {2}([a-z][a-z0-9_-]*):\s*$/))) {
      if (out.fields[m[1]]) throw new Error(`field "${m[1]}" twice`);
      cur = out.fields[m[1]] = {};
      return;
    }
    if (inFields && cur && (m = l.match(/^ {4}(value|required|meaning):\s*(.*)$/))) {
      cur[m[1]] = unq(m[2].trim());
      return;
    }
    throw new Error(`line ${i + 1} "${raw.trim()}" is not in the format`);
  });
  if (!out.type) throw new Error('no "type:" line');
  for (const [name, f] of Object.entries(out.fields)) {
    f.spec = parseValueSpec(f.value || "");
    if (!f.spec) throw new Error(`field "${name}": value "${f.value || ""}" is not text, link, date or one of [a, b]`);
    if (f.required === void 0 || f.required === "false") f.required = false;
    else if (f.required === "true") f.required = true;
    else throw new Error(`field "${name}": required must be true or false`);
  }
  return out;
}
const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v + "T00:00:00Z")) && (new Date(v + "T00:00:00Z")).toISOString().slice(0, 10) === v;
function fieldValueOk(spec, v) {
  if (typeof v !== "string" || !v.trim()) return false;
  if (spec.kind === "text") return true;
  if (spec.kind === "link") return /^https?:\/\/\S+$/.test(v) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v);
  if (spec.kind === "date") return validDate(v);
  return spec.values.includes(v);
}
function checkTypeFile({ view, agent, path, cls, next, changeMeta }) {
  needRights(view, agent, ["types", "system"], "change note type files");
  const extra = Object.keys(changeMeta || {});
  if (extra.length) throw refuse("UNKNOWN_FIELD", `A type file has no meta ("${extra[0]}").`, "Send only text.", { path, field: extra[0] });
  let t;
  try {
    t = parseTypeFile(next.text);
  } catch (e) {
    throw refuse("BAD_LINE", `The type file does not parse: ${e.message}.`, `Format:
${TYPE_FILE_FORMAT}`, { path });
  }
  if (t.type !== cls.type) throw refuse("BAD_LINE", `"type: ${t.type}" does not match the file name "${cls.type}.yaml".`, `Format:
${TYPE_FILE_FORMAT}`, { path, field: "type" });
  const clash = Object.keys(t.fields).find((f) => BRAIN_META.includes(f) || SERVER_META.includes(f));
  if (clash) throw refuse("BAD_LINE", `"${clash}" is a common note field; a type file has only the type's own fields.`, `Format:
${TYPE_FILE_FORMAT}`, { path, field: clash });
  const old = view.typeFile(cls.type);
  for (const f of Object.keys(old ? old.fields : {}).filter((x) => !(x in t.fields))) {
    const n = view.paths().filter((p) => p.startsWith("brain/") && view.file(p).meta.type === cls.type && has(view.file(p).meta[f])).length;
    if (n) throw refuse("IN_USE", `"${f}" is used by ${n} notes, so it can't be removed.`, `Remove ${f} from those notes first, or keep it.`, { path, field: f });
  }
  return { setMeta: {} };
}
function checkCard({ view, agent, path, cls, next, changeMeta }) {
  needRight(view, agent, CONFIG.PROJECT_WRITE_RIGHT, cls.isNew ? "add a project card" : `change the card of "${cls.project}"`);
  serverFields(changeMeta, path);
  const extra = Object.keys({ ...next.meta, ...changeMeta }).filter((k) => !SERVER_META.includes(k));
  if (extra.length) throw refuse("UNKNOWN_FIELD", `A project card has no meta ("${extra[0]}").`, `Send only text: ${CARD_FORMAT}`, { path, field: extra[0], allowed: CARD_FIELDS });
  const c = parseCard(next.text);
  if (c.bad.length) throw refuse("UNKNOWN_FIELD", `A project card has only ${CARD_FIELDS.join(", ")} ("${c.bad[0]}" is not one).`, `Anything more about the project goes to its repo. Card: ${CARD_FORMAT}`, { path, field: c.bad[0], allowed: CARD_FIELDS });
  const missing = ["name", "what", "vector"].filter((k) => !c[k]);
  if (missing.length) throw refuse("MISSING_FIELD", `A project card needs ${missing.join(" and ")}.`, `Card: ${CARD_FORMAT}`, { path, field: missing[0], allowed: CARD_FIELDS });
  value("vector", c.vector, Object.keys(VECTORS), path, "The vector from the project's README (Vector:).");
  if (c.status) value("status", c.status, CARD_STATUSES, path, "Empty or active = active.");
  if (c.successor) {
    const ps = view.projects();
    if (c.successor === cls.project || !ps[c.successor]) throw refuse("UNKNOWN_PROJECT", `successor "${c.successor}" is not another project.`, "successor = the id of the project that replaced this one.", { path, field: "successor", allowed: Object.keys(ps).filter((k) => k !== cls.project) });
  }
  if (cls.isNew && !c.repo && (!c.status || c.status === "active")) throw refuse("MISSING_FIELD", "A new project needs its GitHub repo.", `Card: ${CARD_FORMAT}`, { path, field: "repo", allowed: CARD_FIELDS });
  return { setMeta: {} };
}
const FACT_DATE_RE = /\([^()]*\b\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\b[^()]*\)\s*\.?\s*$/;
function checkFactDates(path, existing, next) {
  const before = new Set((existing && existing.text || "").split("\n"));
  const bad2 = next.text.split("\n").filter((l) => /^\s*- /.test(l) && !before.has(l) && !FACT_DATE_RE.test(l));
  if (bad2.length) throw refuse("BAD_LINE", `A fact line has no date: "${bad2[0].trim()}".`, 'End each fact line with its true source and date: "(owner, DD.MM)" or "(<app name> memory, DD.MM)". Keep the source you had. Date unclear → the date you save it. A moved line keeps its own date.', { path, lines: bad2.slice(0, 5) });
}
const FROM_APP_MEMORY_RE = /\([^()]*\bmemory\b[^()]*\b\d{1,2}\.\d{1,2}\b[^()]*\)\s*\.?\s*$/i;
function checkAgent({ agent, path, cls, next, changeMeta, existing }) {
  serverFields(changeMeta, path);
  if (cls.file === "memory.md") checkFactDates(path, existing, next);
  if (cls.file === "agent.md" && agent === cls.owner) {
    const before = new Set((existing && existing.text || "").split("\n"));
    const fromApp = next.text.split("\n").filter((l) => /^\s*- /.test(l) && !before.has(l) && FROM_APP_MEMORY_RE.test(l));
    if (fromApp.length) throw refuse("BAD_LINE", `"${fromApp[0].trim()}" comes from your app's memory, not from the owner to you.`, "agent.md holds only the rules the owner gave you for this job. Put every line from your app's memory into memory.md (or data/) word for word with its source; the system agent's review sorts it.", { path, lines: fromApp.slice(0, 5) });
  }
  const cap = CONFIG.CAPS[cls.file];
  if (cap && next.text.length > cap) throw refuse("OVER_CAP", `${cls.file} would be ${next.text.length} characters; the cap is ${cap}.`, "Move growing lists to data/.", { path, current: { length: next.text.length, cap } });
  return { setMeta: {} };
}
function onlyOwnName(existing, change, agent) {
  if (!existing || !change || Object.keys(change).some((k) => k !== "meta") || !change.meta || Object.keys(change.meta).some((k) => k !== "agents")) return false;
  const a = [].concat(existing.meta.agents || []), b = [].concat(change.meta.agents || []);
  const added = b.filter((x) => !a.includes(x)), removed = a.filter((x) => !b.includes(x));
  return added.length + removed.length === 1 && [...added, ...removed][0] === agent;
}
function checkLayerFile({ cls, path, view, agent, existing, change }) {
  if (cls.area === "user") return needRight(view, agent, "system", "change About the owner (user.md)");
  if (cls.area === "agents-md") return needRight(view, agent, "system", "change the shared rules (agents.md)");
  const main = cls.skill ? view.file(`skills/${cls.skill}/SKILL.md`) : null;
  if (cls.skill && cls.file === "SKILL.md" && onlyOwnName(existing, change, agent)) return;
  if (main && main.meta.installed === true) throw refuse("READ_ONLY", `"${cls.skill}" is an installed skill; nobody edits it.`, "Installed skills are read only.", { path });
  if (cls.skill && !isLayerSkill(cls.skill) && (!main || main.meta.by === agent)) return;
  return needRights(view, agent, skillRights(cls.skill), cls.skill ? `change the skill "${cls.skill}"` : "add a skill");
}
function checkSkill({ agent, path, cls, next, changeMeta, isCreate, view, existing, change }) {
  serverFields(changeMeta, path);
  if (cls.file === "SKILL.md") {
    if (!has(next.meta.when) && !has(next.meta.description)) throw refuse("MISSING_FIELD", 'A skill needs "description" (one line: when to use it).', 'Add meta.description: "<one line: when an agent should use this skill>".', { path, field: "description" });
    if (next.meta.type !== void 0 && next.meta.type !== "routine") throw refuse("BAD_LINE", `type "${next.meta.type}" is not a skill type.`, 'Use type: "routine", or leave type out.', { path, field: "type", allowed: ["routine"] });
    if (next.meta.type === "routine" && !has(next.meta.schedule)) throw refuse("MISSING_FIELD", 'A routine skill needs "schedule" (when the app runs it).', 'Add meta.schedule, e.g. "every day 09:00 (Europe/Berlin)".', { path, field: "schedule" });
    const ag = next.meta.agents;
    if (ag !== void 0 && !(Array.isArray(ag) && ag.every((x) => typeof x === "string" && /^[a-z][a-z0-9-]*$/.test(x)))) throw refuse("BAD_LINE", `agents must be a list of agent names (got ${JSON.stringify(ag)}).`, 'agents: ["<your name>", …]: the agents that get this skill at start ("all" = every agent).', { path, field: "agents" });
    const b = next.meta.before;
    if (b !== void 0 && !(Array.isArray(b) && b.every((f) => BEFORE_NAMES.includes(f)))) throw refuse("BAD_LINE", `before must be a list of nm function names (got ${JSON.stringify(b)}).`, `before: [${BEFORE_NAMES.map((f) => `"${f}"`).join(", ")}] (any of them), or leave it out.`, { path, field: "before", allowed: BEFORE_NAMES });
    if (isCreate && next.meta.agents === void 0 && !next.meta.installed) return { setMeta: { agents: [agent] } };
    return { setMeta: {} };
  }
  if (!view.file(`skills/${cls.skill}/SKILL.md`)) throw refuse("MISSING_FIELD", `Skill "${cls.skill}" has no SKILL.md yet.`, `${SKILL_PATH_FIX.replace("<name>", cls.skill)} Write it first, in the same run.`, { path, field: "when" });
  return { setMeta: {} };
}
const DICT_LINE_RE = /^([a-z][a-z0-9 _-]*?)\s*((?:\((?:default|closed)\)\s*)*)\s+(?:—|–|-{1,2})\s+(\S.*)$/i;
function parseDict(text = "") {
  const values = [];
  const bad2 = [];
  text.split("\n").forEach((raw, i) => {
    const l = raw.trim();
    if (!l || l.startsWith("#")) return;
    const m = l.match(DICT_LINE_RE);
    if (!m) {
      bad2.push({ n: i + 1, line: l });
      return;
    }
    values.push({ value: m[1].trim(), meaning: m[3].trim(), default: /\(default\)/.test(m[2]), closed: /\(closed\)/.test(m[2]) });
  });
  return { values, bad: bad2 };
}
function checkDictionary({ view, agent, path, cls, existing, next }) {
  needRights(view, agent, dictRights(cls.dict), `change the ${cls.dict} dictionary`);
  const fmt = DICT_LINES[cls.dict];
  const { values, bad: bad2 } = parseDict(next.text);
  if (bad2.length) throw refuse("BAD_LINE", `Line ${bad2[0].n} "${bad2[0].line}" is not a dictionary line.`, `Format: ${fmt}`, { path });
  if (!values.length) throw refuse("BAD_LINE", "The dictionary has no values left.", `Format: ${fmt}`, { path });
  for (const v of values) {
    if (v.closed && !DICT_MARKS[cls.dict].includes("closed")) throw refuse("BAD_LINE", `"(closed)" is not used in ${cls.dict}.`, `Format: ${fmt}`, { path });
    if (v.default && !DICT_MARKS[cls.dict].includes("default")) throw refuse("BAD_LINE", `"(default)" is not used in ${cls.dict}.`, `Format: ${fmt}`, { path });
  }
  if (DICT_MARKS[cls.dict].includes("default") && values.filter((v) => v.default).length !== 1) throw refuse("BAD_LINE", 'Exactly one line needs "(default)".', `Format: ${fmt}`, { path });
  const names = values.map((v) => v.value);
  if (new Set(names).size !== names.length) throw refuse("BAD_LINE", "A value is listed twice.", `Format: ${fmt}`, { path });
  for (const v of parseDict(existing.text).values.map((d) => d.value).filter((x) => !names.includes(x))) {
    const n = view.valueUses(cls.dict, v);
    if (n > 0) throw refuse("IN_USE", `"${v}" is used by ${n} ${cls.dict === "note-types" ? "notes" : "tasks"}, so it can't be removed.`, "Move those to another value first, or keep this value.", { path, field: v });
  }
  return { setMeta: {} };
}
const TAG_LINE_FORMAT = "<type> | <note path> | <date>";
function checkTagSuggestions({ view, agent, path, next }) {
  needRight(view, agent, "types", "change the note type suggestions");
  const l = next.text.split("\n").map((x) => x.trim()).find((x) => x && !x.startsWith("#") && x.split("|").length !== 3);
  if (l) throw refuse("BAD_LINE", `Line "${l}" is not "${TAG_LINE_FORMAT}".`, `One line per suggestion: "${TAG_LINE_FORMAT}".`, { path });
  return { setMeta: {} };
}
function checkNotice({ view, agent, path, change, isCreate }) {
  needRight(view, agent, "notices", "change notices");
  const keys = Object.keys(change.meta || {});
  if (isCreate || change.text !== void 0 || change.append !== void 0 || change.replace !== void 0 || !keys.length || keys.some((k) => k !== "told")) throw refuse("READ_ONLY", 'Only "told" may change on a notice.', "Only write(n.path, {meta: {told: true}}, n.version).", { path, field: keys.find((k) => k !== "told") });
  if (typeof change.meta.told !== "boolean") throw refuse("UNKNOWN_VALUE", "told must be true or false.", "{meta: {told: true}}.", { path, field: "told", allowed: [true, false] });
  return { setMeta: {} };
}
const SELF_RIGHTS = ["notes", "tasks", "notices"];
function checkAccess({ agent, path, existing, next }) {
  let oldA, newA;
  try {
    oldA = parseAccessYaml(existing ? existing.text : "");
  } catch {
    oldA = {};
  }
  try {
    newA = parseAccessYaml(next.text);
  } catch (e) {
    throw refuse("BAD_LINE", `access.yaml does not parse: ${e.message}`, 'Keep the format "<right>: [name, name]", one right per line. The old file stays.', { path });
  }
  const changes = [];
  for (const [right, names] of Object.entries(oldA)) for (const n of names) if (!(newA[right] || []).includes(n)) changes.push({ right, n, add: false });
  for (const [right, names] of Object.entries(newA)) for (const n of names) if (!(oldA[right] || []).includes(n)) changes.push({ right, n, add: true });
  const system = oldA.system || [];
  const head = (t) => (t || "").split("\n").filter((l) => l.trim().startsWith("#")).join("\n");
  if (!system.includes(agent) && head(existing && existing.text) !== head(next.text)) throw refuse("NO_RIGHT", 'Without the "system" right you may not change the comment lines of access.yaml.', system.length ? `Agents with the "system" right: ${system.join(", ")}.` : 'No agent has the "system" right yet.', { path, right: "system", who_can: system });
  if (!system.includes(agent)) {
    const bad2 = changes.filter((c) => !c.add || c.n !== agent || !SELF_RIGHTS.includes(c.right));
    if (bad2.length) {
      const what = bad2.map((c) => `${c.add ? "adds" : "removes"} ${c.n} ${c.add ? "to" : "from"} ${c.right}`).join(", ");
      throw refuse("NO_RIGHT", `Without the "system" right you may add only yourself, and only to ${SELF_RIGHTS.join(", ")} (this change ${what}).`, system.length ? `Agents with the "system" right: ${system.join(", ")}.` : 'No agent has the "system" right yet.', { path, right: "system", who_can: system });
    }
  }
  const noSystem = (newA.types || []).filter((n) => !(newA.system || []).includes(n));
  if (noSystem.length) throw refuse("BAD_LINE", `"types" goes only with "system" (${noSystem.join(", ")} would have types without system).`, "Give system and types together, or neither.", { path, field: "types" });
  return { setMeta: {} };
}
function parseAccessYaml(text) {
  const out = {};
  let cur = null;
  text.split("\n").forEach((raw, i) => {
    const l = raw.replace(/\s+#.*$/, "").replace(/^#.*$/, "");
    if (!l.trim()) return;
    let m;
    if (m = l.match(/^([A-Za-z_][\w-]*):\s*\[(.*)\]\s*$/)) {
      out[m[1]] = m[2].split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      cur = null;
      return;
    }
    if (m = l.match(/^([A-Za-z_][\w-]*):\s*$/)) {
      out[m[1]] = [];
      cur = m[1];
      return;
    }
    if ((m = l.match(/^\s+-\s+(\S+)\s*$/)) && cur) {
      out[cur].push(m[1].replace(/^["']|["']$/g, ""));
      return;
    }
    throw new Error(`line ${i + 1}: "${raw.trim()}"`);
  });
  for (const [k, v] of Object.entries(out)) if (!v.every((n) => /^[\w-]+$/.test(n))) throw new Error(`bad name in ${k}`);
  return out;
}
function checkOrder(view, input, scopeOf) {
  const extra = Object.keys(input).filter((k) => k !== "order");
  if (extra.length) throw bad(`order goes alone (got also ${extra.join(", ")}).`, "Send save_task({order: [id, id, …]}) by itself (ids top first); other changes in their own save_task. One task to a place: save_task({id, version, position}).");
  const ids = input.order;
  if (!Array.isArray(ids) || !ids.length || !ids.every((x) => Number.isInteger(Number(x)))) throw bad("order must be a list of task ids, top first.", "save_task({order: [103, 104, 101, 105, 102]}) with the ids of the list you showed the owner.");
  const list = ids.map(Number);
  if (new Set(list).size !== list.length) throw bad("An id is listed twice.", "List each task once, top first.");
  const closed = view.closedStatuses();
  const tasks = list.map((id) => view.task(id));
  const gone = list.filter((id, i) => !tasks[i] || closed.has(tasks[i].status));
  if (gone.length) throw refuse("NOT_FOUND", `No open task ${gone.join(", ")}.`, 'Use ids of open tasks from a fresh nm.list("todo").', { field: "order" });
  const scopes = tasks.map((t) => scopeOf(t));
  const odd = tasks.filter((t, i) => scopes[i].key !== scopes[0].key);
  if (odd.length) throw refuse("MIXED_LISTS", `These tasks are not in one list: ${[...new Set(scopes.map((x) => x.label))].join(" · ")}.`, "One call per list: the ids of one section (one level, where it shows levels) or of one parent's subtasks, top first.", { field: "order", allowed: [...new Set(scopes.map((x) => x.label))] });
  return list;
}
function checkTask({ view, agent, input, existing, currentVersion, madeInRun = false, scopeOf }) {
  needRight(view, agent, "tasks", "change the owner's tasks");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw bad("save_task needs one task object.", 'nm.save_task({title, vector}) or nm.save_task({id, version, priority: "high"}).');
  if (input.order !== void 0) return { order: checkOrder(view, input, scopeOf) };
  if ("date" in input) throw refuse("UNKNOWN_FIELD", 'Tasks have no field "date".', 'deadline: "YYYY-MM-DD" = done by that day (a hard deadline). day: "YYYY-MM-DD" = done on that day (an event, one copy of a repeating task). Approximate → add_comment "approx: <real dates>".', { field: "date", allowed: TASK_FIELDS });
  if ("number" in input) throw refuse("UNKNOWN_FIELD", 'Tasks have no field "number"; the server keeps the order.', "Leave the place out (the task goes to the end), or send position (1 = top of its list). An order the owner dictates: save_task({order: [ids, top first]}).", { field: "number", allowed: TASK_FIELDS });
  for (const k of Object.keys(input)) {
    if (TASK_SERVER_FIELDS.includes(k)) throw refuse("SERVER_FIELD", `"${k}" is set by the server only.`, `Leave out ${k}.`, { field: k });
    if (!TASK_FIELDS.includes(k)) throw refuse("UNKNOWN_FIELD", `Tasks have no field "${k}".`, `Use only: ${TASK_FIELDS.join(", ")}.`, { field: k, allowed: TASK_FIELDS });
  }
  const path = existing ? `todo/${existing.id}` : "todo";
  if (input.id !== void 0 && input.id !== null && !existing) throw refuse("NOT_FOUND", `There is no task ${input.id}.`, 'Leave out id to make a new task, or take the id from nm.list("todo") / nm.find({query, in: "todo"}).', { path: `todo/${input.id}`, field: "id" });
  if (existing) checkVersion({ exists: true, version: input.version, currentVersion, current: view.taskOut(existing), path, madeInRun });
  if (!existing && !has(input.title)) throw refuse("MISSING_FIELD", "A new task needs a title.", 'Pass title: "<what to do>" (an action).', { path, field: "title" });
  if (!existing && !has(input.short)) throw refuse("MISSING_FIELD", "A new task needs a short name.", `Pass short: 2-3 words the owner knows the task by (up to ${SHORT_MAX} characters), next to the full title.`, { path, field: "short" });
  if (input.short !== void 0 && (typeof input.short !== "string" || !input.short.trim())) throw refuse("UNKNOWN_VALUE", "short must be non-empty text.", 'Pass short: "<2-3 words>".', { path, field: "short" });
  if (typeof input.short === "string" && input.short.trim().length > SHORT_MAX) throw refuse("TOO_LONG", `short has ${input.short.trim().length} characters; at most ${SHORT_MAX}.`, `Short name: 2-3 words, up to ${SHORT_MAX} characters; the full name goes in title.`, { path, field: "short" });
  if (input.title !== void 0 && (typeof input.title !== "string" || !input.title.trim())) throw refuse("UNKNOWN_VALUE", "title must be non-empty text.", 'Pass title: "<what to do>".', { path, field: "title" });
  if (typeof input.title === "string" && input.title.trim().length > TITLE_MAX) throw refuse("TOO_LONG", `title has ${input.title.trim().length} characters; at most ${TITLE_MAX}.`, `Title: the full name of the task in up to ${TITLE_MAX} characters. Details → description (up to ${DESCRIPTION_MAX}).`, { path, field: "title" });
  if (input.description !== void 0 && input.description !== null && (typeof input.description !== "string" || input.description.length > DESCRIPTION_MAX)) throw refuse("TOO_LONG", `description must be text of at most ${DESCRIPTION_MAX} characters.`, `Keep the description to ${DESCRIPTION_MAX} characters; anything longer → add_comment.`, { path, field: "description" });
  const withMeaning = (d) => view.dict(d).map((x) => `${x.value} — ${x.meaning}`);
  if (input.status !== void 0 && !view.dict("task-statuses").some((x) => x.value === input.status)) throw refuse("UNKNOWN_VALUE", `status ${JSON.stringify(input.status)} is not allowed.`, 'Use a status from allowed (the name before "—").', { path, field: "status", allowed: withMeaning("task-statuses") });
  if (input.priority !== void 0 && !view.dict("task-priority").some((x) => x.value === input.priority)) throw refuse("UNKNOWN_VALUE", `priority ${JSON.stringify(input.priority)} is not allowed.`, 'Use a priority from allowed (the name before "—").', { path, field: "priority", allowed: withMeaning("task-priority") });
  if (input.vector !== void 0 && input.vector !== null && !VECTORS[input.vector]) throw refuse("UNKNOWN_VALUE", `vector ${JSON.stringify(input.vector)} is not allowed.`, 'Use a vector from allowed (the name before "—").', { path, field: "vector", allowed: vectorLines() });
  const p = {};
  for (const k of ["short", "title", "status", "priority", "comment", "add_comment"]) if (input[k] !== void 0) p[k] = input[k];
  if (input.description !== void 0) p.description = input.description || null;
  if (input.project !== void 0) {
    const v = input.project;
    if (v === null || v === "" || v === "none") p.project = null;
    else if (!view.projects()[v]) throw refuse("UNKNOWN_PROJECT", `There is no project "${v}".`, 'Use a project id from list("projects"), or project: null.', { path, field: "project", allowed: Object.keys(view.projects()) });
    else p.project = v;
  }
  if (input.parent !== void 0) {
    const v = input.parent;
    if (v === null || v === "" || v === 0) p.parent = null;
    else {
      const par = view.task(Number(v));
      if (!par) throw refuse("NOT_FOUND", `Parent task ${v} does not exist.`, 'Use an id from nm.list("todo"), or the id a save_task in this run returned.', { path, field: "parent" });
      if (existing && (par.id === existing.id || view.isDescendant(par.id, existing.id))) throw refuse("UNKNOWN_VALUE", "A task can't be under itself or under its own subtask.", "Pick another parent.", { path, field: "parent" });
      p.parent = par.id;
    }
  }
  for (const k of ["deadline", "day"]) {
    if (input[k] === void 0) continue;
    const v = input[k];
    if (v === null || v === "") p[k] = null;
    else if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v + "T00:00:00Z")) || (new Date(v + "T00:00:00Z")).toISOString().slice(0, 10) !== v) throw refuse("BAD_DATE", `${k} ${JSON.stringify(v)} is not YYYY-MM-DD.`, 'deadline: "2026-11-30" = done by then; day: "2026-11-30" = done on that day. Approximate → add_comment "approx: <real dates>", neither field.', { path, field: k });
    else p[k] = v;
  }
  if (input.position !== void 0 && input.position !== null) {
    if (!Number.isInteger(input.position) || input.position < 1) throw refuse("UNKNOWN_VALUE", `position must be a whole number from 1 (got ${JSON.stringify(input.position)}).`, "1 = top of its list (its level, where the section shows levels); leave it out for the end. The server moves the others.", { path, field: "position" });
    p.position = input.position;
  }
  for (const k of ["comment", "add_comment"]) if (p[k] !== void 0 && typeof p[k] !== "string") throw refuse("UNKNOWN_VALUE", `${k} must be text.`, `Pass ${k}: "…".`, { path, field: k });
  const parent = p.parent !== void 0 ? p.parent : existing?.parent ?? null;
  let project = p.project !== void 0 ? p.project : existing?.project ?? null;
  let vector = existing?.vector ?? null;
  if (parent != null) {
    const par = view.task(parent);
    project = par.project ?? null;
    vector = par.vector ?? vector;
  }
  const pv = project ? view.projects()[project]?.vector || null : null;
  if (input.vector !== void 0 && input.vector !== null) {
    if (pv && input.vector !== pv) throw refuse("VECTOR_FROM_PROJECT", `A task in project "${project}" takes that project's vector.`, "A project task takes the project's vector; or set project: null.", { path, field: "vector" });
    if (parent == null) vector = input.vector;
  }
  if (pv) vector = pv;
  if (parent == null && !project && !vector) throw refuse("NEEDS_VECTOR", "A task with no project and no parent needs a vector.", `One of: ${vectorLines().join(" · ")}. Or link a project or a parent.`, { path, field: "vector", allowed: vectorLines() });
  if (parent != null) {
    const h = existing ? view.height(existing.id) : 0;
    if (view.depth(parent) + 1 + h > CONFIG.MAX_TASK_DEPTH) {
      let ok = view.task(parent);
      while (ok && view.depth(ok.id) + 1 + h > CONFIG.MAX_TASK_DEPTH) ok = ok.parent != null ? view.task(ok.parent) : null;
      throw refuse("TOO_DEEP", `Tasks go only 3 levels deep (task → subtask → sub-subtask); under "${view.task(parent).title}" is too deep.`, ok ? `Deepest allowed parent: ${ok.id}, "${ok.title}".` : "No parent here is shallow enough.", { path, field: "parent" });
    }
  }
  p.project = project;
  p.vector = vector;
  if (p.parent === void 0 && !existing) p.parent = null;
  return p;
}
export {
  BEFORE_NAMES,
  BRAIN_META,
  CHANGE_KEYS,
  CONFIG,
  DESCRIPTION_MAX,
  DICTS,
  DICT_LINE_RE,
  LAYER_ORDER,
  LAYER_SKILLS,
  LEVELS_OVER,
  NM_FUNCTIONS,
  ORIGINS,
  PROJECT_PLACES,
  PROJECT_ROOT_FILES,
  SELF_RIGHTS,
  SERVER_META,
  SHAPE_CODES,
  SHORT_MAX,
  SKILL_PATH_FIX,
  SPACES,
  STAGES,
  TAG_LINE_FORMAT,
  TASK_FIELDS,
  TASK_SERVER_FIELDS,
  TITLE_MAX,
  TYPE_FILE_FORMAT,
  VECTORS,
  VECTOR_ORDER,
  VECTOR_SAY,
  bad,
  checkChange,
  checkOrder,
  checkSize,
  checkTask,
  checkVersion,
  checkWrite,
  classify,
  dictRights,
  exists,
  fieldValueOk,
  isAppendOnly,
  isLayerSkill,
  isRefusal,
  mergeMeta,
  needRight,
  normPath,
  normTitle,
  parseAccessYaml,
  parseDict,
  parseTypeFile,
  parseValueSpec,
  preCheck,
  processedOrigin,
  refuse,
  sameCodeRefused,
  serverFields,
  skillRights,
  topCount,
  vectorLines
};
