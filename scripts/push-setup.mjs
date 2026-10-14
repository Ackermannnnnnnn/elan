// Prépare les notifications (gratuites) : génère les clés et le secret, puis
// affiche exactement quoi copier dans Vercel et dans Supabase.
// Usage : npm run push:setup -- https://ton-app.vercel.app
//
// Les valeurs affichées sont des SECRETS : ne les colle nulle part ailleurs
// (ni dans un chat, ni dans le code). Les relancer change les clés : il faudra
// alors réactiver les notifications sur chaque téléphone.
import { randomBytes } from "node:crypto";
import webpush from "web-push";

const appUrl = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!/^https:\/\/[^\s/]+/.test(appUrl)) {
  console.error(
    "Indique l'adresse de ton application, par exemple :\n  npm run push:setup -- https://elan-xxxx.vercel.app",
  );
  process.exit(1);
}

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const secret = randomBytes(32).toString("hex");
const sqlString = (value) => `'${value.replace(/'/g, "''")}'`;
const upsertSecret = (name, value) => `do $$
begin
  perform vault.create_secret(${sqlString(value)}, ${sqlString(name)});
exception when unique_violation then
  perform vault.update_secret((select id from vault.secrets where name = ${sqlString(name)}), ${sqlString(value)});
end;
$$;`;

const line = "─".repeat(72);
console.log(`
${line}
1) VERCEL → ton projet → Settings → Environment Variables
   Ajoute ces 4 variables (Environments : Production, Preview, Development) :
${line}
NEXT_PUBLIC_VAPID_PUBLIC_KEY   (type « Config », elle n'est pas secrète)
${publicKey}

VAPID_PRIVATE_KEY   (secrète)
${privateKey}

VAPID_SUBJECT
${appUrl}

PUSH_SECRET   (secrète)
${secret}

${line}
2) SUPABASE → ton projet → SQL Editor → New query
   Colle ce bloc, puis « Run » :
${line}
${upsertSecret("elan_app_url", appUrl)}

${upsertSecret("elan_push_secret", secret)}

${line}
3) Vercel → Deployments → ⋯ sur le dernier → Redeploy.
   Puis, sur ton téléphone : Profil → Rappels et notifications → Activer.
${line}
`);
