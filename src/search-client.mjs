import { fork } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
function startSearchClient({ stateDir, dbPath, timeoutMs = 2500, log = console.error }) {
  let child = null;
  let ready = false;
  let seq = 0;
  let restarts = 0;
  let refreshTimer = null;
  const waiting = new Map();
  function spawnWorker() {
    ready = false;
    child = fork(path.join(HERE, "search-worker.mjs"), [], { env: { ...process.env, NM_STATE: stateDir, SEARCH_DB: dbPath }, stdio: ["ignore", "ignore", "inherit", "ipc"] });
    child.on("message", (m) => {
      if (m.ready) {
        ready = true;
        log(`search worker ready: ${JSON.stringify(m.refresh)}`);
        return;
      }
      const w = waiting.get(m.id);
      if (!w) return;
      waiting.delete(m.id);
      clearTimeout(w.timer);
      if (m.ok) w.resolve(m.value);
      else w.resolve(null);
    });
    child.on("exit", (code, sig) => {
      ready = false;
      for (const w of waiting.values()) {
        clearTimeout(w.timer);
        w.resolve(null);
      }
      waiting.clear();
      const delay = Math.min(6e4, 2e3 * 2 ** Math.min(restarts++, 5));
      log(`search worker stopped (${code ?? sig}); restart in ${delay} ms`);
      setTimeout(spawnWorker, delay).unref();
    });
  }
  function ask(msg, ms) {
    if (!child || !ready) return Promise.resolve(null);
    const id = ++seq;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        waiting.delete(id);
        resolve(null);
      }, ms);
      waiting.set(id, { resolve, timer });
      try {
        child.send({ id, ...msg });
      } catch {
        clearTimeout(timer);
        waiting.delete(id);
        resolve(null);
      }
    });
  }
  spawnWorker();
  return {
    close: (text) => ask({ op: "close", text, deadline: Date.now() + timeoutMs }, timeoutMs),
    refresh() {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        ask({ op: "refresh" }, 10 * 60 * 1e3);
      }, 300);
    },
    status: () => ask({ op: "status" }, 2e3),
    get ready() {
      return ready;
    },
    stop() {
      if (child) {
        child.removeAllListeners("exit");
        child.kill();
      }
    }
  };
}
export {
  startSearchClient
};
