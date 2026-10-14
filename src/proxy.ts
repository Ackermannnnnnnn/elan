import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 : ce fichier remplace `middleware.ts`.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques, les images, les métadonnées, le service
    // worker et /api/push (appelée par Supabase avec son propre secret, sans session).
    "/((?!_next/static|_next/image|\\.well-known|favicon.ico|manifest.webmanifest|robots.txt|sw\\.js|offline\\.html|api/push|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2|wasm)$).*)",
  ],
};
