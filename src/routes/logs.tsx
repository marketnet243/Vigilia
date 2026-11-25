import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/shell";
import { PageHeader, StatusDot, fmtDate } from "@/components/app/status";
import { pageHead } from "@/lib/workspace/head";
import type { Workspace } from "@/lib/workspace/workspace.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Activity,
  MessageSquare,
  CheckCircle2,
  XCircle,
  User,
  Bot,
  Cpu,
  Shield,
} from "lucide-react";

export const Route = createFileRoute("/logs")({
  head: () => pageHead("Journaux", "Journal d'audit complet, historique des contrôles HTTP et bascules IA."),
  component: () => <AppShell>{(w) => <LogsView w={w} />}</AppShell>,
});

const ACTOR_ICONS: Record<string, React.ReactNode> = {
  user: <User className="size-3" />,
  agent: <Bot className="size-3" />,
  telegram: <MessageSquare className="size-3" />,
  system: <Cpu className="size-3" />,
};

const ACTOR_COLORS: Record<string, string> = {
  user: "bg-primary/15 text-primary border-primary/30",
  agent: "bg-success/15 text-success border-success/30",
  telegram: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  system: "bg-muted/50 text-muted-foreground border-border",
};

function LogsView({ w }: { w: Workspace }) {
  const [actorFilter, setActorFilter] = useState<string>("all");
  const monById = new Map(w.monitors.map((m) => [m.id, m.name]));
  const filteredAudit = actorFilter === "all" ? w.logs : w.logs.filter((l) => l.actor_type === actorFilter);

  const actorFilters = [
    { key: "all", label: "Tous", icon: <FileText className="size-3" /> },
    { key: "user", label: "User", icon: <User className="size-3" /> },
    { key: "agent", label: "Agent", icon: <Bot className="size-3" /> },
    { key: "telegram", label: "Telegram", icon: <MessageSquare className="size-3" /> },
    { key: "system", label: "Système", icon: <Cpu className="size-3" /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journaux & Traçabilité"
        sub="Audit des décisions, exécutions d'agents, vérifications HTTP et événements Telegram."
      />

      <Tabs defaultValue="audit">
        <TabsList className="glass-card border border-border/50 p-1">
          <TabsTrigger value="audit" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Shield className="size-3.5" />
            Audit
            <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[11px] text-primary">{w.logs.length}</span>
          </TabsTrigger>
          <TabsTrigger value="checks" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Activity className="size-3.5" />
            Contrôles HTTP
            <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[11px] text-primary">{w.checks.length}</span>
          </TabsTrigger>
          <TabsTrigger value="telegram" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <MessageSquare className="size-3.5" />
            Telegram
            <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[11px] text-primary">{w.telegramMessages.length}</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Onglet Audit ── */}
        <TabsContent value="audit" className="mt-5 space-y-4">
          {/* Filtres acteur */}
          <div className="flex flex-wrap gap-1.5">
            {actorFilters.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActorFilter(key)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-xs transition-all ${
                  actorFilter === key
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border/60 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          <div className="glass-card rounded-2xl overflow-hidden">
            {filteredAudit.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted/30 ring-1 ring-border">
                  <FileText className="size-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">Aucune entrée d'audit pour ce filtre.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filteredAudit.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs transition-colors hover:bg-primary/5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] ${ACTOR_COLORS[l.actor_type] ?? ACTOR_COLORS.system}`}>
                        {ACTOR_ICONS[l.actor_type] ?? <Cpu className="size-3" />}
                        {l.actor_type}
                      </span>
                      <span className="font-medium text-foreground">{l.action}</span>
                      <span className="truncate text-muted-foreground">par {l.actor_name}</span>
                    </div>
                    <span className="font-mono text-muted-foreground">{fmtDate(l.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Onglet Contrôles HTTP ── */}
        <TabsContent value="checks" className="mt-5">
          <div className="glass-card rounded-2xl overflow-hidden">
            {w.checks.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted/30 ring-1 ring-border">
                  <Activity className="size-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">Aucun contrôle HTTP exécuté pour le moment.</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Configurez des contrôles dans la page Surveillance pour voir les résultats ici.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {w.checks.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs transition-colors hover:bg-primary/5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {c.ok ? (
                        <CheckCircle2 className="size-4 shrink-0 text-success" />
                      ) : (
                        <XCircle className="size-4 shrink-0 text-destructive" />
                      )}
                      <span className="font-medium text-foreground">
                        {monById.get(c.monitor_id) ?? c.monitor_id.slice(0, 8)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
                          c.ok
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-destructive/30 bg-destructive/10 text-destructive"
                        }`}
                      >
                        HTTP {c.status_code ?? "—"}
                      </span>
                      {c.response_ms != null && (
                        <span className="font-mono text-muted-foreground">{c.response_ms} ms</span>
                      )}
                      {c.error && (
                        <span className="truncate text-destructive">{c.error}</span>
                      )}
                    </div>
                    <span className="font-mono text-muted-foreground">{fmtDate(c.checked_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Onglet Telegram ── */}
        <TabsContent value="telegram" className="mt-5">
          <div className="glass-card rounded-2xl overflow-hidden">
            {w.telegramMessages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted/30 ring-1 ring-border">
                  <MessageSquare className="size-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">Aucun message Telegram reçu.</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Configurez le bot Telegram dans les Intégrations pour recevoir des messages ici.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {w.telegramMessages.map((m) => (
                  <div key={m.update_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs transition-colors hover:bg-primary/5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
                          m.direction === "in"
                            ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                            : "border-success/30 bg-success/10 text-success"
                        }`}
                      >
                        {m.direction === "in" ? "↓ Reçu" : "↑ Envoyé"}
                      </span>
                      <span className="truncate text-foreground/80">{m.text}</span>
                    </div>
                    <span className="font-mono text-muted-foreground">{fmtDate(m.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
