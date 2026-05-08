export type DataProviderKind = "supabase" | "api";

export function getDataProviderKind(): DataProviderKind {
  const raw = ((import.meta.env.VITE_DATA_PROVIDER as string | undefined) ?? "supabase").trim().toLowerCase();
  if (raw === "api") return "api";
  return "supabase";
}

export function getApiBaseUrl(): string {
  const raw = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8787").trim();
  return raw.replace(/\/+$/, "");
}

