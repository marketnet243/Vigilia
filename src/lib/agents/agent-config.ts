// Config statique des domaines et outils d'agents – fichier séparé
// pour éviter les conflits TanStack Router code-splitter avec les icônes Lucide

export const AGENT_DOMAIN_KEYS = ["all", "orchestration", "dev", "system", "network", "security"] as const;
export type AgentDomainKey = (typeof AGENT_DOMAIN_KEYS)[number];

export const AGENT_DOMAIN_META: Record<
  AgentDomainKey,
  { label: string; iconName: string; match: string[] }
> = {
  all:          { label: "Tous",             iconName: "Layers",     match: [] },
  orchestration:{ label: "Orchestration",    iconName: "Crown",      match: ["orchestration", "lead"] },
  dev:          { label: "Développement",    iconName: "Code2",      match: ["développement", "dev", "full-stack", "données", "developpement"] },
  system:       { label: "Systèmes & DevOps",iconName: "Terminal",   match: ["système", "systeme", "sysadmin", "linux", "ubuntu", "devops", "docker"] },
  network:      { label: "Réseaux & DNS",    iconName: "Network",    match: ["réseau", "reseau", "dns", "tls", "surveillance", "uptime", "latence", "connectivite"] },
  security:     { label: "Cybersécurité",    iconName: "ShieldAlert", match: ["sécurité", "securite", "cyber", "audit", "incident", "crise"] },
};

export const ALL_TOOL_IDS = [
  "project_context",
  "github_read",
  "prepare_patch",
  "git_branch_manager",
  "database_query",
  "monitoring_read",
  "network_ping",
  "dns_lookup",
  "incident_read",
  "security_scan",
  "audit_read",
  "telegram_notify",
  "integration_check",
  "log_analyzer",
  "memory_read",
  "memory_write",
  "request_approval",
] as const;

export type ToolId = (typeof ALL_TOOL_IDS)[number];

export const TOOL_META: Record<ToolId, { label: string; category: string; iconName: string }> = {
  project_context:   { label: "Contexte projet",          category: "Core",        iconName: "Search" },
  github_read:       { label: "Lecture GitHub",            category: "Code",        iconName: "Eye" },
  prepare_patch:     { label: "Préparation de patch",      category: "Code",        iconName: "Pencil" },
  git_branch_manager:{ label: "Gestion de branches",       category: "Code",        iconName: "GitBranch" },
  database_query:    { label: "Inspection Base SQL",        category: "Données",     iconName: "Database" },
  monitoring_read:   { label: "Lecture Surveillance",       category: "Réseau",      iconName: "Activity" },
  network_ping:      { label: "Ping & Latence",             category: "Réseau",      iconName: "Network" },
  dns_lookup:        { label: "Résolution DNS",             category: "Réseau",      iconName: "Globe" },
  incident_read:     { label: "Historique Incidents",       category: "Sécurité",    iconName: "AlertTriangle" },
  security_scan:     { label: "Audit Sécurité & Secrets",   category: "Sécurité",    iconName: "ShieldAlert" },
  audit_read:        { label: "Journal d'audit",            category: "Sécurité",    iconName: "ShieldCheck" },
  telegram_notify:   { label: "Alerte Telegram d'urgence", category: "Alerting",    iconName: "Send" },
  integration_check: { label: "Contrôle Intégrations",      category: "Infra",       iconName: "Wrench" },
  log_analyzer:      { label: "Analyseur de logs",          category: "Infra",       iconName: "Terminal" },
  memory_read:       { label: "Lecture Mémoire IA",         category: "Mémoire",     iconName: "Bot" },
  memory_write:      { label: "Écriture Mémoire IA",        category: "Mémoire",     iconName: "Sparkles" },
  request_approval:  { label: "Demande d'approbation",      category: "Gouvernance", iconName: "Crown" },
};

export function getToolLabel(id: string): string {
  return (TOOL_META as Record<string, { label: string }>)[id]?.label ?? id;
}

export function getAgentDomainName(specialty: string, roleTitle: string, name: string, isLead?: boolean): string {
  const text = `${specialty ?? ""} ${roleTitle ?? ""} ${name ?? ""}`.toLowerCase();
  if (isLead || text.includes("orchestration")) return "Orchestration";
  if (text.includes("sécurité") || text.includes("securite") || text.includes("cyber") || text.includes("incident") || text.includes("crise"))
    return "Cybersécurité";
  if (text.includes("système") || text.includes("systeme") || text.includes("linux") || text.includes("devops") || text.includes("docker"))
    return "Systèmes & DevOps";
  if (text.includes("réseau") || text.includes("reseau") || text.includes("dns") || text.includes("surveillance") || text.includes("uptime"))
    return "Réseaux & DNS";
  return "Développement";
}

export function getDomainBadgeStyle(domain: string): string {
  switch (domain) {
    case "Orchestration":    return "border-primary/40 bg-primary/10 text-primary";
    case "Développement":    return "border-blue-500/40 bg-blue-500/10 text-blue-400";
    case "Systèmes & DevOps":return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
    case "Réseaux & DNS":    return "border-purple-500/40 bg-purple-500/10 text-purple-400";
    case "Cybersécurité":    return "border-red-500/40 bg-red-500/10 text-red-400";
    default:                 return "border-border bg-secondary/50 text-muted-foreground";
  }
}
