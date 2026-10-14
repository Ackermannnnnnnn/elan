import { exportAccountData } from "@/data/account";
import { getSessionUser } from "@/lib/auth/session";

/** Téléchargement de toutes les données de l'utilisateur connecté (fichier JSON). */
export async function GET(): Promise<Response> {
  if (!(await getSessionUser())) return new Response(null, { status: 401 });
  try {
    const data = await exportAccountData();
    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="elan-donnees-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(null, { status: 500 });
  }
}
