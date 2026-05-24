const TILE = 32;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const STAGES = window.AGU_STAGES || [];
const CONFIG = window.AGU_GAME_CONFIG || { totalRescueGoal: 30, targetStageSeconds: 120 };
const CHARACTERS = window.AGU_CHARACTERS || {};
const OPENING = window.AGU_OPENING || [];

const screens = {
  title: document.getElementById('titleScreen'),
  game: document.getElementById('gameScreen'),
  clear: document.getElementById('clearScreen'),
  ending: document.getElementById('endingScreen'),
};

const ui = {
  stageNo: document.getElementById('stageNo'),
  stageTotal: document.getElementById('stageTotal'),
  stageName: document.getElementById('stageName'),
  rescued: document.getElementById('rescuedCount'),
  totalRescued: document.getElementById('totalRescuedCount'),
  goal: document.getElementById('goalCount'),
  campaignGoal: document.getElementById('campaignGoalCount'),
  rewinds: document.getElementById('rewindCount'),
  message: document.getElementById('message'),
  clearTitle: document.getElementById('clearTitle'),
  clearText: document.getElementById('clearText'),
  nextBtn: document.getElementById('nextBtn'),
};

const dialogueEls = {
  overlay: document.getElementById('dialogueOverlay'),
  portrait: document.getElementById('dialoguePortrait'),
  speaker: document.getElementById('dialogueSpeaker'),
  role: document.getElementById('dialogueRole'),
  design: document.getElementById('dialogueDesign'),
  text: document.getElementById('dialogueText'),
  nextBtn: document.getElementById('dialogueNextBtn'),
};

let stageIndex = 0;
let state;
let lastTime = 0;
let animId;
let openingPlayed = false;
let dialogue = { active: false, lines: [], index: 0, onFinish: null };
let campaign = loadCampaign();

function loadCampaign() {
  try {
    const saved = JSON.parse(localStorage.getItem('agus-rpg-save-v2') || '{}');
    return {
      totalRescued: Number(saved.totalRescued || 0),
      unlockedStage: Number(saved.unlockedStage || 0),
      clearedStages: Array.isArray(saved.clearedStages) ? saved.clearedStages : [],
      metCharacters: Array.isArray(saved.metCharacters) ? saved.metCharacters : [],
      items: Array.isArray(saved.items) ? saved.items : [],
    };
  } catch {
    return { totalRescued: 0, unlockedStage: 0, clearedStages: [], metCharacters: [], items: [] };
  }
}

function saveCampaign() {
  localStorage.setItem('agus-rpg-save-v2', JSON.stringify(campaign));
}

function show(name) {
  Object.values(screens).forEach(s => s?.classList.remove('active'));
  screens[name]?.classList.add('active');
}

function startGame() {
  show('game');
  if (!openingPlayed && OPENING.length) {
    openingPlayed = true;
    openDialogue(OPENING, () => startStage(Math.min(campaign.unlockedStage, STAGES.length - 1)));
  } else {
    startStage(Math.min(campaign.unlockedStage, STAGES.length - 1));
  }
}

function currentStage() { return STAGES[stageIndex]; }
function mapSize(stage) { return { width: stage.map[0].length, height: stage.map.length }; }

function parseStage(index) {
  const src = STAGES[index];
  const walls = new Set();
  const switches = [];
  const doors = [];
  const keys = [];
  const lockedGates = [];
  const npcs = [];
  let player = { x: 1, y: 1, px: 1, py: 1, target: null, moving: false, progress: 1 };
  let residentIndex = 0;

  src.map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '#') walls.add(`${x},${y}`);
      if (ch === 'P') player = { x, y, px: x, py: y, target: null, moving: false, progress: 1 };
      if (ch === 'S') switches.push({ x, y, on: false });
      if (ch === 'D') doors.push({ x, y, open: false });
      if (ch === 'K') keys.push({ x, y, taken: false });
      if (ch === 'L') lockedGates.push({ x, y, open: false });
      if (ch === 'N') {
        const characterId = src.residents?.[residentIndex++] || null;
        npcs.push({ x, y, rescued: false, characterId });
      }
    });
  });

  return {
    stage: src,
    size: mapSize(src),
    walls,
    switches,
    doors,
    keys,
    lockedGates,
    npcs,
    player,
    enemies: (src.enemies || []).map(e => ({
      path: e.path.map(p => [...p]),
      speed: e.speed || 0.6,
      step: 0,
      tick: 0,
      x: e.path[0][0],
      y: e.path[0][1],
    })),
    rewinds: state?.rewinds ?? 0,
    startedAt: performance.now(),
  };
}

