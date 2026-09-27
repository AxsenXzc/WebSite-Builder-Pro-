import { redirect } from "next/navigation";
import { DashboardView } from "@/components/app/dashboard-view";
import { getSession } from "@/lib/auth/server";

export const metadata = { title: "Progetti", robots: { index: false, follow: false } };

/** L'area di lavoro richiede una sessione: GitHub, Google o locale. */
export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login?next=/dashboard");
  return <DashboardView />;
}
