import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Play,
  Plus,
  Pencil,
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
  fetchProviderModels,
  testProvider,
  toggleProvider,
  updateProvider,
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
type ModelOption = { id: string; label: string; desc: string };

const PROVIDER_CONFIG: Record<
  ProviderType,
  {
    name: string;
    defaultLabel: string;
    color: string;
    models: ModelOption[];
    defaultModel: string;
    defaultFallback: string;
  }
> = {
  gemini: {
    name: "Google Gemini",
    defaultLabel: "Google Gemini Principal",
    color: "bg-blue-500/15 ring-blue-500/30 text-blue-400",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", desc: "Recommandé · Ultra-rapide & dernière génération" },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", desc: "Raisonnement avancé & code complexe" },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", desc: "Léger & très économique" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", desc: "Compatibilité standard" },
    ],
    defaultModel: "gemini-3.8-flash",
    defaultFallback: "gemini-3.1-pro-preview",
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
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", desc: "Recommandé · Meilleur modèle code & analyse" },
      { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet", desc: "Raisonnement approfondi" },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", desc: "Vitesse maximale & faible coût" },
    ],
    defaultModel: "claude-sonnet-4-20250514",
    defaultFallback: "claude-3-5-haiku-20241022",
  },
  openrouter: {
    name: "OpenRouter",
    defaultLabel: "OpenRouter Multi-LLM",
    color: "bg-purple-500/15 ring-purple-500/30 text-purple-400",
    models: [
      { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4 (OpenRouter)", desc: "Via passerelle OpenRouter" },
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (OpenRouter)", desc: "Faible latence" },
      { id: "openai/gpt-4o", label: "GPT-4o (OpenRouter)", desc: "Accès universel" },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", desc: "Open-source haute précision" },
    ],
    defaultModel: "anthropic/claude-sonnet-4",
    defaultFallback: "google/gemini-2.5-flash",
  },
};

function detectProviderFromKey(key: string): ProviderType | null {
  const k = key.trim();
  if (k.startsWith("AIza") || k.startsWith("AQ.")) return "gemini";
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("sk-")) return "openai";
  return null;
}

