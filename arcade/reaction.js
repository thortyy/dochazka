export function mount(container, services) {
  container.innerHTML = `<div class="arc-reaction"><div class="arc-reaction-metrics"><div><span>Poslední pokus</span><strong data-last>—</strong></div><div><span>Osobní rekord</span><strong id="reaction-best" data-best>—</strong></div><div><span>Průměr 5 pokusů</span><strong data-average>—</strong></div></div><button id="reaction-target" class="reaction-target" type="button"><span data-symbol aria-hidden="true">⚡</span><strong data-target>Spustit postřeh</strong><span data-sub>Počkej na zelenou. Potom klikni co nejrychleji.</span></button><p id="reaction-result" class="arc-reaction-message" role="status">Jak rychlý máš postřeh?</p><div class="arc-reaction-history" data-history aria-label="Poslední výsledky"></div><p class="arc-reaction-help">Ovládání: kliknutí, klepnutí nebo mezerník na tlačítku. Předčasný klik se nepočítá.</p></div>`;
  const get = name => container.querySelector('[data-' + name + ']');
  const button = container.querySelector('#reaction-target'), result = container.querySelector('#reaction-result');
  const controller = new AbortController();
  let state = 'idle', timer = null, readyAt = 0, scores = [], best = services.getBest('reaction');
  const showBest = () => {get('best').textContent = best ? best + ' ms' : '—';};
  function reset() {clearTimeout(timer); state = 'idle'; button.className = 'reaction-target'; get('target').textContent = 'Spustit postřeh';get('sub').textContent = 'Počkej na zelenou. Potom klikni co nejrychleji.';get('symbol').textContent = '⚡';}
  button.addEventListener('click', () => {
    if (state === 'waiting') {reset();result.textContent = 'Moc brzy! Počkej na zelenou a zkus to znovu.';return;}
    if (state === 'ready') {
      const elapsed = Math.max(1, Math.round(performance.now() - readyAt)), record = !best || elapsed < best;
      best = services.saveBest('reaction', elapsed);scores.unshift(elapsed);scores = scores.slice(0, 5);
      get('last').textContent = elapsed + ' ms';get('average').textContent = Math.round(scores.reduce((sum,value) => sum + value, 0) / scores.length) + ' ms';
      get('history').replaceChildren(...scores.map(value => {const chip = document.createElement('span');chip.textContent = value + ' ms';return chip;}));
      reset();showBest();result.textContent = `${elapsed} ms${record ? ' · Nový osobní rekord!' : ' · Zkus překonat svůj rekord.'}`;return;
    }
    state = 'waiting';button.className = 'reaction-target waiting';get('target').textContent = 'Počkej na zelenou…';get('sub').textContent = 'Ještě neklikej.';get('symbol').textContent = '…';result.textContent = 'Připrav se.';
    timer = setTimeout(() => {state = 'ready';readyAt = performance.now();button.className = 'reaction-target ready';get('target').textContent = 'TEĎ!';get('sub').textContent = 'Klikni nebo stiskni mezerník.';get('symbol').textContent = '↯';}, 1200 + Math.random() * 2200);
  }, {signal:controller.signal});
  showBest();
  return {pause() {if(state !== 'idle'){reset();result.textContent = 'Pokus přerušen. Až budeš připravený, spusť nový.';}},destroy() {clearTimeout(timer);controller.abort();container.replaceChildren();}};
}
