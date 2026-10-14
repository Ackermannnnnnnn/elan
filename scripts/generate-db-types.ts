/**
 * Génère `src/types/database.ts` à partir des migrations SQL.
 *
 * Les migrations sont appliquées dans un PostgreSQL en mémoire (PGlite), puis
 * le schéma `public` est lu pour produire les types attendus par supabase-js.
 * Les colonnes `text` contraintes par un CHECK … IN (…) deviennent des unions
 * littérales : une faute de frappe sur un statut est détectée à la compilation.
 *
 * Usage : npm run db:types
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTestDatabase } from "../tests/db/harness.ts";

type Column = {
  table_name: string;
  column_name: string;
  udt_name: string;
  is_nullable: boolean;
  has_default: boolean;
};

type Check = { table_name: string; definition: string };

const SCALAR_TYPES: Record<string, string> = {
  uuid: "string",
  text: "string",
  varchar: "string",
  date: "string",
  void: "undefined",
  time: "string",
  timestamptz: "string",
  timestamp: "string",
  bool: "boolean",
  int2: "number",
  int4: "number",
  int8: "number",
  numeric: "number",
  float4: "number",
  float8: "number",
  jsonb: "Json",
  json: "Json",
};

function baseType(udtName: string): string {
  if (udtName.startsWith("_")) return `${baseType(udtName.slice(1))}[]`;
  const mapped = SCALAR_TYPES[udtName];
  if (!mapped) throw new Error(`Type PostgreSQL non géré : ${udtName}`);
  return mapped;
}

/** Extrait `colonne → valeurs autorisées` d'un CHECK portant sur une seule colonne. */
function parseEnumCheck(definition: string): { column: string; values: string[] } | null {
  // Forme produite par pg_get_constraintdef :
  //   CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text])))
  const scalar = /^CHECK \(\((\w+) = ANY \(ARRAY\[(.+)\]\)\)\)$/.exec(definition);
  //   CHECK ((meal_style <@ ARRAY['budget'::text, 'quick'::text]))
  const array = /^CHECK \(\((\w+) <@ ARRAY\[(.+)\]\)\)$/.exec(definition);
  const match = scalar ?? array;
  if (!match?.[1] || !match[2]) return null;

  const values = [...match[2].matchAll(/'((?:[^']|'')*)'::text/g)].map((m) => m[1] ?? "");
  if (values.length === 0) return null;
  return { column: match[1], values };
}

const db = await createTestDatabase();

const { rows: columns } = await db.query<Column>(`
  select table_name, column_name, udt_name,
         is_nullable = 'YES' as is_nullable,
         (column_default is not null or is_generated = 'ALWAYS') as has_default
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, ordinal_position
`);

const { rows: checks } = await db.query<Check>(`
  select rel.relname as table_name, pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public' and con.contype = 'c'
`);

const enums = new Map<string, string[]>();
for (const check of checks) {
  const parsed = parseEnumCheck(check.definition);
  if (parsed) enums.set(`${check.table_name}.${parsed.column}`, parsed.values);
}

function columnType(column: Column): string {
  let type = baseType(column.udt_name);
  const allowed = enums.get(`${column.table_name}.${column.column_name}`);
  if (allowed) {
    const union = allowed.map((value) => JSON.stringify(value)).join(" | ");
    type = column.udt_name.startsWith("_") ? `(${union})[]` : union;
  }
  return column.is_nullable ? `${type} | null` : type;
}

const tables = new Map<string, Column[]>();
for (const column of columns) {
  tables.set(column.table_name, [...(tables.get(column.table_name) ?? []), column]);
}

