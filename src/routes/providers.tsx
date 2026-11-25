import { useState } from "react";
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
  head: () => pageHead("Fournisseurs IA", "Routage multi-fournisseurs, quotas, circuit breaker et bascule automatique."),
  component: () => <AppShell>{(w, refresh) => <ProvidersView w={w} refresh={refresh} />}</AppShell>,
});

const PROVIDER_LOGOS: Record<string, { label: string; color: string }> = {
  openai: { label: "OpenAI", color: "bg-[#10a37f]/15 ring-[#10a37f]/30 text-[#10a37f]" },
  gemini: { label: "Gemini", color: "bg-blue-500/15 ring-blue-500/30 text-blue-400" },
  anthropic: { label: "Anthropic", color: "bg-orange-500/15 ring-orange-500/30 text-orange-400" },
  openrouter: { label: "OpenRouter", color: "bg-purple-500/15 ring-purple-500/30 text-purple-400" },
  lovable_gateway: { label: "Lovable Gateway", color: "bg-primary/15 ring-primary/30 text-primary" },
};

function ProvidersView({ w, refresh }: { w: Workspace; refresh: () => void }) {
  const doAdd = useServerFn(addProvider);
  const doTest = useServerFn(testProvider);
  const doToggle = useServerFn(toggleProvider);
  const doDel = useServerFn(deleteProvider);

  const [open, setOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [provider, setProvider] = useState<"openai" | "gemini" | "anthropic" | "openrouter">("openai");
  const [label, setLabel] = useState("");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [fallback, setFallback] = useState("");
  const [secret, setSecret] = useState("");
  const [priority, setPriority] = useState(10);
  const [limit, setLimit] = useState(1000000);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await doAdd({
        data: {
          provider,
          label,
          model_default: model,
          fallback_model: fallback.trim() || null,
          secret: secret.trim(),
          shared_quota_group: null,
          priority: Number(priority),
          monthly_token_limit: Number(limit),
        },
      });
      toast.success("Fournisseur ajouté (désactivé jusqu'au premier test réussi).");
      setLabel("");
      setSecret("");
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'ajout");
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      await doTest({ data: { id } });
      toast.success("Fournisseur testé et activé.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test échoué");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fournisseurs IA & Bascule"
        sub="Ordre de priorité, suivi des jetons et circuit breaker automatique (pas de bascule sur erreur de prompt)."
      >
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <Plus className="size-3.5" />
          Ajouter une clé IA
        </Button>
      </PageHeader>

      {/* Liste fournisseurs */}
      {w.providers.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Cpu className="size-6 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-foreground/70">Aucun fournisseur IA configuré</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Ajoutez votre première clé API pour permettre à Vigilia Lead de générer des réponses IA.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {w.providers.map((p) => {
            const pct = Math.min(100, Math.round((p.tokens_used / Math.max(1, p.monthly_token_limit)) * 100));
            const style = PROVIDER_LOGOS[p.provider] ?? { label: p.provider, color: "bg-muted/30 ring-border text-muted-foreground" };
            const statusColor =
              !p.enabled ? "bg-muted-foreground/30" :
              pct >= 90 ? "bg-destructive" :
              pct >= 70 ? "bg-warning" :
              "bg-success";

            return (
              <div key={p.id} className="glass-card group rounded-2xl p-4 transition-all hover:border-primary/30">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Provider badge */}
                    <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 font-bold text-xs ${style.color}`}>
                      {style.label.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusDot status={p.enabled ? p.status : "disabled"} />
                        <span className="font-semibold text-sm">{p.label}</span>
                        <span className="rounded-full border border-border/50 bg-background/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                          P{p.priority} · {p.provider}
                        </span>
                        {p.key_fingerprint && (
                          <span className="font-mono text-[11px] text-muted-foreground">{p.key_fingerprint}</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                        <span>{p.model_default}</span>
                        {p.fallback_model && (
                          <>
                            <ArrowRight className="size-3" />
                            <span>{p.fallback_model}</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="text-success">{p.requests_count} req.</span>
                        {p.errors_count > 0 && (
                          <span className="text-destructive">{p.errors_count} err.</span>
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
                      className="gap-1.5 text-xs"
                    >
                      {testingId === p.id ? (
                        <><RefreshCw className="size-3 animate-spin" /> Test…</>
                      ) : (
                        <><Play className="size-3" /> Tester</>
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
                    {p.provider !== "lovable_gateway" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await doDel({ data: { id: p.id } });
                          toast.success("Clé supprimée.");
                          refresh();
                        }}
                        className="size-7 p-0 text-destructive opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Quota bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="size-3" />
                      {p.tokens_used.toLocaleString("fr-FR")} / {p.monthly_token_limit.toLocaleString("fr-FR")} jetons
                    </span>
                    <span className={pct >= 90 ? "text-destructive font-semibold" : pct >= 70 ? "text-warning" : ""}>
                      {pct}% · {fmtDate(p.last_used_at)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40">
                    <div
                      className={`h-full rounded-full transition-all ${statusColor}`}
                      style={{ width: `${pct}%` }}
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

      {/* Historique bascules */}
      <div className="glass-card rounded-2xl">
        <div className="flex items-center gap-2.5 border-b border-border/40 px-5 py-3.5">
          <Zap className="size-4 text-warning" />
          <h3 className="font-semibold text-sm">Historique des bascules IA</h3>
          <span className="ml-auto rounded-full bg-secondary/60 px-2 py-0.5 font-mono text-[11px]">
            {w.failovers.length}
          </span>
        </div>
        {w.failovers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCircle2 className="size-8 text-success/50" />
            <p className="text-sm text-muted-foreground">Aucune erreur ou bascule fournisseur enregistrée.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {w.failovers.slice(0, 15).map((f) => (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-xs">
                <span className="font-mono text-warning">{f.error_type}</span>
                <span className="flex-1 truncate text-muted-foreground">{f.message}</span>
                <span className="font-mono text-muted-foreground">
                  {f.switched ? "✓ Basculé" : "✗ Arrêté"} · {fmtDate(f.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog ajout fournisseur */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un fournisseur IA externe</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium">Fournisseur</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium">Priorité (1 = plus haute)</Label>
                <Input type="number" min={1} max={100} value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="mt-1 rounded-xl" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Nom / libellé</Label>
              <Input required value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 rounded-xl" placeholder="OpenAI Secours" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium">Modèle principal</Label>
                <Input required value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 rounded-xl font-mono" />
              </div>
              <div>
                <Label className="text-xs font-medium">Modèle de secours</Label>
                <Input value={fallback} onChange={(e) => setFallback(e.target.value)} className="mt-1 rounded-xl font-mono" placeholder="Optionnel" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Clé API</Label>
              <Input type="password" required value={secret} onChange={(e) => setSecret(e.target.value)} className="mt-1 rounded-xl font-mono" placeholder="sk-…" />
              <p className="mt-1 text-[11px] text-muted-foreground">Chiffrée AES-256-GCM · jamais renvoyée au navigateur.</p>
            </div>
            <div>
              <Label className="text-xs font-medium">Limite mensuelle de jetons</Label>
              <Input type="number" min={1000} max={10000000} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="mt-1 rounded-xl" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" className="bg-gradient-primary text-primary-foreground">Ajouter</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
