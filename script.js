// Werewolf — script.js

const MAX_PLAYERS = 15;
let state = {
  players: [], // {id,name,role,alive}
  roles: [],
  phase: 'setup',
  revealIndex: 0,
  night: { victim: null, saved: null, seerPeek: null },
  dayCount: 0
};

/* ---------- Utilities ---------- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const rand = n => Math.floor(Math.random()*n);

/* ---------- Setup UI ---------- */
function init(){
  bindSetup();
  renderPlayerInputs(6);
}

function bindSetup(){
  $('#btn-generate').onclick = ()=>{
    const cnt = parseInt($('#player-count').value)||3;
    const clamped = Math.max(3,Math.min(MAX_PLAYERS,cnt));
    renderPlayerInputs(clamped);
  }
  $('#btn-start').onclick = ()=>{
    collectPlayers();
    assignRoles();
    showDeck();
  }
  $('#btn-skip').onclick = ()=>{ nextReveal(); }
  $('#btn-next-reveal').onclick = ()=>{ nextReveal(); }
  $('#btn-night').onclick = ()=>{ startNightSequence(); }
  $('#btn-vote').onclick = ()=>{ startDayVote(); }
  $('#btn-help').onclick = ()=>{ showModal('How To Play','Narrator announces night/day. Swipe up to reveal roles. Pass device between players.','Close'); }
}

function renderPlayerInputs(count){
  const ul = $('#player-list'); ul.innerHTML='';
  for(let i=0;i<count;i++){
    const li = document.createElement('li');
    li.innerHTML = `<input class="input-name" data-i="${i}" value="Player ${i+1}" />
      <button class="btn small remove">✕</button>`;
    ul.appendChild(li);
    li.querySelector('.remove').onclick = ()=>{ li.remove(); updatePlayerCount(); };
  }
  updatePlayerCount();
}
function updatePlayerCount(){
  const list = $$('#player-list .input-name');
  $('#player-count').value = list.length;
}

function collectPlayers(){
  const names = $$('#player-list .input-name').map(inp=>inp.value.trim()||inp.placeholder);
  state.players = names.map((n,i)=>({id:i,name:n,role:null,alive:true}));
}

/* ---------- Role Assignment ---------- */
function assignRoles(){
  const n = state.players.length;
  // WEREWOLVES: at least 1, roughly n/4
  let wolves = Math.max(1, Math.floor(n/4));
  // ensure at least one werewolf and at most n-2
  wolves = Math.min(wolves, n-2);
  let roles = [];
  for(let i=0;i<wolves;i++) roles.push('Werewolf');
  // always 1 Seer
  if(n>=3) roles.push('Seer');
  // at least 1 Doctor for n>=4
  if(n>=4) roles.push('Doctor');
  // Hunter when n>=5
  if(n>=5) roles.push('Hunter');
  while(roles.length < n) roles.push('Villager');
  // shuffle and assign
  roles = shuffle(roles);
  state.players.forEach((p,i)=>p.role=roles[i]);
}
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

/* ---------- Deck / Reveal (Swipe Up) ---------- */
function showDeck(){
  state.revealIndex = 0;
  $('#setup').classList.add('hidden');
  $('#deck').classList.remove('hidden');
  updateRevealCard();
  bindSwipeReveal();
}

function updateRevealCard(){
  const player = state.players[state.revealIndex];
  $('#reveal-name').textContent = player.name;
  $('#role-title').textContent = '???';
  $('#role-desc').textContent = '';
  $('#role-card').classList.remove('flipped');
  $('#btn-next-reveal').classList.add('hidden');
}

function bindSwipeReveal(){
  const card = $('#role-card');
  let startY=0, endY=0;
  card.ontouchstart = (e)=>{ startY = e.touches[0].clientY; };
  card.ontouchend = (e)=>{ endY = e.changedTouches[0].clientY; if(startY - endY > 50) doReveal(); };
  card.onclick = ()=>{ /* also allow tap */ doReveal(); };
}

