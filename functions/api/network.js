import { requireAdmin } from '../_shared/auth.js';
import { ensureNetwork, clientIp, normalizeIp } from '../_shared/network.js';
import { json } from '../_shared/attendance.js';
export async function onRequestGet(context) {
  try {
    const denied=await requireAdmin(context);if(denied)return denied;
    await ensureNetwork(context.env.DB);
    const policy=await context.env.DB.prepare('SELECT enabled FROM school_network_policy WHERE id=1').first();
    const {results}=await context.env.DB.prepare('SELECT ip FROM school_networks ORDER BY ip').all();
    return json({enabled:Boolean(policy.enabled),currentIp:clientIp(context.request),addresses:results.map(r=>r.ip)});
  } catch {return json({error:'Nastavení sítě se nepodařilo načíst'},500);}
}
export async function onRequestPost(context) {
  try {
    const denied=await requireAdmin(context,true);if(denied)return denied;
    let body;try{body=await context.request.json();}catch{return json({error:'Neplatná data'},400);}
    await ensureNetwork(context.env.DB);
    const db=context.env.DB;
    if(body?.action==='add_current') {
      if(body.confirmSchool!==true)return json({error:'Potvrďte, že jste ve školní síti'},400);
      const ip=clientIp(context.request);if(!ip)return json({error:'Veřejnou IP se nepodařilo zjistit'},400);
      await db.batch([db.prepare('INSERT OR IGNORE INTO school_networks (ip) VALUES (?)').bind(ip),db.prepare('UPDATE school_network_policy SET enabled=1 WHERE id=1')]);
    } else if(body?.action==='remove') {
      const ip=normalizeIp(body.ip);if(!ip)return json({error:'Neplatná IP adresa'},400);
      await db.prepare('DELETE FROM school_networks WHERE ip=?').bind(ip).run();
    } else if(body?.action==='disable') {
      await db.prepare('UPDATE school_network_policy SET enabled=0 WHERE id=1').run();
    } else return json({error:'Neplatná akce'},400);
    return json({success:true});
  } catch {return json({error:'Nastavení sítě se nepodařilo uložit'},500);}
}
