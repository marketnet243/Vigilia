import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.INITIAL_ADMIN_EMAIL || "kayoyolandry@gmail.com";
const PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || "Landry@2025";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Erreur: Les variables d'environnement Supabase sont manquantes dans .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log(`Initialisation du compte pour: ${EMAIL}...`);

  // Tentative d'inscription
  const { data, error } = await supabase.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
  });

  if (error) {
    if (error.message.includes("already registered") || error.status === 422) {
      console.log(`ℹ️ Le compte ${EMAIL} est déjà enregistré sur Supabase.`);
      console.log(`👉 Pour confirmer automatiquement le compte sans e-mail de validation, exécutez le script SQL:`);
      console.log(`   scripts/create-admin-user.sql`);
      console.log(`   dans l'éditeur SQL de votre dashboard Supabase.`);
      return;
    }
    console.error("Erreur lors de la création :", error.message);
    process.exit(1);
  }

  console.log("Compte créé avec l'identifiant :", data.user?.id);
  if (!data.session) {
    console.log("⚠️ Supabase attend une confirmation d'e-mail par défaut.");
    console.log("👉 Pour activer immédiatement le compte sans e-mail, exécutez :");
    console.log("   scripts/create-admin-user.sql");
    console.log("   ou désactivez 'Confirm email' dans Supabase > Authentication > Providers > Email.");
  } else {
    console.log("✅ Compte activé et connecté immédiatement !");
  }
}

main();
