/**
 * Contratto d'errore delle route API.
 *
 * Ogni risposta di errore ha la stessa forma: un messaggio leggibile per la
 * persona, un codice stabile per il codice (`VALIDATION`, `RATE_LIMITED`, …) e
 * uno stato HTTP coerente. Gli errori non previsti non escono mai in chiaro:
 * vengono registrati come riga JSON strutturata e restituiti come 500 generico.
 */

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "VALIDATION"
  | "QUOTA_EXCEEDED"
  | "NOT_CONFIGURED"
  | "UPSTREAM_ERROR"
  | "INTERNAL";

export const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION",
  429: "RATE_LIMITED",
  500: "INTERNAL",
  502: "UPSTREAM_ERROR",
  503: "NOT_CONFIGURED",
};

/** Errore atteso: interrompe l'handler con stato, codice e messaggio decisi. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly hint?: string;

  constructor(message: string, status = 400, code: ErrorCode = "BAD_REQUEST", hint?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

/** Riga di log strutturata: si aggrega senza parsing, anche anni dopo. */
export function logError(error: unknown, context: Record<string, unknown> = {}): void {
  const payload = {
    level: "error",
    type: "unhandled_api_error",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
    ts: new Date().toISOString(),
  };
  console.error(JSON.stringify(payload));
}

/** Qualsiasi cosa sia stata lanciata diventa una Response JSON con stato coerente. */
export function errorResponse(error: unknown, context: Record<string, unknown> = {}): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.message, code: error.code, ...(error.hint ? { hint: error.hint } : {}) },
      { status: error.status },
    );
  }

  logError(error, context);
  return Response.json({ error: "Errore interno del server", code: "INTERNAL" }, { status: 500 });
}

export function badRequest(message: string, hint?: string): never {
  throw new ApiError(message, 400, "BAD_REQUEST", hint);
}

export function validationFailed(message: string, hint?: string): never {
  throw new ApiError(message, 422, "VALIDATION", hint);
}

export function unauthorized(message = "Sessione assente o scaduta", hint?: string): never {
  throw new ApiError(message, 401, "UNAUTHORIZED", hint);
}

export function forbidden(message = "Non autorizzato"): never {
  throw new ApiError(message, 403, "FORBIDDEN");
}

export function notFound(message = "Risorsa non trovata"): never {
  throw new ApiError(message, 404, "NOT_FOUND");
}

export function conflict(message = "Conflitto"): never {
  throw new ApiError(message, 409, "CONFLICT");
}

export function rateLimited(message = "Troppe richieste", hint?: string): never {
  throw new ApiError(message, 429, "RATE_LIMITED", hint);
}

export function quotaExceeded(message = "Quota esaurita per questo provider", hint?: string): never {
  throw new ApiError(message, 429, "QUOTA_EXCEEDED", hint);
}

export function notConfigured(message: string, hint?: string): never {
  throw new ApiError(message, 503, "NOT_CONFIGURED", hint);
}

export function upstreamError(message = "Il servizio a monte ha risposto male", hint?: string): never {
  throw new ApiError(message, 502, "UPSTREAM_ERROR", hint);
}

/** Tutti i codici stabili: serve a riconoscere una risposta che parla la nostra lingua. */
export const ERROR_CODES: readonly ErrorCode[] = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "VALIDATION",
  "QUOTA_EXCEEDED",
  "NOT_CONFIGURED",
  "UPSTREAM_ERROR",
  "INTERNAL",
];

/** Legge il codice d'errore da un corpo JSON sconosciuto, se è uno dei nostri. */
export function readErrorCode(body: unknown): ErrorCode | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as { code?: unknown }).code;
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value) ? (value as ErrorCode) : null;
}
