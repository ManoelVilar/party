#!/usr/bin/env node
/* Extrai o <script> embutido do index.html e roda o ESLint (procura variáveis não declaradas, código morto etc.). */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const js = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
mkdirSync(join(root, ".cache"), { recursive: true });
writeFileSync(join(root, ".cache/app.js"), js);
const r = spawnSync("npx", ["--no-install", "eslint", "--no-warn-ignored", ".cache/app.js"], { cwd: root, stdio: "inherit" });
if (r.status === 0) console.log("ESLint: sem problemas.");
process.exit(r.status ?? 1);
