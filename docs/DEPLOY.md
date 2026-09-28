# Deploy e accessi

Tutto quello che serve per mettere Atelier online e per accendere i pulsanti GitHub/Google.
Nessun passaggio richiede di modificare il codice: sono credenziali e collegamenti.

---

## 1. Repository GitHub privato

Il repository esiste già: **`https://github.com/AxsenXzc/WebSite-Builder-Pro-.git`** (privato), con `origin` collegato e `main` allineato.

```bash
git remote -v          # deve mostrare origin → AxsenXzc/WebSite-Builder-Pro-.git
git push origin main   # Git Credential Manager autorizza al primo push
```

Da qui in poi ogni `git push` su `main` fa ripartire il deploy su Vercel. Le pipeline in `.github/workflows/` (`ci.yml`, `security.yml`) girano a ogni push: typecheck, test, build e audit settimanale delle dipendenze.

---

## 2. Progetto Vercel

Il modo più diretto è la CLI (una volta sola):

```bash
npx vercel login          # apre il browser, autorizzi il tuo account
npx vercel link           # crea/collega il progetto "atelier"
npx vercel env add ATELIER_SESSION_SECRET production
npx vercel --prod         # deploy
```

In alternativa, dal pannello Vercel: *Add New… → Project → Import Git Repository* → scegli `atelier` → framework **Next.js** rilevato da solo, build `npm run build`, nessuna configurazione aggiuntiva.

### Variabili d'ambiente (Vercel → Project → Settings → Environment Variables)

| Variabile | Obbligatoria | Perché |
|---|---|---|
| `ATELIER_SESSION_SECRET` | **sì** | Firma le sessioni. Senza, Vercel usa la chiave locale di ripiego: le sessioni funzionano ma non sopravvivono a un cambio di macchina e il cookie non viene marcato `Secure`. Almeno 16 caratteri casuali. |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | per l'accesso GitHub | Vedi §3 |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | per l'accesso Google | Vedi §3 |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`, `CLOUDFLARE_*` | no | Se presenti, l'AI riscrive i contenuti lato server. Senza, si compila offline: il sito esce completo comunque. |
| `SUPABASE_URL` | per l'archivio cloud | Indirizzo del progetto Supabase, per esempio `https://xxxxxxxx.supabase.co`. |
| `SUPABASE_PUBLISHABLE_KEY` | per l'archivio cloud | Chiave `sb_publishable_…`: è pubblica per costruzione, serve solo a indirizzare le RPC. |
| `ATELIER_CLOUD_SECRET` | per l'archivio cloud | Segreto di firma della busta HMAC. **Deve coincidere** con il valore in `atelier.secrets` (vedi §5). |

Senza tutte e tre le variabili cloud il pannello «Archivio cloud» della dashboard resta spento, con l'elenco delle variabili mancanti: i progetti continuano a vivere nel browser, senza errori.

### Controllo dopo il deploy

`https://<tuo-dominio>/api/providers/health` deve rispondere con:

```json
{
  "sessionSecretConfigured": true,
  "authProviders": [{ "id": "github", "configured": true }, { "id": "google", "configured": true }],
  "cloud": { "configured": true, "missing": [] }
}
```

La stessa lettura è mostrata in forma leggibile su `https://<tuo-dominio>/stato`, insieme ai provider AI e alle quote residue.

---

## 3. App OAuth GitHub e Google

### GitHub

1. github.com → *Settings* → *Developer settings* → **OAuth Apps** → *New OAuth App*.
2. **Homepage URL**: `https://<tuo-dominio>`.
3. **Authorization callback URL**: `https://<tuo-dominio>/api/auth/github/callback`.
   Per lo sviluppo locale serve una seconda app (o la stessa con callback `http://localhost:3000/api/auth/github/callback`).
4. *Generate a new client secret* → copia **Client ID** e **Client secret** in `AUTH_GITHUB_ID` e `AUTH_GITHUB_SECRET`.