function startStage(index) {
  if (!STAGES.length) {
    alert('ステージデータが見つかりません。');
    return;
  }
  stageIndex = Math.max(0, Math.min(index, STAGES.length - 1));
  state = parseStage(stageIndex);
  canvas.width = state.size.width * TILE;
  canvas.height = state.size.height * TILE;

  ui.stageNo.textContent = stageIndex + 1;
  ui.stageTotal.textContent = STAGES.length;
  ui.stageName.textContent = state.stage.name;
  ui.goal.textContent = state.npcs.length;
  ui.rescued.textContent = '0';
  ui.totalRescued.textContent = campaign.totalRescued;
  ui.campaignGoal.textContent = CONFIG.totalRescueGoal;
  ui.rewinds.textContent = state.rewinds;
  setMessage(state.stage.intro);

  show('game');
  cancelAnimationFrame(animId);
  lastTime = performance.now();
  loop(lastTime);

  if (state.stage.openingCutscene?.length) openDialogue(state.stage.openingCutscene);
}

function setMessage(text) { ui.message.textContent = text; }

function isBlocked(x, y) {
  if (x < 0 || y < 0 || x >= state.size.width || y >= state.size.height) return true;
  if (state.walls.has(`${x},${y}`)) return true;
  if (state.doors.some(d => !d.open && d.x === x && d.y === y)) return true;
  if (state.lockedGates.some(g => !g.open && g.x === x && g.y === y)) return true;
  return false;
}

function neighbors(node) {
  return [[1,0],[-1,0],[0,1],[0,-1]]
    .map(([dx,dy]) => ({ x: node.x + dx, y: node.y + dy }))
    .filter(p => !isBlocked(p.x, p.y));
}

function findPath(start, goal) {
  if (isBlocked(goal.x, goal.y)) return null;
  const key = p => `${p.x},${p.y}`;
  const queue = [start];
  const came = new Map([[key(start), null]]);
  while (queue.length) {
    const cur = queue.shift();
    if (cur.x === goal.x && cur.y === goal.y) break;
    for (const n of neighbors(cur)) {
      const k = key(n);
      if (!came.has(k)) { came.set(k, cur); queue.push(n); }
    }
  }
  if (!came.has(key(goal))) return null;
  const path = [];
  let cur = goal;
  while (cur) { path.unshift(cur); cur = came.get(key(cur)); }
  return path.slice(1);
}

function goTo(tileX, tileY) {
  if (dialogue.active) return;
  const p = state.player;
  const path = findPath({ x: p.x, y: p.y }, { x: tileX, y: tileY });
  if (!path || !path.length) {
    setMessage('そこへは行けない。先にスイッチや鍵を探そう。');
    return;
  }
  p.target = path;
  p.moving = false;
}

function updatePlayer(dt) {
  const p = state.player;
  if (!p.moving && p.target && p.target.length) {
    const next = p.target.shift();
    p.px = p.x; p.py = p.y; p.x = next.x; p.y = next.y;
    p.progress = 0; p.moving = true;
  }
  if (p.moving) {
    p.progress += dt * 7.5;
    if (p.progress >= 1) { p.progress = 1; p.moving = false; handlePlayerTile(); }
  }
}

function handlePlayerTile() {
  const p = state.player;
  const keyTile = state.keys.find(k => !k.taken && k.x === p.x && k.y === p.y);
  if (keyTile) {
    keyTile.taken = true;
    state.lockedGates.forEach(g => g.open = true);
    setMessage('鍵を手に入れた！ 鍵付きゲートが開いた。');
  }
}

function updateEnemies(dt) {
  for (const e of state.enemies) {
    e.tick += dt;
    if (e.tick > e.speed) {
      e.tick = 0;
      e.step = (e.step + 1) % e.path.length;
      e.x = e.path[e.step][0];
      e.y = e.path[e.step][1];
    }
  }
}

function checkEnemyHit() {
  const p = state.player;
  if (state.enemies.some(e => e.x === p.x && e.y === p.y)) rewindTime();
}

