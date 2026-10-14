import { clearRestAlarm, setRestAlarm } from "@/data/notifications";
import { restAlarmSchema } from "@/features/notifications/schemas";

/**
 * Notification de fin de repos, pour l'écran verrouillé. Appelée par le
 * minuteur de séance avec `fetch(…, { keepalive: true })` : la requête part
 * même si l'écran s'éteint juste après, et ne bloque pas les autres actions.
 * La session (cookies) identifie l'utilisateur ; la RLS fait le reste.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = restAlarmSchema.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });
  const { seconds, detail, sessionId } = parsed.data;
  try {
    await setRestAlarm({ seconds, detail, url: `/training/sessions/${sessionId}` });
  } catch {
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}

export async function DELETE(): Promise<Response> {
  try {
    await clearRestAlarm();
  } catch {
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
