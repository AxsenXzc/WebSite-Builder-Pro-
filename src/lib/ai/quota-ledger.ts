import { PROVIDERS, providerSpec, type ProviderId } from "./providers";

/**
 * Registro delle quote.
 *
 * Tiene traccia di quante richieste e quanti token abbiamo consumato per
 * provider nelle finestre al minuto e giornaliere, e mette in pausa un provider
 * quando risponde 429 o va in errore. Serve a due cose concrete: scegliere la
 * catena giusta e mostrare all'utente quanta quota gli resta.
 */

export type ProviderUsage = {
  requestsMinute: number[];
  requestsDay: number[];
  tokensDay: number;
  cooldownUntil: number;
  consecutiveErrors: number;
  lastError?: string;
};

export type LedgerSnapshot = {
  provider: ProviderId;
  label: string;
  used: { rpm: number; rpd: number; tpd: number };
  limits: { rpm: number; rpd: number; tpd: number };
  remaining: { rpm: number; rpd: number; tpd: number };
  cooldownSeconds: number;
  available: boolean;
  ready: boolean;
  lastError?: string;
};

export type LedgerState = Partial<Record<ProviderId, ProviderUsage>>;

const EMPTY: ProviderUsage = {
  requestsMinute: [],
  requestsDay: [],
  tokensDay: 0,
  cooldownUntil: 0,
  consecutiveErrors: 0,
};

export class QuotaLedger {
  private state: LedgerState;
  private readonly now: () => number;
  private readonly persist?: (state: LedgerState) => void;

  constructor(options: { state?: LedgerState; now?: () => number; persist?: (state: LedgerState) => void } = {}) {
    this.state = options.state ?? {};
    this.now = options.now ?? (() => Date.now());
    this.persist = options.persist;
  }

  private usage(provider: ProviderId): ProviderUsage {
    const current = this.state[provider] ?? { ...EMPTY, requestsMinute: [], requestsDay: [] };
    const now = this.now();
    current.requestsMinute = current.requestsMinute.filter((time) => now - time < 60_000);
    current.requestsDay = current.requestsDay.filter((time) => now - time < 86_400_000);
    this.state[provider] = current;
    return current;
  }

  record(provider: ProviderId, tokens: number): void {
    const usage = this.usage(provider);
    const now = this.now();
    usage.requestsMinute.push(now);
    usage.requestsDay.push(now);
    usage.tokensDay += Math.max(0, tokens);
    usage.consecutiveErrors = 0;
    this.persist?.(this.state);
  }

  /** Mette in pausa un provider: 429 o errore serio. */
  coolDown(provider: ProviderId, seconds: number, reason?: string): void {
    const usage = this.usage(provider);
    usage.cooldownUntil = this.now() + seconds * 1000;
    usage.consecutiveErrors += 1;
    if (reason) usage.lastError = reason;
    this.persist?.(this.state);
  }

  available(provider: ProviderId): boolean {
    const spec = providerSpec(provider);
    const usage = this.usage(provider);
    if (usage.cooldownUntil > this.now()) return false;
    if (usage.requestsMinute.length >= spec.limits.rpm) return false;
    if (usage.requestsDay.length >= spec.limits.rpd) return false;
    if (usage.tokensDay >= spec.limits.tpd) return false;
    return true;
  }

  /** Secondi di attesa stimati prima che il provider torni utilizzabile. */
  waitSeconds(provider: ProviderId): number {
    const usage = this.usage(provider);
    const cooldown = Math.max(0, Math.ceil((usage.cooldownUntil - this.now()) / 1000));
    const spec = providerSpec(provider);
    if (usage.requestsMinute.length >= spec.limits.rpm) {
      const oldest = usage.requestsMinute[0] ?? this.now();
      return Math.max(cooldown, Math.ceil((60_000 - (this.now() - oldest)) / 1000));
    }
    return cooldown;
  }

  snapshot(ready: ProviderId[]): LedgerSnapshot[] {
    return PROVIDERS.map((spec) => {
      const usage = this.usage(spec.id);
      const used = { rpm: usage.requestsMinute.length, rpd: usage.requestsDay.length, tpd: usage.tokensDay };
      return {
        provider: spec.id,
        label: spec.label,
        used,
        limits: { rpm: spec.limits.rpm, rpd: spec.limits.rpd, tpd: spec.limits.tpd },
        remaining: {
          rpm: Math.max(0, spec.limits.rpm - used.rpm),
          rpd: Math.max(0, spec.limits.rpd - used.rpd),
          tpd: Math.max(0, spec.limits.tpd - used.tpd),
        },
        cooldownSeconds: this.waitSeconds(spec.id),
        available: this.available(spec.id),
        ready: ready.includes(spec.id),
        lastError: usage.lastError,
      };
    });
  }

  toJSON(): LedgerState {
    return this.state;
  }
}

/** Riconosce gli errori che significano "quota esaurita" e non "richiesta sbagliata". */
export function classifyProviderError(error: unknown): { kind: "rate" | "auth" | "context" | "other"; message: string; retryAfter?: number } {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { statusCode?: number; status?: number })?.statusCode ?? (error as { status?: number })?.status;

  if (status === 429 || /rate limit|quota|too many requests|resource_exhausted/i.test(message)) {
    const retryAfter = Number((error as { retryAfter?: number })?.retryAfter) || undefined;
    return { kind: "rate", message, retryAfter };
  }
  if (status === 401 || status === 403 || /api key|unauthor|invalid key|permission/i.test(message)) {
    return { kind: "auth", message };
  }
  if (/context length|too long|maximum context|token limit/i.test(message)) {
    return { kind: "context", message };
  }
  return { kind: "other", message };
}

/** Quanti token ha consumato una richiesta, con stima prudente se manca il dato. */
export function estimateTokens(usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined, fallbackText: string): number {
  if (usage?.totalTokens) return usage.totalTokens;
  if (usage?.promptTokens !== undefined || usage?.completionTokens !== undefined) {
    return (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0);
  }
  return Math.ceil(fallbackText.length / 4);
}
