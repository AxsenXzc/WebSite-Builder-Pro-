import { redirect } from "next/navigation";
import { StudioShell } from "@/components/studio/studio-shell";
import { getSession } from "@/lib/auth/server";

export const metadata = { title: "Studio", robots: { index: false, follow: false } };

/**
 * Lo Studio lavora interamente nel browser: il progetto vive in IndexedDB.
 * Questa route è il punto di ingresso, con l'id risolto lato server e la
 * sessione verificata prima di aprire l'editor.
 */
export default async function StudioPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/studio/${siteId}`)}`);

  return <StudioShell siteId={siteId} />;
}
