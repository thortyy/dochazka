import { digest, passwordHash } from './auth.js';
import { json } from './attendance.js';
export async function ensureStudentPasswords(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS student_password_policy (id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL)'),
    db.prepare('INSERT OR IGNORE INTO student_password_policy (id,enabled) VALUES (1,0)'),
    db.prepare('CREATE TABLE IF NOT EXISTS student_passwords (name TEXT PRIMARY KEY, salt TEXT NOT NULL, password_hash TEXT NOT NULL, updated_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS password_failures (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)')
  ]);
}
export async function passwordAttempt(context, scope) {
  const key=await digest(scope+':'+(context.request.headers.get('CF-Connecting-IP')||'unknown'));
  const row=await context.env.DB.prepare('SELECT count,expires_at FROM password_failures WHERE key=?').bind(key).first();
  return {key,blocked:Boolean(row && row.expires_at>Date.now() && row.count>=10)};
}
export async function failedPassword(db,key) {
  const now=Date.now();
  await db.prepare(`INSERT INTO password_failures (key,count,expires_at) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END`)
    .bind(key,now+900000,now,now).run();
  await db.prepare('DELETE FROM password_failures WHERE expires_at<?').bind(now).run();
}
export async function studentPasswordGate(context,name,password) {
  const db=context.env.DB;await ensureStudentPasswords(db);
  const policy=await db.prepare('SELECT enabled FROM student_password_policy WHERE id=1').first();
  if(!policy.enabled)return null;
  const required={passwordRequired:true};
  if(typeof password!=='string'||!password.length)return json({...required,error:'Zadej své osobní heslo od učitele.'},401);
  const attempt=await passwordAttempt(context,'student:'+name);
  if(attempt.blocked)return json({...required,error:'Příliš mnoho nesprávných hesel. Zkus to za 15 minut nebo požádej učitele o zápis.'},429);
  const record=await db.prepare('SELECT salt,password_hash FROM student_passwords WHERE name=?').bind(name).first();
  const calculated=await passwordHash(password,record?.salt||'missing-student-password');
  if(!record||calculated!==record.password_hash){await failedPassword(db,attempt.key);return json({...required,error:'Heslo nepatří uvedenému žákovi. Zkontroluj jméno a své heslo.'},401);}
  await db.prepare('DELETE FROM password_failures WHERE key=?').bind(attempt.key).run();
  return null;
}
