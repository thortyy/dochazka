export async function onRequestPost(context) {
  const { env } = context;

  try {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();

    await env.DB.prepare('UPDATE sessions SET active = 0').run();

    await env.DB.prepare(
      'INSERT INTO sessions (code, active) VALUES (?, 1)'
    ).bind(code).run();

    return Response.json({ code });
  } catch (err) {
    return Response.json({ error: 'Chyba' }, { status: 500 });
  }
}
