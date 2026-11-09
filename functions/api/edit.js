import { requireAdmin, currentUser } from '../_shared/auth.js';
import { json, roster, findStudent } from '../_shared/attendance.js';
export async function onRequestPost(context) {
  try {
    const denied=await requireAdmin(context,true);if(denied)return denied;
    let body;try{body=await context.request.json();}catch{return json({error:'Neplatná data'},400);}
    if(!body || !roster.includes(body.name) || typeof body.present!=='boolean' || typeof body.code!=='string')return json({error:'Neplatný žák nebo stav'},400);
    const {env}=context;
    const code=body.code.trim().toUpperCase();
    const active=await env.DB.prepare('SELECT code FROM sessions WHERE code=? AND active=1').bind(code).first();
    if(!active)return json({error:'Hodina se změnila. Obnovte přehled.'},409);
    const actor=await currentUser(context);
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS attendance_edits (code TEXT NOT NULL,name TEXT NOT NULL,present INTEGER NOT NULL,actor TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)').run();
    let change;
    if(body.present) {
      change=env.DB.prepare(`INSERT INTO attendance (name,code) SELECT ?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE code=? AND active=1) AND NOT EXISTS (SELECT 1 FROM attendance WHERE code=? AND name=?)`).bind(body.name,code,code,code,body.name);
    } else {
      const {results}=await env.DB.prepare('SELECT DISTINCT name FROM attendance WHERE code=?').bind(code).all();
      const names=[...new Set([body.name,...results.filter(r=>findStudent(r.name)===body.name).map(r=>r.name)])];
      change=env.DB.prepare(`DELETE FROM attendance WHERE code=? AND name IN (${names.map(()=>'?').join(',')}) AND EXISTS (SELECT 1 FROM sessions WHERE code=? AND active=1)`).bind(code,...names,code);
    }
    const result=await env.DB.batch([
      change,
      env.DB.prepare('INSERT INTO attendance_edits (code,name,present,actor) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE code=? AND active=1)').bind(code,body.name,Number(body.present),actor.username,code)
    ]);
    if(!result[1].meta.changes)return json({error:'Hodina se změnila. Obnovte přehled.'},409);
    return json({success:true});
  } catch {return json({error:'Docházku se nepodařilo upravit'},500);}
}
