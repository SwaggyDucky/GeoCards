// Usage: node generate-data.mjs
import { promises as fs } from "fs";
import path from "path";
import url from "url";

const __dirname   = path.dirname(url.fileURLToPath(import.meta.url));
const PUBLIC_DIR  = path.resolve(__dirname, "public");
const IMAGES_ROOT = path.join(PUBLIC_DIR, "images");      // /public/images/<country>/*.ext
const OUT_DIR     = path.join(PUBLIC_DIR, "data");
const OUT_FILE    = path.join(OUT_DIR, "data.json");

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);

// Optional: normalize country folder name -> display name.
// Example below title-cases "france" -> "France". Adjust to your taste.
const NORMALIZE_COUNTRY = (name) =>
  name.replace(/(^|[\s_-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

function isImage(p) {
  return IMAGE_EXTS.has(path.extname(p).toLowerCase());
}
function toWebPath(absPath) {
  const rel = path.relative(PUBLIC_DIR, absPath).split(path.sep).join("/");
  return "/" + rel;
}
function sortLocale(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

// Derive type from filename (without extension). Keeps the base name and
// strips only trailing counters like " (12)", "_12", "-12", or " 12".
function deriveType(filenameWithoutExt) {
  let base = filenameWithoutExt.trim();
  base = base.replace(/\s*\(\d+\)\s*$/i, "");   // remove " (12)"
  base = base.replace(/[\s_-]*\d+\s*$/i, "");   // remove "_12", "-12", " 12"
  return base.trim();
}

async function safeReaddir(dir) {
  try { return await fs.readdir(dir, { withFileTypes: true }); }
  catch { return []; }
}

async function main() {
  const countryDirs = (await safeReaddir(IMAGES_ROOT)).filter(d => d.isDirectory());
  const dataset = [];

  for (const c of countryDirs) {
    const folderName  = c.name;                     // e.g., "france"
    const countryName = NORMALIZE_COUNTRY(folderName); // -> "France"
    const countryPath = path.join(IMAGES_ROOT, folderName);

    const entries = (await safeReaddir(countryPath)).filter(e => e.isFile());
    const byType = new Map();

    for (const f of entries) {
      const abs = path.join(countryPath, f.name);
      if (!isImage(abs)) continue;

      const nameNoExt = f.name.replace(/\.[^.]+$/, "");    // drop extension
      const type = deriveType(nameNoExt);                  // e.g., "bollard", "pole", "YellowSign", "hwy"
      if (!type) continue;

      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(toWebPath(abs));
    }

    const items = [...byType.entries()]
      .map(([type, images]) => ({ type, images: images.sort(sortLocale) }))
      .sort((a, b) => sortLocale(a.type, b.type));

    // Pre-fill region with an empty string so it can be filled manually later.
    if (items.length) dataset.push({ country: countryName, region: "", items });
  }

  dataset.sort((a, b) => sortLocale(a.country, b.country));

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(dataset, null, 2) + "\n", "utf8");

  const itemCount  = dataset.reduce((n, c) => n + c.items.length, 0);
  const imageCount = dataset.reduce((n, c) => n + c.items.reduce((m, it) => m + it.images.length, 0), 0);

  console.log(`✔ Wrote ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`  Countries: ${dataset.length} | Item types: ${itemCount} | Images: ${imageCount}`);
}

main().catch(err => { console.error("✖ Failed:", err); process.exit(1); });
