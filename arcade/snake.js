const VECTORS = Object.freeze({ up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] });
const OPPOSITE = Object.freeze({ up: 'down', down: 'up', left: 'right', right: 'left' });
const GRID = 20;

export function placeSnakeFood(snake, random = Math.random) {
  const occupied = new Set(snake.map(p => p.y * GRID + p.x));
  const free = [];
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    if (!occupied.has(y * GRID + x)) free.push({ x, y });
  }
  if (!free.length) return null;
  const index = Math.min(free.length - 1, Math.max(0, Math.floor(random() * free.length)));
  return free[index];
}

export function createSnakeState(random = Math.random) {
  const snake = [{ x: 6, y: 10 }, { x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
  return { snake, direction: 'right', food: placeSnakeFood(snake, random), score: 0, over: false, won: false };
}

export function advanceSnake(state, requestedDirection = state.direction, random = Math.random) {
  if (state.over || state.won) return state;
  const direction = VECTORS[requestedDirection] && OPPOSITE[state.direction] !== requestedDirection ? requestedDirection : state.direction;
  const [dx, dy] = VECTORS[direction];
  const head = { x: (state.snake[0].x + dx + GRID) % GRID, y: (state.snake[0].y + dy + GRID) % GRID };
  const eating = Boolean(state.food && head.x === state.food.x && head.y === state.food.y);
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID || body.some(p => p.x === head.x && p.y === head.y)) {
    return { ...state, direction, over: true };
  }
  const snake = [head, ...state.snake];
  if (!eating) snake.pop();
  const food = eating ? placeSnakeFood(snake, random) : state.food;
  return { snake, direction, food, score: state.score + (eating ? 10 : 0), over: false, won: food === null };
}

export function mount(container, services = {}) {
  const abort = new AbortController();
  const signal = abort.signal;
  const root = document.createElement('section');
  root.className = 'snake-game';
  root.setAttribute('aria-label', 'Neon Had');
  root.innerHTML = `
    <div class="snake-heading"><div><span class="snake-kicker">ARCADE / 01</span><h3>Neon Had</h3><p>Další sousto. Delší had. Vyšší rekord.</p></div><span class="snake-chip">20 × 20</span></div>
    <div class="snake-metrics" aria-label="Skóre hry"><div><span>Skóre</span><strong data-snake-score>0</strong></div><div><span>Tvůj rekord</span><strong data-snake-best>0</strong></div><div><span>Úroveň</span><strong data-snake-level>1</strong></div></div>
    <div class="snake-levelbar"><div><strong data-level-name>01 / Rozjezd</strong><span data-level-goal>Ještě 5 soust do další úrovně</span></div><progress data-level-progress value="0" max="5" aria-label="Postup úrovní"></progress></div><div class="snake-board" tabindex="0" role="group" aria-label="Herní pole hada. Ovládání šipkami nebo W A S D.">
      <canvas width="400" height="400" aria-label="Had a svítící sousto na herní ploše">Tvůj prohlížeč nepodporuje canvas. Zkus jiný prohlížeč.</canvas>
      <div class="snake-overlay"><span class="snake-overlay-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 17h5v-5h5V6m-4 0h4v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><h4 data-snake-title>První sousto čeká.</h4><p data-snake-description>Posbírej světelné body. Okrajem projedeš na druhou stranu. Pozor na vlastní ocas.</p><button class="snake-start" type="button">Spustit hru</button><span class="snake-overlay-hint">Šipky / WASD / tlačítka pod hrou</span></div>
    </div>
    <div class="snake-actions"><button class="snake-pause" type="button" disabled>Pozastavit</button><button class="snake-reset" type="button">Nová hra</button></div>
    <div class="snake-controls" role="group" aria-label="Směr hada"><button type="button" data-snake-dir="up" aria-label="Nahoru">↑</button><button type="button" data-snake-dir="left" aria-label="Doleva">←</button><button type="button" data-snake-dir="down" aria-label="Dolů">↓</button><button type="button" data-snake-dir="right" aria-label="Doprava">→</button></div>
    <p class="snake-help">Běžné sousto: 10 bodů, zlaté: 30. Každých 5 soust nová úroveň a barva. Had zrychluje a okraje tě pustí na druhou stranu. Pozor na vlastní ocas.</p><p class="snake-announcement" role="status" aria-live="polite"></p>`;
  container.appendChild(root);
  const get = selector => root.querySelector(selector);
  const canvas = get('canvas');
  const context = canvas.getContext('2d');
  const board = get('.snake-board');
  const overlay = get('.snake-overlay');
  const startButton = get('.snake-start');
  const pauseButton = get('.snake-pause');
  const announcement = get('.snake-announcement');
  let state = createSnakeState();
  let mode = 'ready';
  let timer = null;
  let frame = 0, stepAt = 0, eaten = 0, previousSnake = null, flashUntil = 0;
  const levelNames = ["Rozjezd", "V rytmu", "Neonový sprint", "Hyperprostor", "Lovec rekordů", "Nekonečno"];
  const palettes = [["#b6ffda","#54c9a6"],["#b9efff","#58b6e1"],["#d7baff","#9c78de"],["#ffd6a3","#eaa35e"],["#ffbdd7","#de789f"],["#edffad","#aacb57"]];
  const duration = () => Math.max(65, 145 - Math.floor(eaten / 5) * 13);
  let pendingDirection = null;
  let destroyed = false;
  let best = 0;
  try { best = Number(services.getBest?.('snake')) || 0; } catch {}
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = 400 * ratio;
  canvas.height = 400 * ratio;
  if (context) context.setTransform(ratio, 0, 0, ratio, 0, 0);

  function roundedRect(x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
    context.fill();
  }
  function render(progress = 1) {
    if (!context || destroyed) return;
    context.fillStyle = '#091a23';
    context.fillRect(0, 0, 400, 400);
    context.strokeStyle = '#16313a';
    context.lineWidth = 0.5;
    context.beginPath();
    for (let i = 1; i < GRID; i++) {
      context.moveTo(i * 20, 0); context.lineTo(i * 20, 400);
      context.moveTo(0, i * 20); context.lineTo(400, i * 20);
    }
    context.stroke();
    if (state.food) {
      const x = state.food.x * 20 + 10, y = state.food.y * 20 + 10;
      const golden = (eaten + 1) % 4 === 0;
      context.fillStyle = golden ? '#ffe29b' : '#ffaf8e'; context.beginPath(); context.arc(x, y, 5.5, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#73514a'; context.lineWidth = 1; context.beginPath(); context.arc(x, y, 8.5, 0, Math.PI * 2); context.stroke();
    }
    const positions = state.snake.map((point,index) => {
      const old = previousSnake?.[index] || previousSnake?.[previousSnake.length - 1] || point;
      let dx=point.x-old.x,dy=point.y-old.y;if(dx>10)dx-=20;if(dx< -10)dx+=20;if(dy>10)dy-=20;if(dy< -10)dy+=20;
      return {x:(old.x+dx*progress+20)%20,y:(old.y+dy*progress+20)%20};
    });
    const palette=palettes[Math.min(5,Math.floor(eaten/5))];
    positions.slice().reverse().forEach((point, reverseIndex) => {
      const index = state.snake.length - 1 - reverseIndex;
      context.fillStyle = index === 0 ? palette[0] : palette[1];
      roundedRect(point.x * 20 + 1.5, point.y * 20 + 1.5, 17, 17, index === 0 ? 5 : 4);
    });
    const head = positions[0];
    const [dx, dy] = VECTORS[state.direction];
    context.fillStyle = '#133d33';
    const eyes = dx ? [[head.x * 20 + 10 + dx * 4, head.y * 20 + 6], [head.x * 20 + 10 + dx * 4, head.y * 20 + 14]] : [[head.x * 20 + 6, head.y * 20 + 10 + dy * 4], [head.x * 20 + 14, head.y * 20 + 10 + dy * 4]];
    eyes.forEach(([x, y]) => { context.beginPath(); context.arc(x, y, 1.6, 0, Math.PI * 2); context.fill(); });
    if(performance.now()<flashUntil){context.strokeStyle=palette[0];context.lineWidth=3;context.strokeRect(2,2,396,396);}

  }
  function updateMetrics() {
    if (state.score > best) {
      best = state.score;
      try { best = Math.max(best, Number(services.saveBest?.('snake', best)) || 0); } catch {}
    }
    get('[data-snake-score]').textContent = String(state.score);
    get('[data-snake-best]').textContent = String(best);
    get('[data-snake-level]').textContent = String(1 + Math.floor(eaten / 5));
  }
  function updateLevel(){
    const level=Math.floor(eaten/5);
    get('[data-level-name]').textContent=String(level+1).padStart(2,'0')+' / '+levelNames[Math.min(5,level)];
    get('[data-level-goal]').textContent=(eaten+1)%4===0?'Zlaté sousto: 30 bodů!':`Do další úrovně: ${5-eaten%5} soust · každé čtvrté je zlaté`;
    get('[data-level-progress]').value=eaten%5;
  }
  function showOverlay(title, description, buttonText) {
    get('[data-snake-title]').textContent = title;
    get('[data-snake-description]').textContent = description;
    startButton.textContent = buttonText;
    overlay.hidden = false;
  }
  function finish() {
    clearTimeout(timer); cancelAnimationFrame(frame); timer = null; mode = 'over';
    pauseButton.disabled = true;
    const title = state.won ? 'Celá plocha je tvoje!' : 'Ještě jedno kolo?';
    showOverlay(title, `Skóre ${state.score} bodů. ${state.score > 0 && state.score === best ? 'Tvůj nejlepší výkon na tomto zařízení!' : 'Každé další kolo je nová šance.'}`, 'Hrát znovu');
    announcement.textContent = `${title} Skóre: ${state.score} bodů.`;
    startButton.focus({ preventScroll: true });
  }
  function schedule() {
    cancelAnimationFrame(frame);stepAt=performance.now();
    function tick(now){
      if(mode!=='running'||destroyed)return;
      const interval=duration();
      if(now-stepAt>=interval){
        previousSnake=state.snake.map(point=>({...point}));
        const oldLength=state.snake.length;
        state=advanceSnake(state,pendingDirection||state.direction);pendingDirection=null;stepAt=now;
        if(state.snake.length>oldLength){eaten++;if(eaten%4===0)state.score+=20;flashUntil=now+220;updateLevel();}
        updateMetrics();
        if(state.over||state.won){render();finish();return;}
      }
      render(Math.min(1,(now-stepAt)/interval));frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);
  }
  function pause() {
    if (destroyed || mode !== 'running') return;
    mode = 'paused'; cancelAnimationFrame(frame); render(); clearTimeout(timer); timer = null; pendingDirection = null;
    pauseButton.textContent = 'Pokračovat';
    showOverlay('Malá pauza.', 'Had nikam neuteče. Pokračuj, až budeš připravený.', 'Pokračovat');
    announcement.textContent = 'Hra je pozastavená.';
  }
  function run(reset = false) {
    if (destroyed || !context) return;
    if (reset || mode !== 'paused') {state = createSnakeState();eaten=0;previousSnake=null;updateLevel();}
    previousSnake=null;pendingDirection = null; mode = 'running';
    pauseButton.disabled = false; pauseButton.textContent = 'Pozastavit';
    board.focus({ preventScroll: true });
    overlay.hidden = true;
    announcement.textContent = 'Hra běží. Ovládej hada šipkami, WASD nebo tlačítky.';
    updateMetrics(); render(); schedule();
  }
  function steer(direction) {
    if (mode !== 'running' || pendingDirection || direction === state.direction || OPPOSITE[state.direction] === direction) return;
    pendingDirection = direction;
  }
  startButton.addEventListener('click', () => run(), { signal });
  pauseButton.addEventListener('click', () => { if (mode === 'running') pause(); else if (mode === 'paused') run(); }, { signal });
  get('.snake-reset').addEventListener('click', () => run(true), { signal });
  root.querySelectorAll('[data-snake-dir]').forEach(button => button.addEventListener('click', () => { steer(button.dataset.snakeDir); }, { signal }));
  root.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left', w: 'up', d: 'right', s: 'down', a: 'left' }[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (direction && mode === 'running') { event.preventDefault(); steer(direction); }
    else if ((event.key === 'Escape' || event.key.toLowerCase() === 'p') && mode === 'running') { event.preventDefault(); pause(); }
  }, { signal });
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) pause(); }, { signal });
  window.addEventListener('blur', pause, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, { signal });
  updateLevel();updateMetrics(); render();
  if (!context) {
    showOverlay('Herní plocha není dostupná.', 'Zkus jiný prohlížeč, který podporuje canvas.', 'Hra není dostupná');
    startButton.disabled = true; get('.snake-reset').disabled = true;
  }
  return {
    pause,
    destroy() {
      if (destroyed) return;
      destroyed = true; cancelAnimationFrame(frame); clearTimeout(timer); timer = null; abort.abort(); root.remove();
    }
  };
}
