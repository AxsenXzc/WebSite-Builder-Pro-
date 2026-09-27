/**
 * Cookie a mano: leggere e scrivere `Set-Cookie` senza dipendenze, così le
 * stesse funzioni valgono nei route handler e nei test.
 */

export type CookieOptions = {
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
};

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? "/"}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.httpOnly ?? true) parts.push("HttpOnly");
  if (options.secure ?? process.env.NODE_ENV === "production") parts.push("Secure");
  const sameSite = options.sameSite ?? "lax";
  parts.push(`SameSite=${sameSite === "strict" ? "Strict" : sameSite === "none" ? "None" : "Lax"}`);
  return parts.join("; ");
}

export function clearCookie(name: string, options: CookieOptions = {}): string {
  return serializeCookie(name, "", { ...options, maxAge: 0 });
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const chunk of header.split(";")) {
    const index = chunk.indexOf("=");
    if (index === -1) continue;
    const key = chunk.slice(0, index).trim();
    const raw = chunk.slice(index + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(raw);
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

/** Reindirizzamento con cookie allegati: `Response.redirect` non li accetterebbe. */
export function redirectWithCookies(location: string, cookies: string[]): Response {
  const headers = new Headers({ location });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}