// Fonctions exposées par l'API (RPC) : arguments et type de retour.
type FunctionInfo = {
  name: string;
  arg_names: string[] | null;
  arg_types: string[];
  arg_defaults: number;
  returns_set: boolean;
  return_type: string;
  return_table: string | null;
};
const { rows: functions } = await db.query<FunctionInfo>(`
  select p.proname as name,
         p.proargnames as arg_names,
         array(select format_type(t, null) from unnest(p.proargtypes) as t) as arg_types,
         p.pronargdefaults as arg_defaults,
         p.proretset as returns_set,
         format_type(p.prorettype, null) as return_type,
         (select c.relname from pg_class c where c.reltype = p.prorettype) as return_table
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
  order by p.proname
`);

const SQL_TO_TS: Record<string, string> = {
  text: "string",
  integer: "number",
  smallint: "number",
  bigint: "number",
  numeric: "number",
  boolean: "boolean",
  uuid: "string",
  date: "string",
  void: "undefined",
};

function functionLines(info: FunctionInfo): string[] {
  const names = info.arg_names ?? [];
  const firstOptional = info.arg_types.length - info.arg_defaults;
  const args = info.arg_types.map((type, index) => {
    const tsType = SQL_TO_TS[type];
    if (!tsType) throw new Error(`Type d'argument non géré : ${type} (${info.name})`);
    return `${names[index] ?? `arg${index}`}${index >= firstOptional ? "?" : ""}: ${tsType}`;
  });
  const row = info.return_table
    ? `Database["public"]["Tables"]["${info.return_table}"]["Row"]`
    : SQL_TO_TS[info.return_type];
  if (!row) throw new Error(`Type de retour non géré : ${info.return_type} (${info.name})`);
  return [
    `      ${info.name}: {`,
    args.length > 0
      ? `        Args: { ${args.join("; ")} };`
      : "        Args: Record<string, never>;",
    `        Returns: ${info.returns_set ? `${row}[]` : row};`,
    "      };",
  ];
}

const lines: string[] = [
  "// Fichier GÉNÉRÉ par `npm run db:types` à partir de supabase/migrations.",
  "// Ne pas modifier à la main : modifier une migration puis régénérer.",
  "",
  "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];",
  "",
  "export type Database = {",
  "  public: {",
  "    Tables: {",
];

for (const [table, tableColumns] of tables) {
  lines.push(`      ${table}: {`, "        Row: {");
  for (const column of tableColumns) {
    lines.push(`          ${column.column_name}: ${columnType(column)};`);
  }
  lines.push("        };", "        Insert: {");
  for (const column of tableColumns) {
    const optional = column.is_nullable || column.has_default ? "?" : "";
    lines.push(`          ${column.column_name}${optional}: ${columnType(column)};`);
  }
  lines.push("        };", "        Update: {");
  for (const column of tableColumns) {
    lines.push(`          ${column.column_name}?: ${columnType(column)};`);
  }
  lines.push("        };", "        Relationships: [];", "      };");
}

lines.push(
  "    };",
  "    Views: { [_ in never]: never };",
  ...(functions.length > 0
    ? ["    Functions: {", ...functions.flatMap(functionLines), "    };"]
    : ["    Functions: { [_ in never]: never };"]),
  "    Enums: { [_ in never]: never };",
  "    CompositeTypes: { [_ in never]: never };",
  "  };",
  "};",
  "",
  'type PublicTables = Database["public"]["Tables"];',
  "",
  '/** Ligne telle que lue en base : `Row<"profiles">`. */',
  'export type Row<T extends keyof PublicTables> = PublicTables[T]["Row"];',
  "/** Données acceptées à l'insertion. */",
  'export type InsertRow<T extends keyof PublicTables> = PublicTables[T]["Insert"];',
  "/** Données acceptées à la mise à jour. */",
  'export type UpdateRow<T extends keyof PublicTables> = PublicTables[T]["Update"];',
  "",
);

const target = join(import.meta.dirname, "..", "src", "types", "database.ts");
writeFileSync(target, lines.join("\n"));
await db.close();

console.log(
  `${tables.size} tables, ${enums.size} colonnes à valeurs contraintes → src/types/database.ts`,
);
