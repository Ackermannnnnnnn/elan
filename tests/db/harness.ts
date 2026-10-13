import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";

const ROOT = join(import.meta.dirname, "..", "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");

/**
 * Base PostgreSQL en mémoire (PGlite) avec le socle Supabase simulé puis
 * toutes les migrations du projet appliquées dans l'ordre.
 * Aucun Docker ni serveur n'est nécessaire pour lancer ces tests.
 */
export async function createTestDatabase(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pg_trgm, unaccent } });
  await db.exec(readFileSync(join(import.meta.dirname, "supabase-shim.sql"), "utf8"));

  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} en échec : ${(error as Error).message}`);
    }
  }
  return db;
}

/** Crée un compte comme le ferait Supabase Auth (déclenche l'initialisation). */
export async function createUser(db: PGlite, email: string, displayName?: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, displayName ? { display_name: displayName } : {}],
  );
  const user = rows[0];
  if (!user) throw new Error("Création du compte de test impossible");
  return user.id;
}

/**
 * Exécute `run` exactement comme une requête de l'API Supabase : rôle
 * `authenticated` (ou `anon`) et identité portée par les claims du JWT.
 * La transaction est toujours annulée : chaque test repart d'un état propre.
 */
export async function asRole<T>(
  db: PGlite,
  identity: { role: "authenticated"; userId: string } | { role: "anon" },
  run: (tx: Transaction) => Promise<T>,
  options: { commit?: boolean } = {},
): Promise<T> {
  let result: T | undefined;
  let failure: unknown;

  await db.transaction(async (tx) => {
    const claims =
      identity.role === "authenticated"
        ? { sub: identity.userId, role: "authenticated" }
        : { role: "anon" };
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await tx.exec(`set local role ${identity.role}`);
    try {
      result = await run(tx);
    } catch (error) {
      failure = error;
    }
    if (failure || !options.commit) await tx.rollback();
  });

  if (failure) throw failure;
  return result as T;
}

export const asUser = <T>(
  db: PGlite,
  userId: string,
  run: (tx: Transaction) => Promise<T>,
  options?: { commit?: boolean },
) => asRole(db, { role: "authenticated", userId }, run, options);

export const asAnon = <T>(db: PGlite, run: (tx: Transaction) => Promise<T>) =>
  asRole(db, { role: "anon" }, run);
