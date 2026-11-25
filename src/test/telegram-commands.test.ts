import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { authorizedTelegramChat, parseTelegramCommand, splitTelegramText, telegramUpdateSchema, uniqueById } from '@/lib/telegram/commands';
import { dispatchTelegramCommand } from '@/lib/telegram/dispatch.server';

const completion = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai/providers.server', () => ({ runRoutedCompletion: completion }));
const owner = '11c4f1fd-22e6-4e40-ab4e-15d8942879e3';
const id = 'abcdef01-1111-4111-8111-111111111111';
type Row = Record<string, unknown>;
function database(seed: Record<string, Row[]>) {
  const tables = structuredClone(seed);
  const operations: { table: string; kind: string; values: Row; filters: [string, unknown][] }[] = [];
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    const tests: ((r: Row) => boolean)[] = [];
    let kind = 'select', values: Row = {}, single = false;
    const chain = {
      select: () => chain, order: () => chain, limit: () => chain,
      eq: (key: string, value: unknown) => { filters.push([key, value]); tests.push(r => r[key] === value); return chain; },
      neq: (key: string, value: unknown) => { tests.push(r => r[key] !== value); return chain; },
      gt: (key: string, value: string) => { tests.push(r => String(r[key]) > value); return chain; },
      in: (key: string, choices: unknown[]) => { tests.push(r => choices.includes(r[key])); return chain; },
      update: (row: Row) => { kind = 'update'; values = row; return chain; },
      insert: (row: Row) => { kind = 'insert'; values = row; return chain; },
      single: () => { single = true; return chain; },
      then: (resolve: (v: unknown) => unknown) => {
        let rows = (tables[table] ?? []).filter(r => tests.every(test => test(r)));
        if (kind !== 'select') {
          operations.push({ table, kind, values, filters });
          if (kind === 'insert') { const row = { id, ...values }; tables[table] = [...(tables[table] ?? []), row]; rows = [row]; }
          else rows.forEach(r => Object.assign(r, values));
        }
        return Promise.resolve(resolve({ data: single ? rows[0] ?? null : rows, error: null, count: rows.length }));
      },
    };
    return chain;
  };
  return { client: { from } as unknown as SupabaseClient<Database>, tables, operations };
}

describe('Telegram command security', () => {
  it('accepts only the verified owner private chat', () => {
    const link = { verified: true, chat_id: 42 };
    const message = { message_id: 1, chat: { id: 42, type: 'private' }, from: { id: 42 } };
    expect(authorizedTelegramChat(link, message)).toBe(true);
    expect(authorizedTelegramChat(link, { ...message, chat: { id: 42, type: 'group' } })).toBe(false);
    expect(authorizedTelegramChat(link, { ...message, from: { id: 99 } })).toBe(false);
    expect(authorizedTelegramChat({ ...link, verified: false }, message)).toBe(false);
    expect(authorizedTelegramChat({ ...link, chat_id: null }, message)).toBe(false);
  });
  it('validates incoming update IDs and message payloads', () => {
    expect(telegramUpdateSchema.safeParse({ update_id: -1 }).success).toBe(false);
    expect(telegramUpdateSchema.safeParse({ update_id: 1, message: { message_id: 1, chat: { id: 42, type: 'private' }, text: 'x'.repeat(4097) } }).success).toBe(false);
    expect(telegramUpdateSchema.safeParse({ update_id: 1, message: { message_id: 1, chat: { id: 42, type: 'private' }, text: '/help' } }).success).toBe(true);
  });
  it('parses bot-qualified commands and multiline natural conversation', () => {
    expect(parseTelegramCommand('/CHECK@Assistant_net_bot abcdef01')).toEqual({ command: 'check', bot: 'assistant_net_bot', argument: 'abcdef01' });
    expect(parseTelegramCommand('Bonjour\nQuels incidents ?').command).toBe('ask');
    expect(parseTelegramCommand('/note ligne 1\nligne 2').argument).toBe('ligne 1\nligne 2');
  });
  it('rejects ambiguous and short identifiers rather than picking the first', () => {
    expect(uniqueById([{ id }], 'abcdef01').id).toBe(id);
    expect(() => uniqueById([{ id }, { id: 'abcdef02-1111-4111-8111-111111111111' }], 'abcdef')).toThrow('ambigu');
    expect(() => uniqueById([{ id }], 'abc')).toThrow();
  });
  it('splits long replies without losing content or breaking emoji', () => {
    const text = 'x'.repeat(3899) + '🛰️' + 'y'.repeat(5000);
    const parts = splitTelegramText(text);
    expect(parts.join('')).toBe(text);
    expect(parts.every(p => p.length <= 3900)).toBe(true);
    expect(parts[0]?.endsWith('x')).toBe(true);
  });
});

