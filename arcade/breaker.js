const WIDTH = 600;
const HEIGHT = 380;
const BALL_RADIUS = 7;
const PADDLE_Y = 344;
const KEY = 'breaker';

export function makeBricks(level) {
  const rows = Math.min(6, 3 + level);
  const cols = 8;
  const gap = 6;
  const width = (WIDTH - 48 - gap * (cols - 1)) / cols;
  return Array.from({ length: rows * cols }, (_, index) => {
    const row = Math.floor(index / cols);
    return { x: 24 + (index % cols) * (width + gap), y: 40 + row * 23, w: width, h: 16, hp: level === 3 && row < 2 ? 2 : 1, row };
  });
}

export function circleHitsRect(ball, rectangle) {
  const x = Math.max(rectangle.x, Math.min(ball.x, rectangle.x + rectangle.w));
  const y = Math.max(rectangle.y, Math.min(ball.y, rectangle.y + rectangle.h));
  return (ball.x - x) ** 2 + (ball.y - y) ** 2 <= ball.r ** 2;
}

export function bounceFromPaddle(ball, paddle, speed) {
  const offset = Math.max(-1, Math.min(1, (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2)));
  const angle = offset * Math.PI / 3;
  return { ...ball, y: PADDLE_Y - ball.r - 0.1, vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed };
}

export function clampPaddle(x, width) {
  return Math.max(10, Math.min(WIDTH - width - 10, x));
}

