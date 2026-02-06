// Werewolf — script.js

const MAX_PLAYERS = 15;
let state = {
  players: [], // {id,name,role,alive}
  phase: 'setup',
  revealIndex: 0,
  night: { victim: null, saved: null, seerPeek: null },
};

// --- Utilities ---
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const pause = ms => new Promise(res => setTimeout(res, ms));
const escapeHtml = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// --- Init ---
function init(){
  bindSetup();
  renderPlayerInputs(6);
}

// --- Setup ---
function bindSetup(){
  $('#btn-generate').onclick = ()=>{
    const cnt = parseInt($('#player-count').value) || 3;
    const clamped = Math.max(3, Math.min(MAX_PLAYERS, cnt));
    renderPlayerInputs(clamped);
  };
  $('#btn-start').onclick = ()=>{
    collectPlayers();
    assignRoles();
    showDeck();
  };
  $('#btn-skip').onclick = nextReveal;
  $('#btn-next-reveal').onclick = nextReveal;
  $('#btn-help').onclick = ()=>showModal('How To Play','Narrator announces night/day. Swipe up to reveal roles. Pass device between players.','Close');
}

function renderPlayerInputs(count){
  const ul = $('#player-list'); ul.innerHTML='';
  for(let i=0;i<count;i++){
    const li = document.createElement('li');
    li.innerHTML = `<input class="input-name" data-i="${i}" value="Player ${i+1}" />
                    <button class="btn small remove">✕</button>`;
    li.querySelector('.remove').onclick = ()=>{ li.remove(); updatePlayerCount(); };
    ul.appendChild(li);
  }
  updatePlayerCount();
}

function updatePlayerCount(){
  const list = $$('#player-list .input-name');
  $('#player-count').value = list.length;
}

function collectPlayers(){
  const names = $$('#player-list .input-name').map(i=>i.value.trim()||i.placeholder);
  state.players = names.map((n,i)=>({id:i,name:n,role:null,alive:true}));
}

// --- Role Assignment ---
function assignRoles(){
  const n = state.players.length;
  let wolves = Math.max(1, Math.floor(n/4));
  wolves = Math.min(wolves, n-2);
  let roles = [];
  for(let i=0;i<wolves;i++) roles.push('Werewolf');
  if(n>=3) roles.push('Seer');
  if(n>=4) roles.push('Doctor');
  if(n>=5) roles.push('Hunter');
  while(roles.length<n) roles.push('Villager');
  roles = shuffle(roles);
  state.players.forEach((p,i)=>p.role=roles[i]);
}

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// --- Deck Reveal ---
function showDeck(){
  state.revealIndex=0;
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
  let startY=0;
  card.ontouchstart = e=>startY=e.touches[0].clientY;
  card.ontouchend = e=>{
    const endY = e.changedTouches[0].clientY;
    if(startY - endY > 50) doReveal();
  };
  card.onclick = doReveal;
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
    $('#deck').classList.add('hidden');
    $('#gameboard').classList.remove('hidden');
    renderPlayersGrid();
    setPhase('day','Game begins');
  } else {
    updateRevealCard();
  }
}

function roleDescription(role){
  const desc = {
    Werewolf:'A werewolf — you hunt at night. Coordinate with your pack.',
    Seer:'Seer — peek at one player each night to learn their role.',
    Doctor:'Doctor — save one player each night from death.',
    Hunter:'Hunter — if you die, you immediately take one player with you.',
    Villager:'Villager — no night power. Use your voice in the day.'
  };
  return desc[role]||'';
}

// --- Gameboard ---
function renderPlayersGrid(){
  const grid = $('#players-grid'); grid.innerHTML='';
  state.players.forEach(p=>{
    const el = document.createElement('div');
    el.className = 'player-card '+(p.alive?'alive':'dead');
    el.innerHTML = `<div class="name">${escapeHtml(p.name)}</div><div class="role-flag">${p.alive?'Alive':'Dead'}</div>`;
    grid.appendChild(el);
  });
}

function setPhase(type,text){
  state.phase = type;
  const banner = $('#phase-banner');
  banner.className = 'phase '+(type==='night'?'night':'day');
  banner.textContent = text;
}

// --- Modal ---
function showModal(title,body,closeLabel='Close'){
  $('#overlay').classList.remove('hidden');
  $('#modal').classList.remove('hidden');
  $('#modal-header').textContent=title;
  $('#modal-body').innerHTML=body;
  const act = $('#modal-actions'); act.innerHTML='';
  const btn = document.createElement('button'); btn.className='btn primary'; btn.textContent=closeLabel;
  btn.onclick = closeModal; act.appendChild(btn);
}

function closeModal(){ $('#overlay').classList.add('hidden'); $('#modal').classList.add('hidden'); }

init();
