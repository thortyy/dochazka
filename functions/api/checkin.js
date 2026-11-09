export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { name, code } = await request.json();

    if (!name || !code) {
      return Response.json({ error: 'Chybí jméno nebo kód' }, { status: 400 });
    }

    const session = await env.DB.prepare(
      'SELECT * FROM sessions WHERE code = ? AND active = 1'
    ).bind(code.toUpperCase()).first();

    if (!session) {
      return Response.json({ error: 'Neplatný nebo neaktivní kód' }, { status: 400 });
    }

    await env.DB.prepare(
      'INSERT INTO attendance (name, code) VALUES (?, ?)'
    ).bind(name, code.toUpperCase()).run();

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: 'Chyba serveru' }, { status: 500 });
  }
}
