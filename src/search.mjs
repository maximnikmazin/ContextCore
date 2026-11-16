import fs from "node:fs";
import path from "node:path";
const TUNING = {
  TITLE: 0.2,
  BODY: 0.1,
  STRONG: 0.65,
  RECENT_BAND: 0.08,
  MORE: 0.7,
  WEAK: 0.55,
  WEAK_MAX: 2,
  GAP: 0.15,
  MAX: 5
};
async function createVectors({ stateDir, dbPath }) {
  const { createStore } = await import("@tobilu/qmd");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const mirror = `${dbPath}.mirror`;
  fs.mkdirSync(mirror, { recursive: true });
  const config = { collections: { cc: { path: path.resolve(mirror), pattern: "**/*.md" } } };
  const store = await createStore({ dbPath, config });
  try {
    const llmJs = new URL("./llm.js", import.meta.resolve("@tobilu/qmd"));
    (await import(llmJs.href)).setDefaultLlamaCpp(store.internal.llm);
  } catch (e) {
    console.error(`search: one model for chunks failed (${e.message}); chunks use a second copy`);
  }
  let updater = null;
  let useq = 0;
  const uwait = new Map();
  try {
    const { Worker } = await import("node:worker_threads");
    const w = new Worker(new URL("./search-update-thread.mjs", import.meta.url), { workerData: { dbPath, config } });
    await new Promise((res, rej) => {
      w.once("message", (m) => m.ready ? res() : rej(new Error("no ready")));
      w.once("error", rej);
    });
    w.on("message", (m) => {
      const f = uwait.get(m.id);
      if (!f) return;
      uwait.delete(m.id);
      if (m.ok) f.res(m.value);
      else f.rej(new Error(m.error));
    });
    const stopped = () => {
      updater = null;
      for (const f of uwait.values()) f.rej(new Error("update thread stopped"));
      uwait.clear();
    };
    w.on("error", stopped);
    w.on("exit", stopped);
    updater = (m) => new Promise((res, rej) => {
      const id = ++useq;
      uwait.set(id, { res, rej });
      w.postMessage({ id });
    });
  } catch {
    updater = null;
  }
  const update = () => updater ? updater().catch(() => store.update()) : store.update();
  const llm = store.internal.llm;
  const headFile = `${dbPath}.heads.json`;
  let heads = new Map();
  try {
    heads = new Map(JSON.parse(fs.readFileSync(headFile, "utf8")).map((h) => [h.path, h]));
  } catch {
  }
  let busy = Promise.resolve();
  let last = null;
  const QUIET_MS = 8e3;
  let searching = 0;
  let lastSearch = 0;
  const llmEmbed = llm.embed.bind(llm);
  async function searchGap() {
    const t = Date.now();
    while ((searching > 0 || Date.now() - lastSearch < QUIET_MS) && Date.now() - t < 3e4) await new Promise((r) => setTimeout(r, 250));
  }
  llm.embed = async (...a) => {
    await searchGap();
    return llmEmbed(...a);
  };
  const llmTokenize = llm.tokenize.bind(llm);
  llm.tokenize = async (...a) => {
    await searchGap();
    return llmTokenize(...a);
  };
  llm.embedBatch = async (texts, ...a) => {
    const out = [];
    for (const t of texts) {
      await searchGap();
      out.push(await llmEmbed(t, ...a));
    }
    return out;
  };
  function syncMirror() {
    const files = listMd(stateDir);
    const keep = new Set(files);
    let changed = 0;
    for (const p of files) {
      const clean = cleanText(path.join(stateDir, p), p);
      const m = path.join(mirror, p);
      let old = null;
      try {
        old = fs.readFileSync(m, "utf8");
      } catch {
      }
      if (old !== clean) {
        fs.mkdirSync(path.dirname(m), { recursive: true });
        fs.writeFileSync(m, clean);
        changed++;
      }
    }
    for (const p of listMd(mirror)) if (!keep.has(p)) {
      fs.rmSync(path.join(mirror, p));
      changed++;
    }
    return changed;
  }
  async function refreshHeads() {
    const files = listMd(stateDir);
    const want = new Map(files.map((p) => [p, headText(path.join(stateDir, p), p)]));
    for (const p of [...heads.keys()]) if (!want.has(p)) heads.delete(p);
    const todo = [...want].filter(([p, t]) => !heads.has(p) || heads.get(p).text !== t);
    for (let i = 0; i < todo.length; i += 32) {
      const batch = todo.slice(i, i + 32);
      const r = await llm.embedBatch(batch.map(([, t]) => t));
      batch.forEach(([p, t], j) => {
        if (r[j]) heads.set(p, { path: p, text: t, v: Float32Array.from(r[j].embedding) });
      });
    }
    if (todo.length) fs.writeFileSync(headFile, JSON.stringify([...heads.values()].map((h) => ({ path: h.path, text: h.text, v: Array.from(h.v) }))));
    for (const h of heads.values()) if (!(h.v instanceof Float32Array)) h.v = Float32Array.from(h.v);
    return todo.length;
  }
  const fpFile = `${dbPath}.model.json`;
  async function checkModel() {
    const fp = Array.from((await llm.embed("title: ContextCore fingerprint | text: wine, ramen, Mem0")).embedding);
    let saved = null;
    try {
      saved = JSON.parse(fs.readFileSync(fpFile, "utf8")).fp;
    } catch {
    }
    const same = saved && saved.length === fp.length && cos(saved, fp) > 0.98;
    if (!same && saved) {
      heads = new Map();
      try {
        fs.rmSync(headFile);
      } catch {
      }
    }
    return { same: !!same, had: !!saved, save: () => fs.writeFileSync(fpFile, JSON.stringify({ model: llm.embedModelName, fp })) };
  }
  let modelChecked = null;
  let again = null;
  function refresh() {
    if (again) return again;
    const run = busy.then(async () => {
      if (again === run) again = null;
      await searchGap();
      const t = Date.now();
      const model = modelChecked || await checkModel();
      const m = syncMirror();
      dbg("mirror synced", m);
      const u = await update();
      dbg("store updated");
      const e = !model.same && model.had ? await store.embed({ force: true }) : u.needsEmbedding ? await store.embed({ maxDocsPerBatch: 1 }) : null;
      if (!modelChecked) {
        model.save();
        modelChecked = { same: true, had: true };
      }
      dbg("chunks embedded");
      const h = await refreshHeads();
      dbg("heads embedded", h);
      last = { at: (new Date()).toISOString(), ms: Date.now() - t, ...!model.same && model.had ? { model_changed: "all vectors made again" } : {}, mirror_changed: m, indexed: u.indexed, updated: u.updated, removed: u.removed, chunks_embedded: e ? e.chunksEmbedded ?? null : 0, heads_embedded: h, notes: heads.size };
      return last;
    }).catch((err) => {
      last = { at: (new Date()).toISOString(), error: String(err && err.message || err) };
      return last;
    });
    busy = run;
    again = run;
    return run;
  }
  async function close(text, limit = 120) {
    searching++;
    try {
      return await closeNow(text, limit);
    } finally {
      searching--;
      lastSearch = Date.now();
    }
  }
  async function closeNow(text, limit) {
    const q = String(text || "").trim();
    dbg("search start");
    const qv = (await llmEmbed(`task: search result | query: ${q}`)).embedding;
    dbg("search embedded");
    const r = await store.internal.searchVec(q, llm.embedModelName, limit, void 0, void 0, qv);
    const by = new Map();
    const get = (p) => {
      if (!by.has(p)) by.set(p, { path: p, head: 0, chunk: 0, snippet: "" });
      return by.get(p);
    };
    for (const x of r) {
      const d = get(x.displayPath.replace(/^cc\//, ""));
      if (x.score > d.chunk) {
        d.chunk = x.score;
        const at = Math.max(0, Number(x.chunkPos) || 0);
        d.snippet = String(x.body || "").slice(at, at + 1200);
      }
    }
    for (const h of heads.values()) {
      if (!(h.v instanceof Float32Array)) continue;
      get(h.path).head = cos(qv, h.v);
    }
    return [...by.values()].map((d) => ({ path: d.path, head: d.head, chunk: d.chunk, snippet: d.chunk > d.head ? d.snippet : "", vec: Math.max(d.head, d.chunk) })).sort((a, b) => b.vec - a.vec);
  }
  async function warm() {
    await close("warm up");
  }
  return { refresh, close, warm, status: () => last };
}
const dbg = (...a) => {
  if (process.env.SEARCH_DEBUG) console.error((new Date()).toISOString().slice(17, 23), ...a);
};
function cos(a, b) {
  let s = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return s / Math.sqrt(na * nb || 1);
}
function listMd(dir, rel = "", out = []) {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (!/^(skills|agents|system|\.git|node_modules)$/.test(r)) listMd(dir, r, out);
    } else if (rel && e.name.endsWith(".md")) out.push(r);
  }
  return out;
}
function parts(file, rel) {
  const raw = fs.readFileSync(file, "utf8");
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const body = fm ? raw.slice(fm[0].length) : raw;
  const title = fm && (fm[1].match(/^title:\s*["']?(.+?)["']?\s*$/m) || [])[1] || (body.match(/^#+\s+(.+)/m) || [])[1] || rel.split("/").pop().replace(/\.md$/, "");
  let summary = fm ? (fm[1].match(/^summary:\s*(.+)$/m) || [])[1] || "" : "";
  if (summary.startsWith('"')) {
    try {
      summary = JSON.parse(summary);
    } catch {
      summary = "";
    }
  }
  return { title, body, summary: String(summary).trim() };
}
function cleanText(file, rel) {
  const { title, body } = parts(file, rel);
  return `# ${title}

${body.replace(/^#+\s+.*\n/, "").trim()}
`;
}
function headText(file, rel) {
  const { title, body, summary } = parts(file, rel);
  return `title: ${title} | text: ${summary || body.replace(/^#+\s+.*\n/, "").replace(/\s+/g, " ").trim().slice(0, 300)}`;
}
const IN_VECTORS = (p) => /^(brain|projects)\//.test(p);
const ALL = /\b(all|every(thing)?|each)\b|(^|[^а-яё])(вс[её]|всех|всю)(?![а-яё])/i;
const RECENT = /\b(latest|last|newest|most recent|recent(ly)?)\b|последн|свеж|недавн|новейш|самое новое|самая новая|самый новый/i;
function rank({ vectors, words, allowed = () => true, T: tuning = {}, query = "", dateOf = null, savedOf = null }) {
  const T = { ...TUNING, ...tuning };
  const all = new Map();
  const base = () => 0.45;
  for (const v of vectors || []) if (allowed(v.path)) all.set(v.path, { path: v.path, vec: v.vec, chunk: v.snippet || "" });
  for (const [p, w] of words) {
    if (!allowed(p)) continue;
    if (!all.has(p)) all.set(p, { path: p, vec: base(p), chunk: "" });
    Object.assign(all.get(p), { wt: w.title, wb: w.body, exact: !!w.exact });
  }
  const shape = (d) => ({ path: d.path, score: Math.round(d.score * 1e3) / 1e3, ...d.weak ? { weak: true } : {}, chunk: d.chunk });
  if (!vectors) {
    const byWords = [...all.values()].map((d) => ({ ...d, score: (d.wt || 0) + (d.wb || 0) })).sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : 1));
    const out2 = { items: byWords.slice(0, T.MAX).map(shape), more: byWords.slice(T.MAX, T.MAX + 15).map(shape) };
    if (!out2.items.length) out2.nothing_close = true;
    return out2;
  }
  const scored = [...all.values()].map((d) => {
    const s = d.vec + T.TITLE * (d.wt || 0) + T.BODY * (d.wb || 0);
    return { ...d, score: d.exact ? Math.max(s, T.STRONG) : s };
  }).sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : 1));
  const best = scored[0] ? scored[0].score : 0;
  let items = [];
  let more = [];
  if (best >= T.STRONG) {
    const keep = scored.filter((d) => d.score >= T.STRONG || d.score >= Math.max(T.WEAK, best - T.GAP));
    items = keep.slice(0, T.MAX);
    more = keep.slice(T.MAX).filter((d) => d.score >= (ALL.test(query) ? T.STRONG : T.MORE) && d.score >= best - T.GAP);
    if (dateOf && RECENT.test(query)) {
      const sure = items.concat(more);
      const onTopic = sure.filter((d) => d.score >= best - T.RECENT_BAND).sort((a, b) => (dateOf(b.path) || "").localeCompare(dateOf(a.path) || ""));
      const ordered = onTopic.concat(sure.filter((d) => !onTopic.includes(d)));
      items = ordered.slice(0, T.MAX);
      more = ordered.slice(T.MAX);
    }
  } else if (best >= T.WEAK) items = scored.filter((d) => d.score >= Math.max(T.WEAK, best - T.GAP)).slice(0, T.WEAK_MAX).map((d) => ({ ...d, weak: true }));
  if (savedOf && items.length && !(dateOf && RECENT.test(query))) {
    const sure = items.concat(more);
    const up = sure.filter((d) => d.score >= T.STRONG && !savedOf(d.path));
    const ordered = up.concat(sure.filter((d) => !up.includes(d)));
    items = ordered.slice(0, items.length);
    more = ordered.slice(items.length);
  }
  const out = { items: items.map(shape), more: more.map(shape) };
  if (!items.length) out.nothing_close = true;
  return out;
}
export {
  ALL,
  IN_VECTORS,
  RECENT,
  TUNING,
  createVectors,
  rank
};
