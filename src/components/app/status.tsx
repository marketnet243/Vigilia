import { cn } from "@/lib/utils";

export function StatusDot({ status }: { status: string }) {
  const c =
    status === "up" || status === "connected" || status === "active" || status === "completed"
      ? "bg-success shadow-[0_0_8px_color-mix(in_oklab,var(--success)_60%,transparent)]"
      : status === "down" || status === "error" || status === "failed" || status === "invalid"
        ? "bg-destructive shadow-[0_0_8px_color-mix(in_oklab,var(--destructive)_60%,transparent)]"
        : status === "awaiting_approval" || status === "degraded" || status === "rate_limited" || status === "circuit_open"
          ? "bg-warning shadow-[0_0_8px_color-mix(in_oklab,var(--warning)_60%,transparent)]"
          : "bg-muted-foreground/70";
  return (
    <span
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        c,
        (status === "down" || status === "awaiting_approval") && "pulse-dot"
      )}
    />
  );
}

const SEV: Record<string, string> = {
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
  critical: "Critique",
};

const SEVC: Record<string, string> = {
  low: "text-muted-foreground border-border/80 bg-muted/40",
  medium: "text-warning border-warning/35 bg-warning/10",
  high: "text-destructive border-destructive/35 bg-destructive/10",
  critical: "text-destructive-foreground bg-destructive border-destructive shadow-sm",
};

export function SeverityBadge({ s }: { s: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide", SEVC[s])}>
      {SEV[s] ?? s}
    </span>
  );
}

const INC_ST: Record<string, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Résolu",
};

export function IncidentStatus({ s }: { s: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        s === "resolved" ? "text-success" : s === "open" ? "text-destructive" : "text-warning"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          s === "resolved" ? "bg-success" : s === "open" ? "bg-destructive pulse-dot" : "bg-warning"
        )}
      />
      {INC_ST[s] ?? s}
    </span>
  );
}

export const MISSION_STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  planning: "Planification",
  investigating: "En investigation",
  in_progress: "En cours",
  awaiting_approval: "En attente d'approbation",
  validating: "En validation",
  completed: "Terminée",
  failed: "Échec",
  cancelled: "Annulée",
};

export function MissionStatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "border-success/35 bg-success/10 text-success"
      : status === "failed"
        ? "border-destructive/35 bg-destructive/10 text-destructive"
        : status === "awaiting_approval"
          ? "border-warning/40 bg-warning/15 text-warning"
          : status === "cancelled"
            ? "border-border/80 bg-muted/40 text-muted-foreground"
            : "border-primary/35 bg-primary/10 text-primary";
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium", cls)}>
      {MISSION_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export const INTEGRATION_STATUS_LABEL: Record<string, string> = {
  not_configured: "À configurer",
  disconnected: "Non connecté",
  connected: "Connecté",
  error: "Erreur",
};

export function IntegrationStatusBadge({ status }: { status: string }) {
  const cls =
    status === "connected"
      ? "border-success/35 bg-success/10 text-success"
      : status === "error"
        ? "border-destructive/35 bg-destructive/10 text-destructive"
        : "border-border/80 bg-muted/40 text-muted-foreground";
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium", cls)}>
      {INTEGRATION_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export const ENV_LABEL: Record<string, string> = {
  production: "Production",
  staging: "Staging",
  development: "Développement",
};

export function fmtDuration(fromIso: string, toIso?: string | null) {
  const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime();
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} h ${m % 60} min` : `${Math.floor(h / 24)} j`;
}

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
