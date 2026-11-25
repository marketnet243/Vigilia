import { useState, useId } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Play,
  Plus,
  Trash2,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Cpu,
  Sparkles,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/shell";
import { PageHeader, StatusDot, fmtDate } from "@/components/app/status";
import { pageHead } from "@/lib/workspace/head";
import {
  addProvider,
  deleteProvider,
  testProvider,
  toggleProvider,
  type Workspace,
} from "@/lib/workspace/workspace.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/providers")({
  head: () =>
    pageHead("Fournisseurs IA", "Routage multi-fournisseurs, quotas, circuit breaker et bascule automatique."),
  component: () => <AppShell>{(w, refresh) => <ProvidersView w={w} refresh={refresh} />}</AppShell>,
});

type ProviderType = "openai" | "gemini" | "anthropic" | "openrouter";

const PROVIDER_CONFIG: Record<
  ProviderType,
  {
    name: string;
    defaultLabel: string;
    color: string;
    models: { id: string; label: string; desc: string }[];
    defaultModel: string;
    defaultFallback: string;
  }
> = {
  gemini: {
    name: "Google Gemini",
    defaultLabel: "Google Gemini Principal",
    color: "bg-blue-500/15 ring-blue-500/30 text-blue-400",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "Recommandé · Ultra-rapide & performant" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", desc: "Raisonnement avancé & code complexe" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", desc: "Léger & très économique" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", desc: "Grande fenêtre de contexte" },
    ],
    defaultModel: "gemini-2.5-flash",
    defaultFallback: "gemini-2.5-pro",
  },
  openai: {
    name: "OpenAI",
    defaultLabel: "OpenAI GPT-4o",
    color: "bg-[#10a37f]/15 ring-[#10a37f]/30 text-[#10a37f]",
    models: [
      { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", desc: "Recommandé · Équilibré & rapide" },
      { id: "gpt-4o", label: "GPT-4o", desc: "Capacités de pointe & vision" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini", desc: "Économique & réactif" },
      { id: "o1-mini", label: "o1 Mini", desc: "Spécialisé logique & programmation" },
    ],
    defaultModel: "gpt-4.1-mini",
    defaultFallback: "gpt-4o-mini",
  },
  anthropic: {
    name: "Anthropic Claude",
    defaultLabel: "Anthropic Claude",
    color: "bg-orange-500/15 ring-orange-500/30 text-orange-400",
    models: [
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", desc: "Recommandé · Meilleur modèle code" },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", desc: "Vitesse maximale & faible coût" },
      { id: "claude-3-opus-20240229", label: "Claude 3 Opus", desc: "Analyse dense & tâches complexes" },
    ],
    defaultModel: "claude-3-5-sonnet-20241022",
    defaultFallback: "claude-3-5-haiku-20241022",
  },
  openrouter: {
    name: "OpenRouter",
    defaultLabel: "OpenRouter Multi-LLM",
    color: "bg-purple-500/15 ring-purple-500/30 text-purple-400",
    models: [
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (OpenRouter)", desc: "Via passerelle OpenRouter" },
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (OpenRouter)", desc: "Faible latence" },
      { id: "openai/gpt-4o", label: "GPT-4o (OpenRouter)", desc: "Accès universel" },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", desc: "Open-source haute précision" },
    ],
    defaultModel: "anthropic/claude-3.5-sonnet",
    defaultFallback: "google/gemini-2.5-flash",
  },
};

function detectProviderFromKey(key: string): ProviderType | null {
  const k = key.trim();
  if (k.startsWith("AIza")) return "gemini";
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("sk-")) return "openai";
  return null;
}

