const TILE = 32;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const STAGES = window.AGU_STAGES || [];
const CONFIG = window.AGU_GAME_CONFIG || { totalRescueGoal: 30, targetStageSeconds: 120 };

const screens = {
  title: document.getElementById('titleScreen'),
  game: document.getElementById('gameScreen'),
  clear: document.getElementById('clearScreen'),
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

let stageIndex = 0;
let state;
let campaign = loadCampaign();
let lastTime = 0;
let animId;

function loadCampaign() {
  try {
    const saved = JSON.parse(localStorage.getItem('agus-rpg-save') || '{}');
    return {
      totalRescued: Number(saved.totalRescued || 0),
      unlockedStage: Number(saved.unlockedStage || 0),
      clearedStages: Array.isArray(saved.clearedStages) ? saved.clearedStages : [],
    };
  } catch {
    return { totalRescued: 0, unlockedStage: 0, clearedStages: [] };
  }
}

function saveCampaign() {
  localStorage.setItem('agus-rpg-save', JSON.stringify(campaign));
}

function show(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function currentStage() {
  return STAGES[stageIndex];
}

function mapSize(stage) {
  return { width: stage.map[0].length, height: stage.map.length };
}

function parseStage(index) {
  const src = STAGES[index];
  const walls = new Set();
  const npcs = [];
  const switches = [];
  const doors = [];
  let player = { x: 1, y: 1, px: 1, py: 1, target: null, moving: false, progress: 1 };

  src.map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '#') walls.add(`${x},${y}`);
      if (ch === 'P') player = { x, y, px: x, py: y, target: null, moving: false, progress: 1 };
      if (ch === 'N') npcs.push({ x, y, rescued: false });
      if (ch === 'S') switches.push({ x, y, on: false });
      if (ch === 'D') doors.push({ x, y, open: false });
    });
  });

  return {
    stage: src,
    size: mapSize(src),
    walls,
    npcs,
    switches,
    doors,
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
    stageRescuedAdded: false,
  };
}

function startStage(index) {
  if (!STAGES.length) {
    alert('ステージデータが見つかりません。levels.jsを確認してください。');
    return;
  }

  stageIndex = Math.max(0, Math.min(index, STAGES.length - 1));
  state = parseStage(stageIndex);

  const { width, height } = state.size;
  canvas.width = width * TILE;
  canvas.height = height * TILE;

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
}

function setMessage(text) {
  ui.message.textContent = text;
}

function isBlocked(x, y) {
  if (x < 0 || y < 0 || x >= state.size.width || y >= state.size.height) return true;
  if (state.walls.has(`${x},${y}`)) return true;
  if (state.doors.some(d => !d.open && d.x === x && d.y === y)) return true;
  return false;
}

function neighbors(node) {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  return dirs
    .map(([dx, dy]) => ({ x: node.x + dx, y: node.y + dy }))
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
      if (!came.has(k)) {
        came.set(k, cur);
        queue.push(n);
      }
    }
  }

  if (!came.has(key(goal))) return null;
  const path = [];
  let cur = goal;
  while (cur) {
    path.unshift(cur);
    cur = came.get(key(cur));
  }
  return path.slice(1);
}

function goTo(tileX, tileY) {
  const p = state.player;
  const path = findPath({ x: p.x, y: p.y }, { x: tileX, y: tileY });
  if (!path || !path.length) {
    setMessage('そこへは行けない。壁、扉、敵の位置をよく見よう。');
    return;
  }
  p.target = path;
  p.moving = false;
}

