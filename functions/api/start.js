import { requireAdmin } from '../_shared/auth.js';
import { ensureWindows, json } from '../_shared/attendance.js';

export async function onRequestPost(context) {
  const { env } = context;
  try {
    const denied = await requireAdmin(context, true);
    if (denied) return denied;
    await ensureWindows(env.DB);
    const code = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await env.DB.batch([
      env.DB.prepare('UPDATE sessions SET active = 0'),
      env.DB.prepare('INSERT INTO sessions (code, active) VALUES (?, 1)').bind(code),
      env.DB.prepare('INSERT INTO attendance_windows (code, expires_at) VALUES (?, ?)').bind(code, expiresAt)
    ]);
    return json({ code, expiresAt, serverNow: Date.now() });
  } catch (err) {
    return json({ error: 'Chyba při spuštění hodiny' }, 500);
  }
}
