#!/usr/bin/env node
/**
 * Verifica automatica di un rilascio.
 *
 *   npm run check:deploy -- https://atelier.vercel.app
 *   npm run check:deploy -- https://atelier.vercel.app --dominio https://atelier.it
 *   npm run check:deploy -- http://localhost:3000 --solo-istanza
 *
 * `--solo-istanza` serve all'integrazione continua: verifica tutto ciò che
 * riguarda l'istanza (pagine, guardie, cookie, sitemap) senza pretendere che
 * archivio cloud e accessi social siano configurati, perché lì non lo sono.
 *
 * Non guarda lo schermo: guarda i fatti. Ogni controllo è una richiesta vera e
 * un confronto su ciò che torna — se la pagina risponde, se la sessione è
 * protetta, se il cookie è firmato come si deve, se l'archivio accetta la firma
 * del server, se il dominio scritto nei dati strutturati è quello giusto.
 *
 * Il controllo che conta di più è `archivio-firma`: entra in una sessione,
 * chiama lo stato dell'archivio e verifica che il database accetti la firma
 * dell'istanza. È l'unico modo di sapere, con un comando, che il segreto
 * copiato nelle variabili d'ambiente è davvero quello giusto.
 *
 * Codice di uscita: 0 se tutti i controlli passano, 1 altrimenti.
 */

import { readEnvFile } from "./lib/atelier.mjs";

const argv = process.argv.slice(2);
const flag = (name) => {
  const index = argv.indexOf(name);
  return index === -1 ? null : (argv[index + 1] ?? null);
};

