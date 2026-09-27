import { SettingsView } from "@/components/app/settings-view";
import { getSession } from "@/lib/auth/server";

export const metadata = { title: "Impostazioni", robots: { index: false, follow: false } };

/**
 * Impostazioni. Visitabile anche senza sessione: serve proprio a capire cosa
 * manca per collegare GitHub o Google e a gestire le chiavi AI.
 */
export default async function SettingsPage() {
  const user = await getSession();
  return <SettingsView pendingLogin={Boolean(user)} />;
}
