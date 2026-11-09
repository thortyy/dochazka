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
  let tttCells=[], tttButtons=[], tttBusy=false, tttOver=false, computerTimer=null;
  const winLines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function winningLine(cells,mark){return winLines.find(line=>line.every(i=>cells[i]===mark));}
  function finishTtt(){
    const winner=winningLine(tttCells,'X')||winningLine(tttCells,'O');
    if(winner){tttOver=true;tttBusy=false;get('ttt-result').textContent=tttCells[winner[0]]==='X'?'Vyhrál jsi! Skvělá hra.':'Počítač vyhrál. Zkus odvetu!';winner.forEach(i=>tttButtons[i].classList.add('winner'));}
    else if(tttCells.every(Boolean)){tttOver=true;tttBusy=false;get('ttt-result').textContent='Remíza! Dáme odvetu?';}
    tttButtons.forEach((b,i)=>{b.textContent=tttCells[i]||'·';b.disabled=tttOver||tttBusy||Boolean(tttCells[i]);b.setAttribute('aria-label',`Pole ${i+1}: ${tttCells[i]||'prázdné'}`);});
    return tttOver;
  }
  function resetTtt(){
    clearTimeout(computerTimer);tttCells=Array(9).fill(null);tttBusy=false;tttOver=false;get('ttt-board').replaceChildren();get('ttt-result').textContent='Jsi na tahu. Hraješ za X.';
    tttButtons=tttCells.map((_,i)=>{const button=document.createElement('button');button.type='button';button.className='ttt-cell';button.onclick=()=>{
      if(tttBusy||tttOver||tttCells[i])return;
      tttCells[i]='X';tttBusy=true;
      if(finishTtt())return;
      get('ttt-result').textContent='Počítač přemýšlí…';
      computerTimer=setTimeout(()=>{
        const free=tttCells.flatMap((v,index)=>v?[]:[index]);
        const wouldWin=mark=>free.find(index=>{const copy=[...tttCells];copy[index]=mark;return Boolean(winningLine(copy,mark));});
        let move=wouldWin('O')??wouldWin('X');
        if(move===undefined)move=!tttCells[4]?4:free[Math.floor(Math.random()*free.length)];
        if(move!==undefined)tttCells[move]='O';tttBusy=false;
        if(!finishTtt())get('ttt-result').textContent='Jsi na tahu.';
      },300);
    };get('ttt-board').appendChild(button);return button;});finishTtt();
  }
  get('ttt-reset').onclick=resetTtt;
  let mathTimer=null,mathDeadline=0,mathPoints=0,mathExpected=0,mathActive=false;
  function updateMathScore(){get('math-score').textContent=`Čas: ${Math.max(0,Math.ceil((mathDeadline-performance.now())/1000))} s · Body: ${mathPoints}`;}
  function stopMath(){
    if(!mathActive)return;mathActive=false;clearInterval(mathTimer);get('math-play').hidden=true;get('math-start').hidden=false;get('math-result').textContent=`Hotovo! Správné odpovědi: ${mathPoints}. Zkus další kolo.`;
  }
  function nextMath(){
    const op=Math.floor(Math.random()*3);let a,b,sign;
    if(op===2){a=1+Math.floor(Math.random()*9);b=1+Math.floor(Math.random()*9);sign='×';mathExpected=a*b;}
    else {a=1+Math.floor(Math.random()*20);b=1+Math.floor(Math.random()*20);if(op===1&&b>a)[a,b]=[b,a];sign=op===0?'+':'−';mathExpected=op===0?a+b:a-b;}
    get('math-question').textContent=`${a} ${sign} ${b} = ?`;get('math-answer').value='';get('math-answer').focus();
  }
  get('math-start').onclick=()=>{clearInterval(mathTimer);mathActive=true;mathPoints=0;mathDeadline=performance.now()+30000;get('math-result').textContent='';get('math-play').hidden=false;get('math-start').hidden=true;updateMathScore();nextMath();mathTimer=setInterval(()=>{updateMathScore();if(performance.now()>=mathDeadline)stopMath();},200);};
  get('math-form').onsubmit=event=>{event.preventDefault();if(!mathActive)return;if(performance.now()>=mathDeadline){updateMathScore();stopMath();return;}
    if(get('math-answer').value.trim()==='')return;
    if(Number(get('math-answer').value)===mathExpected){mathPoints++;get('math-result').textContent='Správně!';updateMathScore();nextMath();}
    else {get('math-result').textContent='Zkus to ještě jednou.';get('math-answer').select();}
  };
  function selectGame(name){
    cancelReaction();stopMath();
    for(const game of ['reaction','memory','ttt','math']){get(game+'-game').hidden=game!==name;get(game+'-tab').setAttribute('aria-pressed',String(game===name));}
    if(name==='memory'&&!cards.length)resetMemory();if(name==='ttt'&&!tttButtons.length)resetTtt();
  }
  for(const name of ['reaction','memory','ttt','math'])get(name+'-tab').onclick=()=>selectGame(name);
  get('games-panel').addEventListener('toggle',()=>{if(!get('games-panel').open){cancelReaction();stopMath();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelReaction();stopMath();}});
})();
