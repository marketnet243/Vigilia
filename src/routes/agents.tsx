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
  Zap,
  Eye,
  Search,
  AlertTriangle,
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

const ALL_TOOLS = [
  "project_context",
  "github_read",
  "monitoring_read",
  "incident_read",
  "memory_read",
  "audit_read",
  "integration_check",
  "prepare_patch",
  "request_approval",
] as const;

const TOOL_ICONS: Record<string, React.ReactNode> = {
  project_context: <Search className="size-3" />,
  github_read: <Eye className="size-3" />,
  monitoring_read: <Zap className="size-3" />,
  incident_read: <AlertTriangle className="size-3" />,
  memory_read: <Bot className="size-3" />,
  audit_read: <ShieldCheck className="size-3" />,
  integration_check: <Wrench className="size-3" />,
  prepare_patch: <Pencil className="size-3" />,
  request_approval: <ShieldCheck className="size-3" />,
};

export const Route = createFileRoute("/agents")({
  head: () => pageHead("Agents IA", "Configurez Vigilia Lead et votre équipe d'agents spécialistes et leurs permissions."),
  component: () => <AppShell>{(w, refresh) => <AgentsView w={w} refresh={refresh} />}</AppShell>,
});

type AgentItem = Workspace["agents"][number];
type FormState = {
  id?: string;
  name: string;
  role_title: string;
  specialty: string;
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
  instructions: "",
  skills: "",
  tools: ["project_context", "memory_read"],
  allowed_project_ids: [],
  permissions: { read: true, analyze: true, prepare: true, execute_with_approval: false },
  enabled: true,
});

function AgentsView({ w, refresh }: { w: Workspace; refresh: () => void }) {
  const save = useServerFn(saveRecord);
  const del = useServerFn(deleteRecord);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  function openEdit(a: AgentItem) {
    const p = (a.permissions ?? {}) as Record<string, boolean>;
    setForm({
      id: a.id,
      name: a.name,
      role_title: a.role_title,
      specialty: a.specialty,
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
      const values = {
        name: form.name,
        role_title: form.role_title,
        specialty: form.specialty,
        instructions: form.instructions,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        tools: form.tools,
        allowed_project_ids: form.allowed_project_ids,
        permissions: form.permissions,
        enabled: form.enabled,
      };
      await save({ data: { kind: "agent", ...(form.id ? { id: form.id } : {}), values } });
      toast.success(form.id ? "Agent mis à jour." : "Agent créé.");
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

  const PERM_LABELS: { key: keyof FormState["permissions"]; label: string; desc: string }[] = [
    { key: "read", label: "Lecture", desc: "Consulter projets, mémoires, logs." },
    { key: "analyze", label: "Analyse", desc: "Générer des rapports et diagnostics." },
    { key: "prepare", label: "Préparation", desc: "Rédiger des patchs et demandes." },
    { key: "execute_with_approval", label: "Exécution (avec approbation)", desc: "Pousser du code après validation owner." },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Équipe d'agents IA"
        sub="Vigilia Lead orchestre automatiquement les spécialistes actifs selon la nature de chaque mission."
      >
        <Button size="sm" onClick={() => { setForm(emptyForm()); setOpen(true); }} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
          <Plus className="size-3.5" />
          Nouvel agent
        </Button>
      </PageHeader>

      {w.agents.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Bot className="size-6 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-foreground/70">Aucun agent configuré</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Créez votre premier agent spécialiste pour étendre les capacités de Vigilia Lead.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {w.agents.map((a) => (
            <div
              key={a.id}
              className={`glass-card group relative rounded-2xl p-4 transition-all hover:border-primary/30 hover:shadow-glow ${!a.enabled ? "opacity-55" : ""}`}
            >
              {/* Accent top */}
              <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-primary opacity-0 transition-opacity group-hover:opacity-70" />

              {/* Header agent */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${a.enabled ? "bg-primary/15 ring-primary/30" : "bg-muted/30 ring-border"}`}>
                    <Bot className={`size-4 ${a.enabled ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusDot status={a.enabled ? "active" : "disabled"} />
                      <span className="font-semibold text-sm truncate">{a.name}</span>
                      {a.is_lead && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                          <Crown className="size-2.5" /> Lead
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.role_title} · {a.specialty}
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

              {/* Instructions */}
              <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {a.instructions}
              </p>

              {/* Compétences */}
              {Array.isArray(a.skills) && (a.skills as string[]).length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {(a.skills as string[]).slice(0, 5).map((sk) => (
                    <span key={sk} className="rounded-full border border-border/50 bg-background/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {sk}
                    </span>
                  ))}
                  {(a.skills as string[]).length > 5 && (
                    <span className="font-mono text-[11px] text-muted-foreground">+{(a.skills as string[]).length - 5}</span>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border/40 pt-2.5">
                <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                  <Wrench className="size-3" />
                  {Array.isArray(a.tools) ? a.tools.length : 0} outil(s)
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(a)} className="size-7 p-0">
                    <Pencil className="size-3" />
                  </Button>
                  {!a.is_builtin && (
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)} className="size-7 p-0 text-destructive hover:bg-destructive/10">
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog form agent */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifier l'agent" : "Créer un agent spécialiste"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium">Nom</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs font-medium">Rôle</Label>
                <Input required value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} className="mt-1 rounded-xl" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Spécialité</Label>
              <Input required value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} className="mt-1 rounded-xl" placeholder="Ex: Sécurité infrastructure, Révision code…" />
            </div>
            <div>
              <Label className="text-xs font-medium">Instructions système</Label>
              <Textarea required rows={4} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className="mt-1 rounded-xl font-mono text-xs" />
            </div>
            <div>
              <Label className="text-xs font-medium">Compétences (séparées par virgules)</Label>
              <Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} className="mt-1 rounded-xl" placeholder="postgres, docker, redis" />
            </div>

            {/* Outils */}
            <div>
              <Label className="text-xs font-medium">Outils autorisés</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ALL_TOOLS.map((t) => {
                  const on = form.tools.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, tools: on ? form.tools.filter((x) => x !== t) : [...form.tools, t] })}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-all ${
                        on
                          ? "border-primary/50 bg-primary/15 text-primary"
                          : "border-border/60 bg-background/40 text-muted-foreground hover:border-border"
                      }`}
                    >
                      {TOOL_ICONS[t]} {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Permissions */}
            <div>
              <Label className="text-xs font-medium">Permissions</Label>
              <div className="mt-2 space-y-2">
                {PERM_LABELS.map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between rounded-xl border border-border/50 bg-background/30 px-3 py-2">
                    <div>
                      <p className="text-xs font-medium">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={form.permissions[key]}
                      onCheckedChange={(v) => setForm({ ...form, permissions: { ...form.permissions, [key]: v } })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={busy} className="bg-gradient-primary text-primary-foreground">
                {busy ? <><RefreshCw className="mr-2 size-4 animate-spin" /> Enregistrement…</> : "Enregistrer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
