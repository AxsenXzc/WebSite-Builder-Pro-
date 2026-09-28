import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell, SectionHeading } from "@/components/site/marketing-shell";
import { absoluteUrl } from "@/lib/util/site-url";

export const metadata: Metadata = {
  title: "Domande frequenti",
  description:
    "Account, chiavi API, privacy dei progetti, qualità dei testi, export, reimport, prezzi e self-hosting: le risposte brevi su come funziona Atelier.",
  alternates: { canonical: "/domande-frequenti" },
  openGraph: {
    title: "Domande frequenti su Atelier",
    description: "Account, chiavi, dati, export e self-hosting: le risposte brevi, senza giri di parole.",
    url: absoluteUrl("/domande-frequenti"),
    type: "article",
  },
};

type Group = { title: string; items: { q: string; a: string }[] };

const GROUPS: Group[] = [
  {
    title: "Prima di iniziare",
    items: [
      {
        q: "Serve un account?",
        a: "No. Puoi entrare con l'accesso locale, che non chiede niente a nessun servizio e crea un workspace tuo nel browser. GitHub e Google servono solo a riconoscere lo stesso workspace su dispositivi diversi, quando l'istanza ha le app OAuth configurate.",
      },
      {
        q: "Serve una chiave API di un provider AI?",
        a: "No. Il primo stadio del compilatore è deterministico e genera un sito completo — pagine, testi, palette, SEO, pagine legali — senza rete. La chiave AI è un'accelerazione: riscrive i contenuti rendendoli specifici per la tua attività.",
      },
      {
        q: "Quanto tempo ci vuole per il primo sito?",
        a: "Meno di un minuto con il composer offline. Con l'AI i tempi dipendono dal provider; ogni stadio ha un budget di tempo, quindi la generazione non resta appesa: se il modello è lento, ricevi il sito del composer e un avviso su cosa non è arrivato.",
      },
      {
        q: "Che cosa devo scrivere nel brief?",
        a: "Settore e attività, nome, eventuale città, servizi principali e tono. Frasi come «studio di fisioterapia a Monza, attenzione alla postura e al recupero sportivo» bastano: il compilatore riconosce il settore dal testo e sceglie pagine e struttura di conseguenza.",
      },
    ],
  },
  {
    title: "Qualità del risultato",
    items: [
      {
        q: "I testi sono generici o sono scritti per la mia attività?",
        a: "Il composer scrive testi coerenti con settore e tono, ma non conosce i tuoi dettagli. Con l'AI i contenuti vengono riscritti sulle informazioni del brief, dentro il catalogo di sezioni: resta il tuo lessico, non un tema riempito.",
      },
      {
        q: "Due siti generati si somigliano?",
        a: "Il compilatore calcola l'impronta strutturale del progetto e cambia le varianti se due siti risultano troppo simili. Palette, tipografia, apertura e sequenza delle sezioni derivano dal brief, non da un tema fisso.",
      },
      {
        q: "Chi decide i colori e i font?",
        a: "Il compilatore, a partire dalla tinta e dal tono. Le palette sono generate in OKLCH, il contrasto viene corretto aritmeticamente e la tipografia sceglie fra accoppiamenti pensati per il settore: nessuna coppia lascia testo illeggibile.",
      },
      {
        q: "Il sito è accessibile?",
        a: "Ogni uscita passa i gate di accessibilità: gerarchia di intestazioni senza salti, testo alternativo sulle immagini, focus visibile, etichette sui campi, contrasto verificato in chiaro e in scuro. I numeri sono nel report dei gate, non in una promessa.",
      },
    ],
  },
  {
    title: "I tuoi dati",
    items: [
      {
        q: "Dove finiscono i miei progetti?",
        a: "Nel tuo browser, nell'archivio locale. Non c'è un database di progetti lato server: nessuno può leggerli o perderli al posto tuo. Per il backup esporti il file di progetto, che si reimporta identico.",
      },
      {
        q: "E le chiavi dei provider AI?",
        a: "Restano nel tuo browser e vengono inviate al server dell'istanza solo per la durata della richiesta che stai facendo, per inoltrarla al provider che hai scelto. Non vengono salvate su disco né conservate dopo la risposta.",
      },
      {
        q: "Usate cookie o tracciamenti?",
        a: "Un solo cookie tecnico: quello di sessione, firmato e con scadenza a 30 giorni. Nessun tracciante, nessuna pubblicità, nessuna statistica di terze parti. I dettagli sono nella pagina Privacy.",
      },
      {
        q: "Posso cancellare tutto?",
        a: "Sì, e non devi chiedere a nessuno: cancelli i progetti dall'archivio del browser e la sessione con l'uscita dall'account. Non conserviamo copie da eliminare.",
      },
    ],
  },
  {
    title: "Export e pubblicazione",
    items: [
      {
        q: "Cosa contiene l'export?",
        a: "Un archivio con le pagine HTML, il foglio di stile, un JavaScript minimo, le immagini generate dal tema, sitemap, robots e le pagine legali. Puoi anche scaricare una singola pagina autosufficiente o il file di progetto per riprendere a lavorare.",
      },
      {
        q: "Il sito esportato è identico all'anteprima?",
        a: "Sì, per costruzione: anteprima ed export nascono dallo stesso albero di markup e dallo stesso foglio di stile. Non c'è un renderer per l'editor e uno per la produzione.",
      },
      {
        q: "Dove posso pubblicarlo?",
        a: "Su qualunque hosting statico: Vercel, Netlify, Cloudflare Pages, GitHub Pages, un bucket S3, uno spazio FTP. Sono file normali, senza build e senza runtime: carichi la cartella e il sito è online.",
      },
      {
        q: "Posso riportare dentro Atelier un progetto esportato?",
        a: "Sì. Il file di progetto si reimporta dalla dashboard e ricompila lo stesso HTML byte per byte: serve per riprendere un lavoro su un altro dispositivo o per ripartire da una versione archiviata.",
      },
    ],
  },
  {
    title: "Installazione e limiti",
    items: [
      {
        q: "Posso installare Atelier sul mio server?",
        a: "Sì. È un'applicazione Next.js con accesso GitHub/Google facoltativo e chiavi AI facoltative: nessun servizio obbligatorio a monte. La guida nel repository elenca variabili, controlli post-deploy e come creare le app OAuth.",
      },
      {
        q: "Cosa non fa Atelier?",
        a: "Non pubblica al posto tuo, non fa e-commerce o aree riservate, non scrive in lingue diverse dall'italiano e non sostituisce un consulente legale: le pagine privacy e cookie sono scritte, ma vanno adattate alla tua attività.",
      },
      {
        q: "I contenuti generati sono miei?",
        a: "Sì. Il sito esportato e i testi che produce sono tuoi, senza attribuzione obbligatoria: pubblichi dove vuoi, anche modificando il codice a mano dopo l'export.",
      },
      {
        q: "Quanto pesa un sito generato?",
        a: "Un sito informativo completo sta nell'ordine delle centinaia di kilobyte, perché le immagini sono generate proceduralmente dal tema invece di essere fotografie. Il gate del peso ti dice il numero reale prima dell'export.",
      },
    ],
  },
];

