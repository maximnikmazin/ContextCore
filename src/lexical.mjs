const STOP = new Set(`a an the and or of to in on for with without is are was were be been being am my me i im we our you your it its this that these those
from at by as do does did done what which who whom whose where when why how about any some all can could would should will shall may might must
have has had having get got make made need want please there here than then also just only very more most much many such into over under
note notes saved save find search look show tell list item items thing things something anything everything one ones two
и в во на с со к ко по о об обо от до за из у для как что это мне меня мой моя мое моё мои ты вы он она оно они его ее её их бы же ли не нет
нужно надо можешь сделай сделать хочу давай пожалуйста вот там тут где когда какой какая какое какие каких какую кто чем чего почему зачем
есть был была было были будет я мы наш наша наши свой своя свои все всё весь вся этот эта эти тот та те так такой также еще ещё уже или либо
заметка заметки заметку заметок найди найти поищи покажи сохранил сохранила сохранял записал записывал про`.split(/\s+/));
const CYR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
const ENDINGS = ["иями", "ями", "ами", "ого", "его", "ому", "ему", "ыми", "ими", "ых", "их", "ах", "ях", "ов", "ев", "ей", "ой", "ий", "ый", "ая", "яя", "ое", "ее", "ом", "ем", "ам", "ям", "ую", "юю", "а", "я", "у", "ю", "е", "ы", "и", "о", "ь", "й"];
const base = (w) => {
  if (!/^[а-я]+$/.test(w) || w.length < 4) return w;
  for (const e of ENDINGS) if (w.endsWith(e) && w.length - e.length >= 3) return w.slice(0, -e.length);
  return w;
};
const stem = (w) => base(w).slice(0, 5);
const words = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !STOP.has(w));
const translit = (w) => /[а-я]/.test(w) ? [...w].map((c) => CYR[c] ?? c).join("") : null;
const ORDER_WORDS = /^(latest|last|newest|recent|recently|последн\S*|свеж\S*|недавн\S*|новейш\S*)$/;
function queryTerms(q) {
  const out = [];
  const seen = new Set();
  for (const w of words(q).filter((x) => !ORDER_WORDS.test(x))) {
    const v = [stem(w)];
    const t = translit(w);
    if (t && t.length > 1) v.push(stem(t));
    const key = v.join("|");
    if (!seen.has(key)) {
      seen.add(key);
      v.words = t && t.length > 1 ? [w, t] : [w];
      out.push(v);
    }
  }
  return out;
}
const memo = new Map();
function itemOf(d) {
  const m = memo.get(d.path);
  const extra = `${d.summary || ""}\0${(d.names || []).join("\0")}`;
  if (m && m.text === d.text && m.titleText === d.title && m.extra === extra) return m.item;
  const names = (d.names || []).join(" ");
  const titleWords = words(`${d.title || ""} ${names} ${String(d.path).split("/").pop().replace(/\.md$/, "").replace(/^\d{6}-/, "").replace(/-/g, " ")}`).map(stem);
  const tf = new Map();
  const full = new Map();
  const raw = words(`${d.title || ""} ${names} ${d.text}`);
  const bw = words(d.text).map(stem);
  for (const w of bw) tf.set(w, (tf.get(w) || 0) + 1);
  const sum = new Set(words(d.summary).map(stem));
  for (const w of raw) for (const x of [w, translit(w)]) if (x) {
    const k = stem(x);
    if (!full.has(k)) full.set(k, new Set());
    full.get(k).add(x);
  }
  const item = { path: d.path, title: new Set(titleWords), tf, sum, full, len: bw.length, keys: [...new Set([...tf.keys(), ...titleWords, ...sum])] };
  memo.set(d.path, { text: d.text, titleText: d.title, extra, item });
  return item;
}
function buildIndex(docs) {
  const N = docs.length || 1;
  const df = new Map();
  let total = 0;
  const items = docs.map((d) => {
    const it = itemOf(d);
    for (const w of it.keys) df.set(w, (df.get(w) || 0) + 1);
    total += it.len;
    return it;
  });
  const avg = total / N || 1;
  const idf = (w) => Math.log(1 + (N - (df.get(w) || 0) + 0.5) / ((df.get(w) || 0) + 0.5));
  function score(q) {
    const terms = queryTerms(q);
    const weights = terms.map((v) => Math.max(...v.map(idf)));
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    const rareDf = Math.max(3, Math.ceil(N * 0.02));
    const rareQ = terms.length > 0 && terms.length <= 3 && terms.every((v) => Math.max(...v.map((w) => df.get(w) || 0)) <= rareDf);
    const sameName = (q0, w0) => {
      const q2 = base(q0);
      const w = base(w0);
      if (q2 === w) return true;
      let i = 0;
      while (i < q2.length && i < w.length && q2[i] === w[i]) i++;
      return i >= Math.max(5, Math.min(q2.length, w.length) - 2);
    };
    const named = (it, v) => v.words.some((q2) => [...it.full.get(stem(q2)) || []].some((w) => sameName(q2, w)));
    const out = new Map();
    for (const it of items) {
      let t = 0;
      let b = 0;
      let found = 0;
      terms.forEach((v, i) => {
        const inT = v.some((w) => it.title.has(w));
        if (inT) t += weights[i];
        const f = Math.max(...v.map((w) => it.tf.get(w) || 0)) || (v.some((w) => it.sum.has(w)) ? 1 : 0);
        if (f) b += weights[i] * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * it.len / avg));
        if (inT || f) found++;
      });
      if (t || b) out.set(it.path, { title: t / sum, body: Math.min(1, b / sum / 2.2), ...rareQ && found === terms.length && terms.every((v) => named(it, v)) ? { exact: true } : {} });
    }
    return out;
  }
  return { score, size: N };
}
export {
  base,
  buildIndex,
  queryTerms
};