const target = (argv.find((value) => /^https?:\/\//.test(value)) ?? "http://localhost:3000").replace(/\/+$/, "");
const origin = new URL(target).origin;
const expectedDomain = flag("--dominio")?.replace(/\/+$/, "") ?? null;
const soloIstanza = argv.includes("--solo-istanza");
const isHttps = origin.startsWith("https://");
const timeoutMs = Number(flag("--timeout") ?? 15000);

/** In `--solo-istanza` una configurazione assente è una nota, non un errore. */
const mancante = (label, detail) => record("config", label, soloIstanza ? "warn" : "fail", detail);

const results = [];
const notes = [];

function record(id, label, state, detail) {
  results.push({ id, label, state, detail });
  const marker = state === "ok" ? "[ok]    " : state === "warn" ? "[!]     " : "[errore]";
  console.log(`${marker} ${label}`);
  if (detail) console.log(`        ${detail}`);
}

async function attempt(label, run) {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    record("rete", label, "fail", `richiesta non riuscita: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false };
  }
}

const get = (path, init = {}) =>
  fetch(`${target}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "*/*", ...(init.headers ?? {}) },
    ...init,
  });

console.log(`Verifica del rilascio: ${target}`);
console.log(isHttps ? "HTTPS: i cookie devono essere marcati Secure." : "HTTP: contesto locale, Secure non atteso.");
if (expectedDomain) console.log(`Dominio atteso nei dati strutturati: ${expectedDomain}`);
console.log("");

// 1. La pagina pubblica risponde e viene servita dal rilascio giusto.
let homeHtml = "";
const home = await attempt("la home risponde", async () => {
  const response = await get("/");
  homeHtml = await response.text();
  return {
    status: response.status,
    html: homeHtml.includes("<html") && homeHtml.length > 500,
  };
});
if (home.ok) {
  home.value.status === 200 && home.value.html
    ? record("home", "la home risponde con una pagina completa", "ok", `stato ${home.value.status}`)
    : record("home", "la home risponde con una pagina completa", "fail", `stato ${home.value.status}`);
}

// 2. Le pagine interne chiedono una sessione: la guardia sta in piedi.
const guardPage = await attempt("la pagina interna è protetta", async () => {
  const response = await get("/dashboard");
  return { status: response.status, location: response.headers.get("location") ?? "" };
});
if (guardPage.ok) {
  const { status, location } = guardPage.value;
  status >= 300 && status < 400 && location.includes("/login")
    ? record("guardia-pagina", "/dashboard senza sessione manda all'accesso", "ok", `${status} → ${location}`)
    : record("guardia-pagina", "/dashboard senza sessione manda all'accesso", "fail", `stato ${status}, location «${location}»`);
}

// 3. Le route dell'archivio non rispondono a chi non ha una sessione.
const guardApi = await attempt("l'API dell'archivio è protetta", async () => {
  const response = await get("/api/cloud/status");
  return response.status;
});
if (guardApi.ok) {
  guardApi.value === 401
    ? record("guardia-api", "/api/cloud/status senza sessione risponde 401", "ok")
    : record("guardia-api", "/api/cloud/status senza sessione risponde 401", "fail", `stato ${guardApi.value}`);
}

// 4. La diagnostica non viene mai messa in cache da un proxy.
const noStore = await attempt("la diagnostica non è memorizzabile", async () => {
  const response = await get("/api/providers/health");
  return { cache: response.headers.get("cache-control") ?? "", body: await response.json() };
});
if (noStore.ok) {
  noStore.value.cache.includes("no-store")
    ? record("cache-api", "le risposte /api sono no-store", "ok", noStore.value.cache)
    : record("cache-api", "le risposte /api sono no-store", "fail", `cache-control: «${noStore.value.cache}»`);
}

// 5. Configurazione dell'istanza, letta dal rilascio stesso.
if (noStore.ok) {
  const health = noStore.value.body;
  health.sessionSecretConfigured
    ? record("sessione", "ATELIER_SESSION_SECRET è impostata", "ok")
    : mancante(
        "ATELIER_SESSION_SECRET è impostata",
        "l'istanza firma le sessioni con la chiave locale di ripiego: aggiungi la variabile e riavvia il deploy",
      );

  if (health.cloud?.configured) {
    record("cloud-config", "l'archivio cloud è configurato", "ok");
  } else {
    mancante(
      "l'archivio cloud è configurato",
      `variabili mancanti: ${(health.cloud?.missing ?? ["stato assente"]).join(", ")} — l'app funziona, ma il pannello resta spento`,
    );
  }

  const authReady = (health.authProviders ?? []).filter((provider) => provider.configured);
  authReady.length === 2
    ? record("accesso-oauth", "GitHub e Google configurati", "ok")
    : record(
        "accesso-oauth",
        "GitHub e Google configurati",
        "warn",
        `${authReady.length}/2 attivi: senza app OAuth resta l'accesso locale`,
      );

  const providers = (health.providers ?? []).filter((provider) => provider.ready);
  notes.push(
    providers.length
      ? `Provider AI attivi sull'istanza: ${providers.map((provider) => provider.id).join(", ")}.`
      : "Nessun provider AI attivo sull'istanza: si genera in modalità offline (è una scelta valida).",
  );
}

// 6. La pagina di stato: è la lettura che serve a chi installa, e deve essere
// raggiungibile senza sessione ma tenuta fuori dagli indici.
const stato = await attempt("la pagina di stato risponde", async () => {
  const response = await get("/stato");
  const html = await response.text();
  return {
    status: response.status,
    card: /archivio cloud/i.test(html),
    noindex: /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html),
  };
});
if (stato.ok) {
  const { status, card, noindex } = stato.value;
  if (status === 200 && card && noindex) {
    record("pagina-stato", "/stato è raggiungibile e resta fuori dagli indici", "ok", "200 · noindex · pannelli presenti");
  } else {
    const manca = [];
    if (status !== 200) manca.push(`stato ${status}`);
    if (!card) manca.push("manca il pannello dell'archivio");
    if (!noindex) manca.push("manca noindex");
    record("pagina-stato", "/stato è raggiungibile e resta fuori dagli indici", "fail", manca.join(", "));
  }
}

// 7. L'accesso locale funziona e il cookie è protetto come si deve.
const session = await attempt("l'accesso locale risponde", async () => {
  const response = await fetch(`${target}/api/auth/local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Verifica rilascio ${new Date().toISOString().slice(0, 16)}` }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const cookies = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const raw = cookies.find((value) => value.startsWith("atelier_session=")) ?? "";
  return { status: response.status, raw, cookie: raw.split(";")[0] };
});