function doReveal(){
  const player = state.players[state.revealIndex];
  $('#role-title').textContent = player.role;
  $('#role-desc').textContent = roleDescription(player.role);
  $('#role-card').classList.add('flipped');
  $('#btn-next-reveal').classList.remove('hidden');
}

function nextReveal(){
  state.revealIndex++;
  if(state.revealIndex >= state.players.length){
    // finished reveal
    $('#deck').classList.add('hidden');
    $('#gameboard').classList.remove('hidden');
    renderPlayersGrid();
    setPhase('day','Game begins');
  } else {
    updateRevealCard();
  }
}

function roleDescription(role){
  const m = {
    Werewolf: 'A werewolf — you hunt at night. Coordinate with your pack.',
    Seer: 'Seer — peek at one player each night to learn their role.',
    Doctor: 'Doctor — save one player each night from death.',
    Hunter: 'Hunter — if you die, you immediately take one player with you.',
    Villager: 'Villager — no night power. Use your voice in the day.'
  };
  return m[role] || '';
}

/* ---------- Gameboard UI ---------- */
function renderPlayersGrid(){
  const grid = $('#players-grid'); grid.innerHTML='';
  state.players.forEach(p=>{
    const el = document.createElement('div'); el.className='player-card '+(p.alive?'alive':'dead');
    el.dataset.id = p.id;
    el.innerHTML = `<div class="name">${escapeHtml(p.name)}</div><div class="role-flag">${p.alive?'Alive':'Dead'}</div>`;
    if(!p.alive) el.classList.add('dead');
    grid.appendChild(el);
  });
}

function setPhase(type,text){
  state.phase = type;
  const banner = $('#phase-banner'); banner.className = 'phase '+(type==='night'?'night':'day');
  banner.textContent = text;
}

/* ---------- Narrator-led Night Sequence ---------- */
async function startNightSequence(){
  if(checkWin()) return;
  setPhase('night','All players, close your eyes. Night begins…');
  await pause(1000);
  // WEREWOLVES
  await narratorStep('Werewolves, open your eyes and select your victim.', werewolvesSelection);
  // SEER
  await narratorStep('Werewolves, close your eyes. Seer, open your eyes and peek at a player.', seerSelection);
  // DOCTOR
  await narratorStep('Seer, close your eyes. Doctor, open your eyes and save a player.', doctorSelection);
  // resolve
  await pause(400);
  resolveNight();
}

function narratorStep(message, action){
  return new Promise(resolve=>{
    showModal('Narrator', message, [{label:'Proceed',onClick:()=>{ closeModal(); action().then(resolve); }}], true);
  });
}

/* Werewolf selection — single victim chosen by whoever holds the device */
function werewolvesSelection(){
  return new Promise(resolve=>{
    showSelection('Werewolves: Pick a victim','Select one player to be attacked.',true,(choiceId)=>{
      state.night.victim = choiceId; closeModal(); resolve();
    }, showAliveNonWerewolfList);
  });
}

/* Seer selection */
function seerSelection(){
  return new Promise(resolve=>{
    const seer = state.players.find(p=>p.role==='Seer' && p.alive);
    if(!seer){ resolve(); return; }
    showSelection('Seer — Peek','Pick a player to reveal to the Seer (their role will be shown).',true,(choiceId)=>{
      state.night.seerPeek = choiceId;
      const peekRole = state.players.find(p=>p.id===choiceId).role;
      showModal('Seer — Peek', `You peeked at ${state.players.find(p=>p.id===choiceId).name}: <b>${peekRole}</b>`,[{label:'Okay',onClick:()=>{ closeModal(); resolve(); }}], true);
    }, ()=>state.players.filter(p=>p.alive).map(p=>({id:p.id,label:p.name})) );
  });
}