function rewindTime() {
  const oldRewinds = state.rewinds + 1;
  state = parseStage(stageIndex);
  state.rewinds = oldRewinds;
  ui.rewinds.textContent = state.rewinds;
  ui.rescued.textContent = '0';
  setMessage('敵に遭遇した！ 時間が巻き戻った。');
  if (state.stage.openingCutscene?.length) openDialogue(state.stage.openingCutscene);
}

function near(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1; }

function interact() {
  if (dialogue.active) return;
  const p = state.player;
  const npc = state.npcs.find(n => !n.rescued && near(p, n));
  if (npc) {
    const chara = CHARACTERS[npc.characterId] || { name: '村人', role: '村人', design: '', rescueLine: '助かった！', bio: '' };
    const line = state.stage.isFinalStage && npc.characterId === 'ami' ? (chara.finalRescueLine || chara.rescueLine) : chara.rescueLine;
    openDialogue([
      { characterId: npc.characterId, speaker: chara.name, role: `${chara.job || chara.role || '村人'} / ${chara.age || '?'}歳`, text: line },
      { characterId: npc.characterId, speaker: chara.name, role: chara.relation || chara.personality || '', text: `【人物メモ】${chara.personality || chara.bio || '村の大切な人。'}` },
    ], () => finishRescue(npc));
    return;
  }
  const sw = state.switches.find(s => near(p, s));
  if (sw) {
    sw.on = !sw.on;
    state.doors.forEach(d => d.open = state.switches.some(s => s.on));
    setMessage(sw.on ? 'スイッチ作動！ 扉が開いた。' : 'スイッチ解除。扉が閉じた。');
    return;
  }
  setMessage('近くに救助できる人や仕掛けはない。');
}

function finishRescue(npc) {
  npc.rescued = true;
  if (npc.characterId && !campaign.metCharacters.includes(npc.characterId)) campaign.metCharacters.push(npc.characterId);
  saveCampaign();
  const done = state.npcs.filter(n => n.rescued).length;
  ui.rescued.textContent = done;
  if (done >= state.npcs.length) clearStage();
  else setMessage(`救助成功。残りは ${state.npcs.length - done} 人。`);
}

function openDialogue(lines, onFinish = null) {
  dialogue = { active: true, lines, index: 0, onFinish };
  renderDialogueLine();
}

function renderDialogueLine() {
  const line = dialogue.lines[dialogue.index];
  const chara = line.characterId ? CHARACTERS[line.characterId] : null;
  dialogueEls.speaker.textContent = line.speaker || chara?.name || '語り手';
  dialogueEls.role.textContent = line.role || chara?.job || '';
  dialogueEls.design.textContent = chara?.design || '';
  dialogueEls.text.textContent = line.text || '';
  dialogueEls.portrait.style.background = chara?.important ? 'linear-gradient(180deg,#ffd58a,#5b4b75)' : 'linear-gradient(180deg,#8eb8ff,#5b4b75)';
  dialogueEls.overlay.classList.remove('hidden');
}

function nextDialogue() {
  if (!dialogue.active) return;
  if (dialogue.index < dialogue.lines.length - 1) {
    dialogue.index += 1;
    renderDialogueLine();
    return;
  }
  dialogueEls.overlay.classList.add('hidden');
  const onFinish = dialogue.onFinish;
  dialogue = { active: false, lines: [], index: 0, onFinish: null };
  if (typeof onFinish === 'function') onFinish();
}

function clearStage() {
  cancelAnimationFrame(animId);
  const st = currentStage();
  const alreadyCleared = campaign.clearedStages.includes(st.id);
  if (!alreadyCleared) {
    campaign.totalRescued += st.rescuedPeople || state.npcs.length;
    campaign.clearedStages.push(st.id);
    campaign.unlockedStage = Math.max(campaign.unlockedStage, stageIndex + 1);
    if (st.clearReward && !campaign.items.includes(st.clearReward)) campaign.items.push(st.clearReward);
    saveCampaign();
  }
  const elapsed = Math.max(1, Math.round((performance.now() - state.startedAt) / 1000));
  ui.clearTitle.textContent = st.isFinalStage ? 'ami救出！' : 'ステージクリア！';
  ui.clearText.textContent = `${st.clearMessage}\n${alreadyCleared ? 'このステージはクリア済み。' : `獲得: ${st.clearReward || 'なし'}`}\n累計救助: ${campaign.totalRescued}/${CONFIG.totalRescueGoal}\nクリア時間: ${elapsed}秒`;
  ui.nextBtn.textContent = st.isFinalStage ? 'エンドロールへ' : '次のステージへ';
  show('clear');
}

