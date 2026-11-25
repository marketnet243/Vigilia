import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Shield,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/workspace/head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () =>
    pageHead("Connexion", "Accès sécurisé au centre de commandement Vigilia."),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Veuillez saisir votre adresse e-mail.");
      return;
    }
    if (!password) {
      toast.error("Veuillez saisir votre mot de passe.");
      return;
    }

    setBusy(true);
    try {
      // 1. Déconnecter d'abord toute session active ou corrompue
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Ignorer les erreurs de signOut (session déjà invalide)
      }

      // 2. Purger localStorage de tous les tokens Supabase résiduels
      if (typeof window !== "undefined") {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-") || k.startsWith("supabase"))
          .forEach((k) => localStorage.removeItem(k));
      }

      // 3. Petite pause pour laisser le client se réinitialiser
      await new Promise((r) => setTimeout(r, 50));

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const code = (error as { code?: string }).code ?? "";
        const msg = error.message.toLowerCase();

        if (msg.includes("email not confirmed") || code === "email_not_confirmed") {
          setErrorMessage(
            "L'adresse e-mail n'a pas été confirmée. Contactez l'administrateur pour activer le compte."
          );
          toast.error("E-mail non confirmé.");
          return;
        }

        if (
          msg.includes("invalid login credentials") ||
          msg.includes("invalid credentials") ||
          code === "invalid_credentials"
        ) {
          setErrorMessage(
            "Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe."
          );
          toast.error("Identifiants incorrects.");
          return;
        }

        setErrorMessage(error.message);
        toast.error("Erreur de connexion.");
        return;
      }

      if (data.session) {
        toast.success("Authentification réussie. Bienvenue dans Vigilia !");
        void navigate({ to: "/" });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erreur de connexion inattendue";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background bg-signal px-4 py-12">
      {/* Tactical grid overlay */}
      <div className="bg-command-grid pointer-events-none absolute inset-0 opacity-70" />

      {/* Ambient luminous orbs */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[440px] w-[620px] rounded-full bg-primary/10 blur-[150px]" />
      </div>

      <div className="animate-rise relative z-10 w-full max-w-[420px] space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <Shield className="size-7" />
            <span className="absolute -bottom-1 -right-1 flex size-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex size-3.5 rounded-full border-2 border-background bg-success" />
            </span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            <span className="size-1.5 rounded-full bg-primary pulse-dot" />
            Vigilia Command Center
          </div>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Accès Propriétaire
          </h1>
          <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Console autonome de surveillance, d&apos;opérations et de gouvernance IA
          </p>
        </div>

        {/* Glassmorphism Login Panel */}
        <div className="glass-card relative overflow-hidden rounded-2xl">
          {/* Top luminous hairline accent */}
          <div className="h-[2px] w-full bg-gradient-primary opacity-80" />

          <div className="space-y-5 p-6 sm:p-7">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Connexion sécurisée
              </h2>
              <p className="text-xs text-muted-foreground">
                Authentifiez-vous pour accéder à votre espace de commandement.
              </p>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-foreground">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="space-y-0.5 leading-relaxed">
                  <span className="font-semibold text-destructive">
                    Échec d&apos;authentification
                  </span>
                  <p className="text-foreground/90">{errorMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-xs font-medium text-foreground/90"
                >
                  Adresse e-mail
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-3 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@domaine.com"
                    className="h-10.5 rounded-xl border-border/80 bg-background/65 pl-10 font-mono text-sm transition-colors placeholder:text-muted-foreground/50 focus-visible:border-primary/60 focus-visible:ring-primary/25"
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-xs font-medium text-foreground/90"
                >
                  Mot de passe
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-3 size-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-10.5 rounded-xl border-border/80 bg-background/65 pl-10 pr-10 font-mono text-sm transition-colors placeholder:text-muted-foreground/50 focus-visible:border-primary/60 focus-visible:ring-primary/25"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Afficher ou masquer le mot de passe"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="mt-2 h-10.5 w-full gap-2 rounded-xl bg-gradient-primary font-semibold text-primary-foreground shadow-glow transition-all hover:opacity-95 active:scale-[0.99]"
              >
                {busy ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="size-4 animate-spin" />
                    Vérification en cours…
                  </span>
                ) : (
                  <>
                    <KeyRound className="size-4" />
                    <span>Se connecter</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Subtle footer telemetry */}
        <div className="flex items-center justify-center gap-2 font-mono text-[11px] text-muted-foreground/70">
          <span className="size-1.5 rounded-full bg-success/80" />
          <span>Accès restreint · Session chiffrée Supabase</span>
        </div>
      </div>
    </div>
  );
}