/* Doctor selection */
function doctorSelection(){
  return new Promise(resolve=>{
    const doc = state.players.find(p=>p.role==='Doctor' && p.alive);
    if(!doc){ resolve(); return; }
    showSelection('Doctor — Save','Pick a player to save from tonight's attack.',true,(choiceId)=>{
      state.night.saved = choiceId; closeModal(); resolve();
    }, ()=>state.players.filter(p=>p.alive).map(p=>({id:p.id,label:p.name})) );
  });
}

/* Helpers for selection lists */
function showSelection(title,body,requireAlive,onChoose,itemsProvider){
  const items = (typeof itemsProvider === 'function')? itemsProvider() : (itemsProvider||state.players.filter(p=>p.alive).map(p=>({id:p.id,label:p.name})));
  const bodyHtml = `<div class="modal-body">${body}</div><div class="list">${items.map(it=>`<button class="btn vote-chip" data-id="${it.id}">${escapeHtml(it.label)}</button>`).join('')}</div>`;
  const actions = [];
  showModal(title, bodyHtml, [], false);
  document.querySelectorAll('.vote-chip').forEach(b=>{ b.onclick = ()=>{ const id = parseInt(b.dataset.id); onChoose(id); }; });
}

/* Resolve night results */
function resolveNight(){
  const victim = state.night.victim;
  const saved = state.night.saved;
  let killed = null;
  if(victim != null && victim !== saved){
    // kill the victim
    const p = state.players.find(pl=>pl.id===victim);
    if(p && p.alive){ p.alive=false; killed = p; }
  }

  // Day begins
  if(killed){
    renderPlayersGrid();
    revealDeath(killed);
  } else {
    setPhase('day','Night ends. Day begins. No one died.');
    renderPlayersGrid();
    state.night = { victim:null, saved:null, seerPeek:null };
    checkWin();
  }
}

function revealDeath(player){
  setPhase('day','Night ends. Day begins.');
  showModal('Night Result', `${player.name} was killed during the night. They were a <b>${player.role}</b>.`, [{label:'Continue',onClick:()=>{ closeModal(); postDeathTriggers(player); }}], true);
}

function postDeathTriggers(player){
  // Hunter revenge
  if(player.role === 'Hunter'){
    // hunter can immediately pick a target
    const candidates = state.players.filter(p=>p.alive).map(p=>({id:p.id,label:p.name}));
    if(candidates.length>0){
      showSelection('Hunter — Revenge','You died! Hunter, pick someone to take with you.',true,(targetId)=>{
        const t = state.players.find(p=>p.id===targetId);
        if(t){ t.alive=false; renderPlayersGrid(); showModal('Hunter Revenge', `${t.name} was taken by the Hunter's revenge. They were a <b>${t.role}</b>.`, [{label:'Ok',onClick:()=>{ closeModal(); finalizeNight(); }}], true); }
      }, ()=>candidates);
      return;
    }
  }
  finalizeNight();
}

function finalizeNight(){
  state.night = { victim:null, saved:null, seerPeek:null };
  renderPlayersGrid();
  checkWin();
}

/* ---------- Day Vote ---------- */
function startDayVote(){
  setPhase('day','Discussion time — then vote.');
  showModal('Vote','Tap the player to cast your vote. Votes will fly to the pile. After everyone votes, the most-voted is lynched.', [], true);
  // present voting UI overlay where players take turns voting
  presentVoting().then(result=>{
    closeModal();
    if(result.tied){
      // tie animation
      animateTie();
    } else if(result.kicked!=null){
      // eliminate
      const p = state.players.find(x=>x.id===result.kicked);
      p.alive=false; renderPlayersGrid();
      showModal('Lynch','The village lynched '+p.name+` — they were <b>${p.role}</b>.`, [{label:'Continue',onClick:()=>{ closeModal(); if(p.role==='Hunter') postDeathTriggers(p); else checkWin(); }}], true);
    }
  });
}