function ProvidersView({ w, refresh }: { w: Workspace; refresh: () => void }) {
  const doAdd = useServerFn(addProvider);
  const doTest = useServerFn(testProvider);
  const doToggle = useServerFn(toggleProvider);
  const doDel = useServerFn(deleteProvider);

  const [open, setOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderType>("gemini");
  const [label, setLabel] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [fallback, setFallback] = useState("gemini-2.5-pro");
  const [secret, setSecret] = useState("");
  const [detectedBadge, setDetectedBadge] = useState<string | null>(null);
  const [priority, setPriority] = useState(10);
  const [limit, setLimit] = useState(2000000);
  const [busy, setBusy] = useState(false);

  // Mise à jour du fournisseur avec adaptation des modèles
  function handleProviderChange(p: ProviderType) {
    setProvider(p);
    const cfg = PROVIDER_CONFIG[p];
    if (!label || Object.values(PROVIDER_CONFIG).some((c) => c.defaultLabel === label)) {
      setLabel(cfg.defaultLabel);
    }
    setModel(cfg.defaultModel);
    setFallback(cfg.defaultFallback);
  }

  // Détection automatique lors de la saisie / collage de la clé API
  function handleSecretChange(val: string) {
    setSecret(val);
    const detected = detectProviderFromKey(val);
    if (detected) {
      const cfg = PROVIDER_CONFIG[detected];
      setProvider(detected);
      setLabel(cfg.defaultLabel);
      setModel(cfg.defaultModel);
      setFallback(cfg.defaultFallback);
      setDetectedBadge(`Clé ${cfg.name} reconnue automatiquement ! Modèles pré-configurés.`);
      toast.success(`Clé ${cfg.name} détectée : modèles configurés.`);
    } else {
      setDetectedBadge(null);
    }
  }

  function handleOpenDialog() {
    setProvider("gemini");
    setLabel(PROVIDER_CONFIG.gemini.defaultLabel);
    setModel(PROVIDER_CONFIG.gemini.defaultModel);
    setFallback(PROVIDER_CONFIG.gemini.defaultFallback);
    setSecret("");
    setDetectedBadge(null);
    setPriority(10);
    setLimit(2000000);
    setOpen(true);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) {
      toast.error("Veuillez saisir votre clé API.");
      return;
    }
    setBusy(true);
    try {
      await doAdd({
        data: {
          provider,
          label: label.trim() || PROVIDER_CONFIG[provider].defaultLabel,
          model_default: model,
          fallback_model: fallback.trim() || null,
          secret: secret.trim(),
          shared_quota_group: null,
          priority: Number(priority),
          monthly_token_limit: Number(limit),
        },
      });
      toast.success("Fournisseur ajouté avec succès (chiffré AES-256-GCM).");
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'ajout");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      await doTest({ data: { id } });
      toast.success("Fournisseur testé avec succès et activé.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test échoué");
    } finally {
      setTestingId(null);
    }
  }

  const activeProviderConfig = PROVIDER_CONFIG[provider];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fournisseurs IA & Routage"
        sub="Routage direct par vos propres clés API, gestion des quotas et bascule automatique en cas de panne."
      >
        <Button
          size="sm"
          onClick={handleOpenDialog}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <Plus className="size-3.5" />
          Ajouter une clé IA
        </Button>
      </PageHeader>

      {/* Liste des fournisseurs configurés */}
      {w.providers.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Cpu className="size-6 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-foreground">Aucun fournisseur IA configuré</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Collez votre clé API (Gemini, OpenAI, Anthropic ou OpenRouter). Vigilia détecte automatiquement le
            fournisseur et sélectionne les meilleurs modèles.
          </p>
          <Button
            size="sm"
            onClick={handleOpenDialog}
            className="mt-1 gap-2 bg-gradient-primary text-primary-foreground"
          >
            <Plus className="size-3.5" />
            Configurer ma première clé
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {w.providers.map((p) => {
            const pct = Math.min(100, Math.round((p.tokens_used / Math.max(1, p.monthly_token_limit)) * 100));
            const cfg = PROVIDER_CONFIG[p.provider as ProviderType] ?? {
              name: p.provider,
              color: "bg-muted/30 ring-border text-muted-foreground",
            };
            const statusColor = !p.enabled
              ? "bg-muted-foreground/30"
              : pct >= 90
              ? "bg-destructive"
              : pct >= 70
              ? "bg-warning"
              : "bg-success";

            return (
              <div
                key={p.id}
                className="glass-card group rounded-2xl p-4 transition-all hover:border-primary/30 hover:shadow-glow"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 font-bold text-xs ${cfg.color}`}
                    >
                      {cfg.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusDot status={p.enabled ? p.status : "disabled"} />
                        <span className="font-semibold text-sm">{p.label}</span>
                        <span className="rounded-full border border-border/50 bg-background/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                          Priorité {p.priority} · {cfg.name}
                        </span>
                        {p.key_fingerprint && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {p.key_fingerprint}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                        <span className="text-foreground/90 font-medium">{p.model_default}</span>
                        {p.fallback_model && (
                          <>
                            <ArrowRight className="size-3 text-muted-foreground/60" />
                            <span>Secours : {p.fallback_model}</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="text-success">{p.requests_count} requête(s)</span>
                        {p.errors_count > 0 && (
                          <span className="text-destructive font-semibold">· {p.errors_count} erreur(s)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={testingId === p.id}
                      onClick={() => handleTest(p.id)}
                      className="gap-1.5 text-xs font-semibold rounded-xl"
                    >
                      {testingId === p.id ? (
                        <>
                          <RefreshCw className="size-3 animate-spin" /> Tester…
                        </>
                      ) : (
                        <>
                          <Play className="size-3 text-primary" /> Tester
                        </>
                      )}
                    </Button>
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={async (v) => {
                        await doToggle({ data: { id: p.id, enabled: v } });
                        refresh();
                      }}
                      aria-label={`Activer ${p.label}`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await doDel({ data: { id: p.id } });
                        toast.success("Fournisseur supprimé.");
                        refresh();
                      }}
                      className="size-8 p-0 text-destructive hover:bg-destructive/10"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Barre de quota mensuel */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="size-3" />
                      Quota : {p.tokens_used.toLocaleString("fr-FR")} /{" "}
                      {p.monthly_token_limit.toLocaleString("fr-FR")} jetons
                    </span>
                    <span className={pct >= 90 ? "text-destructive font-semibold" : pct >= 70 ? "text-warning" : ""}>
                      {pct}% · {fmtDate(p.last_used_at)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40">
                    <div
                      className={`h-full rounded-full transition-all ${statusColor}`}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                </div>

                {p.last_error_message && (
                  <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                    {p.last_error_message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Historique des bascules IA */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border/40 px-5 py-3.5">
          <Zap className="size-4 text-warning" />
          <h3 className="font-semibold text-sm">Circuit Breaker & Bascules IA</h3>
          <span className="ml-auto rounded-full bg-secondary/60 px-2 py-0.5 font-mono text-[11px]">
            {w.failovers.length}
          </span>
        </div>
        {w.failovers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCircle2 className="size-8 text-success/50" />
            <p className="text-sm text-muted-foreground">Aucune coupure ni erreur de fournisseur enregistrée.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {w.failovers.slice(0, 15).map((f) => (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-xs">
                <span className="font-mono text-warning font-semibold">{f.error_type}</span>
                <span className="flex-1 truncate text-muted-foreground">{f.message}</span>
                <span className="font-mono text-muted-foreground">
                  {f.switched ? "✓ Basculé sur secours" : "✗ Arrêté"} · {fmtDate(f.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODALE PROPRE ET INTELLIGENTE : AJOUT FOURNISSEUR IA ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Configurer une clé IA
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAdd} className="space-y-4 pt-1">
            {/* Champ Clé API avec auto-détection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Clé API <span className="text-primary font-normal">(Collez votre clé pour auto-détection)</span>
              </Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  type="password"
                  required
                  value={secret}
                  onChange={(e) => handleSecretChange(e.target.value)}
                  className="rounded-xl border-border/80 bg-background/65 pl-10 font-mono text-xs placeholder:text-muted-foreground/50"
                  placeholder="AIzaSy... (Gemini) ou sk-... (OpenAI / Claude)"
                  autoComplete="off"
                />
              </div>
              {detectedBadge ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5 font-mono text-[11px] text-success animate-rise">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  {detectedBadge}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Chiffrée en AES-256-GCM côté serveur · Jamais renvoyée au navigateur.
                </p>
              )}
            </div>

            {/* Sélection Fournisseur & Priorité */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Fournisseur</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => handleProviderChange(v as ProviderType)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Google Gemini (AIza...)</SelectItem>
                    <SelectItem value="openai">OpenAI (sk-...)</SelectItem>
                    <SelectItem value="anthropic">Anthropic Claude (sk-ant-...)</SelectItem>
                    <SelectItem value="openrouter">OpenRouter (sk-or-...)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Priorité de routage</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="rounded-xl font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">1 = Priorité la plus haute</p>
              </div>
            </div>

            {/* Libellé */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nom / Libellé d&apos;identification</Label>
              <Input
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="rounded-xl text-xs"
                placeholder="Ex: Gemini 2.5 Flash Principal"
              />
            </div>

            {/* Modèle Principal (Liste dynamique intelligente) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Modèle principal</Label>
                <span className="font-mono text-[10px] text-primary">{activeProviderConfig.name}</span>
              </div>
              <Select value={model} onValueChange={(v) => setModel(v)}>
                <SelectTrigger className="rounded-xl font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeProviderConfig.models.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                      <div className="flex flex-col py-0.5">
                        <span className="font-semibold text-foreground">{m.label}</span>
                        <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Modèle de Secours */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Modèle de secours (Failover)</Label>
              <Select value={fallback} onValueChange={(v) => setFallback(v)}>
                <SelectTrigger className="rounded-xl font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeProviderConfig.models.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Limite mensuelle de jetons */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Limite mensuelle de jetons (Sécurité budget)</Label>
              <Input
                type="number"
                min={1000}
                max={50000000}
                step={50000}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="rounded-xl font-mono text-xs"
              />
            </div>

            {/* Boutons d'action */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={busy || !secret.trim()}
                className="gap-2 bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
              >
                {busy ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" />
                    Ajouter le fournisseur
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