export default function DomandeFrequentiPage() {
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GROUPS.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    ),
  };

  return (
    <MarketingShell
      eyebrow="domande frequenti"
      title="Le risposte che servono prima di iniziare"
      lead={
        <p>
          Nessuna domanda con la risposta elusiva: se una funzione non c&apos;è, è scritto. Se un limite esiste, è dichiarato con il
          numero che lo descrive.
        </p>
      }
      meta={[`${GROUPS.reduce((total, group) => total + group.items.length, 0)} risposte`, "accesso, dati, qualità, export", "limiti dichiarati"]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />

      {GROUPS.map((group) => (
        <section key={group.title} className="grid scroll-mt-24 gap-3 pt-6">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{group.title}</h2>
          <div className="grid gap-2">
            {group.items.map((item) => (
              <details key={item.q} className="faq">
                <summary>{item.q}</summary>
                <div className="text-[13px] leading-relaxed text-ink-500">{item.a}</div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <section className="grid gap-3 pt-8">
        <SectionHeading
          eyebrow="non hai trovato la risposta"
          title="Guarda dentro Atelier, non nella documentazione"
          text="La pagina di stato mostra cosa è configurato su questa istanza e la pagina delle funzionalità entra nel dettaglio tecnico di ogni stadio."
        />
        <div className="flex flex-wrap gap-3">
          <Link className="btn btn-outline" href="/funzionalita">
            Funzionalità in dettaglio
          </Link>
          <Link className="btn btn-outline" href="/stato">
            Stato del servizio
          </Link>
          <Link className="btn btn-outline" href="/privacy">
            Privacy
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
