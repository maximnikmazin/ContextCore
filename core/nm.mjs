import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { run as sandbox } from "../src/sandbox.mjs";
import * as C from "./checks.mjs";
import * as L from "./labels.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORLD = path.join(HERE, "world");
const STATE = process.env.NM_STATE ? path.resolve(process.env.NM_STATE) : path.join(HERE, "state");
const OVERRIDES = path.join(HERE, "overrides");
const CONTENT_ROOTS = ["brain", "projects", "agents", "skills", "system", "user.md", "agents.md", "access.yaml"];
const VOLATILE_META = ["unused", "last_hit"];
const DAY = 864e5;
const JSONISH = /^[\[{"]|^(true|false|null)$|^-?\d+(\.\d+)?$/;
function parseDoc(raw) {
  if (raw.startsWith("---\n")) {
    const end = raw.indexOf("\n---\n", 3);
    if (end > 0) {
      const meta = {};
      for (const l of raw.slice(4, end).split("\n")) {
        const m = l.match(/^([\w-]+):\s?(.*)$/);
        if (!m) continue;
        let v = m[2];
        try {
          if (JSONISH.test(v)) v = JSON.parse(v);
        } catch {
        }
        meta[m[1]] = v;
      }
      return { text: raw.slice(end + 5), meta };
    }
  }
  return { text: raw, meta: {} };
}
function formatDoc({ text, meta }) {
  const keys = Object.keys(meta || {});
  if (!keys.length) return text;
  const fv = (v) => typeof v === "string" && !v.includes("\n") && !JSONISH.test(v) && !/^\s|\s$/.test(v) && !/: | #|^[-?:,\[\]{}#&*!|>'%@`]/.test(v) ? v : JSON.stringify(v);
  return `---
${keys.map((k) => `${k}: ${fv(meta[k])}`).join("\n")}
---
${text}`;
}
function walk(dir, base, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) walk(full, rel, out);
    else if (e.name !== ".DS_Store" && e.name !== ".keep") out.push(rel);
  }
}
function loadState(dir = STATE) {
  if (!fs.existsSync(path.join(dir, "_server.json"))) throw new Error(`No state in ${dir}. Run: node cli.mjs reset`);
  const files = new Map();
  for (const root of CONTENT_ROOTS) {
    const full = path.join(dir, root);
    if (!fs.existsSync(full)) continue;
    const list = [];
    if (fs.statSync(full).isDirectory()) walk(full, root, list);
    else list.push(root);
    for (const rel of list) files.set(rel, parseDoc(fs.readFileSync(path.join(dir, rel), "utf8")));
  }
  const todo = JSON.parse(fs.readFileSync(path.join(dir, "todo.json"), "utf8"));
  const server = JSON.parse(fs.readFileSync(path.join(dir, "_server.json"), "utf8"));
  server.chats ||= {};
  server.ops ||= {};
  server.changes ||= [];
  return { files, todo, server };
}
function saveState(S, dir = STATE) {
  for (const root of CONTENT_ROOTS) fs.rmSync(path.join(dir, root), { recursive: true, force: true });
  for (const [rel, doc] of [...S.files.entries()].sort()) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, formatDoc(doc));
  }
  fs.writeFileSync(path.join(dir, "todo.json"), JSON.stringify(S.todo, null, 1));
  fs.writeFileSync(path.join(dir, "_server.json"), JSON.stringify(S.server, null, 1));
}
const cloneState = (S) => ({ files: new Map([...S.files].map(([k, v]) => [k, structuredClone(v)])), todo: structuredClone(S.todo), server: structuredClone(S.server) });
const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
function fileVersion(doc) {
  const m = { ...doc.meta };
  for (const k of VOLATILE_META) delete m[k];
  return hash(doc.text + "\0" + JSON.stringify(sortObj(m)));
}
function taskVersion(t) {
  return hash(JSON.stringify([t.id, t.title, t.status, t.priority, t.parent ?? null, t.project ?? null, t.vector ?? null, t.description ?? null, t.deadline ?? null, t.day ?? null, t.comment ?? ""].concat(t.short != null ? [t.short] : [])));
}
const CYR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
const slug = (s) => String(s).toLowerCase().replace(/[а-яё]/g, (c) => CYR[c]).normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 50).replace(/-$/, "") || "note";
const publicMeta = (meta) => {
  const m = { ...meta };
  delete m.last_hit;
  return m;
};
function ownerTz(S) {
  return (S.files.get("user.md")?.text.match(/timezone:\s*([\w/+-]+)/i) || [])[1] || "UTC";
}
function localIso(S, iso = S.server.now) {
  const d = new Date(iso);
  let off = "GMT";
  try {
    off = new Intl.DateTimeFormat("en", { timeZone: ownerTz(S), timeZoneName: "longOffset" }).formatToParts(d).find((p) => p.type === "timeZoneName").value;
  } catch {
  }
  const m = off.match(/GMT([+-])(\d{2}):(\d{2})/);
  const mins = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  const local = new Date(d.getTime() + mins * 6e4).toISOString().slice(0, 19);
  return `${local}${m ? `${m[1]}${m[2]}:${m[3]}` : "Z"}`;
}
function nowLine(S) {
  const l = localIso(S);
  const day = (new Date(`${l.slice(0, 10)}T12:00:00Z`)).toLocaleDateString("en", { weekday: "short", timeZone: "UTC" });
  const base = `${day} ${l.slice(8, 10)}.${l.slice(5, 7)}.${l.slice(0, 4)}, ${l.slice(11, 16)} (${ownerTz(S)})`;
  return base;
}
const ddmm = (S) => {
  const l = localIso(S);
  return `${l.slice(8, 10)}.${l.slice(5, 7)}`;
};
function makeView(S) {
  const v = {
    S,
    file: (p) => S.files.get(p),
    paths: () => [...S.files.keys()].sort(),
    version: (p) => S.files.get(p) ? fileVersion(S.files.get(p)) : null,
    rights: () => {
      try {
        return C.parseAccessYaml(S.files.get("access.yaml")?.text || "");
      } catch {
        return {};
      }
    },
    has: (agent, right) => (v.rights()[right] || []).includes(agent),
    typeFile: (type) => {
      const f = S.files.get(`system/dictionaries/note-types/${type}.yaml`);
      if (!f) return null;
      try {
        return C.parseTypeFile(f.text);
      } catch {
        return null;
      }
    },
    typeFiles: () => v.paths().filter((p) => /^system\/dictionaries\/note-types\/[^/]+\.yaml$/.test(p)),
    dict: (name) => C.parseDict(S.files.get(`system/dictionaries/${name}.md`)?.text || "").values,
    closedStatuses: () => new Set(v.dict("task-statuses").filter((d) => d.closed).map((d) => d.value)),
    dictDefault: (name, fallback) => v.dict(name).find((d) => d.default)?.value || fallback,
    projects: () => {
      const out = {};
      for (const p of v.paths()) {
        const m = p.match(/^projects\/([^/]+)\/card\.md$/);
        if (m) out[m[1]] = L.parseCard(S.files.get(p).text);
      }
      return out;
    },
    agents: () => [...new Set(v.paths().map((p) => p.match(/^agents\/([^/]+)\/agent\.md$/)?.[1]).filter(Boolean))],
    skills: () => v.paths().filter((p) => /^skills\/[^/]+\/SKILL\.md$/.test(p)).map((p) => {
      const f = S.files.get(p);
      return { name: p.split("/")[1], when: f.meta.when || "", description: f.meta.description || "", mac_only: f.meta.mac_only === true, installed: f.meta.installed === true, archived: f.meta.archived === true, by: f.meta.by || "", type: f.meta.type || "", schedule: f.meta.schedule || "", agents: [].concat(f.meta.agents || []) };
    }),
    tasks: () => S.todo.tasks,
    task: (id) => S.todo.tasks.find((t) => t.id === Number(id)),
    taskVersion,
    taskOut: (t) => taskOut(S, t),
    sectionOf: (t) => sectionOf(S, t),
    depth: (id) => {
      let d = 0;
      let t = v.task(id);
      while (t && t.parent != null) {
        d++;
        t = v.task(t.parent);
      }
      return d;
    },
    height: (id) => {
      const kids = S.todo.tasks.filter((t) => t.parent === id);
      return kids.length ? 1 + Math.max(...kids.map((k) => v.height(k.id))) : 0;
    },
    isDescendant: (id, ancestor) => {
      let t = v.task(id);
      while (t && t.parent != null) {
        if (t.parent === ancestor) return true;
        t = v.task(t.parent);
      }
      return false;
    },
    valueUses: (dict, value) => {
      if (dict === "note-types") return v.paths().filter((p) => p.startsWith("brain/") && S.files.get(p).meta.type === value).length;
      const f = { "task-priority": "priority", "task-statuses": "status" }[dict];
      return S.todo.tasks.filter((t) => t[f] === value).length;
    }
  };
  return v;
}
function sectionOf(S, t) {
  let r = t;
  const seen = new Set();
  while (r && r.parent != null && !seen.has(r.id)) {
    seen.add(r.id);
    r = S.todo.tasks.find((x) => x.id === r.parent) || null;
  }
  r = r || t;
  return r.project || r.vector || t.project || t.vector || "none";
}
const openTest = (S) => {
  const closed = makeView(S).closedStatuses();
  return (t) => !closed.has(t.status);
};
function taskOut(S, t) {
  const o = { id: t.id, short: t.short ?? null, title: t.title, status: t.status, priority: t.priority, position: positionOf(S, t, openTest(S)), section: sectionOf(S, t), parent: t.parent ?? null, project: t.project ?? null, vector: t.vector ?? null, description: t.description ?? null, deadline: t.deadline ?? null, day: t.day ?? null, comment: t.comment || "", version: taskVersion(t) };
  const kids = S.todo.tasks.filter((c) => c.parent === t.id).map((c) => c.id);
  if (kids.length) o.children = kids;
  return o;
}
function logChange(S, p, by, what, before) {
  const c = { at: S.server.now, path: p, by, what };
  if (before !== void 0 && (p.startsWith("agents/") || OWNER_FILES[p] || p.startsWith("skills/"))) {
    const now = (S.files.get(p) || {}).text || "";
    const a = before.split("\n");
    const b = now.split("\n");
    const added = b.filter((l) => l.trim() && !a.includes(l));
    const removed = a.filter((l) => l.trim() && !b.includes(l));
    if (added.length) c.added = added.slice(0, 20);
    if (removed.length) c.removed = removed.slice(0, 20);
  }
  S.server.changes.push(c);
}
function sweep(S) {
  const now = Date.parse(S.server.now);
  for (const p of [...S.files.keys()]) {
    if (!p.startsWith("brain/")) continue;
    const m = S.files.get(p).meta;
    if (m.archived && m.archived_at && now - Date.parse(m.archived_at) > C.CONFIG.ARCHIVE_KEEP_DAYS * DAY) {
      S.files.delete(p);
      logChange(S, p, "server", "deleted (archived over 30 days)");
      continue;
    }
    const last = Date.parse(m.last_hit || m.created || S.server.now);
    if (!m.archived && !m.unused && now - last > C.CONFIG.UNUSED_AFTER_DAYS * DAY) m.unused = true;
  }
}
function touch(S, p) {
  const f = S.files.get(p);
  if (!f || !p.startsWith("brain/")) return;
  f.meta.last_hit = S.server.now;
  delete f.meta.unused;
}
const seqKey = (S, t) => t.parent != null ? `p${t.parent}` : `s:${sectionOf(S, t)}`;
function seqOf(S, key, isOpen, except) {
  return S.todo.tasks.filter((x) => x !== except && isOpen(x) && seqKey(S, x) === key).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.id - b.id);
}
const setSeq = (list) => list.forEach((x, i) => {
  x.order = i + 1;
});
const hasLevels = (key, list) => key.startsWith("s:") && C.topCount(list) > C.LEVELS_OVER;
function isLeveled(S, key, isOpen) {
  return hasLevels(key, seqOf(S, key, isOpen));
}
function positionOf(S, t, isOpen) {
  if (!isOpen(t)) return null;
  const key = seqKey(S, t);
  const list = seqOf(S, key, isOpen);
  const scope = hasLevels(key, list) ? list.filter((x) => x.priority === t.priority) : list;
  const i = scope.indexOf(t);
  return i < 0 ? null : i + 1;
}
function insert(S, t, pos, isOpen) {
  const key = seqKey(S, t);
  const list = seqOf(S, key, isOpen, t);
  let at = list.length;
  if (pos != null) {
    if (hasLevels(key, [...list, t])) {
      const lvl = list.filter((x) => x.priority === t.priority);
      if (pos <= lvl.length) at = list.indexOf(lvl[pos - 1]);
    } else at = Math.min(pos - 1, list.length);
  }
  list.splice(at, 0, t);
  setSeq(list);
}
function normalizePositions(S) {
  const closed = makeView(S).closedStatuses();
  const isOpen = (t) => !closed.has(t.status);
  for (const t of S.todo.tasks) {
    delete t.position;
    delete t.number;
    if (!isOpen(t)) t.order = null;
  }
  for (const key of new Set(S.todo.tasks.filter(isOpen).map((t) => seqKey(S, t)))) setSeq(seqOf(S, key, isOpen));
}
function todoListing(S) {
  const view = makeView(S);
  const closed = view.closedStatuses();
  const isOpen = (t) => !closed.has(t.status);
  return L.todoSections(view, isOpen, (t) => positionOf(S, t, isOpen), view.dict("task-priority").map((d) => d.value), C.VECTOR_ORDER, C.LEVELS_OVER, C.topCount);
}
function placeOfList(p) {
  const q = C.normPath(p || "/").replace(/\/$/, "");
  return q === "brain" || q === "todo" ? q : null;
}
function rulesOf(S, place) {
  if (place === "brain") return (S.files.get("skills/contextcore-notes-1-rules/SKILL.md") || { text: "" }).text.trim();
  return (S.files.get("skills/contextcore-tasks-1-rules/SKILL.md") || { text: "" }).text.trim();
}
function projectRules(S, id) {
  const t = S.files.get(`projects/${id}/README.md`)?.text || "";
  const m = t.match(/^#+\s*Where things go[^\n]*\n([\s\S]*?)(?=^#+\s|(?![\s\S]))/mi);
  return m ? m[1].trim() : null;
}
function makeApi(S, agent, calls) {
  const view = makeView(S);
  const now = () => S.server.now;
  function list(p = "/") {
    const place = placeOfList(p);
    const r = listRaw(p);
    const own = place && view.has(agent, place === "brain" ? "notes" : "tasks");
    if (place === "todo") return own ? { rules: rulesOf(S, "todo"), sections: r } : { sections: r };
    const pid = (C.normPath(p).match(/^projects\/([^/]+)\/?$/) || [])[1];
    if (pid) return { rules: projectRules(S, pid), items: r };
    return own ? { rules: rulesOf(S, place), items: r } : { items: r };
  }
  function listRaw(p = "/") {
    p = C.normPath(p).replace(/\/$/, "");
    if (p === "") return L.listRoot(view);
    if (p === "todo") return todoListing(S);
    if (p === "brain") return L.listBrain(view);
    if (p === "projects") return L.listProjects(view);
    let m;
    if (m = p.match(/^projects\/([^/]+)(\/.*)?$/)) {
      const id = m[1];
      if (!view.projects()[id]) throw C.refuse("UNKNOWN_PROJECT", `There is no project "${id}".`, 'nm.list("projects") shows all projects.', { path: p, allowed: Object.keys(view.projects()) });
      if (m[2] && /\.md$/.test(m[2])) throw C.refuse("NOT_A_FOLDER", `"${p}" is a file.`, `nm.read("${p}").`, { path: p });
      const pre = `${p}/`;
      if (m[2] && !view.paths().some((x) => x.startsWith(pre))) C.classify(`${pre}x.md`, agent, view);
      return view.paths().filter((x) => x.startsWith(pre)).map((x) => L.it(x, x.slice(`projects/${id}/`.length), x.endsWith("/card.md") ? L.projectLine(id, view.projects()[id]) : L.firstLine(S.files.get(x).text), { version: view.version(x) }));
    }
    if (p === "agents") return L.listAgents(view);
    if ((m = p.match(/^agents\/([^/]+)$/)) && view.agents().includes(m[1])) return L.listAgent(view, m[1], C.CONFIG.CAPS);
    if (p === "skills") return L.listSkills(view);
    if ((m = p.match(/^skills\/([^/]+)$/)) && S.files.has(`skills/${m[1]}/SKILL.md`)) return L.listSkill(view, m[1]);
    if (p === "system") return L.listSystem(view);
    if (p === "system/dictionaries") return L.listDictionaries(view, agent);
    if (S.files.has(p)) throw C.refuse("NOT_A_FOLDER", `"${p}" is a file.`, `nm.read("${p}").`, { path: p });
    if (view.paths().some((x) => x.startsWith(p + "/"))) return L.listFiles(view, p);
    if (/^agents\/[^/]+\/data$/.test(p)) return [];
    throw C.refuse("NOT_FOUND", `There is no folder "${p}".`, 'nm.list("/") shows the top folders.', { path: p });
  }
  function read(p) {
    p = C.normPath(p, { allowEmpty: false });
    if (p === "todo" || p === "todo/") throw C.refuse("NOT_A_FILE", '"todo" is the task list, not a file.', 'nm.list("todo") for all open tasks; nm.read("todo/<id>") for one task.', { path: p });
    if (p.startsWith("todo/")) {
      const t = view.task(p.slice(5));
      if (!t) throw C.refuse("NOT_FOUND", `There is no task ${p.slice(5)}.`, 'nm.list("todo") or nm.find({query, in: "todo"}).', { path: p });
      return taskOut(S, t);
    }
    if (S.files.has(p.replace(/\/$/, "") + "/SKILL.md")) return read(p.replace(/\/$/, "") + "/SKILL.md");
    if (p.endsWith("/")) throw C.refuse("NOT_A_FILE", `"${p}" is a folder.`, `nm.list("${p}").`, { path: p });
    const f = S.files.get(p);
    const pm = p.match(/^projects\/([^/]+)\/(.+)$/);
    if (!f && pm && pm[2] !== "card.md" && view.projects()[pm[1]]) C.classify(p, agent, view);
    if (!f) {
      if (view.paths().some((x) => x.startsWith(p + "/"))) throw C.refuse("NOT_A_FILE", `"${p}" is a folder.`, `nm.list("${p}").`, { path: p });
      const want = new Set(tokens(p.split("/").pop().replace(/^\d{6}-/, "").replace(/\.md$/, "")));
      const near = view.paths().map((x) => [x, tokens(x.split("/").pop()).filter((w) => want.has(w)).length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([x]) => x);
      throw C.refuse("NOT_FOUND", `"${p}" does not exist.`, "Find it with nm.find({query}) or nm.list(folder).", { path: p, allowed: near.length ? near : void 0 });
    }
    touch(S, p);
    const sm = p.match(/^skills\/([^/]+)\/SKILL\.md$/);
    if (sm) markRead(sm[1]);
    const out = { path: p, text: f.text, meta: publicMeta(f.meta), version: fileVersion(f) };
    const lf = linkedFrom(p);
    if (lf) Object.assign(out, lf);
    return out;
  }
  function linkedFrom(p) {
    if (!/^brain\//.test(p) && !(/^projects\//.test(p) && !/\/card\.md$/.test(p))) return null;
    const name = p.split("/").pop().replace(/\.md$/, "");
    const re = new RegExp(`\\[\\[${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\||\\]\\])`);
    const hits = view.paths().filter((x) => x !== p && /^(brain|projects)\//.test(x) && re.test(S.files.get(x).text || ""));
    if (!hits.length) return null;
    const items = hits.slice(0, 20).map((x) => ({ path: x, title: S.files.get(x).meta.title || x.split("/").pop() }));
    return hits.length > 20 ? { linked_from: items, linked_from_total: hits.length } : { linked_from: items };
  }
  function markRead(name) {
    ((S.server.read_in_chat ||= {})[agent] ||= {})[`skills/${name}/SKILL.md`] = S.server.chats[agent] || 0;
  }
  function find(opts = {}) {
    if (typeof opts === "string") opts = { query: opts };
    if (!opts || typeof opts !== "object") throw C.bad("find takes {query?, in?, where?, cursor?}.", 'nm.find({query: "faceless AI channels"}).');
    for (const k of Object.keys(opts)) if (!["query", "in", "where", "cursor"].includes(k)) throw C.refuse("UNKNOWN_FIELD", `find has no option "${k}".`, "Use {query?, in?, where?, cursor?}.", { field: k, allowed: ["query", "in", "where", "cursor"] });
    const spaces = opts.in === void 0 ? ["brain"] : opts.in === "all" ? [...C.SPACES] : Array.isArray(opts.in) ? opts.in : [opts.in];
    for (const s of spaces) if (!C.SPACES.includes(s)) throw C.refuse("UNKNOWN_VALUE", `in "${s}" is not a space.`, 'Use one of allowed, an array of them, or "all".', { field: "in", allowed: [...C.SPACES, "all"] });
    if (S.server.search_down) {
      if (spaces.length === 1 && spaces[0] === "skills") {
        const items2 = L.skillListAsHits(view);
        return { items: items2, total: items2.length, note: L.MSG.searchDownSkills };
      }
      throw C.refuse("SEARCH_UNAVAILABLE", 'Search is unavailable right now; this is not "nothing found".', "nm.list and nm.read still work.");
    }
    const where = opts.where || {};
    if (typeof where !== "object" || Array.isArray(where)) throw C.bad('where must be an object of meta fields, e.g. {type: "idea", stage: "raw"}.', 'nm.find({where: {type: "idea"}}).');
    const q = tokens(opts.query || "");
    const matchWhere = (obj) => Object.entries(where).every(([k, want]) => {
      const have = obj[k];
      const wants = Array.isArray(want) ? want : [want];
      if (Array.isArray(have)) return wants.some((w) => have.includes(w));
      return wants.some((w) => w === have || w === null && have === void 0 || w === false && have === void 0 && k === "archived");
    });
    const scoreOf = (title, body) => {
      if (!q.length) return 1;
      const tt = new Set(tokens(title));
      const bt = new Set(tokens(body));
      let s = 0;
      for (const w of q) {
        if (tt.has(w)) s += 3;
        else if (bt.has(w)) s += 1;
      }
      return s;
    };
    const hits = [];
    const skillRank = spaces.includes("skills") && q.length ? skillRanker(S, view, opts.query) : null;
    for (const p of view.paths()) {
      const f = S.files.get(p);
      const space = spaceOf(p, f);
      if (!spaces.includes(space) || !matchWhere(f.meta)) continue;
      if (skillRank && /^skills\/[^/]+\/SKILL\.md$/.test(p)) {
        const s2 = skillRank(p, f);
        if (!s2) continue;
        hits.push({ s: s2 * 10, hit: { path: p, space, title: p.split("/")[1], meta: publicMeta(f.meta), snippet: String(f.meta.description || "").slice(0, 240), version: fileVersion(f) } });
        continue;
      }
      if (skillRank && space === "skills") continue;
      let s = scoreOf(f.meta.title || p.split("/").pop(), `${p} ${f.text} ${[].concat(f.meta.source || []).join(" ")} ${f.meta.original || ""} ${f.meta.type || ""} ${f.meta.when || ""}`);
      if (!s) continue;
      if (f.meta.stage === "processed") s *= 1.3;
      if (f.meta.origin === "you") s *= 1.2;
      if (f.meta.checked === false) s *= 0.8;
      hits.push({ s, hit: { path: p, space, title: f.meta.title || /^projects\/[^/]+\/card\.md$/.test(p) && L.parseCard(f.text).name || /^projects\//.test(p) && L.firstLine(f.text).replace(/^#+\s*/, "") || p, meta: publicMeta(f.meta), snippet: snippet(f.text, q), version: fileVersion(f) } });
    }
    if (spaces.includes("todo")) {
      const open = openTest(S);
      const anyStatus = where.status !== void 0;
      for (const t of S.todo.tasks) {
        if (!matchWhere(t) || !anyStatus && !q.length && !open(t)) continue;
        const s = scoreOf(t.title, `${t.description || ""} ${t.comment || ""}`);
        if (!s) continue;
        hits.push({ s, closed: !open(t), hit: { path: `todo/${t.id}`, id: t.id, space: "todo", title: t.title, meta: { short: t.short ?? null, status: t.status, priority: t.priority, position: positionOf(S, t, openTest(S)), section: sectionOf(S, t), parent: t.parent ?? null, project: t.project ?? null, vector: t.vector ?? null, description: t.description ?? null, deadline: t.deadline ?? null, day: t.day ?? null }, snippet: snippet(`${t.description || ""} ${t.comment || ""}`.trim(), q), version: taskVersion(t) } });
      }
    }
    hits.sort((a, b) => (a.closed ? 1 : 0) - (b.closed ? 1 : 0) || b.s - a.s || (a.hit.path < b.hit.path ? -1 : 1));
    const start2 = Number.isInteger(Number(opts.cursor)) && opts.cursor !== void 0 ? Number(opts.cursor) : 0;
    const items = hits.slice(start2, start2 + 20).map((h) => h.hit);
    if (q.length) {
      for (const h of items) if (h.space === "brain" || h.space === "archive") touch(S, h.path);
    }
    const out = { items, total: hits.length };
    if (start2 + 20 < hits.length) out.cursor = String(start2 + 20);
    return out;
  }
  function write(p, change, version, extra) {
    if (extra !== void 0) {
      const fixed = { ...change || {}, ...extra && typeof extra === "object" ? extra : {} };
      throw C.refuse("BAD_CALL", "Nothing changed. nm.write takes at most 3 arguments: path, change, version.", `The call with one change: nm.write(${JSON.stringify(p)}, ${JSON.stringify(fixed)}${version !== void 0 ? ", " + JSON.stringify(version) : ""}).`, { path: p });
    }
    p = C.normPath(p, { allowEmpty: false });
    if (p === "todo" || p.startsWith("todo/")) C.classify(p, agent, view);
    const body = C.checkChange(change);
    if (change.move_to !== void 0) return move(p, change, version);
    let cls = C.classify(p, agent, view);
    C.preCheck({ view, agent, path: p, cls, existing: S.files.get(p), change });
    const folderCreate = p.endsWith("/");
    if (folderCreate) {
      p = newName(p, cls, change.meta || {});
      cls = C.classify(p, agent, view);
    }
    const existing = S.files.get(p);
    const appendOnly = cls.area === "tag-suggestions" && C.isAppendOnly(change);
    C.preCheck({ view, agent, path: p, cls, existing, change, version: existing ? fileVersion(existing) : void 0 });
    if (folderCreate) {
      const taken = takenName(p, cls);
      if (taken) {
        const t2 = S.files.get(taken);
        throw C.exists(taken, fileVersion(t2), { path: taken, title: t2.meta.title, version: fileVersion(t2) });
      }
    }
    const isCreate = !existing;
    if (existing && !version && body === "text" && C.CONFIG.EXISTS_ON_TEXT_WITHOUT_VERSION && !appendOnly) throw C.exists(p, fileVersion(existing), { path: p, text: existing.text, meta: publicMeta(existing.meta), version: fileVersion(existing) });
    C.checkVersion({ exists: !!existing, version, currentVersion: existing && fileVersion(existing), current: existing && { path: p, text: existing.text, meta: publicMeta(existing.meta), version: fileVersion(existing) }, path: p, exempt: appendOnly, madeInRun: !!existing && madeInRun(p, fileVersion(existing)) });
    if (isCreate && change.replace) throw C.refuse("NOT_FOUND", `"${p}" does not exist, so nothing can be replaced.`, "Create it with {text}, or find the right path first.", { path: p });
    let text = existing ? existing.text : "";
    if (change.text !== void 0) text = change.text;
    else if (change.append !== void 0) text = appendText(existing ? text : "", change.append);
    else if (change.replace) {
      const [o, n] = change.replace;
      const count = o ? text.split(o).length - 1 : 0;
      if (count !== 1) throw C.refuse("REPLACE_FAILED", count ? `"${o.slice(0, 60)}" is in the text ${count} times.` : `"${o.slice(0, 60)}" is not in the text.`, count ? "Use a longer old string that occurs once." : "Copy the old words exactly from current.text, or send only an append.", { path: p, current: { path: p, text, version: fileVersion(existing) } });
      text = text.replace(o, () => n);
    }
    const meta = C.mergeMeta(existing ? existing.meta : {}, change.meta, p);
    if (cls.area === "skill" && cls.file === "SKILL.md") delete meta.title;
    if (cls.area === "brain" && existing) C.processedOrigin(change.meta, meta, p);
    const res = C.checkWrite({ view, agent, path: p, cls, existing, next: { text, meta }, change, changeMeta: change.meta, isCreate });
    Object.assign(meta, res.setMeta || {});
    const t = now();
    if (cls.area === "project-file") delete meta.title;
    if (["tag-suggestions", "user", "agents-md", "access", "dictionary", "type-file", "project-card", "project-file"].includes(cls.area)) {
    } else if (isCreate) {
      meta.created = t;
      meta.by = agent;
    } else meta.updated = t;
    if (cls.area === "brain") {
      if (meta.archived === true && !meta.archived_at) meta.archived_at = t;
      if (meta.archived === false) {
        delete meta.archived;
        delete meta.archived_at;
      }
      meta.last_hit = t;
      delete meta.unused;
    }
    if (cls.area === "notice") {
      if (meta.told === true) meta.told_at = t;
      else delete meta.told_at;
    }
    const doc = { text, meta };
    S.files.set(p, doc);
    logChange(S, p, agent, isCreate ? "created" : describeChange(change), existing ? existing.text : "");
    if (res.suggestType) suggestType(res.suggestType, p);
    const out = { path: p, version: fileVersion(doc) };
    noteRunVersion(p, out.version);
    if (cls.area === "brain") {
      out.stage = meta.stage;
      out.origin = meta.origin;
    }
    return out;
  }
  function suggestType(type, notePath) {
    const sp = "system/dictionaries/note-types-suggestions.md";
    const f = S.files.get(sp) || { text: "", meta: {} };
    if (f.text.split("\n").some((l) => {
      const x = l.split("|").map((y) => y.trim());
      return x[0] === type && x[1] === notePath;
    })) return;
    f.text = appendText(f.text, `${type} | ${notePath} | ${localIso(S).slice(0, 10)}`);
    S.files.set(sp, f);
    logChange(S, sp, "server", `suggested type ${type}`);
  }
  function newName(p, cls, meta) {
    if (cls.area === "skill" && cls.skill && !S.files.has(`${p}SKILL.md`)) return `${p}SKILL.md`;
    if (!meta || typeof meta.title !== "string" || !meta.title.trim()) throw C.refuse("MISSING_FIELD", `A new file in "${p}" needs meta.title; the server names the file from it.`, cls.area === "skill" ? C.SKILL_PATH_FIX : 'Add meta.title: "<short title>".', { path: p, field: "title" });
    const s = slug(meta.title);
    if (cls.area === "brain" || cls.area === "notice" || cls.area === "agent" && cls.file === "data") return `${p}${s}.md`;
    if (cls.area === "project-file" && cls.kind === "task") return `${p}${localIso(S, now()).slice(2, 10).replace(/-/g, "")}-${s}/task.md`;
    if (cls.area === "project-file" && cls.kind === "context") return `${p}${s}.md`;
    if (cls.area === "skill" && cls.skill === null) return `skills/${s}/SKILL.md`;
    if (cls.area === "skill") return S.files.has(`${p}SKILL.md`) ? `${p}${s}.md` : `${p}SKILL.md`;
    throw C.refuse("BAD_CALL", `"${p}" is not a folder new files go into.`, "Write to an exact file path, or to a folder from nm.list().", { path: p });
  }
  function takenName(p, cls) {
    if (S.files.has(p)) return p;
    if (cls.area !== "brain") return null;
    const dir = p.slice(0, p.lastIndexOf("/") + 1);
    const base = p.slice(dir.length).replace(/^\d{6}-/, "");
    return view.paths().find((x) => x.startsWith(dir) && !x.slice(dir.length).includes("/") && x.slice(dir.length).replace(/^\d{6}-/, "") === base) || null;
  }
  function move(p, change, version) {
    if (Object.keys(change).filter((k) => change[k] !== void 0).some((k) => k !== "move_to")) throw C.bad("move_to goes alone in a change.", "First move, then change the text with the new path.");
    const existing = S.files.get(p);
    if (!existing) throw C.refuse("NOT_FOUND", `"${p}" does not exist.`, "Find it with nm.find({query}).", { path: p });
    const srcCls = C.classify(p, agent, view);
    const cardMove = () => C.refuse("BAD_CALL", "A project card is never moved: its path is the project id.", "Change the card with write and its version. A new project → skills/contextcore-projects-1-new/SKILL.md.", { path: p });
    if (srcCls.area === "project-card") throw cardMove();
    C.preCheck({ view, agent, path: p, cls: srcCls, existing, change: { text: existing.text } });
    C.checkVersion({ exists: true, version, currentVersion: fileVersion(existing), current: { path: p, text: existing.text, meta: publicMeta(existing.meta), version: fileVersion(existing) }, path: p, madeInRun: madeInRun(p, fileVersion(existing)) });
    let dest = C.normPath(change.move_to, { allowEmpty: false });
    if (dest.endsWith("/")) dest += p.split("/").pop();
    const cls = C.classify(dest, agent, view);
    if (cls.area === "project-card") throw cardMove();
    if (S.files.has(dest)) {
      const t = S.files.get(dest);
      throw C.exists(dest, fileVersion(t), { path: dest, title: t.meta.title, version: fileVersion(t) });
    }
    const meta = { ...existing.meta };
    C.preCheck({ view, agent, path: dest, cls, existing: void 0, change: { text: existing.text } });
    const res = C.checkWrite({ view, agent, path: dest, cls, existing: void 0, next: { text: existing.text, meta }, change: { text: existing.text }, changeMeta: void 0, isCreate: false });
    Object.assign(meta, res.setMeta || {});
    meta.updated = now();
    S.files.delete(p);
    S.files.set(dest, { text: existing.text, meta });
    const ts = S.files.get("system/dictionaries/note-types-suggestions.md");
    if (ts && ts.text.includes(p)) {
      ts.text = ts.text.split("\n").map((l) => {
        const parts = l.split("|");
        if (parts.length === 3 && parts[1].trim() === p) parts[1] = ` ${dest} `;
        return parts.join("|");
      }).join("\n");
      logChange(S, "system/dictionaries/note-types-suggestions.md", "server", `path ${p} → ${dest}`);
    }
    logChange(S, p, agent, `moved to ${dest}`);
    logChange(S, dest, agent, `moved from ${p}`);
    const nameOf = (x) => x.split("/").pop().replace(/\.md$/, "");
    const from = nameOf(p);
    const to = nameOf(dest);
    const relinked = [];
    if (from !== to) {
      const re = new RegExp(`\\[\\[${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\||\\]\\])`, "g");
      for (const [fp, f] of S.files) {
        if (typeof f.text !== "string" || !re.test(f.text)) continue;
        re.lastIndex = 0;
        f.text = f.text.replace(re, `[[${to}`);
        relinked.push(fp);
        logChange(S, fp, "server", `links ${from} → ${to}`);
      }
    }
    const out = { path: dest, version: fileVersion(S.files.get(dest)) };
    if (relinked.length) out.links_updated = relinked;
    if (dest.startsWith("brain/")) out.stage = meta.stage;
    return out;
  }
  function save_task(input) {
    C.needRight(view, agent, "tasks", "change the owner's tasks");
    const closed = view.closedStatuses();
    const isOpen = (t2) => !closed.has(t2.status);
    const existing = input && input.order === void 0 && input.id !== void 0 && input.id !== null ? view.task(input.id) : void 0;
    const patch = C.checkTask({ view, agent, input, existing, currentVersion: existing && taskVersion(existing), madeInRun: !!existing && madeInRun(`todo/${existing.id}`, taskVersion(existing)), scopeOf: (t2) => scopeOf(t2, isOpen) });
    if (patch.order) return setOrder(patch.order, isOpen);
    const t0 = now();
    let t;
    let wasOpen = true;
    if (!existing) {
      t = { id: S.todo.next_id++, short: patch.short.trim(), title: patch.title.trim(), status: patch.status || view.dictDefault("task-statuses", "planned"), priority: patch.priority || view.dictDefault("task-priority", "medium"), order: null, parent: patch.parent ?? null, project: patch.project ?? null, vector: patch.vector ?? null, description: patch.description ?? null, deadline: patch.deadline ?? null, day: patch.day ?? null, comment: patch.comment || "", created: t0, by: agent };
      if (patch.add_comment) t.comment = joinAppend(t.comment, `${ddmm(S)}: ${patch.add_comment}`);
      S.todo.tasks.push(t);
      if (isOpen(t)) insert(S, t, patch.position, isOpen);
      else t.closed_at = t0;
    } else {
      t = existing;
      wasOpen = isOpen(t);
      const oldKey = seqKey(S, t);
      const oldPriority = t.priority;
      const oldLinks = [t.project, t.vector];
      for (const k of ["short", "title", "status", "priority", "parent", "project", "vector", "description", "deadline", "day", "comment"]) if (patch[k] !== void 0) t[k] = k === "title" || k === "short" ? patch[k].trim() : patch[k];
      if (patch.add_comment) t.comment = joinAppend(t.comment || "", `${ddmm(S)}: ${patch.add_comment}`);
      t.updated = t0;
      if (!wasOpen && isOpen(t)) delete t.closed_at;
      if (wasOpen && !isOpen(t)) t.closed_at = t0;
      const newKey = seqKey(S, t);
      const levelMove = t.priority !== oldPriority && newKey === oldKey && isLeveled(S, newKey, isOpen);
      if (newKey !== oldKey || wasOpen !== isOpen(t) || patch.position !== void 0 || levelMove) {
        t.order = null;
        setSeq(seqOf(S, oldKey, isOpen, t));
        if (isOpen(t)) insert(S, t, patch.position, isOpen);
      }
      if (oldLinks[0] !== t.project || oldLinks[1] !== t.vector) cascade(t);
    }
    const closedSteps = [];
    if (existing && wasOpen && !isOpen(t)) {
      const walk2 = (id) => {
        for (const c of S.todo.tasks.filter((x) => x.parent === id)) {
          if (isOpen(c)) {
            const key = seqKey(S, c);
            c.status = t.status;
            c.closed_at = t0;
            c.updated = t0;
            c.order = null;
            setSeq(seqOf(S, key, isOpen, c));
            closedSteps.push(c.id);
            noteRunVersion(`todo/${c.id}`, taskVersion(c));
          }
          walk2(c.id);
        }
      };
      walk2(t.id);
    }
    const out = taskOut(S, t);
    noteRunVersion(`todo/${t.id}`, out.version);
    if (closedSteps.length) out.closed_steps = closedSteps;
    if (wasOpen && !isOpen(t) && t.parent != null) {
      const par = view.task(t.parent);
      if (par && isOpen(par) && S.todo.tasks.filter((c) => c.parent === par.id).every((c) => !isOpen(c))) out.parent_all_done = { id: par.id, title: par.title };
    }
    return out;
  }
  function scopeOf(t, isOpen) {
    const key = seqKey(S, t);
    if (t.parent != null) {
      const p = view.task(t.parent);
      return { key, label: `the subtasks of "${p ? p.title : t.parent}"` };
    }
    const sec = sectionOf(S, t);
    if (isLeveled(S, key, isOpen)) return { key: `${key}|${t.priority}`, label: `${sec}, ${t.priority}` };
    return { key, label: sec };
  }
  function setOrder(ids, isOpen) {
    const first = view.task(ids[0]);
    const key = seqKey(S, first);
    const all = seqOf(S, key, isOpen);
    const leveled = isLeveled(S, key, isOpen);
    const inScope = (x) => !leveled || x.priority === first.priority;
    const scope = all.filter(inScope);
    const wanted = ids.map((id) => view.task(id));
    const next = [...wanted, ...scope.filter((x) => !ids.includes(x.id))];
    const slots = all.map((x, i) => inScope(x) ? i : -1).filter((i) => i >= 0);
    slots.forEach((slot, j) => {
      all[slot] = next[j];
    });
    setSeq(all);
    const sc = scopeOf(first, isOpen);
    return { list: sc.label, tasks: next.map((x) => ({ id: x.id, short: x.short ?? null, title: x.title, position: positionOf(S, x, isOpen) })) };
  }
  const runVersions = new Map();
  function noteRunVersion(p, v) {
    if (!runVersions.has(p)) runVersions.set(p, new Set());
    runVersions.get(p).add(v);
  }
  function madeInRun(p, v) {
    return !!runVersions.get(p)?.has(v);
  }
  function cascade(t) {
    for (const c of S.todo.tasks.filter((x) => x.parent === t.id)) {
      c.project = t.project;
      c.vector = t.vector;
      cascade(c);
    }
  }
  const api = { list, read, find, write, save_task };
  const wrapped = {};
  for (const [name, fn] of Object.entries(api)) {
    wrapped[name] = (...args) => {
      try {
        const r = fn(...args);
        calls.push({ fn: name, args, result: r });
        return r;
      } catch (e) {
        const r = C.isRefusal(e) ? e : C.refuse("SERVER_ERROR", String(e?.stack || e), "A bug in the fake server; report it.");
        calls.push({ fn: name, args, refusal: r });
        throw r;
      }
    };
  }
  return wrapped;
}
function appendText(text, add) {
  const a = String(add).replace(/^(\r?\n)+/, "");
  const body = a.endsWith("\n") ? a : a + "\n";
  if (!text) return body;
  return (text.endsWith("\n") ? text : text + "\n") + body;
}
function joinAppend(text, add) {
  if (!text) return add.replace(/^\n+/, "");
  if (text.endsWith("\n") || add.startsWith("\n")) return text + add;
  return text + "\n" + add;
}
function describeChange(change) {
  if (change.meta && change.meta.archived === true) return "archived";
  if (change.meta && change.meta.archived === false) return "restored";
  if (change.append !== void 0) return "appended";
  if (change.text !== void 0 || change.replace) return "changed";
  return "meta changed";
}
function spaceOf(p, f) {
  if (p.startsWith("brain/")) return f.meta.archived ? "archive" : "brain";
  const top = p.split("/")[0];
  if (["projects", "agents", "skills"].includes(top)) return top;
  return "system";
}
const SKILL_STOP = new Set("a an the and or of to in on for with is are be my me i it this that from at by as do does did what about me please can you could would make get need want и в во на с со к ко по о об от до за из у для как что это мне меня мой моя мои ты вы он она они его ее их бы же ли не нужно надо можешь сделай сделать хочу давай пожалуйста плиз вот там тут".split(" "));
const stem = (w) => w.replace(/ё/g, "е").slice(0, 5);
function skillTokens(s) {
  return String(s || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !SKILL_STOP.has(w)).map(stem);
}
const SKILL_FIELDS = [["triggers", 4], ["use_cases", 4], ["description", 3], ["tags", 2], ["name", 2], ["body", 0.3]];
function skillRanker(S, view, query) {
  const docs = [];
  for (const p of view.paths()) {
    if (!/^skills\/[^/]+\/SKILL\.md$/.test(p)) continue;
    const f = S.files.get(p);
    const name = p.split("/")[1];
    const fields = {
      triggers: [].concat(f.meta.triggers || []).join(" "),
      use_cases: [].concat(f.meta.use_cases || []).join(" "),
      description: f.meta.description || f.meta.when || "",
      tags: [].concat(f.meta.tags || []).join(" "),
      name: name.replace(/-\d-/, " ").replace(/-/g, " "),
      body: (f.text || "").slice(0, 4e3)
    };
    docs.push({ p, sets: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, new Set(skillTokens(v))])) });
  }
  const q = [...new Set(skillTokens(query))];
  const df = (w) => docs.filter((d) => Object.values(d.sets).some((st) => st.has(w))).length;
  const idf = Object.fromEntries(q.map((w) => [w, Math.log(1 + (docs.length + 1) / (df(w) + 0.5))]));
  const exact = String(query || "").trim().toLowerCase();
  const scores = new Map(docs.map((d) => {
    let s = 0;
    for (const w of q) {
      let best = 0;
      for (const [k, wt] of SKILL_FIELDS) if (d.sets[k].has(w)) best = Math.max(best, wt);
      s += best * idf[w];
    }
    if (exact && d.p.split("/")[1] === exact) s += 100;
    return [d.p, s];
  }));
  const top = Math.max(0, ...scores.values());
  return (p) => {
    const s = scores.get(p) || 0;
    return s >= Math.max(1.5, top * 0.35) ? s : 0;
  };
}
const STOP = new Set("a an the and or of to in on for with is are be my me i it this that from at by as do does did what about note notes".split(" "));
function tokens(s) {
  return String(s).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !STOP.has(w)).map((w) => w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
}
function snippet(text, q) {
  const flat = text.replace(/\s+/g, " ").trim();
  const low = flat.toLowerCase();
  let i = q.length ? Math.min(...q.map((w) => {
    const j = low.indexOf(w);
    return j < 0 ? 1e9 : j;
  })) : 0;
  if (i === 1e9) i = 0;
  const s = Math.max(0, i - 40);
  return (s ? "…" : "") + flat.slice(s, s + 160) + (flat.length > s + 160 ? "…" : "");
}
function notices(S, agent, view) {
  if (!(view.rights().notices || []).includes(agent)) return void 0;
  const now = Date.parse(S.server.now);
  return view.paths().filter((p) => p.startsWith("system/notices/")).map((p) => ({ p, f: S.files.get(p) })).filter(({ f }) => f.meta.status !== "closed" && (!f.meta.told || f.meta.told_at && now - Date.parse(f.meta.told_at) > C.CONFIG.NOTICE_REPEAT_DAYS * DAY)).map(({ p, f }) => ({ path: p, text: f.text.trim(), opened: f.meta.opened || f.meta.created, version: fileVersion(f) }));
}
const docOf = (S, p) => {
  const f = S.files.get(p);
  return f ? { text: f.text, version: fileVersion(f) } : null;
};
const OWNER_FILES = { "user.md": "about_owner", "agents.md": "shared_rules" };
const ownerTexts = (S) => Object.fromEntries(Object.entries(OWNER_FILES).map(([p, k]) => [k, (S.files.get(p) || { text: "" }).text]));
function layersOf(S, view, agent) {
  const out = [];
  for (const right of C.LAYER_ORDER) {
    if (!view.has(agent, right)) continue;
    const skill = C.LAYER_SKILLS[right];
    const f = S.files.get(`skills/${skill}/SKILL.md`);
    if (!f) continue;
    const l = { right, skill, text: f.text.trim() };
    if (right === "notes") {
      l.note_types = (S.files.get("system/dictionaries/note-types.md") || { text: "" }).text.trim();
      l.type_files = view.typeFiles();
    }
    out.push(l);
  }
  return out;
}
const dropTopHeading = (t = "") => t.trim().replace(/^#\s+[^\n]*\n+/, "").trim();
const CHECKS_AT = /^# Before each save\b/m;
function splitSharedRules(text = "") {
  const m = CHECKS_AT.exec(text);
  return m ? { body: text.slice(0, m.index).trim(), checks: text.slice(m.index).trim() } : { body: text.trim(), checks: "" };
}
function instructionsText(agentMd, own, layers, rightsText, skillsNote2 = "") {
  const shared = splitSharedRules(own.shared_rules);
  const parts = [L.MSG.instructionsHead, "# Your own rules", dropTopHeading(agentMd), "# About the owner", dropTopHeading(own.about_owner), "# Shared rules", shared.body];
  if (skillsNote2) parts.push("# Skills", skillsNote2);
  for (const l of layers) parts.push(`# ${L.MSG.layerHeading[l.right] || l.right}`, dropTopHeading(l.text));
  if (rightsText) parts.push(`# ${L.MSG.rightsHeading}`, rightsText);
  if (shared.checks) parts.push(shared.checks);
  return `<${L.MSG.instructionsTag}>
${parts.filter((x) => x !== "").join("\n\n")}
</${L.MSG.instructionsTag}>`;
}
const RIGHTS_ORDER = ["notes", "tasks", "types", "system", "notices"];
function rightsTextOf(view, agent) {
  if (process.env.NO_RIGHTS_BLOCK) return "";
  const all = view.rights();
  const lines = [L.MSG.rightsAlways];
  for (const r of RIGHTS_ORDER) {
    const t = L.MSG.rightTexts[r];
    const holders = all[r] || [];
    if (holders.includes(agent)) lines.push(`- ${t.has}`);
    else if (t.not) {
      const names = holders.map((n) => n[0].toUpperCase() + n.slice(1)).join(", ");
      lines.push(`- ${t.not(L.MSG.rightsWho(names), names)}`);
    }
  }
  return lines.join("\n");
}
const ownsSkill = (s, agent) => s.agents.includes(agent) || s.agents.includes("all");
function otherSkills(view) {
  return view.skills().filter((s) => !C.isLayerSkill(s.name) && !s.archived);
}
function startSkills(view, agent) {
  const list = otherSkills(view);
  const own = list.filter((s) => ownsSkill(s, agent));
  return { own: own.map(L.ownSkillLine), others: list.length - own.length };
}
function skillsNote(view, agent) {
  const list = otherSkills(view);
  const own = list.filter((s) => ownsSkill(s, agent)).length;
  return L.MSG.skillsNote(own, list.length - own);
}
function start(S, agent) {
  const view = makeView(S);
  if (typeof agent !== "string" || !agent) return C.refuse("BAD_CALL", "start needs your agent name.", 'start("<your name>").');
  S.server.chats[agent] = (S.server.chats[agent] || 0) + 1;
  (S.server.last_as_of ||= {})[agent] = S.server.now;
  (S.server.stale_told ||= {})[agent] = S.server.changes.length;
  const base = { as_of: localIso(S), now: nowLine(S), agent };
  if (!view.agents().includes(agent)) return { ...base, unknown_agent: true, message: L.MSG.unknownAgent(agent), ...ownerTexts(S) };
  const layers = layersOf(S, view, agent);
  for (const l of layers) ((S.server.read_in_chat ||= {})[agent] ||= {})[`skills/${l.skill}/SKILL.md`] = S.server.chats[agent];
  const am = docOf(S, `agents/${agent}/agent.md`) || { text: "", version: null };
  const own = ownerTexts(S);
  const out = {
    instructions: instructionsText(am.text, own, layers, rightsTextOf(view, agent), skillsNote(view, agent)),
    ...base,
    agent_md: { version: am.version, cap: C.CONFIG.CAPS["agent.md"] },
    rights: Object.entries(view.rights()).filter(([, names]) => names.includes(agent)).map(([r]) => r),
    who_has_rights: view.rights(),
    memory_md: { ...docOf(S, `agents/${agent}/memory.md`) || { text: "", version: null }, cap: C.CONFIG.CAPS["memory.md"] },
    data: view.paths().filter((p) => p.startsWith(`agents/${agent}/data/`)).map((p) => {
      const f = S.files.get(p);
      return { path: p, line: f.meta.title || (f.text.split("\n").find((l) => l.trim()) || "").replace(/^#+\s*/, "").slice(0, 120) };
    }),
    layers: layers.map(({ text, ...l }) => l),
    skills: startSkills(view, agent),
    projects: L.startProjects(view),
    next_action: L.MSG.nextAction
  };
  const n = notices(S, agent, view);
  if (n) {
    out.notices = n;
    rememberShown(S, agent, n);
  }
  return out;
}
function rememberShown(S, agent, n) {
  const shown = (S.server.shown_notices ||= {})[agent] ||= [];
  for (const x of n) if (!shown.includes(x.path)) shown.push(x.path);
}
function untoldFor(S, agent) {
  const out = [];
  for (const p of (S.server.shown_notices || {})[agent] || []) {
    const f = S.files.get(p);
    if (f && f.meta.told !== true && f.meta.status !== "closed") out.push({ path: p, version: fileVersion(f), line: f.text.trim().split("\n")[0].slice(0, 160), fix: L.MSG.untoldFix });
  }
  return out;
}
function whatsNew(S, agent, since) {
  const view = makeView(S);
  const t = Date.parse(since);
  if (!since || isNaN(t) || !/^\d{4}-\d{2}-\d{2}T/.test(since)) return C.refuse("BAD_SINCE", `since "${since}" is not an as_of time.`, "Pass the latest as_of from start or whats_new in this chat (never a version from a save). No as_of in this chat → call start instead.");
  if (!view.agents().includes(agent)) return { as_of: localIso(S), unknown_agent: true, message: L.MSG.unknownAgent(agent) };
  (S.server.last_as_of ||= {})[agent] = S.server.now;
  const wide = (view.rights().system || []).includes(agent);
  const changes = changeItems(S, changesFor(S, agent, t, void 0, 0, wide), agent);
  const out = { as_of: localIso(S), now: nowLine(S) };
  const n = notices(S, agent, view);
  if (n && n.length) rememberShown(S, agent, n);
  const expired = wide ? expiredLines(S) : [];
  if (!changes.length && !(n && n.length) && !expired.length) return { ...out, nothing_new: true, message: L.MSG.nothingNew, tasks: L.MSG.tasksNotCovered };
  out.changes = changes;
  if (expired.length) out.expired = expired;
  if (n) out.notices = n;
  out.tasks = L.MSG.tasksNotCovered;
  return out;
}
function expiredLines(S) {
  const today = localIso(S).slice(0, 10);
  const y = +today.slice(0, 4);
  const out = [];
  for (const [p, f] of S.files) {
    if (!(p === "user.md" || /^agents\/[^/]+\/memory\.md$/.test(p))) continue;
    for (const line of f.text.split("\n")) {
      const m = line.match(/\buntil (\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/i);
      if (!m) continue;
      const iso = (yy) => `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      let d = m[3] ? iso(m[3].length === 2 ? 2e3 + +m[3] : +m[3]) : [y - 1, y, y + 1].map(iso).sort((a, b) => Math.abs(Date.parse(a) - Date.parse(today)) - Math.abs(Date.parse(b) - Date.parse(today)))[0];
      if (d < today) out.push({ path: p, line: line.trim(), until: d });
    }
  }
  return out;
}
function changeItems(S, changes, agent) {
  return changes.map((c) => {
    const f = S.files.get(c.path);
    if (OWNER_FILES[c.path]) return { [OWNER_FILES[c.path]]: f ? f.text : "", what: "changed", by: c.by, ...c.added && { added: c.added }, ...c.removed && { removed: c.removed }, at: localIso(S, c.at) };
    const o = { path: c.path, what: c.what, by: c.by, at: localIso(S, c.at) };
    if (agent && (c.path.startsWith("agents/") && !c.path.startsWith(`agents/${agent}/`) || c.path.startsWith("skills/"))) {
      if (c.added) o.added = c.added;
      if (c.removed) o.removed = c.removed;
      if (f) o.version = fileVersion(f);
      if (c.added || c.removed || !f) return o;
    }
    if (f && f.text.length <= 3e3) {
      o.text = f.text;
      o.version = fileVersion(f);
    } else if (f) {
      o.line = f.text.slice(0, 200);
      o.version = fileVersion(f);
    }
    return o;
  });
}
function changesFor(S, agent, sinceMs, upto = S.server.changes.length, from = 0, wide = false) {
  const relevant = (p) => p.startsWith(`agents/${agent}/`) || wide && p.startsWith("agents/") || p === "user.md" || p === "agents.md" || p.startsWith("system/dictionaries/") && p !== "system/dictionaries/note-types-suggestions.md" || p.startsWith("skills/") || /^projects\/[^/]+\/card\.md$/.test(p);
  const byPath = new Map();
  for (const c of S.server.changes.slice(from, upto)) {
    if (!(Date.parse(c.at) > sinceMs && relevant(c.path))) continue;
    if (c.by === agent && c.path.startsWith(`agents/${agent}/data/`)) continue;
    const prev = byPath.get(c.path);
    if (prev && (prev.added || prev.removed || c.added || c.removed)) {
      const add = [...prev.added || []];
      const rem = [...prev.removed || []];
      for (const l of c.removed || []) {
        const i = add.indexOf(l);
        if (i >= 0) add.splice(i, 1);
        else rem.push(l);
      }
      for (const l of c.added || []) {
        const i = rem.indexOf(l);
        if (i >= 0) rem.splice(i, 1);
        else add.push(l);
      }
      byPath.set(c.path, { ...c, added: add.length ? add : void 0, removed: rem.length ? rem : void 0 });
    } else byPath.set(c.path, c);
  }
  return [...byPath.values()];
}
async function runProgram(S, agent, opId, code, calls) {
  S.server.refused ||= {};
  const now = Date.parse(S.server.now);
  for (const [k, v] of Object.entries(S.server.ops)) if (now - Date.parse(v.at) > C.CONFIG.OP_CACHE_MINUTES * 6e4) delete S.server.ops[k];
  const exact = hash(code);
  const cachedOp = S.server.ops[`${agent}|${opId}`];
  const earlier = (S.server.refused[agent] || {})[exact];
  let r;
  if (!cachedOp && earlier) {
    const answer = C.sameCodeRefused(earlier);
    if (C.CONFIG.CACHE_REFUSALS) S.server.ops[`${agent}|${opId}`] = { at: S.server.now, code: hash(code.trim()), answer };
    r = { answer, state: S };
  } else {
    const before = S.server.changes.length;
    r = await runOnce(S, agent, opId, code, calls);
    r.ownChangesFrom = before;
    const a = r.answer;
    if (!r.cached && a && a.committed === false && C.SHAPE_CODES.includes(a.code)) (r.state.server.refused[agent] ||= {})[exact] = { code: a.code, fix: a.fix };
  }
  const T = r.state;
  const notes = {};
  if (r.cached) notes.cached = { ran_at: localIso(T, r.ranAt) };
  const last = (T.server.last_as_of || {})[agent];
  if (last) {
    const upto = r.ownChangesFrom ?? T.server.changes.length;
    const told = T.server.stale_told ||= {};
    const ch = changeItems(T, changesFor(T, agent, Date.parse(last), upto, told[agent] || 0));
    if (ch.length) {
      notes.stale = { changes: ch, fix: L.MSG.staleFix };
      told[agent] = Math.max(told[agent] || 0, upto);
    }
  }
  const u = untoldFor(T, agent);
  if (u.length) notes.untold = u;
  const called = new Set(calls.map((c) => c.fn));
  for (const c of calls) {
    const a0 = c.args && c.args[0];
    if (c.fn === "list" && typeof a0 === "string" && a0.replace(/^\/+|\/+$/g, "") === "todo") called.add("list:todo");
    if (c.fn === "find" && a0 && typeof a0 === "object" && (a0.in === "todo" || a0.in === "all" || Array.isArray(a0.in) && a0.in.includes("todo"))) called.add("list:todo");
  }
  const chat = T.server.chats[agent] || 0;
  for (const sk of makeView(T).skills()) {
    const p = `skills/${sk.name}/SKILL.md`;
    const before = T.files.get(p).meta.before || [];
    if (C.isLayerSkill(sk.name)) continue;
    if (!before.some((f) => called.has(f))) continue;
    if (((T.server.read_in_chat || {})[agent] || {})[p] === chat) continue;
    const sent = (T.server.read_first_sent ||= {})[agent] ||= {};
    if (sent[p] === chat) continue;
    sent[p] = chat;
    notes.read_first = { path: p, fix: L.MSG.readFirstFix };
    break;
  }
  r.notes = notes;
  return r;
}
async function runOnce(S, agent, opId, code, calls) {
  const key = `${agent}|${opId}`;
  const codeHash = hash(code.trim());
  const cachedOp = S.server.ops[key];
  if (cachedOp) {
    if (cachedOp.code === codeHash) return { answer: cachedOp.answer, state: S, cached: true, ranAt: cachedOp.at };
    return { answer: C.refuse("OP_ID_REUSED", `op_id "${opId}" was already used with other code.`, 'Every new program needs an op_id you never used (e.g. "091204-2"). The same op_id only resends the SAME code after no answer or a timeout.'), state: S };
  }
  const noAwait = code.match(/(?<!await\s{0,3})(?<!return\s{0,3})(?<![\w.])nm\.(read|write|list|find|save_task)\s*\(/);
  if (noAwait && !/Promise\.all/.test(code)) return { answer: C.refuse("MISSING_AWAIT", `Nothing ran: nm.${noAwait[1]}(…) has no await.`, `Put await before every nm call (const x = await nm.${noAwait[1]}(…)) and run it again with a new op_id.`), state: S };
  const T = cloneState(S);
  const api = makeApi(T, agent, calls);
  const r = await sandbox(code, api);
  const again = "Fix the program and run it again with a new op_id. Nothing was saved.";
  let answer;
  const ok = r.ok;
  if (r.ok) answer = r.value;
  else if (r.kind === "PARSE") answer = C.refuse("PROGRAM_ERROR", `The program does not parse: ${r.message}`, "Fix the TypeScript/JavaScript and run it again with a new op_id. Nothing was saved.");
  else if (r.kind === "THROWN" && r.error && typeof r.error.code === "string" && r.error.committed === false) answer = r.error;
  else if (r.kind === "TIMEOUT" || r.kind === "MEMORY") answer = C.refuse(r.kind, r.message, r.kind === "TIMEOUT" ? "Await only nm calls and keep the program short. " + again : "Keep less in memory: return only what you need. " + again);
  else answer = C.refuse("PROGRAM_ERROR", r.message, again);
  if (ok) {
    T.server.ops[key] = { at: T.server.now, code: codeHash, answer };
    return { answer, state: T };
  }
  if (C.CONFIG.CACHE_REFUSALS) S.server.ops[key] = { at: S.server.now, code: codeHash, answer };
  return { answer, state: S };
}
function reset(scenario) {
  fs.rmSync(STATE, { recursive: true, force: true });
  fs.cpSync(WORLD, STATE, { recursive: true });
  const S = loadState(STATE);
  let applied = [];
  if (scenario && fs.existsSync(path.join(OVERRIDES, `${scenario}.json`))) applied = applyOverride(S, scenario);
  else if (scenario) applied = [`no override for ${scenario}: base world`];
  normalizePositions(S);
  sweep(S);
  S.server.scenario = scenario || null;
  S.server.ops = {};
  saveState(S, STATE);
  fs.writeFileSync(path.join(STATE, "_calls.jsonl"), "");
  return { scenario: scenario || "base", applied, files: S.files.size, tasks: S.todo.tasks.length, as_of: localIso(S) };
}
function applyOverride(S, name, seen = new Set()) {
  const file = path.join(OVERRIDES, `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`No override ${file}. Scenarios: ${fs.readdirSync(OVERRIDES).map((f) => f.replace(/\.json$/, "")).join(", ")}`);
  if (seen.has(name)) throw new Error(`override loop at ${name}`);
  seen.add(name);
  const o = JSON.parse(fs.readFileSync(file, "utf8"));
  const applied = o.extends ? applyOverride(S, o.extends, seen) : [];
  for (const r of o.remove || []) for (const p of [...S.files.keys()]) if (p === r || r.endsWith("/") && p.startsWith(r)) S.files.delete(p);
  for (const [p, v] of Object.entries(o.files || {})) S.files.set(p, typeof v === "string" ? parseDoc(v) : { text: v.text || "", meta: v.meta || {} });
  for (const [p, m] of Object.entries(o.patch_meta || {})) {
    const f = S.files.get(p);
    if (!f) throw new Error(`patch_meta: no ${p}`);
    for (const [k, v] of Object.entries(m)) {
      if (v === null) delete f.meta[k];
      else f.meta[k] = v;
    }
  }
  for (const [p, [a, b]] of Object.entries(o.replace_text || {})) {
    const f = S.files.get(p);
    if (!f || !f.text.includes(a)) throw new Error(`replace_text: ${p}`);
    f.text = f.text.replace(a, b);
  }
  for (const [p, add] of Object.entries(o.append_text || {})) {
    const f = S.files.get(p);
    if (!f) throw new Error(`append_text: no ${p}`);
    f.text = appendText(f.text, add);
  }
  if (o.access) {
    const r = C.parseAccessYaml(S.files.get("access.yaml").text);
    Object.assign(r, o.access);
    const header = S.files.get("access.yaml").text.split("\n").filter((l) => l.startsWith("#")).join("\n");
    S.files.get("access.yaml").text = `${header}
${Object.entries(r).map(([k, v]) => `${k}: [${v.join(", ")}]`).join("\n")}
`;
  }
  if (o.tasks) {
    const T = S.todo.tasks;
    for (const id of o.tasks.remove || []) {
      const i = T.findIndex((t) => t.id === id);
      if (i >= 0) T.splice(i, 1);
    }
    for (const [id, patch] of Object.entries(o.tasks.patch || {})) {
      const t = T.find((x) => x.id === Number(id));
      if (!t) throw new Error(`tasks.patch: no ${id}`);
      Object.assign(t, patch);
    }
    for (const t of o.tasks.add || []) {
      T.push({ status: "planned", priority: "medium", order: null, parent: null, project: null, vector: null, description: null, deadline: null, day: null, comment: "", created: S.server.now, by: "owner", ...t });
      S.todo.next_id = Math.max(S.todo.next_id, t.id + 1);
    }
  }
  if (o.server) {
    const { changes, ...rest } = o.server;
    Object.assign(S.server, rest);
    if (changes) S.server.changes.push(...changes);
  }
  return [...applied, name];
}
export {
  HERE,
  OVERRIDES,
  STATE,
  WORLD,
  appendText,
  cloneState,
  fileVersion,
  formatDoc,
  isLeveled,
  loadState,
  localIso,
  makeApi,
  makeView,
  normalizePositions,
  nowLine,
  ownerTz,
  parseDoc,
  placeOfList,
  positionOf,
  projectRules,
  reset,
  rulesOf,
  runProgram,
  saveState,
  sectionOf,
  seqKey,
  seqOf,
  slug,
  splitSharedRules,
  start,
  sweep,
  taskVersion,
  todoListing,
  whatsNew
};
