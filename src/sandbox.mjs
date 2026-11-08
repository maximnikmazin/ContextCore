import module from "node:module";
import ivm from "isolated-vm";
const LIMITS = { timeoutMs: 3e3, wallMs: 5e3, memoryMb: 64 };
const NM_FUNCTIONS = ["list", "read", "find", "write", "save_task"];
function toJs(code) {
  const wrapped = `async function __program__() {
${code}
}`;
  const emit = process.emitWarning;
  process.emitWarning = () => {
  };
  try {
    return module.stripTypeScriptTypes(wrapped, { mode: "transform" });
  } finally {
    process.emitWarning = emit;
  }
}
async function run(code, api, limits = {}) {
  const { timeoutMs, wallMs, memoryMb } = { ...LIMITS, ...limits };
  let src;
  try {
    src = toJs(code);
  } catch (e) {
    return { ok: false, kind: "PARSE", message: String(e.message || e).split("\n")[0] };
  }
  const isolate = new ivm.Isolate({ memoryLimit: memoryMb });
  const wall = setTimeout(() => {
    if (!isolate.isDisposed) isolate.dispose();
  }, wallMs);
  try {
    const context = await isolate.createContext();
    const host = new ivm.Reference((name, argsJson) => {
      if (!NM_FUNCTIONS.includes(name)) return JSON.stringify({ err: { code: "PROGRAM_ERROR", message: `nm.${name} does not exist.` } });
      try {
        const r2 = api[name](...JSON.parse(argsJson));
        return JSON.stringify({ ok: r2 === void 0 ? null : r2 });
      } catch (e) {
        return JSON.stringify({ err: e });
      }
    });
    await context.global.set("__host__", host);
    await context.eval(`globalThis.nm = ((host) => {
        const call = (n, a) => { const r = JSON.parse(host.applySync(undefined, [n, JSON.stringify(a)])); if ('err' in r) throw r.err; return r.ok; };
        return Object.freeze(Object.fromEntries(${JSON.stringify(NM_FUNCTIONS)}.map((n) => [n, async (...a) => call(n, a)])));
      })(__host__);
      delete globalThis.__host__;`);
    const out = await context.eval(
      `${src}
__program__().then((v) => JSON.stringify({ v: v === undefined ? null : v }), (e) => JSON.stringify({ e: (e && typeof e === 'object' && !(e instanceof Error)) ? e : { message: String(e && e.message || e) } }))`,
      { timeout: timeoutMs, promise: true }
    );
    const r = JSON.parse(out);
    return "v" in r ? { ok: true, value: r.v } : { ok: false, kind: "THROWN", message: r.e.message || "", error: r.e };
  } catch (e) {
    const m = String(e && e.message || e);
    if (/memory limit/i.test(m)) return { ok: false, kind: "MEMORY", message: `The program used more than ${memoryMb} MB.` };
    if (/timed out/i.test(m) || isolate.isDisposed) return { ok: false, kind: "TIMEOUT", message: `The program ran longer than ${timeoutMs / 1e3} s.` };
    return { ok: false, kind: "PROGRAM_ERROR", message: m.split("\n")[0] };
  } finally {
    clearTimeout(wall);
    if (!isolate.isDisposed) isolate.dispose();
  }
}
export {
  LIMITS,
  run
};