function drawTile(x, y, color, inset = 0) { ctx.fillStyle = color; ctx.fillRect(x*TILE+inset, y*TILE+inset, TILE-inset*2, TILE-inset*2); }
function drawSprite(x, y, color, face = '#111') { ctx.fillStyle = color; ctx.fillRect(x*TILE+7, y*TILE+6, 18, 22); ctx.fillStyle = face; ctx.fillRect(x*TILE+11, y*TILE+13, 3, 3); ctx.fillRect(x*TILE+19, y*TILE+13, 3, 3); }

function draw() {
  if (!state) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (let y=0;y<state.size.height;y++) for (let x=0;x<state.size.width;x++) { drawTile(x,y,(x+y)%2?'#26314a':'#202a40'); ctx.strokeStyle='rgba(255,255,255,.035)'; ctx.strokeRect(x*TILE,y*TILE,TILE,TILE); }
  state.walls.forEach(k=>{const [x,y]=k.split(',').map(Number); drawTile(x,y,'#48506a',2); drawTile(x,y,'#2e3448',8);});
  state.switches.forEach(s=>{ drawTile(s.x,s.y,s.on?'#75d1ff':'#2d7494',7); ctx.fillStyle='#e8fbff'; ctx.fillRect(s.x*TILE+13,s.y*TILE+10,6,12); });
  state.doors.forEach(d=>{ drawTile(d.x,d.y,d.open?'#38533a':'#8b5b2c',3); });
  state.keys.forEach(k=>{ if(!k.taken){ drawTile(k.x,k.y,'#8a6b18',8); ctx.fillStyle='#ffea8a'; ctx.fillRect(k.x*TILE+14,k.y*TILE+10,4,12); ctx.fillRect(k.x*TILE+18,k.y*TILE+10,6,4);} });
  state.lockedGates.forEach(g=>{ drawTile(g.x,g.y,g.open?'#39503d':'#6c4d1d',4); });
  state.npcs.forEach(n=>{ if(n.rescued){ drawTile(n.x,n.y,'#3e5e46',8); ctx.fillStyle='#d9ffe0'; ctx.font='18px monospace'; ctx.fillText('✓',n.x*TILE+11,n.y*TILE+22);} else { drawSprite(n.x,n.y,CHARACTERS[n.characterId]?.important?'#ffd58a':'#f7efd4'); ctx.fillStyle='#fff'; ctx.fillRect(n.x*TILE+22,n.y*TILE+2,5,5);} });
  state.enemies.forEach(e=>drawSprite(e.x,e.y,'#ff6b6b','#280606'));
  const p=state.player; const ix=p.moving?p.px+(p.x-p.px)*p.progress:p.x; const iy=p.moving?p.py+(p.y-p.py)*p.progress:p.y; drawSprite(ix,iy,'#f5b642');
}

function loop(now) {
  const dt = Math.min(0.05, (now-lastTime)/1000);
  lastTime = now;
  if (!dialogue.active) { updatePlayer(dt); updateEnemies(dt); checkEnemyHit(); }
  draw();
  animId = requestAnimationFrame(loop);
}

canvas.addEventListener('pointerdown', ev => { if(!state || dialogue.active) return; const r=canvas.getBoundingClientRect(); const x=Math.floor((ev.clientX-r.left)/r.width*state.size.width); const y=Math.floor((ev.clientY-r.top)/r.height*state.size.height); goTo(x,y); });
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('interactBtn').addEventListener('click', interact);
document.getElementById('resetBtn').addEventListener('click', () => startStage(stageIndex));
document.getElementById('nextBtn').addEventListener('click', () => { if(currentStage()?.isFinalStage) show('ending'); else startStage(stageIndex + 1); });
document.getElementById('endingBackBtn')?.addEventListener('click', () => show('title'));
dialogueEls.nextBtn.addEventListener('click', nextDialogue);
dialogueEls.overlay.addEventListener('pointerdown', e => { if (e.target === dialogueEls.overlay) nextDialogue(); });

ui.stageTotal.textContent = STAGES.length;
ui.totalRescued.textContent = campaign.totalRescued;
ui.campaignGoal.textContent = CONFIG.totalRescueGoal;
show('title');
