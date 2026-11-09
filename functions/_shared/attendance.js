export const roster = [
  'Bigizhanov Alisher', 'Butenko Mariia', 'Částka Šimon', 'Ferčák Rafael',
  'Gaivoronskiy Anatoliy', 'Harms Shawn Wander', 'Hübsch Jáchym', 'Kryvyi Andrii',
  'Kuchař Josef', 'Máj Daniel', 'Mohammad Daniel', 'Novoseletskyi Maksym',
  'Páczelt Filip László', 'Prchal Daniel', 'Repetný Jan', 'Rozsypal Jan',
  'Šafář Daniel', 'Savko Oleh', 'Šeborová Julie', 'Smékal Jiří', 'Smrkovský Ondřej',
  'Souček Jakub', 'Srp Lukáš', 'Střítezský Jonáš', 'Synek Jan Jakub',
  'Vopálenský Lukáš', 'Yakovyshenko Nikita'
].sort((a, b) => a.localeCompare(b, 'cs'));

const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '')
  .toLocaleLowerCase('cs').trim().replace(/\s+/g, ' ');

export function findStudent(name) {
  const key = normalize(name);
  return roster.find(student => {
    const [surname, ...given] = student.split(' ');
    return key === normalize(student) || key === normalize([...given, surname].join(' '));
  });
}

export async function ensureWindows(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS attendance_windows (
    code TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
  )`).run();
  await db.prepare('CREATE TABLE IF NOT EXISTS attendance_session_starts (code TEXT PRIMARY KEY, started_at INTEGER NOT NULL)').run();
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
