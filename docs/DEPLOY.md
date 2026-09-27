# Deploy e accessi

Tutto quello che serve per mettere Atelier online e per accendere i pulsanti GitHub/Google.
Nessun passaggio richiede di modificare il codice: sono credenziali e collegamenti.

---

## 1. Repository GitHub privato

Il progetto non ha ancora un repository. Dal tuo account GitHub:

1. **New repository** → nome `atelier` → **Private** → *non* aggiungere README/`.gitignore` (ci sono già).
2. Copia l'indirizzo, per esempio `https://github.com/AxsenXzc/atelier.git`.
3. Da questa cartella:

```bash
git remote add origin https://github.com/AxsenXzc/atelier.git
git push -u origin main
```

Al primo push Git Credential Manager apre una finestra del browser per autorizzare l'accesso al tuo account: è l'unico passaggio interattivo.

Da qui in poi ogni `git push` su `main` fa ripartire il deploy su Vercel.

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

### Controllo dopo il deploy

`https://<tuo-dominio>/api/providers/health` deve rispondere con:

```json
{ "sessionSecretConfigured": true, "authProviders": [{ "id": "github", "configured": true }, { "id": "google", "configured": true }] }
```

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

## 4. Cosa aspettarsi dai primi minuti

- Il deploy è autosufficiente: nessun database esterno, nessun servizio di autenticazione, nessuno storage remoto.
- I progetti vivono in IndexedDB del browser. La sincronizzazione fra dispositivi è il passo successivo (Supabase, schema `atelier`), non un requisito per pubblicare.
- I provider gratuiti hanno limiti giornalieri: il router li prova in cascata e, se nessuno risponde entro le scadenze (25 s blueprint, 20 s per pagina, 90 s totali), consegna il sito generato dal composer con un avviso esplicito.