function updatePlayer(dt) {
  const p = state.player;
  if (!p.moving && p.target && p.target.length) {
    const next = p.target.shift();
    p.px = p.x;
    p.py = p.y;
    p.x = next.x;
    p.y = next.y;
    p.progress = 0;
    p.moving = true;
  }

  if (p.moving) {
    p.progress += dt * 7.5;
    if (p.progress >= 1) {
      p.progress = 1;
      p.moving = false;
    }
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
  const hit = state.enemies.some(e => e.x === p.x && e.y === p.y);
  if (hit) rewindTime();
}

function rewindTime() {
  const oldRewinds = state.rewinds + 1;
  state = parseStage(stageIndex);
  state.rewinds = oldRewinds;
  ui.rewinds.textContent = state.rewinds;
  ui.rescued.textContent = '0';
  setMessage('敵に遭遇した！ 時間が巻き戻った。同じ人をもう一度助けに行こう。');
}

function near(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;
}

function interact() {
  const p = state.player;

  const npc = state.npcs.find(n => !n.rescued && near(p, n));
  if (npc) {
    npc.rescued = true;
    const done = state.npcs.filter(n => n.rescued).length;
    ui.rescued.textContent = done;

    if (done >= state.npcs.length) {
      clearStage();
    } else {
      const left = state.npcs.length - done;
      setMessage(`「助かった！」 このステージはあと${left}人。累計30人救助を目指そう。`);
    }
    return;
  }

  const sw = state.switches.find(s => near(p, s));
  if (sw) {
    sw.on = !sw.on;
    state.doors.forEach(d => { d.open = state.switches.some(s => s.on); });
    setMessage(sw.on ? 'カチッ。扉が開いた！ 新しい救助ルートができた。' : 'カチッ。扉が閉じた。');
    return;
  }

  setMessage('近くに救助できる人や仕掛けはない。近づいてから押そう。');
}

function clearStage() {
  cancelAnimationFrame(animId);

  const stageId = currentStage().id;
  const stageRescueValue = currentStage().rescuedPeople || state.npcs.length;
  const alreadyCleared = campaign.clearedStages.includes(stageId);

  if (!alreadyCleared) {
    campaign.totalRescued += stageRescueValue;
    campaign.clearedStages.push(stageId);
    campaign.unlockedStage = Math.max(campaign.unlockedStage, stageIndex + 1);
    saveCampaign();
  }

  const elapsed = Math.max(1, Math.round((performance.now() - state.startedAt) / 1000));
  const target = CONFIG.targetStageSeconds || 120;
  const reachedGoal = campaign.totalRescued >= CONFIG.totalRescueGoal;

  ui.clearTitle.textContent = reachedGoal ? '30人救助達成！' : 'ステージクリア！';
  ui.clearText.textContent = [
    `${currentStage().name}を${elapsed}秒でクリア。目安は${target}秒。`,
    alreadyCleared ? 'このステージはクリア済みなので累計救助数は増えない。' : currentStage().clearMessage,
    `累計救助: ${campaign.totalRescued}/${CONFIG.totalRescueGoal}`,
  ].join('\n');

  ui.nextBtn.textContent = stageIndex >= STAGES.length - 1 ? '最初のステージへ戻る' : '次のステージへ';
  show('clear');
}

function drawTile(x, y, color, inset = 0) {
  ctx.fillStyle = color;
  ctx.fillRect(x * TILE + inset, y * TILE + inset, TILE - inset * 2, TILE - inset * 2);
}

function drawSprite(x, y, color, face = '#111') {
  ctx.fillStyle = color;
  ctx.fillRect(x * TILE + 7, y * TILE + 6, 18, 22);
  ctx.fillStyle = face;
  ctx.fillRect(x * TILE + 11, y * TILE + 13, 3, 3);
  ctx.fillRect(x * TILE + 19, y * TILE + 13, 3, 3);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < state.size.height; y++) {
    for (let x = 0; x < state.size.width; x++) {
      drawTile(x, y, (x + y) % 2 ? '#26314a' : '#202a40');
      ctx.strokeStyle = 'rgba(255,255,255,.035)';
      ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
    }
  }

  state.walls.forEach(k => {
    const [x, y] = k.split(',').map(Number);
    drawTile(x, y, '#48506a', 2);
    drawTile(x, y, '#2e3448', 8);
  });

  for (const s of state.switches) {
    drawTile(s.x, s.y, s.on ? '#75d1ff' : '#2d7494', 7);
    ctx.fillStyle = '#e8fbff';
    ctx.fillRect(s.x * TILE + 13, s.y * TILE + 10, 6, 12);
  }

  for (const d of state.doors) {
    drawTile(d.x, d.y, d.open ? '#38533a' : '#8b5b2c', 3);
    if (d.open) {
      ctx.fillStyle = '#73e087';
      ctx.fillRect(d.x * TILE + 8, d.y * TILE + 14, 16, 4);
    }
  }

  for (const n of state.npcs) {
    if (n.rescued) {
      drawTile(n.x, n.y, '#3e5e46', 8);
      ctx.fillStyle = '#d9ffe0';
      ctx.font = '18px monospace';
      ctx.fillText('✓', n.x * TILE + 11, n.y * TILE + 22);
    } else {
      drawSprite(n.x, n.y, '#f7efd4');
      ctx.fillStyle = '#fff';
      ctx.fillRect(n.x * TILE + 22, n.y * TILE + 2, 5, 5);
    }
  }

  for (const e of state.enemies) drawSprite(e.x, e.y, '#ff6b6b', '#280606');

  const p = state.player;
  const ix = p.moving ? p.px + (p.x - p.px) * p.progress : p.x;
  const iy = p.moving ? p.py + (p.y - p.py) * p.progress : p.y;
  drawSprite(ix, iy, '#f5b642');
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  updatePlayer(dt);
  updateEnemies(dt);
  checkEnemyHit();
  draw();
  animId = requestAnimationFrame(loop);
}

canvas.addEventListener('pointerdown', ev => {
  if (!state) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((ev.clientX - rect.left) / rect.width * state.size.width);
  const y = Math.floor((ev.clientY - rect.top) / rect.height * state.size.height);
  goTo(x, y);
});

document.getElementById('startBtn').addEventListener('click', () => startStage(Math.min(campaign.unlockedStage, STAGES.length - 1)));
document.getElementById('interactBtn').addEventListener('click', interact);
document.getElementById('resetBtn').addEventListener('click', () => startStage(stageIndex));
document.getElementById('nextBtn').addEventListener('click', () => {
  const next = stageIndex >= STAGES.length - 1 ? 0 : stageIndex + 1;
  startStage(next);
});

ui.stageTotal.textContent = STAGES.length;
ui.totalRescued.textContent = campaign.totalRescued;
ui.campaignGoal.textContent = CONFIG.totalRescueGoal;
show('title');