describe('Telegram system control', () => {
  beforeEach(() => completion.mockReset());
  it('pauses and resumes only the owner monitor and audits both actions', async () => {
    const db = database({ monitors: [{ id, owner_id: owner, name: 'Production', enabled: true }, { id: 'fedcba01-1111-4111-8111-111111111111', owner_id: 'other', enabled: true }] });
    const reply = vi.fn(async () => {});
    await dispatchTelegramCommand(db.client, owner, 42, '/pause abcdef01', reply);
    expect(db.tables['monitors']?.[0]?.['enabled']).toBe(false);
    expect(db.operations[0]?.filters).toContainEqual(['owner_id', owner]);
    await dispatchTelegramCommand(db.client, owner, 42, '/resume abcdef01', reply);
    expect(db.tables['monitors']?.[0]?.['enabled']).toBe(true);
    expect(db.operations.filter(op => op.table === 'audit_logs')).toHaveLength(2);
    await expect(dispatchTelegramCommand(db.client, owner, 42, '/pause fedcba01', reply)).rejects.toThrow('introuvable');
  });
  it('requires the full approval ID and explicit confirmation without executing anything', async () => {
    const db = database({ approvals: [{ id, owner_id: owner, status: 'pending', expires_at: '2099-01-01T00:00:00Z', title: 'Action', operation: 'create branch', risk_summary: 'Écriture', risk_level: 'high' }] });
    const reply = vi.fn(async () => {});
    await dispatchTelegramCommand(db.client, owner, 42, '/approve abcdef01', reply);
    expect(db.operations).toHaveLength(0);
    await dispatchTelegramCommand(db.client, owner, 42, '/approve abcdef01 confirmer', reply);
    expect(db.operations).toHaveLength(0);
    await dispatchTelegramCommand(db.client, owner, 42, `/approve ${id} confirmer`, reply);
    expect(db.tables['approvals']?.[0]?.['status']).toBe('approved');
    expect(db.operations.filter(op => op.table === 'approvals')).toHaveLength(1);
    await expect(dispatchTelegramCommand(db.client, owner, 42, `/approve ${id} confirmer`, reply)).rejects.toThrow();
  });
  it('does not approve expired decisions', async () => {
    const db = database({ approvals: [{ id, owner_id: owner, status: 'pending', expires_at: '2020-01-01T00:00:00Z' }] });
    await expect(dispatchTelegramCommand(db.client, owner, 42, `/approve ${id} confirmer`, vi.fn(async () => {}))).rejects.toThrow();
    expect(db.operations).toHaveLength(0);
  });
  it('never cancels an already running mission', async () => {
    const db = database({ missions: [{ id, owner_id: owner, status: 'in_progress', title: 'Diagnostic' }] });
    await dispatchTelegramCommand(db.client, owner, 42, '/cancel abcdef01', vi.fn(async () => {}));
    expect(db.operations).toHaveLength(0);
    expect(db.tables['missions']?.[0]?.['status']).toBe('in_progress');
  });
  it('persists a note and reads it back', async () => {
    const db = database({ memories: [] });
    const reply = vi.fn(async () => {});
    await dispatchTelegramCommand(db.client, owner, 42, '/note Vérifier le certificat vendredi', reply);
    expect(db.tables['memories']?.[0]?.['content']).toBe('Vérifier le certificat vendredi');
    await dispatchTelegramCommand(db.client, owner, 42, '/memories', reply);
    expect(reply.mock.calls.flat().join(' ')).toContain('Vérifier le certificat vendredi');
  });
  it('refuses secrets before saving memory or invoking AI', async () => {
    const db = database({});
    const secret = 'ghp_1234567890abcdefghij123456';
    await dispatchTelegramCommand(db.client, owner, 42, `/note ${secret}`, vi.fn(async () => {}));
    await dispatchTelegramCommand(db.client, owner, 42, `/ask ${secret}`, vi.fn(async () => {}));
    expect(db.operations).toHaveLength(0);
    expect(completion).not.toHaveBeenCalled();
  });
  it('updates a single notification category', async () => {
    const db = database({ telegram_links: [{ id, owner_id: owner, notify_incidents: true, notify_missions: true }] });
    await dispatchTelegramCommand(db.client, owner, 42, '/alerts incidents off', vi.fn(async () => {}));
    expect(db.tables['telegram_links']?.[0]?.['notify_incidents']).toBe(false);
    expect(db.tables['telegram_links']?.[0]?.['notify_missions']).toBe(true);
  });
  it('conversation reset excludes previous turns while retaining persistent notes', async () => {
    const db = database({ projects: [], incidents: [], monitors: [], memories: [{ owner_id: owner, obsolete: false, title: 'Certificat', content: 'vendredi' }], telegram_messages: [
      { owner_id: owner, chat_id: 42, text: 'Question actuelle' },
      { owner_id: owner, chat_id: 42, text: '/reset' },
      { owner_id: owner, chat_id: 42, text: 'Ancienne question', raw_update: { response: 'Ancienne réponse' } },
    ] });
    completion.mockResolvedValue({ text: 'Réponse actuelle' });
    const reply = vi.fn(async () => {});
    await dispatchTelegramCommand(db.client, owner, 42, 'Question actuelle', reply);
    const call = completion.mock.calls[0];
    expect(call?.[3]).toContain('Question actuelle');
    expect(call?.[3]).not.toContain('Ancienne');
    expect(call?.[2]).toContain('Certificat');
    expect(reply).toHaveBeenCalledWith('Réponse actuelle');
  });
});