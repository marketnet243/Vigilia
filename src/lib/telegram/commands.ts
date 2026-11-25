import { z } from 'zod';

const messageSchema = z.object({
  message_id: z.number().int().nonnegative(),
  chat: z.object({ id: z.number().int().safe(), type: z.string() }),
  from: z.object({ id: z.number().int().safe(), is_bot: z.boolean().optional() }).optional(),
  text: z.string().max(4096).optional(),
});
export const telegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: messageSchema.optional(),
  edited_message: messageSchema.optional(),
});

export const telegramCommands = [
  { command: 'help', description: 'Menu des commandes' },
  { command: 'status', description: 'État général du système' },
  { command: 'projects', description: 'Projets et identifiants' },
  { command: 'project', description: 'Détail : /project identifiant' },
  { command: 'monitors', description: 'Contrôles de surveillance' },
  { command: 'check', description: 'Contrôler : /check identifiant' },
  { command: 'pause', description: 'Suspendre : /pause identifiant' },
  { command: 'resume', description: 'Reprendre : /resume identifiant' },
  { command: 'incidents', description: 'Incidents ouverts' },
  { command: 'resolve', description: 'Résoudre : /resolve identifiant' },
  { command: 'missions', description: 'Missions récentes' },
  { command: 'mission', description: 'Lancer une mission : /mission demande' },
  { command: 'report', description: 'Rapport : /report identifiant' },
  { command: 'cancel', description: 'Annuler une mission encore en attente' },
  { command: 'agents', description: 'Équipe et disponibilités' },
  { command: 'approvals', description: 'Actions en attente de décision' },
  { command: 'approve', description: 'Examiner puis approuver une action' },
  { command: 'reject', description: 'Examiner puis refuser une action' },
  { command: 'ask', description: 'Discuter avec Vigilia : /ask question' },
  { command: 'reset', description: 'Nouvelle conversation' },
  { command: 'note', description: 'Mémoriser : /note votre note' },
  { command: 'memories', description: 'Notes et connaissances récentes' },
  { command: 'alerts', description: 'Préférences : /alerts incidents on ou off' },
] as const;

export const telegramHelp = `🛰️ Vigilia — centre de commande

SYSTÈME
/status · /projects · /project <id> · /agents

SURVEILLANCE
/monitors · /check <id> · /pause <id> · /resume <id>
/incidents · /resolve <id>

MISSIONS
/mission <demande> · /missions · /report <id> · /cancel <id>

DÉCISIONS
/approvals · /approve <id> · /reject <id>
Une décision sensible demande une confirmation explicite. Approuver n’exécute pas l’action.

CONVERSATION & MÉMOIRE
Écrivez directement votre question, ou /ask <question>.
/reset · /note <texte> · /memories

ALERTES
/alerts · /alerts incidents|missions|approvals on|off

Les listes affichent les identifiants. Un préfixe unique d’au moins 6 caractères est accepté. Les missions et conversations utilisent vos fournisseurs IA configurés.`;

export function parseTelegramCommand(text: string) {
  const match = text.trim().match(/^\/([a-z_]+)(?:@([a-z0-9_]+))?(?:\s+([\s\S]*))?$/i);
  return match ? { command: match[1]?.toLowerCase() ?? '', bot: match[2]?.toLowerCase() ?? null, argument: match[3]?.trim() ?? '' } : { command: 'ask', bot: null, argument: text.trim() };
}

export function uniqueById<T extends { id: string }>(rows: T[], prefix: string): T {
  if (!/^[0-9a-f-]{6,36}$/i.test(prefix)) throw new Error('Indiquez un identifiant de la liste (au moins 6 caractères).');
  const matches = rows.filter(row => row.id.toLowerCase().startsWith(prefix.toLowerCase()));
  const row = matches[0];
  if (!row) throw new Error('Élément introuvable. Actualisez la liste.');
  if (matches.length !== 1) throw new Error('Identifiant ambigu : utilisez davantage de caractères.');
  return row;
}

export function authorizedTelegramChat(link: { verified: boolean; chat_id: number | null }, message: z.infer<typeof messageSchema>) {
  return link.verified && message.chat.type === 'private' && message.from?.is_bot !== true &&
    Number(link.chat_id) === message.chat.id && message.from?.id === message.chat.id;
}

export function splitTelegramText(text: string): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 3900) {
    let end = rest.lastIndexOf('\n', 3900);
    if (end < 1000) end = 3900;
    // Do not split a UTF-16 surrogate pair.
    const code = rest.charCodeAt(end - 1);
    if (code >= 0xd800 && code <= 0xdbff) end--;
    chunks.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  if (rest) chunks.push(rest);
  return chunks;
}