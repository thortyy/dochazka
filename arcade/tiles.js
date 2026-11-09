/** Pure 2048 rules: one merge per tile, no mutation of the input. */
export function slideBoard(board, direction) {
  if (!['left', 'right', 'up', 'down'].includes(direction) || board.length !== 16) throw new Error('Invalid board or direction');
  const next = [...board]; let score = 0;
  for (let line = 0; line < 4; line++) {
    const indexes = Array.from({length: 4}, (_, col) => direction === 'left' ? line * 4 + col : direction === 'right' ? line * 4 + 3 - col : direction === 'up' ? col * 4 + line : (3 - col) * 4 + line);
    const values = indexes.map(index => board[index]).filter(Boolean), merged = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) { const value = values[i] * 2; merged.push(value); score += value; i++; }
      else merged.push(values[i]);
    }
    indexes.forEach((index, col) => { next[index] = merged[col] || 0; });
  }
  return {board: next, score, changed: next.some((value, index) => value !== board[index])};
}
export function spawnTile(board, random = Math.random) {
  const empty = board.flatMap((value, index) => value ? [] : [index]), next = [...board];
  if (empty.length) next[empty[Math.min(empty.length - 1, Math.floor(random() * empty.length))]] = random() < .9 ? 2 : 4;
  return next;
}
export function gameOver(board) {
  return !board.includes(0) && !['left', 'up'].some(direction => slideBoard(board, direction).changed);
}
export function mount(container, services) {
  container.innerHTML = `<div class="tiles-game"><div class="tiles-metrics"><div><span>Skóre</span><strong data-score>0</strong></div><div><span>Rekord</span><strong data-best>0</strong></div><div><span>Tahy</span><strong data-moves>0</strong></div></div><div class="tiles-tools"><p>Spojuj stejná čísla. Dostaň se až na <b>2048</b>.</p><div><button type="button" data-undo disabled>Zpět</button><button type="button" data-reset>Nová hra</button></div></div><div class="tiles-board-wrap"><div class="tiles-board" tabindex="0" role="group" aria-label="2048. Ovládej šipkami nebo posunutím prstu." data-board></div><div class="tiles-end" data-end hidden><span>Žádný další tah</span><strong>Konec hry</strong><p data-final></p><button type="button" data-again>Zkusit znovu</button></div></div><div class="tiles-dpad" role="group" aria-label="Směr pohybu"><button type="button" data-move="left" aria-label="Posunout vlevo">←</button><button type="button" data-move="up" aria-label="Posunout nahoru">↑</button><button type="button" data-move="down" aria-label="Posunout dolů">↓</button><button type="button" data-move="right" aria-label="Posunout vpravo">→</button></div><p class="tiles-message" data-message role="status">Šipky na klávesnici, tlačítka nebo přejetí prstem. Každá dlaždice se v jednom tahu spojí jen jednou.</p></div>`;
  const root = container.querySelector('.tiles-game'), get = name => root.querySelector('[data-' + name + ']');
  const controller = new AbortController(), options = {signal: controller.signal};
  const grid = get('board'), cells = Array.from({length: 16}, () => {const cell = document.createElement('div'); cell.className = 'tiles-cell'; grid.appendChild(cell); return cell;});
  let board, score, moves, previous = null, ended = false, won = false, pointer = null;
  let best = services.getBest('tiles');
  function draw() {
    board.forEach((value, i) => {const cell = cells[i]; cell.textContent = value || ''; cell.dataset.level = value ? Math.min(12, Math.log2(value)) : 0; cell.setAttribute('aria-label', value ? String(value) : 'Prázdné pole');});
    get('score').textContent = score; get('best').textContent = best; get('moves').textContent = moves;
    get('undo').disabled = previous === null; get('end').hidden = !ended;
    if (ended) get('final').textContent = `Získal jsi ${score} bodů na ${moves} tahů.`;
  }
  function reset() {
    board = spawnTile(spawnTile(Array(16).fill(0))); score = 0; moves = 0; previous = null; ended = false; won = false;
    get('message').textContent = 'Spoj dvě stejná čísla a najdi cestu k 2048.'; draw();
  }
  function move(direction) {
    if (ended) return;
    const result = slideBoard(board, direction);
    if (!result.changed) {get('message').textContent = 'Tímto směrem se dlaždice neposunou. Zkus jinou šipku.'; return;}
    previous = {board: [...board], score, moves, won}; board = spawnTile(result.board); score += result.score; moves++;
    best = services.saveBest('tiles', score); ended = gameOver(board);
    if (!won && board.some(value => value >= 2048)) {won = true; get('message').textContent = '2048! Skvělá práce. Můžeš hrát dál a zkusit 4096.';}
    else get('message').textContent = ended ? 'Hra skončila. Můžeš vrátit poslední tah nebo začít novou hru.' : result.score ? `+${result.score} bodů. Jen tak dál.` : 'Dlaždice přesunuty.';
    draw();
  }
  const keys = {ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down'};
  document.addEventListener('keydown', event => {
    if(container.hidden || container.closest('[hidden]') || !container.closest('details')?.open || event.altKey || event.ctrlKey || event.metaKey || !keys[event.key])return;
    if(document.activeElement?.closest('input,textarea,select,[contenteditable="true"]'))return;
    event.preventDefault();move(keys[event.key]);
  },options);
  grid.addEventListener('pointerdown', event => {if (!event.isPrimary || event.button !== 0) return; pointer = {id:event.pointerId,x:event.clientX,y:event.clientY}; grid.setPointerCapture(event.pointerId); grid.focus({preventScroll:true});}, options);
  grid.addEventListener('pointerup', event => {if (!pointer || pointer.id !== event.pointerId) return; const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y; pointer = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return; move(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up');}, options);
  grid.addEventListener('pointercancel', () => {pointer = null;}, options);
  root.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => move(button.dataset.move), options));
  get('undo').addEventListener('click', () => {if (!previous) return; ({board,score,moves,won} = previous); previous = null; ended = false; get('message').textContent = 'Poslední tah vrácen.'; draw(); grid.focus({preventScroll:true});}, options);
  for (const element of [get('reset'),get('again')]) element.addEventListener('click', () => {reset(); grid.focus({preventScroll:true});}, options);
  reset();
  return {pause() {pointer = null;}, destroy() {controller.abort(); container.replaceChildren();}};
}