function presentVoting(){
  return new Promise(resolve=>{
    const alive = state.players.filter(p=>p.alive);
    const votes = {};
    let voters = alive.length; // each alive gets one vote
    // create quick voting UI: iterate passing device for each voter
    let idx = 0;
    function nextVoter(){
      if(idx>=alive.length){
        // tally
        const tallies = {};
        for(const v of Object.values(votes)){ tallies[v]=(tallies[v]||0)+1; }
        const max = Math.max(...Object.values(tallies));
        const winners = Object.keys(tallies).filter(k=>tallies[k]===max).map(k=>parseInt(k));
        if(winners.length>1) resolve({tied:true});
        else resolve({tied:false,kicked:winners[0]});
        return;
      }
      const voter = alive[idx++];
      // show modal for this voter to pick
      const items = state.players.filter(p=>p.alive).map(p=>({id:p.id,label:p.name}));
      const bodyHtml = `<div class="modal-body">${voter.name}, cast your vote.</div><div class="list">${items.map(it=>`<button class="btn vote-chip" data-id="${it.id}">${escapeHtml(it.label)}</button>`).join('')}</div>`;
      showModal('Vote', bodyHtml, [], false);
      document.querySelectorAll('.vote-chip').forEach(b=>{ b.onclick = ()=>{
        const id = parseInt(b.dataset.id);
        animateVoteFly(b, id).then(()=>{
          votes[voter.id]=id; closeModal(); nextVoter();
        });
      }; });
    }
    nextVoter();
  });
}

function animateVoteFly(buttonEl, targetId){
  return new Promise(resolve=>{
    // create clone
    const rect = buttonEl.getBoundingClientRect();
    const fly = buttonEl.cloneNode(true);
    fly.classList.add('flying');
    document.body.appendChild(fly);
    fly.style.left = rect.left+'px'; fly.style.top = rect.top+'px'; fly.style.width = rect.width+'px';
    // target center
    const centerX = window.innerWidth/2 - rect.width/2; const centerY = window.innerHeight*0.18;
    requestAnimationFrame(()=>{
      fly.style.transform = `translate(${centerX-rect.left}px, ${centerY-rect.top}px) scale(.6)`;
      fly.style.opacity = '0.85';
    });
    setTimeout(()=>{ fly.remove(); resolve(); }, 700);
  });
}

function animateTie(){
  // subtle fizz
  const banner = $('#phase-banner');
  banner.classList.add('pulse');
  banner.textContent = 'Tie! No lynch.';
  setTimeout(()=>{ banner.classList.remove('pulse'); banner.textContent='Day'; checkWin(); }, 1200);
}

/* ---------- Win detection ---------- */
function checkWin(){
  const alive = state.players.filter(p=>p.alive);
  const wolves = alive.filter(p=>p.role==='Werewolf').length;
  const villagers = alive.length - wolves;
  if(wolves === 0){ showEnd('Villagers win!'); return true; }
  if(wolves >= villagers){ showEnd('Werewolves win!'); return true; }
  renderPlayersGrid();
  return false;
}

function showEnd(text){
  showModal('Game Over', text, [{label:'Restart',onClick:()=>{ location.reload(); }}], true);
}

/* ---------- Modal helpers ---------- */
function showModal(title, body, actions=[], lock=false){
  $('#overlay').classList.remove('hidden');
  $('#modal').classList.remove('hidden');
  $('#modal-header').innerHTML = title;
  $('#modal-body').innerHTML = (typeof body === 'string')?body:body;
  const act = $('#modal-actions'); act.innerHTML='';
  actions.forEach(a=>{
    const b = document.createElement('button'); b.className='btn primary'; b.textContent=a.label; b.onclick = ()=>{ if(a.onClick) a.onClick(); };
    act.appendChild(b);
  });
  if(lock){}
}
function closeModal(){ $('#overlay').classList.add('hidden'); $('#modal').classList.add('hidden'); }

/* ---------- Helpers ---------- */
function pause(ms){ return new Promise(res=>setTimeout(res,ms)); }
function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ---------- Init ---------- */n
init();

// Expose for debug (optional)
window._state = state;