if (session.ok) {
  const { status, raw, cookie } = session.value;
  const flags = {
    httpOnly: /httponly/i.test(raw),
    sameSite: /samesite=lax/i.test(raw),
    secure: /;\s*secure/i.test(raw),
  };
  const problems = [];
  if (status !== 200) problems.push(`stato ${status}`);
  if (!cookie) problems.push("nessun cookie di sessione");
  if (!flags.httpOnly) problems.push("manca HttpOnly");
  if (!flags.sameSite) problems.push("manca SameSite=Lax");
  if (isHttps && !flags.secure) problems.push("manca Secure su HTTPS");

  problems.length === 0
    ? record("cookie", "la sessione locale emette un cookie protetto", "ok", `${origin} · HttpOnly, SameSite=Lax${flags.secure ? ", Secure" : ""}`)
    : record("cookie", "la sessione locale emette un cookie protetto", "fail", problems.join(", "));

  // 8. Il controllo decisivo: il server riesce a parlare con l'archivio.
  if (cookie) {
    const archive = await attempt("l'archivio risponde al server", async () => {
      const response = await fetch(`${target}/api/cloud/status`, {
        headers: { cookie, accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    });

    if (archive.ok) {
      const { status, body } = archive.value;
      if (status === 200 && body?.configured && body?.reachable) {
        record(
          "archivio-firma",
          "l'archivio cloud accetta la firma del server",
          "ok",
          `bucket ${body.ownerKind === "account" ? "dell'account" : "del dispositivo"} · ${body.remoteProjects ?? 0} progetti in archivio`,
        );
      } else if (status === 200 && body?.configured === false) {
        mancante(
          "l'archivio cloud accetta la firma del server",
          `non configurato: mancano ${(body.missing ?? []).join(", ")}`,
        );
      } else if (status === 200) {
        record(
          "archivio-firma",
          "l'archivio cloud accetta la firma del server",
          soloIstanza ? "warn" : "fail",
          `il database non ha accettato la richiesta: ${body?.message ?? "nessun messaggio"} — il valore di ATELIER_CLOUD_SECRET non coincide con atelier.secrets`,
        );
      } else if (status === 401) {
        record("archivio-firma", "l'archivio cloud accetta la firma del server", "fail", "la sessione appena creata non è stata accettata");
      } else {
        record("archivio-firma", "l'archivio cloud accetta la firma del server", "fail", `stato ${status}: ${body?.message ?? body?.error ?? "nessun dettaglio"}`);
      }
    }
  }
}

// 9. Sitemap, robots e immagine social: quello che vedono i motori di ricerca.
const sitemap = await attempt("la sitemap risponde", async () => {
  const response = await get("/sitemap.xml");
  const xml = await response.text();
  return { status: response.status, xml, locs: [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]) };
});

if (sitemap.ok) {
  const { status, locs } = sitemap.value;
  const wanted = expectedDomain ?? origin;
  const wrong = locs.filter((loc) => !loc.startsWith(`https://`) && !loc.startsWith(`http://`));
  const offDomain = locs.filter((loc) => !loc.startsWith(wanted));

  if (status !== 200 || locs.length === 0) {
    record("sitemap", "la sitemap elenca il dominio giusto", "fail", `stato ${status}, ${locs.length} indirizzi`);
  } else if (offDomain.length === 0 && wrong.length === 0) {
    record("sitemap", "la sitemap elenca il dominio giusto", "ok", `${locs.length} pagine su ${wanted}`);
  } else if (expectedDomain) {
    record("sitemap", "la sitemap elenca il dominio giusto", "fail", `indirizzi fuori da ${wanted}: ${offDomain.slice(0, 3).join(", ")}`);
  } else {
    record(
      "sitemap",
      "la sitemap elenca il dominio giusto",
      "warn",
      `gli indirizzi usano ${locs[0]} invece di ${wanted}: su Vercel il dominio canonico è quello di produzione. Se è un deploy di anteprima è normale; sul dominio finale no.`,
    );
  }
}

const robots = await attempt("robots.txt risponde", async () => {
  const response = await get("/robots.txt");
  const text = await response.text();
  return { status: response.status, text, sitemapLine: text.split(/\r?\n/).find((line) => /^sitemap:/i.test(line.trim())) ?? "" };
});
if (robots.ok) {
  const { status, sitemapLine } = robots.value;
  const wanted = expectedDomain ?? origin;
  if (status === 200 && sitemapLine.includes(wanted)) {
    record("robots", "robots.txt rimanda alla sitemap giusta", "ok", sitemapLine);
  } else if (status === 200 && expectedDomain) {
    record("robots", "robots.txt rimanda alla sitemap giusta", "fail", `atteso ${wanted}, trovato «${sitemapLine || "nessuna riga Sitemap"}»`);
  } else {
    record(
      "robots",
      "robots.txt rimanda alla sitemap giusta",
      "warn",
      `la riga Sitemap punta altrove: «${sitemapLine || "assente"}». Su un deploy di anteprima è normale.`,
    );
  }
}

const social = await attempt("l'immagine social è raggiungibile", async () => {
  const response = await get("/opengraph-image");
  return { status: response.status, type: response.headers.get("content-type") ?? "" };
});
if (social.ok) {
  social.value.status === 200 && social.value.type.includes("image")
    ? record("social", "l'immagine social è raggiungibile", "ok", social.value.type)
    : record("social", "l'immagine social è raggiungibile", "fail", `stato ${social.value.status}, tipo «${social.value.type}»`);
}

// 10. Il canone dichiarato nella home: la prima cosa che legge un motore.
if (homeHtml) {
  const canonical = homeHtml.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1] ?? "";
  const wanted = expectedDomain ?? origin;
  if (canonical.startsWith(wanted)) {
    record("canonical", "l'indirizzo canonico della home è quello giusto", "ok", canonical);
  } else if (expectedDomain) {
    record("canonical", "l'indirizzo canonico della home è quello giusto", "fail", `atteso ${wanted}, trovato «${canonical || "assente"}»`);
  } else {
    record("canonical", "l'indirizzo canonico della home è quello giusto", "warn", `canonico «${canonical || "assente"}», richiesto da ${wanted}`);
  }
}

// 11. L'archivio non è aperto: lo schema non è raggiungibile via REST.
const env = readEnvFile(".env.local");
const supabaseUrl = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (supabaseUrl && supabaseKey) {
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

  const table = await attempt("l'archivio non è raggiungibile via REST", async () => {
    const response = await fetch(`${supabaseUrl}/rest/v1/atelier.projects?select=owner&limit=1`, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: response.status, body: await response.text() };
  });
  if (table.ok) {
    if (table.value.status === 200) {
      record("rest-tabelle", "le tabelle dell'archivio non sono raggiungibili via REST", "fail", "una richiesta anonima ha letto atelier.projects");
    } else {
      record("rest-tabelle", "le tabelle dell'archivio non sono raggiungibili via REST", "ok", `stato ${table.value.status} (atteso 404/401)`);
    }
  }

  const internal = await attempt("le RPC interne non sono chiamabili", async () => {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/atelier_cloud_list`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ p_owner: "verifica", p_ts_head: null }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.status;
  });
  if (internal.ok) {
    internal.value === 200
      ? record("rest-rpc", "le funzioni interne non sono chiamabili dall'esterno", "fail", "atelier_cloud_list ha risposto a una richiesta anonima")
      : record("rest-rpc", "le funzioni interne non sono chiamabili dall'esterno", "ok", `stato ${internal.value} (atteso 401)`);
  }
} else {
  notes.push("controlli sull'archivio Supabase saltati: .env.local non contiene URL e chiave publishable.");
}

// Esito.
const failures = results.filter((result) => result.state === "fail");
const warnings = results.filter((result) => result.state === "warn");
console.log("");
for (const note of notes) console.log(`[!]  ${note}`);
console.log("");
console.log(`Controlli: ${results.length - failures.length - warnings.length} ok, ${warnings.length} avvisi, ${failures.length} errori.`);

if (failures.length) {
  console.log("\nDa sistemare:");
  for (const failure of failures) console.log(`  · ${failure.label}: ${failure.detail ?? ""}`);
  console.log("\nIl resto della guida: docs/DEPLOY.md");
  process.exit(1);
}

const archivioVerificato = results.some((result) => result.id === "archivio-firma" && result.state === "ok");
console.log(
  archivioVerificato
    ? "Rilascio verificato: l'istanza risponde, protegge le sessioni e parla con l'archivio."
    : "Rilascio verificato: l'istanza risponde e protegge le sessioni (archivio cloud non compreso in questa verifica).",
);
