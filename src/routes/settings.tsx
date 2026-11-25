import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Brain,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  KeyRound,
  BookOpen,
  SlidersHorizontal,
  RefreshCw,
  CheckCircle2,
  Globe,
  Bot,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/shell";
import { PageHeader, fmtDate } from "@/components/app/status";
import { pageHead } from "@/lib/workspace/head";
import { deleteRecord } from "@/lib/workspace/integrations.functions";
import { saveRecord, type Workspace } from "@/lib/workspace/workspace.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/settings")({
  head: () => pageHead("Paramètres & Mémoire", "Gérez la mémoire technique persistante de vos agents et la sécurité de votre accès."),
  component: () => <AppShell>{(w, refresh) => <SettingsView w={w} refresh={refresh} />}</AppShell>,
});

type MemForm = {
  id?: string;
  title: string;
  content: string;
  scope: "global" | "project" | "agent";
  category: "decision" | "investigation" | "preference" | "documentation" | "knowledge";
  project_id: string;
  agent_id: string;
  obsolete: boolean;
};
const emptyMem = (): MemForm => ({
  title: "",
  content: "",
  scope: "global",
  category: "knowledge",
  project_id: "none",
  agent_id: "none",
  obsolete: false,
});

const SCOPE_ICONS: Record<string, React.ReactNode> = {
  global: <Globe className="size-3.5" />,
  project: <FolderOpen className="size-3.5" />,
  agent: <Bot className="size-3.5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  decision: "bg-primary/15 text-primary border-primary/30",
  investigation: "bg-warning/15 text-warning border-warning/30",
  preference: "bg-success/15 text-success border-success/30",
  documentation: "bg-muted/50 text-muted-foreground border-border",
  knowledge: "bg-secondary/60 text-foreground border-border",
};

