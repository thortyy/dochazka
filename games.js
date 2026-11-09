(() => {
  const get = id => document.getElementById(id);
  const target = get('reaction-target');
  let state = 'idle', timer = null, readyAt = 0, best = null;
  try { const saved = Number(localStorage.getItem('dochazka_reaction_best')); if (Number.isFinite(saved) && saved > 0) best = saved; } catch {}
  const showBest = () => { get('reaction-best').textContent = best ? `Tvůj rekord na tomto zařízení: ${best} ms` : 'Rekord se ukládá jen v tomto prohlížeči.'; };
  showBest();
  function cancelReaction() {
    clearTimeout(timer); state = 'idle'; target.className = 'reaction-target'; target.textContent = 'Spustit postřeh';
  }
  target.onclick = () => {
    if (state === 'waiting') { cancelReaction(); get('reaction-result').textContent = 'Moc brzy! Počkej na zelenou a zkus to znovu.'; return; }
    if (state === 'ready') {
      const elapsed = Math.max(1, Math.round(performance.now() - readyAt));
      const record = best === null || elapsed < best;
      if (record) { best = elapsed; try { localStorage.setItem('dochazka_reaction_best', String(best)); } catch {} }
      cancelReaction(); get('reaction-result').textContent = `${elapsed} ms${record ? ' · Nový osobní rekord!' : ' · Zkus překonat svůj rekord.'}`; showBest(); return;
    }
    state = 'waiting'; target.className = 'reaction-target waiting'; target.textContent = 'Počkej na zelenou…'; get('reaction-result').textContent = 'Připrav se.';
    timer = setTimeout(() => { state = 'ready'; readyAt = performance.now(); target.className = 'reaction-target ready'; target.textContent = 'TEĎ!'; }, 1200 + Math.random() * 2200);
  };
  let cards = [], first = null, locked = false, moves = 0, pairs = 0, flipTimer = null;
  function resetMemory() {
    clearTimeout(flipTimer); first = null; locked = false; moves = 0; pairs = 0;
    const symbols = ['🚀', '🎧', '⚡', '🌍', '🎮', '⭐'];
    const deck = [...symbols, ...symbols];
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    get('memory-board').replaceChildren();
    cards = deck.map((symbol, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'memory-card'; button.textContent = '?'; button.setAttribute('aria-label', `Karta ${i + 1}, otočit`);
      const card = { button, symbol, matched: false };
      button.onclick = () => {
        if (locked || card.matched || card === first) return;
        button.textContent = symbol; button.classList.add('revealed'); button.setAttribute('aria-label', `Karta ${i + 1}: ${symbol}`);
        if (!first) { first = card; return; }
        moves++;
        if (first.symbol === symbol) {
          for (const c of [first, card]) { c.matched = true; c.button.className = 'memory-card matched'; c.button.disabled = true; }
          pairs++; first = null; updateMemory();
          if (pairs === 6) get('memory-result').textContent = `Hotovo! Všech 6 dvojic na ${moves} tahů. Skvělá paměť!`;
        } else {
          locked = true; const previous = first;
          flipTimer = setTimeout(() => { for (const c of [previous, card]) { c.button.textContent = '?'; c.button.className = 'memory-card'; c.button.setAttribute('aria-label', `Karta ${cards.indexOf(c) + 1}, otočit`); } first = null; locked = false; }, 850);
        }
        updateMemory();
      };
      get('memory-board').appendChild(button); return card;
    });
    get('memory-result').textContent = ''; updateMemory();
  }
  function updateMemory() { get('memory-score').textContent = `Dvojice ${pairs}/6 · Tahy ${moves}`; }
  get('memory-reset').onclick = resetMemory;
  function selectGame(memory) {
    cancelReaction(); get('reaction-game').hidden = memory; get('memory-game').hidden = !memory;
    get('reaction-tab').setAttribute('aria-pressed', String(!memory)); get('memory-tab').setAttribute('aria-pressed', String(memory));
    if (memory && !cards.length) resetMemory();
  }
  get('reaction-tab').onclick = () => selectGame(false);
  get('memory-tab').onclick = () => selectGame(true);
  get('games-panel').addEventListener('toggle', () => { if (!get('games-panel').open) cancelReaction(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelReaction(); });
})();
