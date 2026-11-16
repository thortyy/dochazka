import {json} from '../_shared/attendance.js';
import {ensureAuth,currentUser,sameOrigin,digest,sessionResponse} from '../_shared/auth.js';
export async function onRequestGet(context){
  try{await ensureAuth(context.env.DB);return json({user:await currentUser(context)});}
  catch{return json({error:'Vstup se nepodařilo načíst'},500);}
}
export async function onRequestPost(context){
  if(!sameOrigin(context.request))return json({error:'Neplatný původ požadavku'},403);
  let body;try{body=await context.request.json();}catch{return json({error:'Neplatná data'},400);}
  try{
    await ensureAuth(context.env.DB);
    if(body?.action==='logout'){
      const token=(context.request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-dochazka='))?.slice(16);
      if(token)await context.env.DB.prepare('DELETE FROM role_sessions WHERE token_hash=?').bind(await digest(token)).run();
      const res=json({success:true});res.headers.set('Set-Cookie','__Host-dochazka=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');return res;
    }
    if(body?.action!=='choose_role'||!['developer','teacher'].includes(body.role))return json({error:'Vyberte Developer nebo Učitel'},400);
    await context.env.DB.prepare('DELETE FROM role_sessions WHERE expires_at<=?').bind(Date.now()).run();
    return sessionResponse(context.env,body.role==='developer'?'owner':'teacher');
  }catch{return json({error:'Vstup se nepodařil. Zkuste to znovu.'},500);}
}
