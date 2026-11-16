import { parentPort, workerData } from "node:worker_threads";
import { createStore } from "@tobilu/qmd";
const store = await createStore({ dbPath: workerData.dbPath, config: workerData.config });
parentPort.on("message", async (m) => {
  try {
    parentPort.postMessage({ id: m.id, ok: true, value: await store.update() });
  } catch (e) {
    parentPort.postMessage({ id: m.id, ok: false, error: String(e && e.message || e) });
  }
});
parentPort.postMessage({ ready: true });
