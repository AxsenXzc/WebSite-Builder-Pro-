import { redirect } from "next/navigation";
import { WizardView } from "@/components/app/wizard-view";
import { getSession } from "@/lib/auth/server";

export const metadata = { title: "Nuovo sito", robots: { index: false, follow: false } };

/**
 * Creazione di un sito. Il prompt può arrivare dalla vetrina (`?prompt=…`),
 * così "apri un sito tuo" porta dentro l'editor con il testo già scritto.
 */
export default async function NewSitePage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string; stile?: string }>;
}) {
  const user = await getSession();
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.prompt) query.set("prompt", params.prompt);
  if (params.stile) query.set("stile", params.stile);
  const back = query.size > 0 ? `/nuovo?${query.toString()}` : "/nuovo";

  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);

  return <WizardView initialPrompt={params.prompt?.slice(0, 1200) ?? ""} initialStyle={params.stile ?? ""} />;
}
