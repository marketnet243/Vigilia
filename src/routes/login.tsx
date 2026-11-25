import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Shield, Lock, Mail, ArrowRight, Eye, EyeOff, KeyRound, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/workspace/head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  head: () => pageHead("Connexion", "Accès sécurisé au centre de commandement Vigilia."),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("kayoyolandry@gmail.com");
  const [password, setPassword] = useState("Landry@2025");
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
    const cleanEmail = email.trim();
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        if (
          error.message.toLowerCase().includes("email not confirmed") ||
          (error as { code?: string }).code === "email_not_confirmed"
        ) {
          const msg =
            "L'adresse e-mail n'a pas encore été confirmée dans Supabase. Veuillez désactiver 'Confirm email' dans Supabase (Authentication > Providers > Email) ou exécuter le script SQL d'activation.";
          setErrorMessage(msg);
          toast.error("E-mail non confirmé sur Supabase.");
          return;
        }
        throw error;
      }

      if (data.session) {
        toast.success("Authentification réussie. Bienvenue dans Vigilia !");
        void navigate({ to: "/" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12 selection:bg-primary/20 selection:text-primary">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[400px] w-[600px] rounded-full bg-primary/10 blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_25px_rgba(var(--primary-rgb),0.15)]">
            <Shield className="size-7" />
            <span className="absolute -bottom-1 -right-1 flex size-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-3.5 rounded-full border-2 border-background bg-emerald-500" />
            </span>
          </div>

          <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
            Vigilia Command Center
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Accès Propriétaire
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Système autonome de surveillance et de gouvernance IA
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border/80 bg-card/95 shadow-xl backdrop-blur-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base font-semibold">
              Connexion sécurisée
            </CardTitle>
            <CardDescription className="text-xs">
              Veuillez valider vos identifiants pour accéder à la console de commande.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="space-y-1 leading-relaxed">
                  <span className="font-semibold text-destructive">Problème d'authentification :</span>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium">
                  Adresse e-mail
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kayoyolandry@gmail.com"
                    className="h-10 pl-9 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-10 pl-9 pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Afficher ou masquer le mot de passe"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="h-10 w-full gap-2 font-medium shadow-sm transition-all"
              >
                {busy ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Connexion en cours…
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
