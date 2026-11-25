import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Clock,
  Pencil,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  ExternalLink,
  Zap,
  TrendingUp,
  CheckCircle2,
  XCircle,
  RefreshCw,
  BarChart3,
  Globe,
  Timer,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/shell";
import {
  ENV_LABEL,
  IncidentStatus,
  PageHeader,
  SeverityBadge,
  StatusDot,
  fmtDate,
  fmtDuration,
} from "@/components/app/status";
import { pageHead } from "@/lib/workspace/head";
import { deleteRecord, setIncidentStatus } from "@/lib/workspace/integrations.functions";
import { checkMonitor, saveRecord, type Workspace } from "@/lib/workspace/workspace.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/monitoring")({
  head: () =>
    pageHead("Surveillance", "Contrôles HTTP réels protégés SSRF, planification périodique et suivi d'incidents."),
  component: () => <AppShell>{(w, refresh) => <MonitoringView w={w} refresh={refresh} />}</AppShell>,
});

type MonForm = {
  id?: string;
  name: string;
  url: string;
  project_id: string;
  environment: "production" | "staging" | "development";
  http_method: "GET" | "HEAD";
  expected_status: number;
  expected_keyword: string;
  interval_minutes: 1 | 5 | 10 | 15 | 30 | 60;
  timeout_ms: number;
  enabled: boolean;
};

const emptyMon = (): MonForm => ({
  name: "",
  url: "https://",
  project_id: "none",
  environment: "production",
  http_method: "GET",
  expected_status: 200,
  expected_keyword: "",
  interval_minutes: 5,
  timeout_ms: 10000,
  enabled: true,
});

