import { requireAdmin } from '../_shared/auth.js';
import { ensureWindows, json, roster, findStudent } from '../_shared/attendance.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const denied = await requireAdmin(context, false);
    if (denied) return denied;
    await ensureWindows(env.DB);
    const session = await env.DB.prepare(`SELECT s.code, w.expires_at, t.started_at
      FROM sessions s LEFT JOIN attendance_windows w ON s.code = w.code
      LEFT JOIN attendance_session_starts t ON s.code = t.code
      WHERE s.active = 1`).first();
    let results = [];
    if (session) {
      ({ results } = await env.DB.prepare(
        'SELECT name, created_at FROM attendance WHERE code = ? ORDER BY created_at ASC'
      ).bind(session.code).all());
    }
    const present = new Map();
    for (const row of results) {
      const student = findStudent(row.name);
      if (student && !present.has(student)) present.set(student, row.created_at);
    }
    return json({
      code: session?.code ?? null,
      expiresAt: session?.expires_at ?? null,
      startedAt: session?.started_at ?? null,
      serverNow: Date.now(),
      students: roster.map(name => ({ name, present: present.has(name), created_at: present.get(name) ?? null }))
    });
  } catch (err) {
    return json({ error: 'Chyba při načítání docházky' }, 500);
  }
}
