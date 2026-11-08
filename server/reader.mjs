import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
const COOKIE = "cc_reader";
const SKIP_META = new Set(["last_hit"]);
function makeReader({ NM, HERE }) {
  const keyFile = path.join(NM.STATE, "reader-token");
  if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(24).toString("hex") + "\n", { mode: 384 });
  const KEY = fs.readFileSync(keyFile, "utf8").trim();
  const PAGE = path.join(HERE, "reader.src.html");
  const MARKED = path.join(HERE, "marked.min.js");
  const SW = path.join(HERE, "reader-sw.js");
  function fingerprint() {
    const h = crypto.createHash("sha1");
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === ".git" || e.name.endsWith(".jsonl")) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else {
          const st = fs.statSync(p);
          h.update(`${p}:${st.size}:${st.mtimeMs};`);
        }
      }
    };
    walk(NM.STATE);
    return h.digest("hex");
  }
  let cache = null;
  function snapshot() {
    const fp = fingerprint();
    if (cache && cache.fp === fp) return cache;
    const S = NM.loadState();
    const originals = {};
    const files = [...S.files].map(([p, f]) => {
      if (f.meta?.original) originals[p] = f.meta.original;
      return { path: p, text: f.text || "", meta: Object.fromEntries(Object.entries(f.meta || {}).filter(([k]) => !SKIP_META.has(k) && k !== "original")), ...f.meta?.original ? { hasOriginal: true } : {} };
    }).sort((a, b) => a.path.localeCompare(b.path));
    const tasks = {};
    for (const t of S.todo.tasks) tasks[t.id] = { comment: t.comment || null, created: t.created || null, by: t.by || null, date: t.date || null };
    const body = { files, sections: NM.todoListing(S), tasks };
    const version = crypto.createHash("sha1").update(JSON.stringify(body)).update(JSON.stringify(originals)).digest("hex").slice(0, 16);
    if (cache && cache.version === version) {
      cache.fp = fp;
      return cache;
    }
    const json = Buffer.from(JSON.stringify({ version, ...body }));
    const lite = Buffer.from(JSON.stringify({
      version,
      lite: true,
      sections: body.sections,
      tasks,
      files: files.map((f) => ({ path: f.path, meta: f.meta, text: "", hasOriginal: f.hasOriginal, preview: f.text.replace(/^---[\s\S]*?---\s*/, "").replace(/^#.*\n/, "").trim().slice(0, 160) }))
    }));
    const pack = (raw) => ({ raw, br: zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }), gz: zlib.gzipSync(raw) });
    const byPath = new Map(files.map((f) => [f.path, f]));
    cache = { fp, version, byPath, originals, full: pack(json), lite: pack(lite), orig: pack(Buffer.from(JSON.stringify({ version, originals }))) };
    return cache;
  }
  const SEC = {
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  };
  const cookieOk = (req) => String(req.headers.cookie || "").split(/;\s*/).some((c) => c === `${COOKIE}=${KEY}`);
  const send = (req, res, status, type, buf, extra = {}) => {
    const ae = String(req.headers["accept-encoding"] || "");
    const head = { ...SEC, "Content-Type": type, Vary: "Accept-Encoding, Cookie", ...extra };
    if (buf.raw) head["X-Raw-Length"] = String(buf.raw.length);
    if (buf.br && /\bbr\b/.test(ae)) return res.writeHead(status, { ...head, "Content-Encoding": "br" }).end(buf.br);
    if (buf.gz && /\bgzip\b/.test(ae)) return res.writeHead(status, { ...head, "Content-Encoding": "gzip" }).end(buf.gz);
    return res.writeHead(status, head).end(buf.raw);
  };
  const compress = (s) => {
    const raw = Buffer.from(s);
    return { raw, br: zlib.brotliCompressSync(raw), gz: zlib.gzipSync(raw) };
  };
  let pageBuf = null, pageMt = 0, swBuf = null, swMt = 0;
  const page = () => {
    const m = fs.statSync(PAGE).mtimeMs;
    if (m !== pageMt) {
      pageBuf = compress(fs.readFileSync(PAGE, "utf8").replace("/*MARKED*/", () => fs.readFileSync(MARKED, "utf8").replace(/<\/script/gi, "<\\/script")));
      pageMt = m;
    }
    return pageBuf;
  };
  const sw = () => {
    const m = fs.statSync(SW).mtimeMs;
    if (m !== swMt) {
      swBuf = compress(fs.readFileSync(SW, "utf8"));
      swMt = m;
    }
    return swBuf;
  };
  const ICON = compress(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#111"/><text x="256" y="330" font-family="-apple-system,Helvetica,Arial" font-size="220" font-weight="700" fill="#fff" text-anchor="middle">CC</text></svg>`);
  const MANIFEST = compress(JSON.stringify({ name: "ContextCore", short_name: "ContextCore", start_url: "/v/", scope: "/v/", display: "standalone", background_color: "#0b0b0c", theme_color: "#0b0b0c", icons: [{ src: "/v/icon.svg", sizes: "any", type: "image/svg+xml" }] }));
  return function handle(req, res, url) {
    const p = url.pathname;
    if (req.method !== "GET" && (p.startsWith("/v/") || p.startsWith("/r/"))) {
      res.writeHead(405, SEC).end();
      return true;
    }
    if (p === `/r/${KEY}`) {
      res.writeHead(302, { ...SEC, "Set-Cookie": `${COOKIE}=${KEY}; Path=/v; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`, Location: "/v/", "Cache-Control": "no-store" }).end();
      return true;
    }
    if (p.startsWith("/r/")) {
      res.writeHead(404, SEC).end();
      return true;
    }
    if (p === "/v" || p === "/") {
      res.writeHead(302, { ...SEC, Location: "/v/" }).end();
      return true;
    }
    if (!p.startsWith("/v/")) return false;
    if (p === "/v/") {
      send(req, res, 200, "text/html; charset=utf-8", page(), { "Cache-Control": "no-cache" });
      return true;
    }
    if (p === "/v/sw.js") {
      send(req, res, 200, "text/javascript; charset=utf-8", sw(), { "Cache-Control": "no-cache", "Service-Worker-Allowed": "/v/" });
      return true;
    }
    if (p === "/v/manifest.webmanifest") {
      send(req, res, 200, "application/manifest+json", MANIFEST, { "Cache-Control": "public, max-age=86400" });
      return true;
    }
    if (p === "/v/icon.svg") {
      send(req, res, 200, "image/svg+xml", ICON, { "Cache-Control": "public, max-age=86400" });
      return true;
    }
    if (p.startsWith("/v/api/")) {
      if (!cookieOk(req)) {
        res.writeHead(401, { ...SEC, "Cache-Control": "no-store" }).end();
        return true;
      }
      const c = snapshot();
      const JSONT = "application/json; charset=utf-8";
      if (p === "/v/api/first") {
        send(req, res, 200, JSONT, c.lite, { "Cache-Control": "private, no-store" });
        return true;
      }
      if (p === "/v/api/file") {
        const f = c.byPath.get(url.searchParams.get("p") || "");
        if (!f) {
          res.writeHead(404, SEC).end();
          return true;
        }
        const o = c.originals[f.path];
        const raw = Buffer.from(JSON.stringify({ ...f, ...o ? { original: o } : {} }));
        send(req, res, 200, JSONT, { raw, gz: zlib.gzipSync(raw) }, { "Cache-Control": "private, no-store" });
        return true;
      }
      if (p === "/v/api/snapshot" || p === "/v/api/originals") {
        const etag = `"${c.version}"`;
        const head = { "Cache-Control": "private, no-cache", ETag: etag };
        if (String(req.headers["if-none-match"] || "") === etag) {
          res.writeHead(304, { ...SEC, ...head }).end();
          return true;
        }
        send(req, res, 200, JSONT, p === "/v/api/snapshot" ? c.full : c.orig, head);
        return true;
      }
    }
    res.writeHead(404, SEC).end();
    return true;
  };
}
const readerLink = (NM, host) => `https://${host}/r/${fs.readFileSync(path.join(NM.STATE, "reader-token"), "utf8").trim()}`;
export {
  makeReader,
  readerLink
};