function MonitoringView({ w, refresh }: { w: Workspace; refresh: () => void }) {
  const save = useServerFn(saveRecord);
  const del = useServerFn(deleteRecord);
  const runCheck = useServerFn(checkMonitor);
  const setInc = useServerFn(setIncidentStatus);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [form, setForm] = useState<MonForm>(emptyMon());
  const [selectedMonitor, setSelectedMonitor] = useState<Workspace["monitors"][number] | null>(null);

  // Synchroniser le moniteur sélectionné avec les données à jour
  const activeMonitor = selectedMonitor
    ? w.monitors.find((m) => m.id === selectedMonitor.id) ?? selectedMonitor
    : null;

  function openEdit(m: Workspace["monitors"][number]) {
    setForm({
      id: m.id,
      name: m.name,
      url: m.url,
      project_id: m.project_id ?? "none",
      environment: m.environment as MonForm["environment"],
      http_method: m.http_method === "HEAD" ? "HEAD" : "GET",
      expected_status: m.expected_status,
      expected_keyword: m.expected_keyword ?? "",
      interval_minutes: ([1, 5, 10, 15, 30, 60].includes(m.interval_minutes)
        ? m.interval_minutes
        : 5) as MonForm["interval_minutes"],
      timeout_ms: m.timeout_ms,
      enabled: m.enabled,
    });
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
          kind: "monitor",
          ...(form.id ? { id: form.id } : {}),
          values: {
            name: form.name,
            url: form.url,
            project_id: form.project_id === "none" ? null : form.project_id,
            environment: form.environment,
            http_method: form.http_method,
            expected_status: Number(form.expected_status),
            expected_keyword: form.expected_keyword.trim() || null,
            interval_minutes: form.interval_minutes,
            timeout_ms: Number(form.timeout_ms),
            enabled: form.enabled,
          },
        },
      });
      toast.success(form.id ? "Contrôle mis à jour." : "Contrôle ajouté.");
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "URL refusée ou invalide");
    } finally {
      setBusy(false);
    }
  }

  async function handleCheck(id: string) {
    setCheckingId(id);
    try {
      const r = await runCheck({ data: { id } });
      toast[r.ok ? "success" : "error"](
        r.ok ? `OK — HTTP ${r.status_code} (${r.response_ms} ms)` : r.error ?? "En panne"
      );
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur de contrôle";
      toast.error(msg);
    } finally {
      setCheckingId(null);
    }
  }

  async function handleIncStatus(id: string, status: "open" | "in_progress" | "resolved") {
    try {
      await setInc({ data: { id, status } });
      toast.success("Statut d'incident mis à jour.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleDelete(id: string) {
    try {
      await del({ data: { kind: "monitor", id } });
      toast.success("Contrôle supprimé.");
      if (selectedMonitor?.id === id) setSelectedMonitor(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  const openIncCount = w.incidents.filter((i) => i.status !== "resolved").length;

  // Calculs métriques pour le moniteur sélectionné
  const monChecks = activeMonitor
    ? w.checks.filter((c) => c.monitor_id === activeMonitor.id)
    : [];
  const totalChecks = monChecks.length;
  const upChecksCount = monChecks.filter((c) => c.ok).length;
  const uptimePct = totalChecks > 0 ? Math.round((upChecksCount / totalChecks) * 100) : 100;
  const latencies = monChecks.map((c) => c.response_ms).filter((ms): ms is number => ms != null);
  const avgLatency =
    latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : null;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : null;
  const recentHistory = [...monChecks].reverse().slice(-16);
  const maxChartLatency = Math.max(...latencies, 200);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Surveillance & Incidents"
        sub="Contrôles HTTP publics protégés contre les requêtes internes (SSRF), vérifiés périodiquement."
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-[11px] text-primary">
            <Clock className="size-3.5" />
            Planification active
          </span>
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyMon());
              setOpen(true);
            }}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Plus className="size-3.5" />
            Nouveau contrôle
          </Button>
        </div>
      </PageHeader>

      <Tabs defaultValue="monitors">
        <TabsList className="glass-card border border-border/50 p-1">
          <TabsTrigger
            value="monitors"
            className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
          >
            <Activity className="size-3.5" />
            Contrôles
            <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[11px] text-primary">
              {w.monitors.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="incidents"
            className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
          >
            <ShieldCheck className="size-3.5" />
            Incidents
            <span
              className={`ml-1 rounded-full px-1.5 py-0.5 font-mono text-[11px] ${
                openIncCount > 0
                  ? "bg-destructive/20 text-destructive font-semibold"
                  : "bg-secondary/60 text-muted-foreground"
              }`}
            >
              {openIncCount} ouvert(s)
            </span>
          </TabsTrigger>
        </TabsList>

        {/* ── Liste des Cibles de Surveillance ── */}
        <TabsContent value="monitors" className="mt-5 space-y-3">
          {w.monitors.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl py-14 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                <Activity className="size-6 text-primary/60" />
              </div>
              <p className="text-sm font-medium text-foreground/70">Aucun contrôle HTTP configuré</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Ajoutez un endpoint public pour superviser sa latence et être alerté des coupures en temps réel.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setForm(emptyMon());
                  setOpen(true);
                }}
                className="mt-1 gap-2 bg-gradient-primary text-primary-foreground"
              >
                <Plus className="size-3.5" />
                Ajouter un contrôle
              </Button>
            </div>
          ) : (
            w.monitors.map((m) => (
              <div
                key={m.id}
                className="glass-card group relative rounded-2xl p-4 transition-all hover:border-primary/40 hover:shadow-glow cursor-pointer"
                onClick={() => setSelectedMonitor(m)}
              >
                {/* Ligne lumineuse au survol */}
                <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-primary opacity-0 transition-opacity group-hover:opacity-70" />

                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Zone Cible Cliquable */}
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    <div className="pt-1.5">
                      <StatusDot status={m.enabled ? m.last_status : "disabled"} />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tracking-tight text-foreground text-sm group-hover:text-primary transition-colors">
                          {m.name}
                        </span>
                        <span className="rounded-md border border-border/80 bg-secondary/80 px-2 py-0.5 font-mono text-[11px] font-medium">
                          {m.http_method} {m.expected_status}
                        </span>
                        <span className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {ENV_LABEL[m.environment] ?? m.environment} · {m.interval_minutes} min
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-primary/80 font-mono">
                          <BarChart3 className="size-3" />
                          Voir métriques
                        </span>
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">{m.url}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Dernier contrôle : {fmtDate(m.last_checked_at)}</span>
                        {m.last_response_ms != null && (
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums font-semibold ${
                              m.last_response_ms < 300
                                ? "bg-success/15 text-success"
                                : m.last_response_ms < 800
                                ? "bg-warning/15 text-warning"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {m.last_response_ms} ms
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Boutons d'actions */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={checkingId === m.id}
                      onClick={() => handleCheck(m.id)}
                      className="rounded-xl gap-1.5 text-xs font-semibold"
                    >
                      {checkingId === m.id ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin" />
                          Test…
                        </>
                      ) : (
                        <>
                          <Play className="size-3.5" />
                          Vérifier
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(m)}
                      aria-label="Modifier"
                      className="size-8 p-0"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(m.id)}
                      className="size-8 p-0 text-destructive hover:bg-destructive/10"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* ── Onglet Incidents ── */}
        <TabsContent value="incidents" className="mt-5 space-y-3">
          {w.incidents.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl py-14 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-success/10 ring-1 ring-success/20">
                <ShieldCheck className="size-6 text-success" />
              </div>
              <p className="text-sm font-medium text-foreground">Aucun incident détecté</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Tous vos services surveillés fonctionnent normalement sans interruption ni alerte en cours.
              </p>
            </div>
          ) : (
            w.incidents.map((inc) => (
              <div key={inc.id} className="glass-card rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge s={inc.severity} />
                      <IncidentStatus s={inc.status} />
                      <span className="font-mono text-xs text-muted-foreground">
                        Durée : {fmtDuration(inc.started_at, inc.resolved_at)}
                      </span>
                    </div>
                    <div className="font-semibold tracking-tight text-sm">{inc.title}</div>
                    {inc.description && (
                      <p className="text-xs leading-relaxed text-muted-foreground">{inc.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    {inc.status !== "in_progress" && inc.status !== "resolved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleIncStatus(inc.id, "in_progress")}
                        className="text-xs"
                      >
                        Prendre en charge
                      </Button>
                    )}
                    {inc.status !== "resolved" ? (
                      <Button
                        size="sm"
                        onClick={() => handleIncStatus(inc.id, "resolved")}
                        className="bg-gradient-primary text-primary-foreground text-xs"
                      >
                        Résoudre
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleIncStatus(inc.id, "open")}
                        className="text-xs"
                      >
                        Rouvrir
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ── MODALE MÉTRIQUES & SURVEILLANCE EN TEMPS RÉEL (Clic sur cible) ── */}
      <Dialog open={Boolean(activeMonitor)} onOpenChange={(v) => !v && setSelectedMonitor(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {activeMonitor && (
            <div className="space-y-5">
              {/* En-tête Cible */}
              <DialogHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusDot status={activeMonitor.enabled ? activeMonitor.last_status : "disabled"} />
                      <DialogTitle className="text-xl font-bold">{activeMonitor.name}</DialogTitle>
                      <span className="rounded-full border border-border/60 bg-background/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {ENV_LABEL[activeMonitor.environment] ?? activeMonitor.environment}
                      </span>
                    </div>
                    <a
                      href={activeMonitor.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                    >
                      <Globe className="size-3" />
                      {activeMonitor.url}
                      <ExternalLink className="size-2.5" />
                    </a>
                  </div>

                  <Button
                    size="sm"
                    disabled={checkingId === activeMonitor.id}
                    onClick={() => handleCheck(activeMonitor.id)}
                    className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
                  >
                    {checkingId === activeMonitor.id ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" />
                        Contrôle en cours…
                      </>
                    ) : (
                      <>
                        <Play className="size-3.5" />
                        Tester maintenant
                      </>
                    )}
                  </Button>
                </div>
              </DialogHeader>

              {/* Grille des KPIs en direct */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="glass-card rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 font-mono text-[11px] text-muted-foreground">
                    <TrendingUp className="size-3 text-success" /> Disponibilité
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-success">{uptimePct}%</div>
                  <div className="text-[10px] text-muted-foreground">sur {totalChecks} contrôles</div>
                </div>

                <div className="glass-card rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 font-mono text-[11px] text-muted-foreground">
                    <Timer className="size-3 text-primary" /> Latence actuelle
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-primary">
                    {activeMonitor.last_response_ms != null ? `${activeMonitor.last_response_ms} ms` : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {activeMonitor.last_response_ms == null
                      ? "En attente"
                      : activeMonitor.last_response_ms < 300
                      ? "Excellente"
                      : activeMonitor.last_response_ms < 800
                      ? "Normale"
                      : "Élevée"}
                  </div>
                </div>

                <div className="glass-card rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 font-mono text-[11px] text-muted-foreground">
                    <Activity className="size-3 text-warning" /> Latence moyenne
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-foreground">
                    {avgLatency != null ? `${avgLatency} ms` : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Min: {minLatency ?? "—"} / Max: {maxLatency ?? "—"} ms
                  </div>
                </div>

                <div className="glass-card rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 font-mono text-[11px] text-muted-foreground">
                    <ShieldCheck className="size-3 text-success" /> État HTTP
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-foreground">
                    {activeMonitor.expected_status}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Méthode : {activeMonitor.http_method}
                  </div>
                </div>
              </div>

              {/* Histogramme de Latence en Temps Réel */}
              <div className="glass-card rounded-xl p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider text-foreground/80">
                    <BarChart3 className="size-3.5 text-primary" />
                    Historique de latence (derniers contrôles)
                  </h4>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Toutes les {activeMonitor.interval_minutes} min
                  </span>
                </div>

                {recentHistory.length === 0 ? (
                  <p className="py-6 text-center font-mono text-xs text-muted-foreground">
                    Aucun historique de latence disponible. Cliquez sur &quot;Tester maintenant&quot;.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex h-24 items-end gap-1.5 rounded-lg border border-border/40 bg-background/40 p-2">
                      {recentHistory.map((c) => {
                        const heightPct = Math.max(
                          12,
                          Math.min(100, Math.round(((c.response_ms ?? 50) / maxChartLatency) * 100))
                        );
                        const isFast = (c.response_ms ?? 0) < 300;
                        const isMid = (c.response_ms ?? 0) < 800;
                        const barColor = !c.ok
                          ? "bg-destructive"
                          : isFast
                          ? "bg-success"
                          : isMid
                          ? "bg-warning"
                          : "bg-destructive/80";

                        return (
                          <div
                            key={c.id}
                            className="group/bar relative flex h-full flex-1 items-end"
                            title={`HTTP ${c.status_code} · ${c.response_ms} ms (${fmtDate(c.checked_at)})`}
                          >
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full rounded-t transition-all group-hover/bar:brightness-125 ${barColor}`}
                            />
                            {/* Infobulle hover */}
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-2 py-1 font-mono text-[10px] text-popover-foreground shadow-lg group-hover/bar:block">
                              <div>{c.response_ms} ms</div>
                              <div className="text-muted-foreground">HTTP {c.status_code}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                      <span>Plus ancien</span>
                      <span>Plus récent ({activeMonitor.last_response_ms ?? "—"} ms)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Détails Configuration & Sécurité */}
              <div className="glass-card rounded-xl p-4 text-xs space-y-2.5">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-foreground/80">
                  Paramètres de supervision
                </h4>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground sm:grid-cols-3">
                  <div>
                    <span className="block text-foreground font-medium">Fréquence :</span>
                    Chaque {activeMonitor.interval_minutes} minute(s)
                  </div>
                  <div>
                    <span className="block text-foreground font-medium">Délai d&apos;expiration :</span>
                    {activeMonitor.timeout_ms} ms
                  </div>
                  <div>
                    <span className="block text-foreground font-medium">Protection SSRF :</span>
                    <span className="text-success font-medium">✓ Active (adresses privées bloquées)</span>
                  </div>
                  <div>
                    <span className="block text-foreground font-medium">Mot-clé attendu :</span>
                    {activeMonitor.expected_keyword ? (
                      <code className="font-mono text-primary">{activeMonitor.expected_keyword}</code>
                    ) : (
                      "Aucun"
                    )}
                  </div>
                  <div>
                    <span className="block text-foreground font-medium">Dernier passage :</span>
                    {fmtDate(activeMonitor.last_checked_at)}
                  </div>
                  <div>
                    <span className="block text-foreground font-medium">Contrôle actif :</span>
                    {activeMonitor.enabled ? "Oui" : "Désactivé"}
                  </div>
                </div>
              </div>

              {/* Journal des dernières requêtes */}
              <div>
                <h4 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Dernières vérifications ({monChecks.slice(0, 10).length})
                </h4>
                <div className="glass-card divide-y divide-border/40 rounded-xl overflow-hidden text-xs">
                  {monChecks.length === 0 ? (
                    <p className="py-4 text-center text-muted-foreground">Aucune vérification enregistrée.</p>
                  ) : (
                    monChecks.slice(0, 8).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div className="flex items-center gap-2">
                          {c.ok ? (
                            <CheckCircle2 className="size-3.5 text-success" />
                          ) : (
                            <XCircle className="size-3.5 text-destructive" />
                          )}
                          <span
                            className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
                              c.ok
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-destructive/30 bg-destructive/10 text-destructive"
                            }`}
                          >
                            HTTP {c.status_code ?? "—"}
                          </span>
                          {c.error && (
                            <span className="truncate text-destructive max-w-[200px]">{c.error}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                          {c.response_ms != null && (
                            <span className="font-semibold text-foreground">{c.response_ms} ms</span>
                          )}
                          <span>{fmtDate(c.checked_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialog Formulaire Création/Modification ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifier le contrôle" : "Nouveau contrôle HTTP"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="API Production"
                className="mt-1 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL publique (http/https)</Label>
              <Input
                type="url"
                required
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="mt-1 rounded-xl font-mono"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Méthode</Label>
                <Select
                  value={form.http_method}
                  onValueChange={(v) => setForm({ ...form, http_method: v as "GET" | "HEAD" })}
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="HEAD">HEAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Statut attendu</Label>
                <Input
                  type="number"
                  min={100}
                  max={599}
                  value={form.expected_status}
                  onChange={(e) => setForm({ ...form, expected_status: Number(e.target.value) })}
                  className="mt-1 rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Intervalle (min)</Label>
                <Select
                  value={String(form.interval_minutes)}
                  onValueChange={(v) =>
                    setForm({ ...form, interval_minutes: Number(v) as MonForm["interval_minutes"] })
                  }
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 5, 10, 15, 30, 60].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Mot-clé attendu (optionnel)</Label>
                <Input
                  value={form.expected_keyword}
                  onChange={(e) => setForm({ ...form, expected_keyword: e.target.value })}
                  placeholder="ok"
                  className="mt-1 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Timeout (ms)</Label>
                <Input
                  type="number"
                  min={1000}
                  max={30000}
                  value={form.timeout_ms}
                  onChange={(e) => setForm({ ...form, timeout_ms: Number(e.target.value) })}
                  className="mt-1 rounded-xl font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/30 px-3 py-2.5">
              <Label>Contrôle actif</Label>
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={busy} className="bg-gradient-primary text-primary-foreground">
                {busy ? "Validation…" : "Enregistrer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