export function mount(container, services) {
  container.innerHTML = `
    <section class="breaker-game" aria-label="Neon Breaker">
      <div class="breaker-stats" aria-label="Výsledky hry">
        <div><span>Skóre</span><strong data-breaker="score">0</strong></div>
        <div><span>Rekord</span><strong data-breaker="best">0</strong></div>
        <div><span>Životy</span><strong data-breaker="lives">3</strong></div>
        <div><span>Kolo</span><strong data-breaker="level">1 / 3</strong></div>
      </div>
      <div class="breaker-stage">
        <canvas width="600" height="380" tabindex="0" aria-label="Hrací plocha Neon Breaker. Pálku ovládej šipkami, klávesami A a D nebo tažením prstu. Mezerníkem hru pozastavíš."></canvas>
        <div class="breaker-overlay">
          <span class="breaker-overline">ODRAZ. ZAMIŘ. ROZBIJ.</span>
          <h3 data-breaker="title">Neon Breaker</h3>
          <p data-breaker="description">Pálka, míček a tři kola bloků. Zvládneš vyčistit celou plochu?</p>
          <button class="breaker-play" type="button" data-breaker="play">Spustit hru</button>
        </div>
      </div>
      <div class="breaker-toolbar">
        <button class="breaker-pause" type="button" data-breaker="pause" disabled>Pauza</button>
        <button class="breaker-reset" type="button" data-breaker="reset">Nová hra</button>
        <span class="breaker-controls">← → / A D · myš nebo prst · mezerník = pauza</span>
      </div>
      <p class="breaker-status" data-breaker="status" role="status">Zásah středem pálky pošle míček vzhůru. Okraje mění jeho směr.</p>
    </section>`;
  const root = container.querySelector('.breaker-game');
  const get = name => root.querySelector(`[data-breaker="${name}"]`);
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const overlay = root.querySelector('.breaker-overlay');
  const controller = new AbortController();
  const { signal } = controller;
  let destroyed = false;
  let raf = 0;
  let lastTime = 0;
  let mode = 'intro';
  let score = 0;
  let best = Number(services.getBest(KEY)) || 0;
  let lives = 3;
  let level = 1;
  let bricks = makeBricks(level);
  let paddle = { x: 250, w: 100, h: 12 };
  let ball;
  let left = false;
  let right = false;
  let trail = [];
  let dpr = 1;
  let pointerId = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function speed() { return 275 + (level - 1) * 42; }
  function readyBall() {
    ball = { x: paddle.x + paddle.w / 2, y: PADDLE_Y - 12, r: BALL_RADIUS, vx: speed() * 0.42, vy: -speed() * 0.9075 };
    trail = [];
  }
  function updateStats() {
    if (score > best) best = services.saveBest(KEY, score);
    get('score').textContent = score;
    get('best').textContent = best;
    get('lives').textContent = lives;
    get('level').textContent = `${level} / 3`;
  }
  function show(title, description, buttonText, status) {
    get('title').textContent = title;
    get('description').textContent = description;
    get('play').textContent = buttonText;
    get('status').textContent = status || description;
    overlay.hidden = false;
    get('pause').disabled = true;
  }
  function stopLoop() {
    cancelAnimationFrame(raf);
    raf = 0;
    left = right = false;
  }
  function pause() {
    if (destroyed || mode !== 'running') return;
    mode = 'paused';
    stopLoop();
    show('Chvilka na nádech.', 'Tvoje hra počká. Pokračuj, až budeš připravený.', 'Pokračovat', 'Hra je pozastavená.');
    draw();
  }
  function reset() {
    stopLoop();
    score = 0; lives = 3; level = 1; bricks = makeBricks(level);
    paddle = { x: 250, w: 100, h: 12 };
    mode = 'intro';
    readyBall(); updateStats();
    show('Neon Breaker', 'Tři životy. Tři kola. Každý odraz může změnit hru.', 'Spustit hru', 'Nová hra je připravená.');
    draw();
  }
  function start() {
    if (destroyed || mode === 'running') return;
    if (mode === 'won' || mode === 'lost') {
      score = 0; lives = 3; level = 1; bricks = makeBricks(level); paddle = { x: 250, w: 100, h: 12 }; readyBall();
    } else if (mode === 'next') {
      level += 1;
      bricks = makeBricks(level);
      paddle.w = Math.max(78, 106 - level * 6);
      paddle.x = (WIDTH - paddle.w) / 2;
      readyBall();
    }
    mode = 'running';
    overlay.hidden = true;
    get('pause').disabled = false;
    get('status').textContent = `Kolo ${level}. Odrážej míček a znič všechny bloky.`;
    updateStats();
    canvas.focus({ preventScroll: true });
    lastTime = 0;
    raf = requestAnimationFrame(frame);
  }
  function loseLife() {
    lives -= 1; stopLoop();
    if (lives <= 0) {
      mode = 'lost'; updateStats();
      show('Ještě jeden pokus?', `Získal jsi ${score} bodů. Zkus jiný úhel a překonej svůj rekord.`, 'Hrát znovu', `Konec hry. Skóre ${score}.`);
    } else {
      mode = 'life'; paddle.x = (WIDTH - paddle.w) / 2; readyBall(); updateStats();
      show('Míček utekl.', `Zbývají ${lives} ${lives === 1 ? 'život' : 'životy'}. Bloky i body zůstávají.`, 'Další míček');
    }
  }
  function completeLevel() {
    stopLoop(); score += 150 * level; updateStats();
    if (level >= 3) {
      mode = 'won';
      show('Všechna kola tvoje!', `Všechna tři kola jsou tvoje. Celkem ${score} bodů.`, 'Hrát znovu', `Výhra! Všechna tři kola dokončena. Skóre ${score}.`);
    } else {
      mode = 'next';
      show(`Kolo ${level} hotovo!`, `Bonus ${150 * level} bodů. Další kolo přidá bloky i tempo.`, 'Další kolo');
    }
  }
  function step(dt) {
    if (left) paddle.x -= 440 * dt;
    if (right) paddle.x += 440 * dt;
    paddle.x = clampPaddle(paddle.x, paddle.w);
    const slices = Math.max(1, Math.ceil(speed() * dt / 3));
    for (let slice = 0; slice < slices && mode === 'running'; slice++) {
      const previous = { x: ball.x, y: ball.y };
      ball.x += ball.vx * dt / slices;
      ball.y += ball.vy * dt / slices;
      if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x > WIDTH - ball.r) { ball.x = WIDTH - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
      if (ball.vy > 0 && circleHitsRect(ball, { ...paddle, y: PADDLE_Y })) ball = bounceFromPaddle(ball, paddle, speed());
      for (const brick of bricks) {
        if (!brick.hp || !circleHitsRect(ball, brick)) continue;
        brick.hp -= 1; score += 10 * level; updateStats();
        if (previous.y + ball.r <= brick.y || previous.y - ball.r >= brick.y + brick.h) ball.vy *= -1;
        else ball.vx *= -1;
        ball.x = previous.x; ball.y = previous.y;
        break;
      }
      if (ball.y - ball.r > HEIGHT) { loseLife(); return; }
      if (!bricks.some(brick => brick.hp > 0)) { completeLevel(); return; }
    }
  }
  function rounded(x, y, w, h, radius) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
  }
  function draw() {
    if (destroyed) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    background.addColorStop(0, '#101e35'); background.addColorStop(1, '#08121f');
    ctx.fillStyle = background; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = '#20314a'; ctx.lineWidth = 0.6;
    for (let x = 0; x <= WIDTH; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
    for (let y = 0; y <= HEIGHT; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
    const colors = ['#96edd1', '#6ed6e9', '#829ffc', '#b69bf1', '#eea6cc', '#f1c889'];
    for (const brick of bricks) {
      if (!brick.hp) continue;
      ctx.fillStyle = colors[brick.row]; rounded(brick.x, brick.y, brick.w, brick.h, 4);
      if (brick.hp > 1) { ctx.fillStyle = '#ffffff88'; rounded(brick.x + 4, brick.y + 4, brick.w - 8, 2, 1); }
    }
    if (!reducedMotion) {
      trail.forEach((point, index) => { ctx.fillStyle = `rgba(144,229,222,${(index + 1) / trail.length * 0.17})`; ctx.beginPath(); ctx.arc(point.x, point.y, ball.r * (index + 1) / trail.length, 0, Math.PI * 2); ctx.fill(); });
    }
    ctx.fillStyle = '#b4f4dc'; rounded(paddle.x, PADDLE_Y, paddle.w, paddle.h, 6);
    ctx.fillStyle = '#eafff8'; rounded(paddle.x + 12, PADDLE_Y + 2, paddle.w - 24, 2, 1);
    ctx.fillStyle = '#f1fff9'; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#aac2df'; ctx.font = '10px system-ui'; ctx.textAlign = 'right'; ctx.fillText('NEON BREAKER', WIDTH - 18, HEIGHT - 12);
  }
  function frame(now) {
    if (destroyed || mode !== 'running') return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.035) : 0;
    lastTime = now;
    step(dt);
    if (!reducedMotion) { trail.push({ x: ball.x, y: ball.y }); if (trail.length > 7) trail.shift(); }
    draw();
    if (mode === 'running') raf = requestAnimationFrame(frame);
  }
  function resize() {
    if (destroyed) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * dpr; canvas.height = HEIGHT * dpr;
    draw();
  }
  function pointerMove(event) {
    if (mode !== 'running') return;
    if (event.pointerType !== 'mouse' && pointerId !== event.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    paddle.x = clampPaddle((event.clientX - rect.left) / rect.width * WIDTH - paddle.w / 2, paddle.w);
  }
  root.addEventListener('keydown', event => {
    if (event.target.matches('button')) return;
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) {
      event.preventDefault();
      if (key === 'arrowleft' || key === 'a') left = true;
      else right = true;
    }
    if ((event.code === 'Space' || key === 'escape') && !event.repeat) {
      event.preventDefault();
      if (mode === 'running') pause();
      else if (event.code === 'Space') start();
    }
  }, { signal });
  root.addEventListener('keyup', event => {
    const key = event.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') left = false;
    if (key === 'arrowright' || key === 'd') right = false;
  }, { signal });
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) pause(); }, { signal });
  canvas.addEventListener('pointerdown', event => {
    if (mode !== 'running') return;
    pointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({ preventScroll: true });
    pointerMove(event);
  }, { signal });
  canvas.addEventListener('pointermove', pointerMove, { signal });
  const endPointer = () => { pointerId = null; };
  canvas.addEventListener('pointerup', endPointer, { signal });
  canvas.addEventListener('pointercancel', endPointer, { signal });
  get('play').addEventListener('click', start, { signal });
  get('pause').addEventListener('click', pause, { signal });
  get('reset').addEventListener('click', reset, { signal });
  window.addEventListener('blur', pause, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, { signal });
  window.addEventListener('resize', resize, { signal });
  readyBall(); updateStats(); resize();
  return { pause, destroy() { if (destroyed) return; destroyed = true; stopLoop(); controller.abort(); container.replaceChildren(); } };
}
