import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Rocket, Send, Sparkles, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/shell";
import { Md } from "@/components/app/md";
import { PageHeader } from "@/components/app/status";
import { pageHead } from "@/lib/workspace/head";
import { askAssistant } from "@/lib/workspace/integrations.functions";
import { createMission, runMission, type Workspace } from "@/lib/workspace/workspace.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatMsg = { role: "user" | "assistant"; content: string; meta?: string };

export const Route = createFileRoute("/assistant")({
  head: () => pageHead("Assistant IA", "Échangez avec Vigilia Lead à partir du contexte réel de vos projets et incidents."),
  component: () => <AppShell>{(w, refresh) => <AssistantView w={w} refresh={refresh} />}</AppShell>,
});

const SUGGESTIONS = [
  "Fais le point sur mes projets, contrôles et incidents ouverts.",
  "Quels sont les points de vigilance sécurité ou surveillance prioritaires ?",
  "Propose un plan d'action structuré pour fiabiliser mon infrastructure.",
];

function AssistantView({ w, refresh }: { w: Workspace; refresh: () => void }) {
  const navigate = useNavigate();
  const ask = useServerFn(askAssistant);
  const addMission = useServerFn(createMission);
  const execMission = useServerFn(runMission);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [escalating, setEscalating] = useState(false);

  const openInc = w.incidents.filter((i) => i.status !== "resolved").length;

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await ask({ data: { messages: next.map(({ role, content }) => ({ role, content })) } });
      setMessages([...next, { role: "assistant", content: r.text, meta: `${r.provider} · ${r.model}` }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de l'assistant IA");
    } finally {
      setBusy(false);
    }
  }

  async function promoteToMission(promptText: string) {
    if (escalating) return;
    setEscalating(true);
    try {
      const created = await addMission({
        data: { title: promptText.slice(0, 120), description: promptText, project_id: null, priority: "medium", token_budget: 32000, max_steps: 6 },
      });
      toast.success("Mission créée, lancement de l'équipe d'agents…");
      execMission({ data: { id: created.id } }).catch(() => {});
      refresh();
      void navigate({ to: "/missions" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de créer la mission");
    } finally {
      setEscalating(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-13rem)] flex-col lg:h-[calc(100dvh-7.5rem)]">
      <PageHeader
        title="Assistant Vigilia Lead"
        sub={`Contexte connecté : ${w.projects.length} projet(s), ${w.monitors.length} contrôle(s), ${openInc} incident(s) ouverts.`}
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-[11px] text-primary">
            <Sparkles className="size-3.5" />
            Directeur Technique IA
          </span>
          {messages.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setMessages([])}>
              <Trash2 className="mr-1.5 size-4" />
              Effacer
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="glass-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-5 py-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <Bot className="size-7" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Directeur technique IA connecté à vos données réelles
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Les secrets sont automatiquement filtrés. Pour une investigation multi-agents complète, transformez n&apos;importe quelle demande en mission.
                </p>
              </div>
              <div className="flex w-full max-w-xl flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/50 px-4 py-3 text-left text-xs text-foreground/90 transition-all hover:border-primary/45 hover:bg-primary/5"
                  >
                    <span>{s}</span>
                    <Send className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={
                  m.role === "user"
                    ? "ml-auto flex max-w-2xl items-start gap-3"
                    : "mr-auto flex max-w-3xl items-start gap-3"
                }
              >
                {m.role === "assistant" && (
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Bot className="size-4" />
                  </div>
                )}
                <div
                  className={
                    m.role === "user"
                      ? "flex-1 rounded-2xl border border-primary/25 bg-primary/12 px-4 py-3 text-sm"
                      : "flex-1 rounded-2xl border border-border/80 bg-background/60 px-4 py-3"
                  }
                >
                  {m.role === "user" ? (
                    <div className="space-y-2">
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={escalating}
                        onClick={() => promoteToMission(m.content)}
                        className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                      >
                        <Rocket className="mr-1.5 size-3.5" />
                        Lancer en mission multi-agents
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Md text={m.content} />
                      {m.meta && (
                        <div className="border-t border-border/50 pt-2 font-mono text-[11px] text-muted-foreground">
                          {m.meta}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/60 text-foreground">
                    <User className="size-4" />
                  </div>
                )}
              </div>
            ))
          )}
          {busy && (
            <div className="flex items-center gap-2.5 text-xs text-primary">
              <span className="size-2 rounded-full bg-primary pulse-dot" />
              <span>Vigilia Lead analyse votre contexte…</span>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2.5 border-t border-border/70 bg-background/40 p-3 sm:p-4"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Posez une question technique ou demandez un diagnostic…"
            className="min-h-[46px] max-h-36 resize-none rounded-xl border-border/80 bg-background/70 text-sm focus-visible:border-primary/50"
          />
          <Button
            type="submit"
            disabled={busy || !input.trim()}
            className="h-11 shrink-0 rounded-xl bg-gradient-primary px-4 text-primary-foreground shadow-glow hover:opacity-95"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
