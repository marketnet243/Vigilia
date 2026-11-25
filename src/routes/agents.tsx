import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Crown,
  Pencil,
  Plus,
  Trash2,
  Bot,
  Wrench,
  ShieldCheck,
  RefreshCw,
  Eye,
  Search,
  AlertTriangle,
  GitBranch,
  Database,
  Activity,
  Network,
  Globe,
  ShieldAlert,
  Terminal,
  Code2,
  Cpu,
  Send,
  Sparkles,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/shell";
import { PageHeader, StatusDot } from "@/components/app/status";
import { pageHead } from "@/lib/workspace/head";
import { deleteRecord } from "@/lib/workspace/integrations.functions";
import { saveRecord, type Workspace } from "@/lib/workspace/workspace.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const AGENT_DOMAINS = [
  { key: "all", label: "Tous", icon: Layers, match: [] },
  { key: "orchestration", label: "Orchestration", icon: Crown, match: ["orchestration", "lead"] },
  { key: "dev", label: "Développement", icon: Code2, match: ["développement", "dev", "full-stack", "données"] },
  { key: "system", label: "Systèmes & DevOps", icon: Terminal, match: ["système", "sysadmin", "linux", "ubuntu", "devops", "docker"] },
  { key: "network", label: "Réseaux & DNS", icon: Network, match: ["réseau", "dns", "tls", "surveillance", "uptime"] },
  { key: "security", label: "Cybersécurité", icon: ShieldAlert, match: ["sécurité", "cyber", "audit", "incident", "crise"] },
] as const;

export const ALL_TOOLS = [
  { id: "project_context", label: "Contexte projet", category: "Core", icon: Search },
  { id: "github_read", label: "Lecture GitHub", category: "Code", icon: Eye },
  { id: "prepare_patch", label: "Préparation de patch", category: "Code", icon: Pencil },
  { id: "git_branch_manager", label: "Gestion de branches", category: "Code", icon: GitBranch },
  { id: "database_query", label: "Inspection Base SQL", category: "Données", icon: Database },
  { id: "monitoring_read", label: "Lecture Surveillance", category: "Réseau", icon: Activity },
  { id: "network_ping", label: "Ping & Latence", category: "Réseau", icon: Network },
  { id: "dns_lookup", label: "Résolution DNS", category: "Réseau", icon: Globe },
  { id: "incident_read", label: "Historique Incidents", category: "Sécurité", icon: AlertTriangle },
  { id: "security_scan", label: "Audit Sécurité & Secrets", category: "Sécurité", icon: ShieldAlert },
  { id: "audit_read", label: "Journal d'audit", category: "Sécurité", icon: ShieldCheck },
  { id: "telegram_notify", label: "Alerte Telegram d'urgence", category: "Alerting", icon: Send },
  { id: "integration_check", label: "Contrôle Intégrations", category: "Infra", icon: Wrench },
  { id: "log_analyzer", label: "Analyseur de logs", category: "Infra", icon: Terminal },
  { id: "memory_read", label: "Lecture Mémoire IA", category: "Mémoire", icon: Bot },
  { id: "memory_write", label: "Écriture Mémoire IA", category: "Mémoire", icon: Sparkles },
  { id: "request_approval", label: "Demande d'approbation", category: "Gouvernance", icon: Crown },
] as const;

export const Route = createFileRoute("/agents")({
  head: () =>
    pageHead("Agents IA", "Configurez Vigilia Lead et votre équipe d'agents spécialistes classés par domaine."),
  component: () => <AppShell>{(w, refresh) => <AgentsView w={w} refresh={refresh} />}</AppShell>,
});

type AgentItem = Workspace["agents"][number];
type FormState = {
  id?: string;
  name: string;
  role_title: string;
  specialty: string;
  domain: string;
  instructions: string;
  skills: string;
  tools: string[];
  allowed_project_ids: string[];
  permissions: { read: boolean; analyze: boolean; prepare: boolean; execute_with_approval: boolean };
  enabled: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  role_title: "",
  specialty: "",
  domain: "Développement",
  instructions: "",
  skills: "",
  tools: ["project_context", "memory_read", "github_read"],
  allowed_project_ids: [],
  permissions: { read: true, analyze: true, prepare: true, execute_with_approval: false },
  enabled: true,
});