### Google

1. console.cloud.google.com → *API e servizi* → *Credenziali* → **Crea credenziali** → *ID client OAuth* → tipo **Applicazione web**.
2. **URI di reindirizzamento autorizzati**: `https://<tuo-dominio>/api/auth/google/callback` (più `http://localhost:3000/api/auth/google/callback` per lo sviluppo).
3. Scopes: basta `email`, `profile` (sono già richiesti dal codice).
4. Copia **ID client** e **Client secret** in `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET`.

### Verifica

Apri `/login`: i due pulsanti non mostrano più l'avviso "non configurato". Dopo l'accesso, `/impostazioni` mostra il workspace `github:<id>` (o `google:<id>`) e i progetti restano separati per utente in quel browser.

---

## 4. Archivio cloud (Supabase, schema `atelier`)

L'archivio è opzionale: senza di esso tutto continua a funzionare in locale. Per attivarlo servono due cose — il database e le variabili.

### 4.1 Lo schema sul database

Sul progetto Supabase:

1. **SQL Editor** → incolla ed esegui `docs/migrations/002-cloud-entry.sql`.
2. Genera il segreto di firma e mettilo **due volte**: in `ATELIER_CLOUD_SECRET` (variabile d'ambiente) e nella tabella `atelier.secrets`.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

```sql
insert into atelier.secrets (name, value)
values ('atelier_cloud_secret', '<il-tuo-segreto>')
on conflict (name) do update set value = excluded.value;
```

Lo script della migrazione fa già questo inserimento con un segnaposto: eseguilo e poi aggiorna il valore vero, oppure salta quella riga e usa l'`insert` qui sopra.

### 4.2 Il contratto, in breve

- Le tabelle vivono nello schema `atelier`, che **non è esposto via REST** e non ha privilegi per i ruoli Web: non esiste un endpoint con cui leggerle direttamente.
- L'unica porta è la RPC `public.atelier_cloud_entry(payload text, ts bigint, sig text)`, con il corpo `{ "payload": "<JSON>", "ts": 1774…, "sig": "<hmac>" }`.
- `sig` è l'HMAC-SHA256 (base64url) di `payload + "." + ts` calcolato con `ATELIER_CLOUD_SECRET`. Finestra di validità: 5 minuti.
- Senza segreto corretto il database risponde «firma non valida» (o «firma fuori finestra» con un orologio spostato) e non esegue nulla. La sola chiave publishable non basta a leggere o scrivere.
- L'owner dell'archivio è sempre derivato dalla sessione firmata: un account GitHub/Google usa `github:<id>` / `google:<id>`, una sessione locale un identificativo di dispositivo che il server emette in un cookie `atelier_device` (HttpOnly, un anno). Il client non può scegliere il bucket di un altro.

### 4.3 Verifica manuale della firma

Con le variabili impostate, la prova più rapida è dal pannello: **Dashboard → Archivio cloud → Sincronizza ora**, poi ricontrolla i numeri. Un secondo giro deve dire «tutto già allineato»; una firma sbagliata viene invece rifiutata dal database con un messaggio esplicito.

---

## 5. Cosa aspettarsi dai primi minuti

- Il deploy è autosufficiente: nessun database esterno, nessun servizio di autenticazione, nessuno storage remoto sono *necessari* per pubblicare.
- I progetti vivono in IndexedDB del browser. L'archivio cloud (Supabase, schema `atelier`) è un'aggiunta: quando è configurato, il pannello della dashboard sincronizza i progetti del workspace fra dispositivi; quando non lo è, resta spento e tutto continua a funzionare.
- I provider gratuiti hanno limiti giornalieri: il router li prova in cascata e, se nessuno risponde entro le scadenze (25 s blueprint, 20 s per pagina, 90 s totali), consegna il sito generato dal composer con un avviso esplicito.
