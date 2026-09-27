/** Destinazione di ritorno sicura: solo percorsi interni, mai URL assoluti o `//`. */
export function safeNext(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\") || trimmed.includes("\n")) return fallback;
  return trimmed;
}
