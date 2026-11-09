import { requireAdmin } from '../_shared/auth.js';
import { ensureWindows, json } from '../_shared/attendance.js';

export async function onRequestPost(context) {
  try {
    const denied = await requireAdmin(context, true);
    if (denied) return denied;
    let body;
    try { body = await context.request.json(); }
    catch { return json({ error: 'Neplatná data' }, 400); }
    if (typeof body?.code !== 'string' || !body.code.trim()) {
      return json({ error: 'Nejdříve spusťte hodinu' }, 400);
    }
    await ensureWindows(context.env.DB);
    const row = await context.env.DB.prepare(`UPDATE attendance_windows
      SET expires_at = MAX(expires_at, ?) + 300000
      WHERE code = ? AND EXISTS (SELECT 1 FROM sessions WHERE code = attendance_windows.code AND active = 1)
      RETURNING expires_at`).bind(Date.now(), body.code.trim().toUpperCase()).first();
    if (!row) return json({ error: 'Hodina se změnila nebo není spuštěná. Obnovte přehled.' }, 409);
    return json({ expiresAt: row.expires_at, serverNow: Date.now() });
  } catch {
    return json({ error: 'Čas se nepodařilo prodloužit' }, 500);
  }
}
