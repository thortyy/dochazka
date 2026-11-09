import { ensureWindows, json, findStudent } from '../_shared/attendance.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Neplatná data' }, 400); }
  if (typeof body?.name !== 'string' || typeof body?.code !== 'string' || !body.name.trim() || !body.code.trim()) {
    return json({ error: 'Vyplň jméno, příjmení a kód hodiny' }, 400);
  }
  const name = findStudent(body.name);
  const code = body.code.trim().toUpperCase();
  if (!name) return json({ error: 'Zadej své celé jméno a příjmení podle seznamu třídy' }, 400);
  try {
    await ensureWindows(env.DB);
    const session = await env.DB.prepare(`SELECT s.code, w.expires_at
      FROM sessions s LEFT JOIN attendance_windows w ON s.code = w.code
      WHERE s.code = ? AND s.active = 1`).bind(code).first();
    if (!session) return json({ error: 'Neplatný nebo neaktivní kód' }, 400);
    if (!session.expires_at || Date.now() >= session.expires_at) {
      return json({ error: 'Časový limit 10 minut vypršel. Přihlášení je uzavřené.' }, 400);
    }
    // Ověř limit a aktivní hodinu znovu při samotném zápisu.
    const result = await env.DB.prepare(`INSERT INTO attendance (name, code)
      SELECT ?, ? WHERE EXISTS (
        SELECT 1 FROM sessions s JOIN attendance_windows w ON s.code = w.code
        WHERE s.code = ? AND s.active = 1 AND w.expires_at > ?
      ) AND NOT EXISTS (SELECT 1 FROM attendance WHERE name = ? AND code = ?)`)
      .bind(name, code, code, Date.now(), name, code).run();
    if (!result.meta.changes) {
      const existing = await env.DB.prepare('SELECT name FROM attendance WHERE name = ? AND code = ?').bind(name, code).first();
      if (!existing) return json({ error: 'Přihlášení je uzavřené. Obnov stránku.' }, 400);
    }
    return json({ success: true });
  } catch (err) {
    return json({ error: 'Chyba serveru' }, 500);
  }
}