function ProvidersView({ w, refresh }: { w: Workspace; refresh: () => void }) {
  const doAdd = useServerFn(addProvider);
  const doUpdate = useServerFn(updateProvider);
  const doTest = useServerFn(testProvider);
  const doToggle = useServerFn(toggleProvider);
  const doDel = useServerFn(deleteProvider);
  const doFetchModels = useServerFn(fetchProviderModels);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [optimisticEnabled, setOptimisticEnabled] = useState<Record<string, boolean>>({});

  const [provider, setProvider] = useState<ProviderType>("gemini");
  const [label, setLabel] = useState("");
  const [model, setModel] = useState("gemini-3.8-flash");
  const [fallback, setFallback] = useState("gemini-3.1-pro-preview");
  const [secret, setSecret] = useState("");
  const [detectedBadge, setDetectedBadge] = useState<string | null>(null);
  const [keyReady, setKeyReady] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [liveModels, setLiveModels] = useState<ModelOption[] | null>(null);
  const [priority, setPriority] = useState(10);
  const [limit, setLimit] = useState(2000000);
  const [busy, setBusy] = useState(false);

  const activeProviderConfig = PROVIDER_CONFIG[provider];
  const availableModels: ModelOption[] = liveModels && liveModels.length > 0 ? liveModels : activeProviderConfig.models;

  async function loadModelsForKey(targetProvider: ProviderType, keyValue?: string, providerId?: string) {
    setLoadingModels(true);
    try {
      const res = await doFetchModels({
        data: {
          provider: targetProvider,
          ...(keyValue ? { secret: keyValue } : {}),
          ...(providerId ? { providerId } : {}),
        },
      });
      if (res.live && res.models.length > 0) {
        setLiveModels(res.models);
        // Garder le modèle sélectionné s'il est dans la liste, sinon choisir le premier recommandé
        setModel((prev) => (res.models.some((m) => m.id === prev) ? prev : res.models[0]!.id));
        setFallback((prev) =>
          res.models.some((m) => m.id === prev)
            ? prev
            : (res.models[1]?.id ?? res.models[0]!.id),
        );
        setDetectedBadge(`${res.models.length} modèle(s) vérifiés chargés depuis ${PROVIDER_CONFIG[targetProvider].name}.`);
      } else {
        setLiveModels(null);
      }
    } catch {
      setLiveModels(null);
    } finally {
      setLoadingModels(false);
    }
  }

  function handleProviderChange(p: ProviderType) {
    setProvider(p);
    setLiveModels(null);
    const cfg = PROVIDER_CONFIG[p];
    if (!editingId && (!label || Object.values(PROVIDER_CONFIG).some((c) => c.defaultLabel === label))) {
      setLabel(cfg.defaultLabel);
    }
    setModel(cfg.defaultModel);
    setFallback(cfg.defaultFallback);
    if (secret.trim().length >= 12) {
      void loadModelsForKey(p, secret.trim());
    }
  }

  function handleSecretChange(val: string) {
    setSecret(val);
    const trimmed = val.trim();
    const ready = trimmed.length >= 12 || Boolean(editingId);
    setKeyReady(ready);
    const detected = detectProviderFromKey(trimmed);
    if (detected) {
      const cfg = PROVIDER_CONFIG[detected];
      setProvider(detected);
      if (!editingId) setLabel(cfg.defaultLabel);
      setModel(cfg.defaultModel);
      setFallback(cfg.defaultFallback);
      setDetectedBadge(`Clé ${cfg.name} reconnue — chargement des modèles disponibles…`);
      void loadModelsForKey(detected, trimmed);
    } else if (trimmed.length >= 12) {
      setDetectedBadge(null);
      void loadModelsForKey(provider, trimmed);
    } else {
      setDetectedBadge(null);
      setLiveModels(null);
    }
  }

  function handleOpenCreate() {
    setEditingId(null);
    setProvider("gemini");
    setLabel(PROVIDER_CONFIG.gemini.defaultLabel);
    setModel(PROVIDER_CONFIG.gemini.defaultModel);
    setFallback(PROVIDER_CONFIG.gemini.defaultFallback);
    setSecret("");
    setDetectedBadge(null);
    setLiveModels(null);
    setKeyReady(false);
    setPriority(10);
    setLimit(2000000);
    setOpen(true);
  }

  function handleOpenEdit(p: Workspace["providers"][number]) {
    const prov = (["openai", "gemini", "anthropic", "openrouter"].includes(p.provider)
      ? p.provider
      : "gemini") as ProviderType;
    setEditingId(p.id);
    setProvider(prov);
    setLabel(p.label);
    setModel(p.model_default);
    setFallback(p.fallback_model ?? PROVIDER_CONFIG[prov].defaultFallback);
    setSecret("");
    setDetectedBadge("Modification du fournisseur (laissez la clé vide pour conserver l'actuelle).");
    setLiveModels(null);
    setKeyReady(true);
    setPriority(p.priority);
    setLimit(p.monthly_token_limit);
    setOpen(true);
    void loadModelsForKey(prov, undefined, p.id);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId && !secret.trim()) {
      toast.error("Veuillez saisir votre clé API.");
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await doUpdate({
          data: {
            id: editingId,
            label: label.trim() || activeProviderConfig.defaultLabel,
            model_default: model,
            fallback_model: fallback.trim() || null,
            priority: Number(priority),
            monthly_token_limit: Number(limit),
            ...(secret.trim().length >= 12 ? { secret: secret.trim() } : {}),
          },
        });
        toast.success("Fournisseur et modèle mis à jour.");
      } else {
        await doAdd({
          data: {
            provider,
            label: label.trim() || activeProviderConfig.defaultLabel,
            model_default: model,
            fallback_model: fallback.trim() || null,
            secret: secret.trim(),
            shared_quota_group: null,
            priority: Number(priority),
            monthly_token_limit: Number(limit),
          },
        });
        toast.success("Fournisseur ajouté avec succès (chiffré AES-256-GCM).");
      }
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      await doTest({ data: { id } });
      toast.success("Fournisseur testé avec succès et activé !");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test échoué");
      refresh();
    } finally {
      setTestingId(null);
    }
  }

  async function handleToggle(p: Workspace["providers"][number], nextEnabled: boolean) {
    setTogglingId(p.id);
    setOptimisticEnabled((prev) => ({ ...prev, [p.id]: nextEnabled }));
    try {
      await doToggle({ data: { id: p.id, enabled: nextEnabled } });
      toast.success(nextEnabled ? `${p.label} activé.` : `${p.label} désactivé.`);
      refresh();
    } catch (err) {
      setOptimisticEnabled((prev) => ({ ...prev, [p.id]: p.enabled }));
      toast.error(err instanceof Error ? err.message : "Impossible de modifier le statut");
    } finally {
      setTogglingId(null);
    }
  }

  // Assurer que les modèles actuellement sélectionnés apparaissent toujours dans la liste même s'ils ne sont plus dans le catalogue
  const ensureModelInList = (id: string, list: ModelOption[]) =>
    id && !list.some((m) => m.id === id)
      ? [{ id, label: id, desc: "Modèle configuré actuellement" }, ...list]
      : list;

  const modelChoices = ensureModelInList(model, availableModels);
  const fallbackChoices = ensureModelInList(fallback, availableModels);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fournisseurs IA & Routage"
        sub="Routage direct par vos propres clés API, gestion des quotas et bascule automatique en cas de panne."
      >
        <Button
          size="sm"
          onClick={handleOpenCreate}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <Plus className="size-3.5" />
          Ajouter une clé IA
        </Button>
      </PageHeader>

      {w.providers.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Cpu className="size-6 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-foreground">Aucun fournisseur IA configuré</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Collez votre clé API (Gemini, OpenAI, Anthropic ou OpenRouter). Vigilia détecte automatiquement le
            fournisseur et charge les modèles compatibles avec votre clé.
          </p>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="mt-1 gap-2 bg-gradient-primary text-primary-foreground"
          >
            <Plus className="size-3.5" />
            Configurer ma première clé
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {w.providers.map((p) => {
            const isEnabled = optimisticEnabled[p.id] ?? p.enabled;
            const pct = Math.min(100, Math.round((p.tokens_used / Math.max(1, p.monthly_token_limit)) * 100));
            const cfg = PROVIDER_CONFIG[p.provider as ProviderType] ?? {
              name: p.provider,
              color: "bg-muted/30 ring-border text-muted-foreground",
            };
            const statusColor = !isEnabled
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
                        <StatusDot status={isEnabled ? p.status : "disabled"} />
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEdit(p)}
                      className="gap-1.5 text-xs rounded-xl"
                      title="Modifier le modèle ou les paramètres"
                    >
                      <Pencil className="size-3" />
                      Modifier
                    </Button>
                    <div className="flex items-center px-1">
                      <Switch
                        checked={isEnabled}
                        disabled={togglingId === p.id}
                        onCheckedChange={(v) => handleToggle(p, v)}
                        aria-label={`Activer ${p.label}`}
                      />
                    </div>
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

                {/* Jauge de quota */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
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
                    <span className="flex-1">{p.last_error_message}</span>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(p)}
                      className="shrink-0 font-mono text-[11px] underline hover:text-foreground"
                    >
                      Changer de modèle
                    </button>
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

      {/* ── MODALE AJOUT / MODIFICATION FOURNISSEUR IA ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              {editingId ? "Modifier le fournisseur & les modèles" : "Configurer une clé IA"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-1">
            {/* ── ÉTAPE 1 : Clé API ── */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                {editingId ? "Clé API (optionnel — laisser vide pour conserver)" : "1. Clé API"}{" "}
                {!editingId && (
                  <span className="text-primary font-normal">
                    — collez votre clé pour charger les modèles
                  </span>
                )}
              </Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  type="password"
                  required={!editingId}
                  value={secret}
                  onChange={(e) => handleSecretChange(e.target.value)}
                  className="rounded-xl border-border/80 bg-background/65 pl-10 font-mono text-xs placeholder:text-muted-foreground/50"
                  placeholder={
                    editingId
                      ? "•••••••••••••••• (nouvelle clé pour remplacer)"
                      : "AIzaSy... / AQ.Ab... (Gemini) · sk-... (OpenAI / Claude)"
                  }
                  autoComplete="off"
                  autoFocus={!editingId}
                />
              </div>
              {loadingModels ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 font-mono text-[11px] text-primary">
                  <RefreshCw className="size-3.5 shrink-0 animate-spin" />
                  Interrogation de l&apos;API pour charger les modèles disponibles…
                </div>
              ) : detectedBadge ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5 font-mono text-[11px] text-success">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  {detectedBadge}
                </div>
              ) : !keyReady ? (
                <p className="text-[11px] text-muted-foreground">
                  Les modèles compatibles s&apos;affichent dès que la clé est saisie. Chiffrée AES-256-GCM côté serveur.
                </p>
              ) : (
                <p className="text-[11px] text-warning">
                  Préfixe non reconnu — sélectionnez le fournisseur manuellement ci-dessous.
                </p>
              )}
            </div>

            {/* ── ÉTAPE 2 : Config & Modèles (visible dès que clé prête ou en édition) ── */}
            {keyReady && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Fournisseur</Label>
                    <Select
                      value={provider}
                      disabled={Boolean(editingId)}
                      onValueChange={(v) => handleProviderChange(v as ProviderType)}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini">Google Gemini (AIza / AQ.)</SelectItem>
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
                  </div>
                </div>

                {/* Libellé */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nom / Libellé</Label>
                  <Input
                    required
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="rounded-xl text-xs"
                    placeholder="Ex: Google Gemini Principal"
                  />
                </div>

                {/* Modèle principal */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Modèle principal</Label>
                    <button
                      type="button"
                      disabled={loadingModels}
                      onClick={() =>
                        loadModelsForKey(provider, secret.trim() || undefined, editingId ?? undefined)
                      }
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
                    >
                      <RefreshCw className={`size-2.5 ${loadingModels ? "animate-spin" : ""}`} />
                      Actualiser la liste
                    </button>
                  </div>
                  <Select value={model} onValueChange={(v) => setModel(v)}>
                    <SelectTrigger className="rounded-xl font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {modelChoices.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                          <div className="flex flex-col py-0.5">
                            <span className="font-semibold text-foreground">{m.id}</span>
                            <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Modèle de secours */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Modèle de secours (Failover)</Label>
                  <Select value={fallback} onValueChange={(v) => setFallback(v)}>
                    <SelectTrigger className="rounded-xl font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {fallbackChoices.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                          {m.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Limite mensuelle */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Limite mensuelle de jetons</Label>
                  <Input
                    type="number"
                    min={1000}
                    max={10000000}
                    step={1000}
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="rounded-xl font-mono text-xs"
                  />
                </div>
              </>
            )}

            {/* Boutons d'action */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={busy || (!editingId && !secret.trim()) || !keyReady}
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
                    {editingId
                      ? "Enregistrer les modifications"
                      : keyReady
                      ? "Ajouter le fournisseur"
                      : "Collez d'abord votre clé…"}
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
