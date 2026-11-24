// Copies the game code the server needs (match engine, squads, strength) next to the Edge Function,
// with the "@/" imports turned into plain relative ones, so the match is played by the SAME code as in the browser.
// Run it before every deploy:  node scripts/build-edge.mjs
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "supabase/functions/_shared/src");
const entries = ["lib/football/matchday.ts", "lib/football/strength.ts", "lib/football/cup.ts", "lib/football/europe.ts", "lib/football/continental.ts", "lib/football/halftime.ts", "lib/football/friendlies.ts", "lib/football/development.ts", "lib/football/leagueClubs.ts", "lib/football/squads.ts", "lib/football/availability.ts", "lib/football/transfers.ts"];
const seen = new Set();
const missing = new Set();

const find = (spec) => {
  const base = path.join(root, spec.slice(2));
  for (const e of [".ts", ".tsx", "/index.ts"]) if (fs.existsSync(base + e)) return base + e;
  return null;
};

function walk(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = fs.readFileSync(file, "utf8");
  const re = /(?:from\s+|import\(\s*)["'](@\/[^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1] === "@/lib/supabase") continue;
    const f = find(m[1]);
    if (f) walk(f); else missing.add(m[1]);
  }
}
for (const e of entries) walk(path.join(root, e));
if (missing.size) { console.error("Missing files:", [...missing].join(", ")); process.exit(1); }

fs.rmSync(out, { recursive: true, force: true });
const write = (rel, text) => { const to = path.join(out, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, text); };

for (const file of seen) {
  const rel = path.relative(root, file);
  let src = fs.readFileSync(file, "utf8");
  src = src.replace(/(from\s+|import\(\s*)(["'])(@\/[^"']+)\2/g, (all, pre, q, spec) => {
    const target = spec === "@/lib/supabase" ? path.join(root, "lib/supabase.ts") : find(spec);
    let r = path.relative(path.dirname(file), target).replace(/\\/g, "/");
    if (!r.startsWith(".")) r = "./" + r;
    return `${pre}${q}${r.replace(/\.tsx?$/, ".ts")}${q}`;
  });
  write(rel, "// @ts-nocheck\n" + src);
}
write("lib/supabase.ts", "// the server has no browser client\nexport const supabase = null as never;\n");
console.log(`${seen.size} files copied to supabase/functions/_shared/src`);