function SettingsView({ w, refresh }: { w: Workspace; refresh: () => void }) {
  const save = useServerFn(saveRecord);
  const del = useServerFn(deleteRecord);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MemForm>(emptyMem());
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdOk, setPwdOk] = useState(false);

  const memories = scopeFilter === "all" ? w.memories : w.memories.filter((m) => m.scope === scopeFilter);

  function openEdit(m: Workspace["memories"][number]) {
    setForm({
      id: m.id,
      title: m.title,
      content: m.content,
      scope: m.scope as MemForm["scope"],
      category: m.category as MemForm["category"],
      project_id: m.project_id ?? "none",
      agent_id: m.agent_id ?? "none",
      obsolete: m.obsolete,
    });
    setOpen(true);
  }

  async function handleSaveMem(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save({
        data: {
          kind: "memory",
          ...(form.id ? { id: form.id } : {}),
          values: {
            title: form.title,
            content: form.content,
            scope: form.scope,
            category: form.category,
            project_id: form.scope === "project" && form.project_id !== "none" ? form.project_id : null,
            agent_id: form.scope === "agent" && form.agent_id !== "none" ? form.agent_id : null,
            obsolete: form.obsolete,
          },
        },
      });
      toast.success(form.id ? "Mémoire mise à jour." : "Mémoire enregistrée.");
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'enregistrement");
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 8) {
      toast.error("8 caractères minimum pour le nouveau mot de passe.");
      return;
    }
    setPwdBusy(true);
    setPwdOk(false);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd, current_password: curPwd } as never);
      if (error) throw error;
      setCurPwd("");
      setNewPwd("");
      setPwdOk(true);
      toast.success("Mot de passe mis à jour avec succès.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de modifier le mot de passe");
    } finally {
      setPwdBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres & Mémoire"
        sub="Base de connaissances réutilisée par Vigilia Lead et règles de sécurité de l'espace."
      />

      <Tabs defaultValue="memory">
        <TabsList className="glass-card border border-border/50 p-1">
          <TabsTrigger value="memory" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <BookOpen className="size-3.5" />
            Mémoire IA <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 font-mono text-[11px] text-primary">{w.memories.length}</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <SlidersHorizontal className="size-3.5" />
            Sécurité
          </TabsTrigger>
        </TabsList>

        {/* ── Onglet Mémoire ── */}
        <TabsContent value="memory" className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filtres scope */}
            <div className="flex gap-1.5">
              {[
                { key: "all", label: "Toutes", icon: <Brain className="size-3" /> },
                { key: "global", label: "Globale", icon: <Globe className="size-3" /> },
                { key: "project", label: "Projet", icon: <FolderOpen className="size-3" /> },
                { key: "agent", label: "Agent", icon: <Bot className="size-3" /> },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setScopeFilter(key)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-xs transition-all ${
                    scopeFilter === key
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              onClick={() => { setForm(emptyMem()); setOpen(true); }}
              className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <Plus className="size-3.5" />
              Ajouter une mémoire
            </Button>
          </div>

          {memories.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl py-14 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                <Brain className="size-6 text-primary/60" />
              </div>
              <p className="text-sm font-medium text-foreground/70">Aucune entrée de mémoire</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Ajoutez des connaissances, préférences ou décisions que Vigilia Lead réutilisera automatiquement.
              </p>
              <Button size="sm" variant="outline" onClick={() => { setForm(emptyMem()); setOpen(true); }} className="mt-1 gap-2">
                <Plus className="size-3.5" /> Première entrée
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {memories.map((m) => (
                <div
                  key={m.id}
                  className={`glass-card group relative rounded-2xl p-4 transition-all hover:border-primary/30 hover:shadow-glow ${m.obsolete ? "opacity-50" : ""}`}
                >
                  {/* Accent ligne */}
                  <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-primary opacity-0 transition-opacity group-hover:opacity-60" />

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold text-sm">
                        <Brain className="size-3.5 shrink-0 text-primary" />
                        <span className="truncate">{m.title}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] ${CATEGORY_COLORS[m.category] ?? CATEGORY_COLORS.knowledge}`}>
                          {m.category}
                        </span>
                        <span className="flex items-center gap-1 rounded-full border border-border/50 bg-background/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {SCOPE_ICONS[m.scope]} {m.scope}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">{fmtDate(m.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)} className="size-7 p-0">
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await del({ data: { kind: "memory", id: m.id } });
                          toast.success("Mémoire supprimée.");
                          refresh();
                        }}
                        className="size-7 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>

                  <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {m.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Onglet Sécurité ── */}
        <TabsContent value="security" className="mt-5 grid gap-4 lg:grid-cols-2">
          {/* Gouvernance */}
          <div className="glass-card rounded-2xl p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-success/15 ring-1 ring-success/30">
                <ShieldCheck className="size-5 text-success" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">Gouvernance Vigilia</h3>
                <p className="text-xs text-muted-foreground">Protections actives sur cet espace.</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {[
                {
                  label: "Propriétaire autorisé",
                  value: <span className="font-mono text-primary">{w.email}</span>,
                },
                {
                  label: "Contrôle d'accès",
                  value: "Politiques RLS restrictives (rôle owner vérifié côté serveur).",
                },
                {
                  label: "Protection SSRF",
                  value: "Adresses IP privées, locales et ports non standards bloqués avant chaque requête HTTP.",
                },
                {
                  label: "Protection secrets",
                  value: "Détection automatique dans les demandes et chiffrement AES-256-GCM en base.",
                },
                {
                  label: "Branches GitHub",
                  value: (
                    <span>
                      Écriture directe sur{" "}
                      {["main", "master", "prod", "production"].map((b) => (
                        <code key={b} className="mx-0.5 rounded bg-background/50 px-1 py-0.5 font-mono text-[10px]">{b}</code>
                      ))}{" "}
                      interdite.
                    </span>
                  ),
                },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-border/40 bg-background/30 p-2.5">
                  <div className="mb-0.5 font-medium text-foreground/80">{label}</div>
                  <div className="text-muted-foreground leading-relaxed">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Changer mot de passe */}
          <div className="glass-card rounded-2xl p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
                <Lock className="size-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">Changer le mot de passe</h3>
                <p className="text-xs text-muted-foreground">Connexion e-mail + mot de passe.</p>
              </div>
            </div>

            {pwdOk && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-3 py-2.5 text-xs text-success">
                <CheckCircle2 className="size-4 shrink-0" />
                Mot de passe mis à jour avec succès.
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="cpw" className="text-xs font-medium text-foreground/80">
                  Mot de passe actuel
                </Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input
                    id="cpw"
                    type="password"
                    required
                    value={curPwd}
                    onChange={(e) => setCurPwd(e.target.value)}
                    className="rounded-xl border-border/80 bg-background/65 pl-10 font-mono text-sm"
                    placeholder="••••••••••"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="npw" className="text-xs font-medium text-foreground/80">
                  Nouveau mot de passe
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input
                    id="npw"
                    type="password"
                    required
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    className="rounded-xl border-border/80 bg-background/65 pl-10 font-mono text-sm"
                    placeholder="8 caractères minimum"
                  />
                </div>
                {newPwd.length > 0 && (
                  <div className="mt-1 flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          newPwd.length >= i * 3
                            ? newPwd.length >= 12
                              ? "bg-success"
                              : newPwd.length >= 8
                              ? "bg-warning"
                              : "bg-destructive"
                            : "bg-border"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={pwdBusy}
                className="w-full gap-2 rounded-xl bg-gradient-primary font-semibold text-primary-foreground shadow-glow"
              >
                {pwdBusy ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    Mise à jour…
                  </>
                ) : (
                  <>
                    <Lock className="size-4" />
                    Mettre à jour le mot de passe
                  </>
                )}
              </Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog mémoire */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifier la mémoire" : "Nouvelle mémoire persistante"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveMem} className="space-y-3.5">
            <div>
              <Label className="text-xs font-medium">Titre</Label>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 rounded-xl" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-medium">Portée</Label>
                <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v as MemForm["scope"] })}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Globale</SelectItem>
                    <SelectItem value="project">Projet</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium">Catégorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as MemForm["category"] })}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="knowledge">Connaissance</SelectItem>
                    <SelectItem value="decision">Décision</SelectItem>
                    <SelectItem value="investigation">Investigation</SelectItem>
                    <SelectItem value="preference">Préférence</SelectItem>
                    <SelectItem value="documentation">Documentation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.scope === "project" && (
              <div>
                <Label className="text-xs font-medium">Projet associé</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choisir…</SelectItem>
                    {w.projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.scope === "agent" && (
              <div>
                <Label className="text-xs font-medium">Agent associé</Label>
                <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choisir…</SelectItem>
                    {w.agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs font-medium">Contenu de la mémoire</Label>
              <Textarea required rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="mt-1 rounded-xl font-mono text-xs" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/30 px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-foreground/80">Marquer comme obsolète</p>
                <p className="text-[11px] text-muted-foreground">Conserve l'entrée mais la masque par défaut.</p>
              </div>
              <Switch checked={form.obsolete} onCheckedChange={(v) => setForm({ ...form, obsolete: v })} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" className="bg-gradient-primary text-primary-foreground">
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
