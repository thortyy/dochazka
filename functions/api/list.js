export async function onRequestGet(context) {
  const { env } = context;

  try {
    const session = await env.DB.prepare(
      'SELECT code FROM sessions WHERE active = 1'
    ).first();

    if (!session) {
      return Response.json({ code: null, students: [] });
    }

    const { results } = await env.DB.prepare(
      'SELECT name, created_at FROM attendance WHERE code = ? ORDER BY created_at DESC'
    ).bind(session.code).all();

    return Response.json({
      code: session.code,
      students: results
    });
  } catch (err) {
    return Response.json({ error: 'Chyba' }, { status: 500 });
  }
}
