import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

async function executeScheduledChecks(request: Request) {
  const cronSecret = process.env['CRON_SECRET'];
  const authHeader = request.headers.get('authorization') ?? '';
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Valid Vercel CRON_SECRET
  } else {
    const authFailure = await authenticateCronRequest(request);
    if (authFailure) return authFailure;
  }

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { performCheck, recordResult } = await import('@/lib/monitoring/check');
  const { data: monitors } = await supabaseAdmin.from('monitors').select('*').eq('enabled', true).limit(200);
  const now = Date.now();
  const due = (monitors ?? []).filter(
    (m) => !m.last_checked_at || now - Date.parse(m.last_checked_at) >= m.interval_minutes * 60_000 - 15_000,
  );
  let checked = 0;
  for (const m of due.slice(0, 40)) {
    try {
      const r = await performCheck(m);
      await recordResult(supabaseAdmin, m, r);
      checked++;
    } catch (e) {
      console.error('check failed', m.id, e);
    }
  }
  return Response.json({ checked, due: due.length, ts: new Date().toISOString() });
}

export const Route = createFileRoute('/api/public/jobs/run-checks')({
  server: {
    handlers: {
      GET: async ({ request }) => executeScheduledChecks(request),
      POST: async ({ request }) => executeScheduledChecks(request),
    },
  },
});
