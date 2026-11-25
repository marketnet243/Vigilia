import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { authorizedTelegramChat, parseTelegramCommand, splitTelegramText, telegramHelp, telegramUpdateSchema } from '@/lib/telegram/commands';

export async function handleTelegramWebhook(request: Request): Promise<Response> {
  const owner = z.uuid().safeParse(new URL(request.url).searchParams.get('o'));
  if (!owner.success) return new Response('Bad request', { status: 400 });
  const provided = request.headers.get('x-telegram-bot-api-secret-token');
  if (!provided || provided.length > 256) return new Response('Unauthorized', { status: 401 });
  const { supabaseAdmin: a } = await import('@/integrations/supabase/client.server');
  const { sha256Base64Url, timingSafeEqualStr, decryptSecret, containsSecret, redactSecrets } = await import('@/lib/crypto.server');
  const { data: link, error: linkError } = await a.from('telegram_links').select('*').eq('owner_id', owner.data).maybeSingle();
  if (linkError) return new Response('Temporarily unavailable', { status: 503 });
  if (!link?.webhook_secret_hash || !link.encrypted_bot_token || !timingSafeEqualStr(await sha256Base64Url(provided), link.webhook_secret_hash)) return new Response('Unauthorized', { status: 401 });
  // A revoked owner must no longer be able to operate through an old bot link.
  const { data: role, error: roleError } = await a.from('user_roles').select('id').eq('user_id', owner.data).eq('role', 'owner').maybeSingle();
  if (roleError) return new Response('Temporarily unavailable', { status: 503 });
  if (!role) return new Response('Forbidden', { status: 403 });
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 64000) return new Response('Payload too large', { status: 413 });
    body = JSON.parse(raw);
  } catch { return new Response('Invalid JSON', { status: 400 }); }
  const parsed = telegramUpdateSchema.safeParse(body);
  if (!parsed.success) return new Response('Invalid update', { status: 400 });
  const update = parsed.data;
  // Editing a sent command must never trigger an action a second time.
  const msg = update.message;
  if (!msg?.text) return Response.json({ ok: true, ignored: true });
  if (msg.chat.type !== 'private' || msg.from?.id !== msg.chat.id || msg.from.is_bot === true) return Response.json({ ok: true, ignored: true });
  if (link.verified && !authorizedTelegramChat(link, msg)) return Response.json({ ok: true, ignored: true });
  const cmd = parseTelegramCommand(msg.text);
  if (cmd.bot && cmd.bot !== link.bot_username?.toLowerCase()) return Response.json({ ok: true, ignored: true });
  const { sendTelegramText } = await import('@/lib/telegram/client.server');
  const token = await decryptSecret(link.encrypted_bot_token);
  let responses = '';
  const reply = async (text: string) => {
    const safe = redactSecrets(text);
    for (const chunk of splitTelegramText(safe)) {
      const result = await sendTelegramText(token, msg.chat.id, chunk, { plain: true, menu: cmd.command === 'help' || cmd.command === 'start' });
      if (!result.ok) throw new Error('Envoi de la réponse Telegram impossible.');
    }
    responses += (responses ? '\n\n' : '') + safe;
    await a.from('telegram_messages').update({ raw_update: { response: responses.slice(0, 24000) } }).eq('owner_id', owner.data).eq('update_id', update.update_id);
  };
  // Persist only authorized, redacted text; primary key prevents retries from replaying writes.
  const stored = await a.from('telegram_messages').insert({ update_id: update.update_id, owner_id: owner.data, chat_id: msg.chat.id, user_id: msg.from.id, direction: 'in', text: link.verified ? redactSecrets(msg.text) : '[Liaison Telegram]' });
  if (stored.error?.code === '23505') return Response.json({ ok: true, duplicate: true });
  if (stored.error) return new Response('Temporarily unavailable', { status: 503 });
  try {
    if (!link.verified) {
      const code = cmd.command === 'start' ? cmd.argument : msg.text.trim();
      const valid = link.verification_code && link.verification_expires_at && Date.parse(link.verification_expires_at) > Date.now() && timingSafeEqualStr(code, link.verification_code);
      if (!valid) await reply('Envoyez le code de vérification affiché dans Vigilia.');
      else {
        const result = await a.from('telegram_links').update({ verified: true, chat_id: msg.chat.id, verification_code: null, verification_expires_at: null }).eq('owner_id', owner.data).eq('verified', false).eq('verification_code', code).gt('verification_expires_at', new Date().toISOString()).select('id').single();
        if (result.error) throw new Error('Liaison déjà décidée ou code expiré.');
        await reply('✅ Chat privé lié à Vigilia.\n\n' + telegramHelp);
      }
    } else if (containsSecret(msg.text)) await reply('Retirez les secrets de votre message. Ils ne sont pas enregistrés en clair.');
    else {
      const { dispatchTelegramCommand } = await import('@/lib/telegram/dispatch.server');
      await dispatchTelegramCommand(a, owner.data, msg.chat.id, msg.text, reply);
    }
    await a.from('telegram_links').update({ last_error: null }).eq('owner_id', owner.data);
  } catch (error) {
    const safe = redactSecrets(error instanceof Error ? error.message : 'Commande impossible.').slice(0, 500);
    await a.from('telegram_links').update({ last_error: safe }).eq('owner_id', owner.data);
    try { await reply(`⚠️ ${safe}\nConsultez l’état dans Vigilia avant de renvoyer une action.`); } catch { /* A retry must not replay a completed action. */ }
  }
  return Response.json({ ok: true });
}

export const Route = createFileRoute('/api/public/telegram/webhook')({
  server: { handlers: { POST: ({ request }) => handleTelegramWebhook(request) } },
});
