import { createHash, timingSafeEqual } from "node:crypto";
import { getPushConfig } from "@/lib/push/config";
import { pushRequestSchema } from "@/lib/push/payload";
import { buildPayload, sendPush } from "@/lib/push/send";

/**
 * Expédie les notifications dues. Appelée uniquement par Supabase (pg_cron →
 * pg_net, voir la migration « notifications »), avec le secret partagé.
 * Ne lit ni n'écrit rien en base : tout ce qu'il faut est dans la requête.
 */
export async function POST(request: Request): Promise<Response> {
  const config = getPushConfig();
  if (!config?.secret) return Response.json({ error: "notConfigured" }, { status: 503 });

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(token), digest(config.secret))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalidBody" }, { status: 400 });
  }
  const parsed = pushRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalidBody" }, { status: 400 });

  const outcomes = await Promise.all(
    parsed.data.messages.map(async (message) =>
      sendPush(
        config,
        message,
        message.kind,
        await buildPayload(message.kind, message.detail, message.url),
      ),
    ),
  );
  return Response.json({
    sent: outcomes.filter((outcome) => outcome === "sent").length,
    gone: outcomes.filter((outcome) => outcome === "gone").length,
    failed: outcomes.filter((outcome) => outcome === "failed").length,
  });
}
