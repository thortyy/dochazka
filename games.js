// Imported only when the student opens the arcade. Game code and styles load on demand.
const styles = new Map();
function loadStyle(href) {
  if (styles.has(href)) return styles.get(href);
  const promise = new Promise((resolve, reject) => {
    const link = document.createElement('link');link.rel = 'stylesheet';link.href = href;
    link.onload = () => resolve();link.onerror = () => {styles.delete(href);link.remove();reject(new Error('Styl hry se nepodařilo načíst.'));};document.head.appendChild(link);
  });styles.set(href,promise);return promise;
}
const games = {
  reaction: {name:'Postřeh',category:'Rychlost',copy:'Zelená znamená teď. Překonej sám sebe.',icon:'↯',hue:'mint',meta:'Kliknutí · dotyk · mezerník',module:'/arcade/reaction.js'},
  snake: {name:'Neon Had',category:'Obratnost',copy:'Sbírej energii. Neztrať se ve vlastní stopě.',icon:'⌁',hue:'lime',meta:'Šipky · WASD · dotyk',module:'/arcade/snake.js',css:'/arcade/snake.css'},
  breaker: {name:'Neon Breaker',category:'Arkádovka',copy:'Tři životy. Tři kola. Rozbij celou stěnu.',icon:'▦',hue:'violet',meta:'Šipky · myš · dotyk',module:'/arcade/breaker.js',css:'/arcade/breaker.css'},
  tiles: {name:'2048',category:'Logika',copy:'Malá čísla. Velké kombinace. Najdi svůj tah.',icon:'²',hue:'amber',meta:'Šipky · přejetí prstem',module:'/arcade/tiles.js',css:'/arcade/tiles.css'}
};
export async function initArcade(root, details) {
  await loadStyle('/arcade/hub.css');
  root.innerHTML = `<div class="arcade"><header class="arc-header"><div><p class="arc-eyebrow">Malá pauza. Velká výzva.</p><h2>Vyber si svůj další rekord<span>.</span></h2><p>Čtyři hry. Jen ty, tvoje soustředění a další pokus.</p></div><span class="arc-local">Rekordy na tomto zařízení</span></header><div class="arc-layout"><nav class="arc-catalog" aria-label="Vybrat hru"></nav><section class="arc-arena"><header class="arc-stage-header"><div><span class="arc-category"></span><h3 class="arc-game-title"></h3></div><span class="arc-controls"></span></header><p class="arc-loading" role="status" hidden></p><div class="arc-stages"></div></section></div><footer class="arc-footer"><span>Rozpracované hry zůstávají při přepnutí zachované.</span><span>Zápis docházky je vždy nahoře ↑</span></footer></div>`;
  const query = selector => root.querySelector(selector), controller = new AbortController(), instances = new Map(), loaded = new Map(), bestCache = new Map();
  let selected = null, selection = 0, destroyed = false;
  const storeKey = key => key === 'reaction' ? 'dochazka_reaction_best' : 'dochazka_arcade_' + key + '_best';
  function getBest(key) {
    if(bestCache.has(key))return bestCache.get(key);
    let value = 0;try {const saved=Number(localStorage.getItem(storeKey(key)));if(Number.isFinite(saved)&&saved>0)value=Math.round(saved);}catch{}
    bestCache.set(key,value);return value;
  }
  function saveBest(key, score) {
    const old=getBest(key);if(!Number.isFinite(score)||score<0)return old;
    const value=key==='reaction' && old ? Math.min(old,Math.round(score)) : Math.max(old,Math.round(score));
    bestCache.set(key,value);try{localStorage.setItem(storeKey(key),String(value));}catch{}
    const target=query(`[data-best="${key}"]`);if(target)target.textContent=value ? 'Rekord '+value+(key==='reaction'?' ms':'') : 'Tvůj první rekord čeká';
    return value;
  }
  function pauseAll(){for(const instance of instances.values())instance.game.pause();}
  async function select(id) {
    if(destroyed || !games[id])return;
    const token=++selection;pauseAll();selected=id;
    for(const [key,entry] of instances)entry.element.hidden=key!==id;
    query('.arc-catalog').querySelectorAll('button').forEach(button=>{const active=button.dataset.game===id;button.setAttribute('aria-pressed',String(active));});
    const data=games[id];query('.arc-game-title').textContent=data.name;query('.arc-category').textContent=data.category;query('.arc-controls').textContent=data.meta;
    const loading=query('.arc-loading');loading.hidden=false;loading.textContent='Načítám '+data.name+'…';
    try {
      if(!instances.has(id)) {
        if(!loaded.has(id))loaded.set(id,Promise.all([import(data.module),data.css?loadStyle(data.css):Promise.resolve()]));
        const [module]=await loaded.get(id);
        if(destroyed||selection!==token)return;
        const element=document.createElement('div');element.className='arc-stage';element.dataset.stage=id;query('.arc-stages').appendChild(element);
        let game;try{game=module.mount(element,{getBest,saveBest});}catch(error){element.remove();throw error;}
        instances.set(id,{element,game});
      }
      if(destroyed||selection!==token)return;
      instances.get(id).element.hidden=false;loading.hidden=true;
    }catch(error){loaded.delete(id);if(selection!==token||destroyed)return;loading.textContent='Hru se nepodařilo načíst. Zkus ji vybrat znovu.';}
  }
  for(const [id,data] of Object.entries(games)) {
    const button=document.createElement('button');button.type='button';button.className='arc-game-card arc-'+data.hue;button.dataset.game=id;button.setAttribute('aria-pressed','false');
    button.innerHTML=`<span class="arc-card-icon" aria-hidden="true">${data.icon}</span><span class="arc-card-content"><small>${data.category}</small><strong>${data.name}</strong><span>${data.copy}</span><em data-best="${id}"></em></span><span class="arc-card-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    const best=getBest(id);button.querySelector('em').textContent=best?'Rekord '+best+(id==='reaction'?' ms':''):'Tvůj první rekord čeká';
    button.addEventListener('click',()=>select(id),{signal:controller.signal});query('.arc-catalog').appendChild(button);
  }
  details.addEventListener('toggle',()=>{if(!details.open)pauseAll();},{signal:controller.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseAll();},{signal:controller.signal});
  window.addEventListener('blur',pauseAll,{signal:controller.signal});window.addEventListener('pagehide',pauseAll,{signal:controller.signal});
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)pauseAll();}):null;observer?.observe(query('.arc-arena'));
  await select('reaction');
  return {pause:pauseAll,destroy(){destroyed=true;selection++;observer?.disconnect();controller.abort();for(const entry of instances.values())entry.game.destroy();instances.clear();root.replaceChildren();}};
}
