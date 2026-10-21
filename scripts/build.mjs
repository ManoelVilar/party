#!/usr/bin/env node
/* Junta src/head.html + src/js/*.js (em ordem numérica) + src/tail.html em um único index.html.
   Uso:  node scripts/build.mjs            -> gera index.html
         node scripts/build.mjs --check    -> gera em memória e confere se o index.html do repositório está atualizado
   Sem dependências. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = p => readFileSync(join(root, p), "utf8");
const jsParts = readdirSync(join(root, "src/js")).filter(f => f.endsWith(".js")).sort();
// a fonte Pixelify Sans (latin, variável, OFL) vai embutida em base64 no lugar do marcador FONT:arquivo (nenhum pedido ao Google Fonts)
const withFonts = t => t.replace(/\/\*FONT:([\w.-]+)\*\//g, (_, f) => "data:font/woff2;base64," + readFileSync(join(root, "src/fonts/" + f)).toString("base64"));
// o layout compartilhado (escritórios e mesas) é a única fonte para o mapa E para as regras do Firebase (scripts/gera-regras.mjs)
const layoutJson = JSON.stringify(JSON.parse(read("src/layout.json")));
const withLayout = t => t.replace("/*LAYOUT*/null", () => layoutJson);
const html = withLayout(withFonts(read("src/head.html")) + jsParts.map(f => withLayout(read("src/js/" + f))).join("") + read("src/tail.html"));

/* confere a sintaxe do script embutido antes de gravar */
const m = html.lastIndexOf("<script>"), n = html.lastIndexOf("</script>");
const tmp = join(tmpdir(), "party-inline-check.js");
writeFileSync(tmp, html.slice(m + 8, n));
try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); }
catch (e) { console.error("Erro de sintaxe no JavaScript:\n" + String(e.stderr || e)); process.exit(1); }

if (process.argv.includes("--check")) {
  let cur = ""; try { cur = read("index.html"); } catch (e) { /* ainda não existe */ }
  if (cur !== html) { console.error("index.html está desatualizado. Rode: npm run build"); process.exit(1); }
  console.log("index.html está em dia (" + html.length + " bytes, " + jsParts.length + " módulos).");
} else {
  writeFileSync(join(root, "index.html"), html);
  console.log("index.html gerado (" + html.length + " bytes, " + jsParts.length + " módulos).");
}
