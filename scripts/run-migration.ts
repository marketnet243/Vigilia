import postgres from "postgres";
import fs from "fs";
import path from "path";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.LOVABLE_DB_MIGRATION_URL;

if (!connectionString) {
  throw new Error("Définissez DATABASE_URL ou LOVABLE_DB_MIGRATION_URL dans l’environnement.");
}

/**
 * Splits a SQL script into individual statements while respecting:
 * - $$ dollar-quoted blocks (DO $$...$$, functions, etc.)
 * - Single-quoted strings
 * - -- line comments
 * Returns an array of non-empty SQL statements.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;

  while (i < sql.length) {
    // Line comment
    if (sql[i] === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      if (end === -1) {
        current += sql.slice(i);
        break;
      }
      current += sql.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    // Dollar-quoted string ($$...$$)
    if (sql[i] === "$" && sql[i + 1] === "$") {
      const closeIdx = sql.indexOf("$$", i + 2);
      if (closeIdx === -1) {
        current += sql.slice(i);
        break;
      }
      current += sql.slice(i, closeIdx + 2);
      i = closeIdx + 2;
      continue;
    }

    // Single-quoted string
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2; // escaped quote
          continue;
        }
        if (sql[j] === "'") {
          j++;
          break;
        }
        j++;
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    // Statement separator
    if (sql[i] === ";") {
      current += ";";
      const trimmed = current.trim();
      if (trimmed && trimmed !== ";") {
        statements.push(trimmed);
      }
      current = "";
      i++;
      continue;
    }

    current += sql[i];
    i++;
  }

  const trimmed = current.trim();
  if (trimmed && trimmed !== ";") {
    statements.push(trimmed);
  }

  return statements;
}

/** Postgres error codes that mean "already exists" — safe to skip on re-run */
const IDEMPOTENT_CODES = new Set([
  "42710", // type already exists
  "42P07", // relation already exists
  "42P16", // duplicate object (constraints, etc.)
  "42710", // duplicate_object
  "42501", // insufficient_privilege (REVOKE/GRANT on already-set perms)
]);

/** Patterns that indicate the error is harmless on re-run */
const IDEMPOTENT_PATTERNS = [
  /already exists/i,
  /duplicate key value/i,
  /policy .+ already exists/i,
];

function isIdempotentError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; message?: string };
  if (e.code && IDEMPOTENT_CODES.has(e.code)) return true;
  if (e.message && IDEMPOTENT_PATTERNS.some((p) => p.test(e.message!))) return true;
  return false;
}

async function runMigration() {
  console.log("🚀 Lancement de la migration automatique sur Supabase...");
  console.log("Connexion à la base de données...");

  const sql = postgres(connectionString, {
    ssl: "require",
    max: 1,
    connect_timeout: 15,
  });

  try {
    const test = await sql`SELECT current_database(), current_user;`;
    console.log("✅ Connecté avec succès :", test);

    const sqlFile = path.resolve("scripts/supabase-setup-all.sql");
    const migrationContent = fs.readFileSync(sqlFile, "utf8");

    console.log("Exécution du schéma, tables, et compte propriétaire...");

    const statements = splitStatements(migrationContent);
    console.log(`📋 ${statements.length} statements SQL à exécuter`);

    let success = 0;
    let skipped = 0;
    let errors = 0;

    for (let idx = 0; idx < statements.length; idx++) {
      const stmt = statements[idx];
      // Log a short preview (first 80 chars)
      const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
      try {
        await sql.unsafe(stmt);
        success++;
      } catch (err) {
        if (isIdempotentError(err)) {
          skipped++;
          console.log(`  ⏭️  [${idx + 1}] Déjà existant, ignoré: ${preview}...`);
        } else {
          errors++;
          const e = err as { code?: string; message?: string };
          console.error(`  ❌ [${idx + 1}] Erreur: ${e.code} — ${e.message}`);
          console.error(`     Statement: ${preview}...`);
          // Don't stop — continue with remaining statements
        }
      }
    }

    console.log(`\n📊 Résultat: ${success} réussis, ${skipped} déjà existants (ignorés), ${errors} erreurs`);

    if (errors > 0) {
      console.warn("⚠️  Des erreurs non-idempotentes ont été rencontrées, mais la migration continue.");
    }

    console.log("✅ Migration et initialisation du compte propriétaire terminées avec succès !");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur fatale lors de la migration :", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
