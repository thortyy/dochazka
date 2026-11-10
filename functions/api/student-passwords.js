import {requireAdmin,passwordHash,randomToken} from '../_shared/auth.js';
import {ensureStudentPasswords} from '../_shared/student-passwords.js';
import {json,roster} from '../_shared/attendance.js';
export async function onRequestGet(context){
  try{
    const denied=await requireAdmin(context);if(denied)return denied;
    await ensureStudentPasswords(context.env.DB);
    const policy=await context.env.DB.prepare('SELECT enabled FROM student_password_policy WHERE id=1').first();
    const {results}=await context.env.DB.prepare('SELECT name FROM student_passwords').all();const ready=new Set(results.map(row=>row.name));
    return json({enabled:Boolean(policy.enabled),students:roster.map(name=>({name,hasPassword:ready.has(name)}))});
  }catch{return json({error:'Hesla žáků se nepodařilo načíst'},500);}
}
export async function onRequestPost(context){
  try{
    const denied=await requireAdmin(context,true);if(denied)return denied;
    let body;try{body=await context.request.json();}catch{return json({error:'Neplatná data'},400);}
    const db=context.env.DB;await ensureStudentPasswords(db);
    if(body?.action==='set'){
      if(!roster.includes(body.name)||typeof body.password!=='string'||body.password.length===0)return json({error:'Vyber žáka a zadej neprázdné heslo.'},400);
      const salt=randomToken(),hash=await passwordHash(body.password,salt);
      let result;
      if(body.replace===true){
        result=await db.prepare(`INSERT INTO student_passwords (name,salt,password_hash,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(name) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash,updated_at=excluded.updated_at`)
          .bind(body.name,salt,hash,Date.now()).run();
      }else{
        result=await db.prepare('INSERT OR IGNORE INTO student_passwords (name,salt,password_hash,updated_at) VALUES (?,?,?,?)').bind(body.name,salt,hash,Date.now()).run();
        if(!result.meta.changes)return json({error:'Žák už má heslo. Potvrďte jeho změnu.'},409);
      }
      return json({success:true});
    }
    if(body?.action==='enable'){
      const {results}=await db.prepare('SELECT name FROM student_passwords').all();const ready=new Set(results.map(row=>row.name));
      if(!roster.every(name=>ready.has(name)))return json({error:'Nejprve nastavte heslo všem 27 žákům.'},409);
      if(body.confirmDistributed!==true)return json({error:'Potvrďte, že jste žákům předali jejich hesla.'},400);
      await db.prepare('UPDATE student_password_policy SET enabled=1 WHERE id=1').run();return json({success:true});
    }
    if(body?.action==='disable'){await db.prepare('UPDATE student_password_policy SET enabled=0 WHERE id=1').run();return json({success:true});}
    return json({error:'Neplatná akce'},400);
  }catch{return json({error:'Nastavení hesla se nepodařilo uložit'},500);}
}
