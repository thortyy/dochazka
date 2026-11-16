import { json } from './attendance.js';
const encoder = new TextEncoder();
export async function ensureAuth(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS role_sessions (token_hash TEXT PRIMARY KEY, username TEXT NOT NULL, role TEXT NOT NULL, expires_at INTEGER NOT NULL)').run();
}
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
export const digest = async value => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
export async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:encoder.encode(salt), iterations:100000}, key, 256));
}
export function sameOrigin(request) {
  return request.headers.get('Origin') === new URL(request.url).origin;
}
export async function currentUser({request, env}) {
  const token = (request.headers.get('Cookie') || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-dochazka='))?.slice(16);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return env.DB.prepare(`SELECT username,role FROM role_sessions WHERE token_hash=? AND expires_at>?`).bind(await digest(token), Date.now()).first();
}
export async function requireAdmin(context, mutation = false) {
  if (mutation && !sameOrigin(context.request)) return json({error:'Neplatný původ požadavku'},403);
  await ensureAuth(context.env.DB);
  if (!await currentUser(context)) return json({error:'Přihlas se do administrace'},401);
  return null;
}
export async function sessionResponse(env, role) {
  const token = randomToken();
  const username=role==='owner'?'Developer':'Učitel';
  await env.DB.prepare('INSERT INTO role_sessions (token_hash,username,role,expires_at) VALUES (?,?,?,?)').bind(await digest(token),username,role,Date.now()+12*3600000).run();
  const response = json({success:true});
  response.headers.set('Set-Cookie', `__Host-dochazka=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
  return response;
}
