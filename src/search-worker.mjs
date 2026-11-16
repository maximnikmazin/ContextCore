import os from "node:os";
import { createVectors } from "./search.mjs";
try {
  os.setPriority(0, 15);
} catch {
}
const stateDir = process.env.NM_STATE;
const dbPath = process.env.SEARCH_DB;
const v = await createVectors({ stateDir, dbPath });
const first = await v.refresh();
await v.warm();
process.send({ ready: true, refresh: first });
setInterval(() => {
  v.close("keep warm").catch(() => {
  });
}, 4 * 60 * 1e3).unref();
process.on("message", async (m) => {
  try {
    let value;
    if (m.op === "close") {
      if (m.deadline && Date.now() > m.deadline) throw new Error("too late");
      value = await v.close(m.text, m.limit || 120);
    } else if (m.op === "refresh") value = await v.refresh();
    else if (m.op === "status") value = v.status();
    else throw new Error(`unknown op ${m.op}`);
    process.send({ id: m.id, ok: true, value });
  } catch (e) {
    process.send({ id: m.id, ok: false, error: String(e && e.message || e) });
  }
});
process.on("disconnect", () => process.exit(0));
