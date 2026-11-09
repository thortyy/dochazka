import { json } from './attendance.js';
export async function ensureNetwork(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS school_network_policy (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS school_networks (ip TEXT PRIMARY KEY)'),
    db.prepare('INSERT OR IGNORE INTO school_network_policy (id,enabled) VALUES (1,0)')
  ]);
}
export function normalizeIp(value) {
  if (typeof value !== 'string') return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    const parts=value.split('.');
    return parts.every(p=>Number(p)<=255 && String(Number(p))===p) ? parts.join('.') : null;
  }
  if (!value.includes(':') || !/^[a-f0-9:.]+$/i.test(value)) return null;
  try { return new URL('http://['+value+']/').hostname.slice(1,-1); } catch { return null; }
}
// Cloudflare nastavuje tento header na skutečnou adresu klienta. X-Forwarded-For se nepoužívá.
export const clientIp = request => normalizeIp(request.headers.get('CF-Connecting-IP'));
export async function networkGate({request,env}) {
  await ensureNetwork(env.DB);
  const policy=await env.DB.prepare('SELECT enabled FROM school_network_policy WHERE id=1').first();
  if (!policy.enabled) return null;
  const ip=clientIp(request);
  if (ip && await env.DB.prepare('SELECT ip FROM school_networks WHERE ip=?').bind(ip).first()) return null;
  return json({error:'Docházku lze zapsat pouze ze školní sítě. Připoj se ke školní síti nebo požádej učitele o ruční zápis.'},403);
}
