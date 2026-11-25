import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Ban, Check, CheckCircle2, ChevronDown, ChevronUp, Clock, GitBranch, Play, Plus, RefreshCw, Rocket, ShieldCheck, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/shell";
import { Md } from "@/components/app/md";
import { MissionStatusBadge, PageHeader, SeverityBadge, fmtDate } from "@/components/app/status";
import { pageHead } from "@/lib/workspace/head";
import { executeApproval } from "@/lib/workspace/integrations.functions";
import { cancelMission, createMission, decideApproval, runMission, type Workspace } from "@/lib/workspace/workspace.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/missions")({
  head: () => pageHead("Missions & Approbations", "Orchestrez des missions multi-agents persistantes et validez chaque action sensible."),
  component: () => <AppShell>{(w, refresh) => <MissionsView w={w} refresh={refresh} />}</AppShell>,
});

function MissionsView({ w, refresh }: { w: Workspace; refresh: () => void }) {
  const addMission = useServerFn(createMission);
  const execMission = useServerFn(runMission);
  const stopMission = useServerFn(cancelMission);
  const decide = useServerFn(decideApproval);
  const execAppr = useServerFn(executeApproval);

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(w.missions[0]?.id ?? null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [branchInput, setBranchInput] = useState<Record<string, { base: string; next: string }>>({});
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  const selected = w.missions.find((m) => m.id === selectedId) ?? w.missions[0] ?? null;
  const selectedSteps = selected ? w.steps.filter((s) => s.mission_id === selected.id) : [];
  const pendingCount = w.approvals.filter((a) => a.status === "pending").length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const created = await addMission({
        data: { title, description: desc, project_id: projectId === "none" ? null : projectId, priority, token_budget: 32000, max_steps: 6 },
      });
      setTitle(""); setDesc(""); setProjectId("none"); setOpen(false);
      setSelectedId(created.id);
      refresh();
      toast.success("Mission créée — lancement en cours…");
      setRunningId(created.id);
      await execMission({ data: { id: created.id } });
      refresh();
      toast.success("Mission terminée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur mission");
      refresh();
    } finally {
      setRunningId(null);
    }
  }

  async function handleRun(id: string) {
    setRunningId(id);
    try {
      await execMission({ data: { id } });
      toast.success("Mission exécutée.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec d'exécution");
      refresh();
    } finally {
      setRunningId(null);
    }
  }

  async function handleCancel(id: string) {
    try {
      await stopMission({ data: { id } });
      toast.success("Mission annulée.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Annulation impossible");
    }
  }

  async function handleDecide(id: string, approve: boolean) {
    try {
      await decide({ data: { id, approve, note: notes[id] ?? "" } });
      toast.success(approve ? "Action approuvée." : "Action refusée.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Décision impossible");
    }
  }

  async function handleExecBranch(id: string) {
    const cfg = branchInput[id] ?? { base: "main", next: "" };
    if (!cfg.next.trim()) { toast.error("Indiquez le nom de la nouvelle branche."); return; }
    try {
      const r = await execAppr({ data: { id, baseBranch: cfg.base || "main", newBranch: cfg.next.trim() } });
      toast.success(`Branche créée : ${r.branch}`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Exécution GitHub refusée");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Missions & Approbations" sub="Chaque opération sensible (écriture GitHub, prod, migration) exige votre validation explicite.">
        <Button size="sm" onClick={() => setOpen(true)} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
          <Plus className="mr-1.5 size-4" />
          Nouvelle mission
        </Button>
      </PageHeader>

      <Tabs defaultValue={pendingCount > 0 ? "approvals" : "missions"}>
        <TabsList className="bg-card/80 border border-border/70">
          <TabsTrigger value="missions">Missions ({w.missions.length})</TabsTrigger>
          <TabsTrigger value="approvals">
            Approbations ({pendingCount} en attente)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="missions" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="space-y-2.5 lg:col-span-5">
              {w.missions.length === 0 ? (
                <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-10 text-center">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Rocket className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Aucune mission pour le moment</p>
                    <p className="text-xs text-muted-foreground">
                      Orchestrez vos agents IA pour diagnostiquer un incident, auditer un dépôt ou planifier une correction.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                    <Plus className="mr-1.5 size-3.5" />
                    Créer une mission
                  </Button>
                </div>
              ) : (
                w.missions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${
                      selected?.id === m.id
                        ? "border-primary/60 bg-card shadow-glow"
                        : "border-border/80 bg-card/60 hover:border-primary/30 hover:bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-sm font-semibold tracking-tight">{m.title}</span>
                      <MissionStatusBadge status={m.status} />
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${m.progress}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{fmtDate(m.created_at)}</span>
                      <span className="font-mono tabular-nums">{m.progress}% · {m.tokens_used} tok.</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="lg:col-span-7">
              {selected ? (
                <Card className="rounded-2xl border-border/80 bg-card/85 backdrop-blur-sm">
                  <CardHeader className="border-b border-border/60 pb-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base font-semibold">{selected.title}</CardTitle>
                          <MissionStatusBadge status={selected.status} />
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">{selected.description}</p>
                      </div>
                      <div className="flex gap-1.5">
                        {(selected.status === "pending" || selected.status === "failed") && (
                          <Button size="sm" disabled={runningId === selected.id} onClick={() => handleRun(selected.id)}>
                            <Play className="mr-1 size-3.5" />
                            {runningId === selected.id ? "Exécution…" : "Exécuter"}
                          </Button>
                        )}
                        {["pending", "planning", "investigating", "in_progress", "validating"].includes(selected.status) && (
                          <Button size="sm" variant="outline" onClick={() => handleCancel(selected.id)}>
                            <Ban className="mr-1 size-3.5" />
                            Annuler
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    {/* Barre de progression globale */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                        <span>Progression de l&apos;orchestration</span>
                        <span className="font-semibold text-foreground">{selected.progress ?? 0}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/50">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            selected.status === "failed"
                              ? "bg-destructive"
                              : selected.status === "completed"
                              ? "bg-success"
                              : "bg-gradient-primary"
                          }`}
                          style={{ width: `${Math.max(4, selected.progress ?? 0)}%` }}
                        />
                      </div>
                    </div>

                    {selectedSteps.length > 0 && (
                      <div className="space-y-2.5">
                        <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Pipeline d&apos;exécution ({selectedSteps.length} étape{selectedSteps.length > 1 ? "s" : ""})
                        </h4>
                        <div className="relative space-y-2.5 pl-3 before:absolute before:bottom-3 before:left-[18px] before:top-3 before:w-px before:bg-border/60">
                          {selectedSteps.map((st) => {
                            const isRunning = st.status === "running";
                            const isDone = st.status === "completed";
                            const isFailed = st.status === "failed";
                            const isExpanded = Boolean(expandedSteps[st.id]);
                            const statusLabel = isDone
                              ? "Terminée"
                              : isRunning
                              ? "En cours"
                              : isFailed
                              ? "Échec"
                              : "En attente";
                            const statusStyle = isDone
                              ? "border-success/30 bg-success/10 text-success"
                              : isRunning
                              ? "border-primary/40 bg-primary/15 text-primary"
                              : isFailed
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-border bg-secondary/40 text-muted-foreground";

                            return (
                              <div key={st.id} className="relative rounded-xl border border-border/70 bg-background/55 p-3.5 text-xs transition-colors hover:border-border">
                                <div className="flex flex-wrap items-center justify-between gap-2 font-medium">
                                  <span className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={`flex size-6 shrink-0 items-center justify-center rounded-lg border font-mono text-[11px] font-bold ${
                                        isDone
                                          ? "border-success/40 bg-success/15 text-success"
                                          : isRunning
                                          ? "border-primary/50 bg-primary/20 text-primary"
                                          : isFailed
                                          ? "border-destructive/40 bg-destructive/15 text-destructive"
                                          : "border-border bg-secondary/50 text-muted-foreground"
                                      }`}
                                    >
                                      {isDone ? (
                                        <CheckCircle2 className="size-3.5" />
                                      ) : isRunning ? (
                                        <RefreshCw className="size-3.5 animate-spin" />
                                      ) : isFailed ? (
                                        <XCircle className="size-3.5" />
                                      ) : (
                                        st.step_order
                                      )}
                                    </span>
                                    <span className="truncate">
                                      <span className="font-semibold text-foreground">{st.agent_name}</span>
                                      <span className="text-muted-foreground"> — {st.title}</span>
                                    </span>
                                  </span>
                                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium ${statusStyle}`}>
                                    {!isDone && !isRunning && !isFailed && <Clock className="size-2.5" />}
                                    {statusLabel}
                                  </span>
                                </div>
                                {st.output_summary && (
                                  <div className="mt-2.5 pl-8">
                                    <p className={`leading-relaxed text-muted-foreground whitespace-pre-wrap ${isExpanded ? "" : "line-clamp-3"}`}>
                                      {st.output_summary}
                                    </p>
                                    {st.output_summary.length > 180 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedSteps((prev) => ({ ...prev, [st.id]: !isExpanded }))
                                        }
                                        className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
                                      >
                                        {isExpanded ? (
                                          <>
                                            <ChevronUp className="size-3" /> Réduire
                                          </>
                                        ) : (
                                          <>
                                            <ChevronDown className="size-3" /> Voir le détail complet
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {selected.final_report && (
                      <div className="rounded-xl border border-border/80 bg-background/65 p-4">
                        <Md text={selected.final_report} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="glass-card flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-2xl px-6 py-12 text-center">
                  <ShieldCheck className="size-8 text-muted-foreground/60" />
                  <p className="text-sm font-medium text-foreground/85">Rapport de mission</p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Sélectionnez une mission dans la liste pour consulter ses étapes d&apos;agents et son rapport détaillé.
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="mt-4 space-y-3">
          {w.approvals.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center gap-2.5 rounded-2xl px-6 py-12 text-center">
              <div className="flex size-11 items-center justify-center rounded-xl bg-success/10 text-success">
                <ShieldCheck className="size-5" />
              </div>
              <p className="text-sm font-medium">Aucune demande d&apos;approbation</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Les actions sensibles proposées par vos agents apparaîtront ici pour validation explicite.
              </p>
            </div>
          ) : (
            w.approvals.map((ap) => {
              const br = branchInput[ap.id] ?? { base: "main", next: `vigilia/fix-${ap.id.slice(0, 6)}` };
              return (
                <Card key={ap.id} className="rounded-2xl border-border/80 bg-card/85">
                  <CardContent className="space-y-3 p-4 text-sm sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ShieldCheck className="size-4 text-primary" />
                          <span className="font-semibold">{ap.title}</span>
                          <SeverityBadge s={ap.risk_level} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{ap.operation} · Expire : {fmtDate(ap.expires_at)}</p>
                      </div>
                      <span className="rounded-full border border-border/80 bg-muted/40 px-2.5 py-0.5 font-mono text-xs">{ap.status}</span>
                    </div>
                    <div className="grid gap-2.5 rounded-xl border border-border/60 bg-background/50 p-3.5 text-xs sm:grid-cols-2">
                      <div><strong className="text-foreground">Risque :</strong> <span className="text-muted-foreground">{ap.risk_summary}</span></div>
                      <div><strong className="text-foreground">Résultat attendu :</strong> <span className="text-muted-foreground">{ap.expected_result}</span></div>
                      {ap.target_repo && <div className="font-mono sm:col-span-2"><strong>Dépôt :</strong> {ap.target_repo}</div>}
                    </div>
                    {ap.status === "pending" && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Input value={notes[ap.id] ?? ""} onChange={(e) => setNotes({ ...notes, [ap.id]: e.target.value })} placeholder="Note de décision (optionnelle)" className="max-w-xs text-xs" />
                        <Button size="sm" onClick={() => handleDecide(ap.id, true)}><Check className="mr-1 size-3.5" />Approuver</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDecide(ap.id, false)}><X className="mr-1 size-3.5" />Refuser</Button>
                      </div>
                    )}
                    {ap.status === "approved" && ap.action_type === "github_write" && ap.target_repo && (
                      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                        <div><Label className="text-xs">Branche base</Label><Input value={br.base} onChange={(e) => setBranchInput({ ...branchInput, [ap.id]: { ...br, base: e.target.value } })} className="h-8 w-32 font-mono text-xs" /></div>
                        <div><Label className="text-xs">Nouvelle branche</Label><Input value={br.next} onChange={(e) => setBranchInput({ ...branchInput, [ap.id]: { ...br, next: e.target.value } })} className="h-8 w-52 font-mono text-xs" /></div>
                        <Button size="sm" onClick={() => handleExecBranch(ap.id)}><GitBranch className="mr-1 size-3.5" />Créer la branche</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Lancer une nouvelle mission IA</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3.5">
            <div className="space-y-1.5"><Label>Titre</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Auditer les performances API" /></div>
            <div className="space-y-1.5"><Label>Objectif détaillé</Label><Textarea required rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Décrivez le symptôme ou l'analyse souhaitée…" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Projet associé</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Détection automatique</SelectItem>
                    {w.projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priorité</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Faible</SelectItem>
                    <SelectItem value="medium">Moyenne</SelectItem>
                    <SelectItem value="high">Élevée</SelectItem>
                    <SelectItem value="critical">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" className="bg-gradient-primary text-primary-foreground">Créer et exécuter</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
