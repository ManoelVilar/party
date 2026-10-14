/* Reproduz contra o database.rules.json todas as escritas gravadas pelo cliente real (tests/e2e/record_ops.py).
   Rode:  python3 tests/e2e/record_ops.py  (dentro de tests/e2e)  e depois  node tests/rules/replay.cjs */
const targaryen = require("targaryen");
const fs = require("fs");
const path = require("path");
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, "../../database.rules.json"), "utf8"));
const { ops } = JSON.parse(fs.readFileSync(path.join(__dirname, "ops.json"), "utf8"));
const fix = (v, now) => (v && typeof v === "object")
  ? (v[".sv"] === "timestamp" ? now : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x, now)])))
  : v;

let db = targaryen.database(rules, {}, ops[0].t), bad = 0;
for (const o of ops) {
  const now = o.t, v = fix(o.v, now);
  const d = db.as({ uid: o.u }), opt = { now };
  const r = o.op === "update" ? d.update("/" + o.p.replace(/^\//, ""), v, opt) : d.write("/" + o.p.replace(/^\//, ""), v, opt);
  if (r.allowed) db = r.newDatabase.with({ now });
  else { bad++; console.log("NEGADO:", o.op, o.p, JSON.stringify(v).slice(0, 120), "\n   ", String(r.info).split("\n").filter(l => /=> false|denied/.test(l)).slice(0, 3).join(" | ")); }
}
const kinds = {}; ops.forEach(o => { const k = o.p.replace(/^\/?rooms\/[^/]+\//, "").split("/")[0]; kinds[k] = (kinds[k] || 0) + 1; });
console.log(`${ops.length - bad}/${ops.length} escritas do cliente real aceitas pelas regras. Áreas exercitadas:`, JSON.stringify(kinds));
process.exit(bad ? 1 : 0);
