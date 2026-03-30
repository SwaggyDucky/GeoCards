export const BASE = process.env.PUBLIC_URL || "";

export function assetUrl(p) {
  return `${BASE}${p.startsWith("/") ? p : `/${p}`}`;
}

export function deriveImageName(url = "") {
  const filename = url.split("/").pop() || "";
  if (!filename) return "";
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  const withoutCounter = withoutExt.replace(/\s*\(\d+\)$/, "");
  const spaced = withoutCounter
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return "";
  return spaced
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
