// Lists the pictures in public/players and writes lib/football/playerPhotos.generated.ts.
// Run it again every time you add or remove pictures:  node scripts/photos.mjs
import { readdirSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";

const dir = "public/players";
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
// an empty file is only a name waiting for its picture: it is skipped until a real picture replaces it
const files = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f) && statSync(`${dir}/${f}`).size > 0).sort();
writeFileSync(
  "lib/football/playerPhotos.generated.ts",
  `// Made by scripts/photos.mjs. Do not edit by hand.\nexport const PHOTO_FILES: string[] = ${JSON.stringify(files, null, 1)};\n`
);
console.log(`${files.length} player pictures found in ${dir}`);

// real crests of the European clubs: public/club-logos/europe/<club-id>.png
const eu = "public/club-logos/europe";
if (!existsSync(eu)) mkdirSync(eu, { recursive: true });
const files2 = readdirSync(eu).filter((f) => /\.png$/i.test(f)).sort();
// accepted names: real-madrid.png or real-madrid-logo-footylogos.png (the id is the part before "-logo")
const logos = {};
for (const f of files2) logos[f.replace(/\.png$/i, "").replace(/-logo(-footylogos)?$/i, "").replace(/-footylogos$/i, "")] = f;
writeFileSync("lib/football/europeLogos.generated.ts", `// Made by scripts/photos.mjs. Do not edit by hand.\nexport const EUROPE_LOGOS: Record<string, string> = ${JSON.stringify(logos, null, 1)};\n`);
console.log(`${Object.keys(logos).length} European crests found in ${eu}`);