function getAgentDomain(a: AgentItem): string {
  const text = `${a.specialty} ${a.role_title} ${a.name}`.toLowerCase();
  if (text.includes("orchestration") || a.is_lead) return "Orchestration";
  if (text.includes("sécurité") || text.includes("cyber") || text.includes("incident") || text.includes("crise"))
    return "Cybersécurité";
  if (text.includes("système") || text.includes("linux") || text.includes("devops") || text.includes("docker"))
    return "Systèmes & DevOps";
  if (text.includes("réseau") || text.includes("dns") || text.includes("surveillance") || text.includes("uptime"))
    return "Réseaux & DNS";
  return "Développement";
}

function getDomainBadgeStyle(domain: string) {
  switch (domain) {
    case "Orchestration":
      return "border-primary/40 bg-primary/10 text-primary";
    case "Développement":
      return "border-blue-500/40 bg-blue-500/10 text-blue-400";
    case "Systèmes & DevOps":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
    case "Réseaux & DNS":
      return "border-purple-500/40 bg-purple-500/10 text-purple-400";
    case "Cybersécurité":
      return "border-red-500/40 bg-red-500/10 text-red-400";
    default:
      return "border-border bg-secondary/50 text-muted-foreground";
  }
}

function AgentsView({ w, refresh }: { w: Workspace; refresh: () => void }) {
  const save = useServerFn(saveRecord);
  const del = useServerFn(deleteRecord);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [activeDomainFilter, setActiveDomainFilter] = useState<string>("all");

  function openEdit(a: AgentItem) {
    const p = (a.permissions ?? {}) as Record<string, boolean>;
    setForm({
      id: a.id,
      name: a.name,
      role_title: a.role_title,
      specialty: a.specialty,
      domain: getAgentDomain(a),
      instructions: a.instructions,
      skills: Array.isArray(a.skills) ? (a.skills as string[]).join(", ") : "",
      tools: Array.isArray(a.tools) ? (a.tools as string[]) : [],
      allowed_project_ids: a.allowed_project_ids ?? [],
      permissions: {
        read: p["read"] ?? true,
        analyze: p["analyze"] ?? true,
        prepare: p["prepare"] ?? true,
        execute_with_approval: p["execute_with_approval"] ?? false,
      },
      enabled: a.enabled,
    });
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const formattedSpecialty = form.specialty.startsWith("[")
        ? form.specialty
        : `[${form.domain}] ${form.specialty}`;

      const values = {
        name: form.name,
        role_title: form.role_title,
        specialty: formattedSpecialty,
        instructions: form.instructions,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        tools: form.tools,
        allowed_project_ids: form.allowed_project_ids,
        permissions: form.permissions,
        enabled: form.enabled,
      };
      await save({ data: { kind: "agent", ...(form.id ? { id: form.id } : {}), values } });
      toast.success(form.id ? "Agent mis à jour." : "Agent créé avec succès.");
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(a: AgentItem, enabled: boolean) {
    try {
      const p = (a.permissions ?? {}) as Record<string, boolean>;
      await save({
        data: {
          kind: "agent",
          id: a.id,
          values: {
            name: a.name,
            role_title: a.role_title,
            specialty: a.specialty,
            instructions: a.instructions,
            skills: Array.isArray(a.skills) ? a.skills : [],
            tools: Array.isArray(a.tools) ? a.tools : [],
            allowed_project_ids: a.allowed_project_ids ?? [],
            permissions: {
              read: p["read"] ?? true,
              analyze: p["analyze"] ?? true,
              prepare: p["prepare"] ?? true,
              execute_with_approval: p["execute_with_approval"] ?? false,
            },
            enabled,
          },
        },
      });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action refusée");
    }
  }

  async function handleDelete(id: string) {
    try {
      await del({ data: { kind: "agent", id } });
      toast.success("Agent supprimé.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression refusée");
    }
  }

  // Filtrage par domaine
  const filteredAgents = w.agents.filter((a) => {
    if (activeDomainFilter === "all") return true;
    const dom = AGENT_DOMAINS.find((d) => d.key === activeDomainFilter);
    if (!dom) return true;
    const hay = `${a.specialty} ${a.role_title} ${a.name}`.toLowerCase();
    return dom.match.some((m) => hay.includes(m));
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Équipe d'agents IA"
        sub="Vigilia Lead orchestre une équipe de spécialistes structurés par domaine d'expertise technique."
      >
        <Button
          size="sm"
          onClick={() => {
            setForm(emptyForm());
            setOpen(true);
          }}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <Plus className="size-3.5" />
          Nouvel agent
        </Button>
      </PageHeader>

      {/* Barre de filtres par Domaine */}
      <div className="flex flex-wrap gap-2">
        {AGENT_DOMAINS.map((d) => {
          const Icon = d.icon;
          const count =
            d.key === "all"
              ? w.agents.length
              : w.agents.filter((a) => {
                  const hay = `${a.specialty} ${a.role_title} ${a.name}`.toLowerCase();
                  return d.match.some((m) => hay.includes(m));
                }).length;

          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setActiveDomainFilter(d.key)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-xs transition-all ${
                activeDomainFilter === d.key
                  ? "border-primary/50 bg-primary/15 text-primary shadow-glow font-semibold"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{d.label}</span>
              <span className="rounded-full bg-background/60 px-1.5 py-0.2 text-[10px] text-muted-foreground">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grille des Agents */}
      {filteredAgents.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Bot className="size-6 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-foreground/70">Aucun agent dans ce domaine</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Sélectionnez un autre domaine ou créez un nouvel agent spécialiste.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredAgents.map((a) => {
            const domainName = getAgentDomain(a);
            const badgeCls = getDomainBadgeStyle(domainName);
            const agentTools = Array.isArray(a.tools) ? (a.tools as string[]) : [];

            return (
              <div
                key={a.id}
                className={`glass-card group relative rounded-2xl p-4 transition-all hover:border-primary/30 hover:shadow-glow ${
                  !a.enabled ? "opacity-55" : ""
                }`}
              >
                {/* Ligne d'accent lumineuse */}
                <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-primary opacity-0 transition-opacity group-hover:opacity-70" />

                {/* En-tête agent */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${
                        a.is_lead
                          ? "bg-primary/20 ring-primary/40 text-primary"
                          : a.enabled
                          ? "bg-primary/10 ring-primary/25 text-primary"
                          : "bg-muted/30 ring-border text-muted-foreground"
                      }`}
                    >
                      {a.is_lead ? <Crown className="size-4" /> : <Bot className="size-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusDot status={a.enabled ? "active" : "disabled"} />
                        <span className="font-semibold text-sm truncate">{a.name}</span>
                        {a.is_lead && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 font-mono text-[10px] text-primary font-bold">
                            <Crown className="size-2.5" /> LEAD
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium ${badgeCls}`}
                        >
                          {domainName}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.role_title}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Switch
                      checked={a.enabled}
                      disabled={a.is_lead}
                      onCheckedChange={(v) => toggleEnabled(a, v)}
                      aria-label={`Activer ${a.name}`}
                    />
                  </div>
                </div>

                {/* Spécialité & Instructions */}
                <div className="mb-2 font-mono text-[11px] text-foreground/80 line-clamp-1">
                  🎯 {a.specialty}
                </div>
                <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {a.instructions}
                </p>

                {/* Compétences (Skills) */}
                {Array.isArray(a.skills) && (a.skills as string[]).length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {(a.skills as string[]).map((sk) => (
                      <span
                        key={sk}
                        className="rounded-full border border-border/50 bg-background/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                )}

                {/* Outils associés & Actions */}
                <div className="flex items-center justify-between border-t border-border/40 pt-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground mr-1">
                      <Wrench className="size-3 text-primary" />
                      {agentTools.length} outil(s) :
                    </span>
                    {agentTools.slice(0, 3).map((tId) => {
                      const tDef = ALL_TOOLS.find((t) => t.id === tId);
                      return (
                        <span
                          key={tId}
                          className="rounded border border-primary/20 bg-primary/5 px-1.5 py-0.2 font-mono text-[10px] text-primary"
                        >
                          {tDef?.label ?? tId}
                        </span>
                      );
                    })}
                    {agentTools.length > 3 && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        +{agentTools.length - 3}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(a)}
                      className="size-7 p-0"
                      aria-label="Modifier"
                    >
                      <Pencil className="size-3" />
                    </Button>
                    {!a.is_builtin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(a.id)}
                        className="size-7 p-0 text-destructive hover:bg-destructive/10"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODALE FORMULAIRE PROPRE : CRÉATION / MODIFICATION D'AGENT ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="size-5 text-primary" />
              {form.id ? "Modifier l'agent" : "Créer un nouvel agent spécialiste"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-1">
            {/* Nom & Rôle */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nom de l&apos;agent</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="rounded-xl text-xs"
                  placeholder="Ex: Architecte Cloud"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Titre / Rôle fonctionnel</Label>
                <Input
                  required
                  value={form.role_title}
                  onChange={(e) => setForm({ ...form, role_title: e.target.value })}
                  className="rounded-xl text-xs"
                  placeholder="Ex: Expert Infrastructure & Terraform"
                />
              </div>
            </div>

            {/* Domaine & Spécialité */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Domaine d&apos;expertise</Label>
                <Select
                  value={form.domain}
                  onValueChange={(v) => setForm({ ...form, domain: v })}
                >
                  <SelectTrigger className="rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Développement">Développement & Données</SelectItem>
                    <SelectItem value="Systèmes & DevOps">Systèmes, Serveurs & DevOps</SelectItem>
                    <SelectItem value="Réseaux & DNS">Réseaux, DNS & Connectivité</SelectItem>
                    <SelectItem value="Cybersécurité">Cybersécurité, Audit & Incidents</SelectItem>
                    <SelectItem value="Orchestration">Orchestration & Gouvernance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Spécialité technique</Label>
                <Input
                  required
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  className="rounded-xl text-xs"
                  placeholder="Ex: Kubernetes, Helm, Micro-services"
                />
              </div>
            </div>

            {/* Instructions Système */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Instructions système (Prompt de comportement)</Label>
              <Textarea
                required
                rows={3}
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                className="rounded-xl font-mono text-xs"
                placeholder="Décrivez comment cet agent analyse les problèmes et propose des solutions..."
              />
            </div>

            {/* Compétences (Skills) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Compétences clés (Tags séparés par virgules)</Label>
              <Input
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                className="rounded-xl font-mono text-xs"
                placeholder="docker, kubernetes, terraform, aws"
              />
            </div>

            {/* Sélection Propre des Outils Autorisés */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">
                  Boîte à outils autorisée ({form.tools.length} sélectionné(s))
                </Label>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      tools:
                        form.tools.length === ALL_TOOLS.length
                          ? ["project_context"]
                          : ALL_TOOLS.map((t) => t.id),
                    })
                  }
                  className="font-mono text-[10px] text-primary hover:underline"
                >
                  {form.tools.length === ALL_TOOLS.length ? "Réduire" : "Tout sélectionner"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 max-h-44 overflow-y-auto p-1 rounded-xl border border-border/50 bg-background/40">
                {ALL_TOOLS.map((t) => {
                  const on = form.tools.includes(t.id);
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          tools: on ? form.tools.filter((x) => x !== t.id) : [...form.tools, t.id],
                        })
                      }
                      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left font-mono text-[11px] transition-all ${
                        on
                          ? "border-primary/60 bg-primary/15 text-primary font-medium"
                          : "border-border/60 bg-background/50 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-3 shrink-0" />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-1.5 rounded-xl border border-border/50 bg-background/30 p-3">
              <Label className="text-xs font-medium">Niveau d&apos;autorisation</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between rounded-lg border border-border/40 p-2">
                  <span>Analyse & Diagnostic</span>
                  <Switch
                    checked={form.permissions.analyze}
                    onCheckedChange={(v) =>
                      setForm({ ...form, permissions: { ...form.permissions, analyze: v } })
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/40 p-2">
                  <span>Préparation correctifs</span>
                  <Switch
                    checked={form.permissions.prepare}
                    onCheckedChange={(v) =>
                      setForm({ ...form, permissions: { ...form.permissions, prepare: v } })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={busy}
                className="gap-2 bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
              >
                {busy ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  <>
                    <Bot className="size-4" />
                    Enregistrer l&apos;agent
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
