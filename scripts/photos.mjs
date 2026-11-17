// Lists the pictures in public/players and writes lib/football/playerPhotos.generated.ts.
// Run it again every time you add or remove pictures:  node scripts/photos.mjs
import { readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const dir = "public/players";
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const files = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f)).sort();
writeFileSync(
  "lib/football/playerPhotos.generated.ts",
  `// Made by scripts/photos.mjs. Do not edit by hand.\nexport const PHOTO_FILES: string[] = ${JSON.stringify(files, null, 1)};\n`
);
console.log(`${files.length} player pictures found in ${dir}`);
