export const BMW_M5_DEFAULT_PHOTOS = [
  "/bmwm5_1.png",
  "/bmwm5_2.png",
  "/bmwm5_3.png",
  "/bmwm5_4.png",
  "/bmwm5_5.png",
  "/bmwm5_6.png",
] as const;

export const TOYOTA_CAMRY_DEFAULT_PHOTOS = [
  "/toyota-camry-1.png",
  "/toyota-camry-2.png",
  "/toyota-camry-3.png",
  "/toyota-camry-4.png",
  "/toyota-camry-5.png",
  "/toyota-camry-6.png",
] as const;

export function normalizeCarModelKey(value: string): string {
  const base = value.split(/\s{2,}/)[0] ?? value;
  return base.trim().toLowerCase().replace(/\s+/g, " ").trim();
}

const DEFAULT_PHOTOS_BY_MODEL: Record<string, readonly string[]> = {
  "bmw m5": BMW_M5_DEFAULT_PHOTOS,
  "toyota camry": TOYOTA_CAMRY_DEFAULT_PHOTOS,
};

export function defaultPhotosForCarModel(model: string): string[] | null {
  const key = normalizeCarModelKey(model);
  const photos = DEFAULT_PHOTOS_BY_MODEL[key];
  return photos ? [...photos] : null;
}

export function parseCarPhotosByModel(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!Array.isArray(val)) continue;
    const urls = val.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
    if (urls.length > 0) out[key] = urls;
  }
  return out;
}

export function resolveCarPhotosForModel(model: string, overrides: Record<string, string[]>): string[] {
  const key = normalizeCarModelKey(model);
  if (!key) return [];

  const direct = overrides[key];
  if (direct?.length) return direct;

  const matchedEntry = Object.entries(overrides).find(([k]) => normalizeCarModelKey(k) === key);
  if (matchedEntry?.[1]?.length) return matchedEntry[1];

  return defaultPhotosForCarModel(model) ?? [];
}
