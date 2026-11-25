import postgres from "postgres";
import fs from "fs";
import path from "path";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.LOVABLE_DB_MIGRATION_URL ||
  "postgresql://postgres.gqttqjehlfeodocofytp:VT4d9zkzMvUvaoOY@aws-1-eu-west-1.pooler.supabase.com:6543/postgres";

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
    await sql.unsafe(migrationContent);

    console.log("✅ Migration et initialisation du compte propriétaire terminées avec succès !");
    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur lors de la migration :", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
