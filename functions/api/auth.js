import { json } from '../_shared/attendance.js';
import { ensureAuth, currentUser, sameOrigin, randomToken, digest, passwordHash, sessionResponse } from '../_shared/auth.js';

export async function onRequestGet(context) {
  try {
    await ensureAuth(context.env.DB);
    const user = await currentUser(context);
    const owner = await context.env.DB.prepare("SELECT username FROM admin_users WHERE role='owner'").first();
    return json({user, needsSetup:!owner, setupConfigured:typeof context.env.ADMIN_SETUP_KEY==='string' && context.env.ADMIN_SETUP_KEY.length>=20});
  } catch { return json({error:'Přihlášení se nepodařilo načíst'},500); }
}
export async function onRequestPost(context) {
  const {request,env}=context;
  if (!sameOrigin(request)) return json({error:'Neplatný původ požadavku'},403);
  let body;
  try {body=await request.json();} catch {return json({error:'Neplatná data'},400);}
  if (!body || typeof body !== 'object') return json({error:'Neplatná data'},400);
  try {
    await ensureAuth(env.DB);
    const user=await currentUser(context);
    if (body.action==='logout') {
      const token=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-dochazka='))?.slice(16);
      if (token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await digest(token)).run();
      const response=json({success:true});response.headers.set('Set-Cookie','__Host-dochazka=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');return response;
    }
    if (body.action==='invite') {
      if (user?.role!=='owner') return json({error:'Pozvánku může vytvořit pouze správce'},403);
      const token=randomToken();
      await env.DB.prepare('INSERT INTO admin_invites (token_hash,expires_at) VALUES (?,?)').bind(await digest(token),Date.now()+86400000).run();
      return json({url:new URL('/admin',request.url).href+'#invite='+token});
    }
    if (!['setup','accept','login'].includes(body.action)) return json({error:'Neplatná akce'},400);
    // Limit platí i při opakovaných pokusech se špatným heslem nebo kódem.
    const limitKey=await digest((request.headers.get('CF-Connecting-IP')||'unknown')+':'+Math.floor(Date.now()/900000));
    await env.DB.prepare(`INSERT INTO admin_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1`).bind(limitKey,Date.now()+900000).run();
    await env.DB.prepare('DELETE FROM admin_limits WHERE expires_at<?').bind(Date.now()).run();
    await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<?').bind(Date.now()).run();
    const limit=await env.DB.prepare('SELECT count FROM admin_limits WHERE key=?').bind(limitKey).first();
    if (limit.count>20) return json({error:'Příliš mnoho pokusů. Zkus to za 15 minut.'},429);
    const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
    const password=body.password;
    if (!/^[a-z0-9._-]{3,40}$/.test(username) || typeof password!=='string' || password.length<12 || password.length>128) return json({error:'Jméno musí mít 3–40 znaků bez mezer a diakritiky. Heslo musí mít 12–128 znaků.'},400);
    if (body.action==='login') {
      const found=await env.DB.prepare('SELECT * FROM admin_users WHERE username=?').bind(username).first();
      const calculated=await passwordHash(password,found?.salt || 'invalid-login-salt');
      if (!found || calculated!==found.password_hash) return json({error:'Nesprávné jméno nebo heslo'},401);
      return sessionResponse(env,username);
    }
    const salt=randomToken();
    const hash=await passwordHash(password,salt);
    if (body.action==='setup') {
      const owner=await env.DB.prepare("SELECT username FROM admin_users WHERE role='owner'").first();
      if (owner) return json({error:'Administrace už je nastavená. Přihlas se.'},409);
      if (typeof env.ADMIN_SETUP_KEY!=='string' || env.ADMIN_SETUP_KEY.length<20) return json({error:'Nejprve nastav v Cloudflare jednorázový kód ADMIN_SETUP_KEY.'},503);
      if (typeof body.setupKey!=='string' || await digest(body.setupKey)!==await digest(env.ADMIN_SETUP_KEY)) return json({error:'Nesprávný jednorázový kód'},403);
      if (username!=='thortyy') return json({error:'Účet správce má jméno thortyy'},400);
      await env.DB.prepare("INSERT INTO admin_users (username,salt,password_hash,role) VALUES (?,?,?,'owner')").bind(username,salt,hash).run();
      return sessionResponse(env,username);
    }
    if (typeof body.invite!=='string' || !/^[a-f0-9]{64}$/.test(body.invite)) return json({error:'Neplatná pozvánka'},400);
    const inviteHash=await digest(body.invite);
    // D1 batch je transakce: pozvánka se spotřebuje pouze s úspěšným vložením účtu.
    const result=await env.DB.batch([
      env.DB.prepare(`INSERT INTO admin_users (username,salt,password_hash,role) SELECT ?,?,?,'teacher' WHERE EXISTS (SELECT 1 FROM admin_invites WHERE token_hash=? AND used=0 AND expires_at>?)`).bind(username,salt,hash,inviteHash,Date.now()),
      env.DB.prepare('UPDATE admin_invites SET used=1 WHERE token_hash=? AND used=0 AND expires_at>?').bind(inviteHash,Date.now())
    ]);
    if (!result[0].meta.changes) return json({error:'Pozvánka je neplatná nebo už byla použita'},400);
    return sessionResponse(env,username);
  } catch { return json({error:'Akci se nepodařilo dokončit. Při zakládání účtu zkus jiné přihlašovací jméno.'},500); }
}
