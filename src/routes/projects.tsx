import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ExternalLink,
  GitBranch,
  Pencil,
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Globe,
  Code2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/shell";
import { PageHeader, StatusDot, fmtDate } from "@/components/app/status";
import { pageHead } from "@/lib/workspace/head";
import { deleteRecord, inspectRepo } from "@/lib/workspace/integrations.functions";
import { saveRecord, type Workspace } from "@/lib/workspace/workspace.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/projects")({
  head: () => pageHead("Projets", "Inventaire de vos projets, dépôts GitHub, technologies et inspections techniques."),
  component: () => <AppShell>{(w, refresh) => <ProjectsView w={w} refresh={refresh} />}</AppShell>,
});

type RepoInfo = Awaited<ReturnType<typeof inspectRepo>>;
type ProjectForm = {
  id?: string;
  name: string;
  category: string;
  url: string;
  github_repo: string;
  description: string;
  technologies: string;
  environments: string;
  services: string;
  notes: string;
};
const emptyForm = (): ProjectForm => ({
  name: "",
  category: "",
  url: "",
  github_repo: "",
  description: "",
  technologies: "",
  environments: "production",
  services: "",
  notes: "",
});

function ProjectsView({ w, refresh }: { w: Workspace; refresh: () => void }) {
  const save = useServerFn(saveRecord);
  const del = useServerFn(deleteRecord);
  const inspect = useServerFn(inspectRepo);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ProjectForm>(emptyForm());
  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [repoData, setRepoData] = useState<RepoInfo | null>(null);

  function openEdit(p: Workspace["projects"][number]) {
    const csv = (v: unknown) => (Array.isArray(v) ? (v as string[]).join(", ") : "");
    setForm({
      id: p.id,
      name: p.name,
      category: p.category ?? "",
      url: p.url ?? "",
      github_repo: p.github_repo ?? "",
      description: p.description ?? "",
      technologies: csv(p.technologies),
      environments: csv(p.environments),
      services: csv(p.services),
      notes: p.notes ?? "",
    });
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
      await save({
        data: {
          kind: "project",
          ...(form.id ? { id: form.id } : {}),
          values: {
            name: form.name,
            category: form.category,
            url: form.url,
            github_repo: form.github_repo,
            description: form.description,
            technologies: split(form.technologies),
            environments: split(form.environments),
            services: split(form.services),
            notes: form.notes,
          },
        },
      });
      toast.success(form.id ? "Projet mis à jour." : "Projet ajouté.");
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  async function handleInspect(id: string, repo: string) {
    setInspectingId(id);
    try {
      const data = await inspect({ data: { repo } });
      setRepoData(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Inspection GitHub impossible");
    } finally {
      setInspectingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await del({ data: { kind: "project", id } });
      toast.success("Projet supprimé.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de suppression");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projets"
        sub="Centralisez vos applications, dépôts GitHub et services supervisés par Vigilia."
      >
        <Button
          size="sm"
          onClick={() => { setForm(emptyForm()); setOpen(true); }}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <Plus className="size-3.5" />
          Nouveau projet
        </Button>
      </PageHeader>

      {w.projects.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <FolderOpen className="size-6 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-foreground/70">Aucun projet enregistré</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Ajoutez votre premier projet ou dépôt GitHub pour permettre à Vigilia de le surveiller et l'analyser.
          </p>
          <Button size="sm" variant="outline" onClick={() => { setForm(emptyForm()); setOpen(true); }} className="mt-1 gap-2">
            <Plus className="size-3.5" /> Premier projet
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {w.projects.map((p) => (
            <div
              key={p.id}
              className="glass-card group relative rounded-2xl p-4 transition-all hover:border-primary/30 hover:shadow-glow"
            >
              <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-primary opacity-0 transition-opacity group-hover:opacity-60" />

              {/* Header */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/25">
                    <FolderOpen className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusDot status={p.status} />
                      <span className="truncate font-semibold text-sm">{p.name}</span>
                    </div>
                    {p.category && (
                      <span className="inline-block rounded-full border border-border/50 bg-background/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {p.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)} className="size-7 p-0">
                    <Pencil className="size-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)} className="size-7 p-0 text-destructive hover:bg-destructive/10">
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>

              {/* Description */}
              {p.description && (
                <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
              )}

              {/* Links */}
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border/40 bg-background/30 px-2 py-1 text-primary hover:border-primary/40 transition-colors"
                  >
                    <Globe className="size-3" />
                    <span className="max-w-[140px] truncate">{p.url.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink className="size-2.5" />
                  </a>
                )}
                {p.github_repo && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-border/40 bg-background/30 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                    <GitBranch className="size-3" />
                    {p.github_repo}
                  </span>
                )}
              </div>

              {/* Technologies */}
              {Array.isArray(p.technologies) && (p.technologies as string[]).length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {(p.technologies as string[]).map((t) => (
                    <span key={t} className="flex items-center gap-1 rounded-full border border-border/50 bg-background/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                      <Code2 className="size-2.5" /> {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Inspect button */}
              {p.github_repo && (
                <div className="border-t border-border/40 pt-2.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={inspectingId === p.id}
                    onClick={() => handleInspect(p.id, p.github_repo!)}
                    className="gap-2 text-xs"
                  >
                    {inspectingId === p.id ? (
                      <><RefreshCw className="size-3 animate-spin" /> Inspection…</>
                    ) : (
                      <><Search className="size-3" /> Inspecter le dépôt GitHub</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dialog Projet */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifier le projet" : "Nouveau projet"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium">Nom du projet</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs font-medium">Catégorie</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 rounded-xl" placeholder="SaaS, API, Infra…" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium">URL publique</Label>
                <Input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="mt-1 rounded-xl" placeholder="https://…" />
              </div>
              <div>
                <Label className="text-xs font-medium">Dépôt GitHub</Label>
                <Input value={form.github_repo} onChange={(e) => setForm({ ...form, github_repo: e.target.value })} className="mt-1 rounded-xl font-mono" placeholder="owner/repo" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-medium">Technologies (séparées par virgules)</Label>
              <Input value={form.technologies} onChange={(e) => setForm({ ...form, technologies: e.target.value })} className="mt-1 rounded-xl font-mono" placeholder="React, Postgres, Docker" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium">Environnements</Label>
                <Input value={form.environments} onChange={(e) => setForm({ ...form, environments: e.target.value })} className="mt-1 rounded-xl" placeholder="production, staging" />
              </div>
              <div>
                <Label className="text-xs font-medium">Services</Label>
                <Input value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} className="mt-1 rounded-xl" placeholder="API, Worker, CDN" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Notes techniques</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 rounded-xl font-mono text-xs" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={busy} className="bg-gradient-primary text-primary-foreground">
                {busy ? <><RefreshCw className="mr-2 size-4 animate-spin" />Enregistrement…</> : "Enregistrer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog inspection GitHub */}
      <Dialog open={Boolean(repoData)} onOpenChange={(v) => !v && setRepoData(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="size-4 text-primary" />
              Inspection GitHub : {repoData?.name}
            </DialogTitle>
          </DialogHeader>
          {repoData && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-border/50 bg-background/40 px-3 py-1 font-mono text-xs">
                  Branche : {repoData.default_branch}
                </span>
                <span className="rounded-full border border-border/50 bg-background/40 px-3 py-1 font-mono text-xs">
                  {repoData.file_count} fichiers
                </span>
                <span className="rounded-full border border-border/50 bg-background/40 px-3 py-1 text-xs">
                  {repoData.private ? "🔒 Privé" : "🌐 Public"}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${repoData.has_tests ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"}`}>
                  {repoData.has_tests ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
                  Tests
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${repoData.has_ci ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"}`}>
                  {repoData.has_ci ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
                  CI/CD
                </span>
              </div>

              {repoData.has_env_committed.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <strong>Attention :</strong> fichier(s) .env détecté(s) dans le dépôt :{" "}
                    {repoData.has_env_committed.map((f) => (
                      <code key={f} className="mx-0.5 rounded bg-background/40 px-1 font-mono">{f}</code>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Derniers commits
                </h4>
                <div className="glass-card divide-y divide-border/40 rounded-xl overflow-hidden">
                  {repoData.recent_commits.slice(0, 6).map((c) => (
                    <div key={c.sha} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <code className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] text-primary">
                          {c.sha}
                        </code>
                        <span className="truncate text-foreground/80">{c.message}</span>
                      </div>
                      <span className="shrink-0 font-mono text-muted-foreground">{fmtDate(c.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
