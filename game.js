const TILE = 32;
const MAP_W = 10;
const MAP_H = 10;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const screens = {
  title: document.getElementById('titleScreen'),
  game: document.getElementById('gameScreen'),
  clear: document.getElementById('clearScreen'),
};

const ui = {
  stageNo: document.getElementById('stageNo'),
  rescued: document.getElementById('rescuedCount'),
  goal: document.getElementById('goalCount'),
  rewinds: document.getElementById('rewindCount'),
  message: document.getElementById('message'),
  clearText: document.getElementById('clearText'),
};

const levels = [
  {
    name: 'はじまりの広場',
    intro: 'まずは3人を助けよう。敵の赤い影には近づきすぎないで。',
    map: [
      '##########',
      '#........#',
      '#..P.....#',
      '#........#',
      '#...#....#',
      '#...#..E.#',
      '#........#',
      '#..N..N..#',
      '#......N.#',
      '##########',
    ],
    enemies: [{ x: 7, y: 5, path: [[7,5],[7,4],[6,4],[6,5]], step: 0, tick: 0 }],
  },
  {
    name: '古い水門',
    intro: '青いスイッチを押すと扉が開く。住人のそばで調べよう。',
    map: [
      '##########',
      '#P....#..#',
      '#.....#N.#',
      '#..S..D..#',
      '#.....#..#',
      '#..E..#..#',
      '#........#',
      '#..N.....#',
      '#......N.#',
      '##########',
    ],
    enemies: [{ x: 3, y: 5, path: [[3,5],[4,5],[4,6],[3,6]], step: 0, tick: 0 }],
  },
  {
    name: '夕暮れの路地',
    intro: '最後は敵が2体。焦らず助ける順番を考えよう。',
    map: [
      '##########',
      '#P.......#',
      '#..####..#',
      '#..N..#..#',
      '#.....#N.#',
      '#..S..D..#',
      '#.....#..#',
      '#..E..E..#',
      '#N.......#',
      '##########',
    ],
    enemies: [
      { x: 3, y: 7, path: [[3,7],[4,7],[5,7],[4,7]], step: 0, tick: 0 },
      { x: 6, y: 7, path: [[6,7],[7,7],[7,6],[6,6]], step: 0, tick: 0 },
    ],
  },
];

let stage = 0;
let state;
let lastTime = 0;
let animId;

function show(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function parseLevel(index) {
  const src = levels[index];
  const walls = new Set();
  const npcs = [];
  let player = { x: 1, y: 1, px: 1, py: 1, target: null, moving: false, progress: 1 };
  let switchOn = false;
  let door = null;

  src.map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '#') walls.add(`${x},${y}`);
      if (ch === 'P') player = { x, y, px: x, py: y, target: null, moving: false, progress: 1 };
      if (ch === 'N') npcs.push({ x, y, rescued: false, mood: Math.random() });
      if (ch === 'D') door = { x, y, open: false };
      if (ch === 'S') switchOn = false;
    });
  });

  return {
    level: src,
    walls,
    npcs,
    player,
    switchOn,
    door,
    enemies: src.enemies.map(e => ({ ...e, path: e.path.map(p => [...p]) })),
    rewinds: state?.rewinds ?? 0,
    startedAt: performance.now(),
  };
}

function startStage(index) {
  stage = index % levels.length;
  state = parseLevel(stage);
  ui.stageNo.textContent = stage + 1;
  ui.goal.textContent = state.npcs.length;
  ui.rewinds.textContent = state.rewinds;
  setMessage(levels[stage].intro);
  show('game');
  cancelAnimationFrame(animId);
  lastTime = performance.now();
  loop(lastTime);
}

function setMessage(text) {
  ui.message.textContent = text;
}

function isBlocked(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return true;
  if (state.walls.has(`${x},${y}`)) return true;
  if (state.door && !state.door.open && state.door.x === x && state.door.y === y) return true;
  return false;
}

function neighbors(node) {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  return dirs
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
      if (!came.has(k)) {
        came.set(k, cur);
        queue.push(n);
      }
    }
  }
  const gk = key(goal);
  if (!came.has(gk)) return null;
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
    setMessage('そこへは行けないみたい。別の道を探そう。');
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
    p.progress += dt * 7;
    if (p.progress >= 1) {
      p.progress = 1;
      p.moving = false;
    }
  }
}

function updateEnemies(dt) {
  for (const e of state.enemies) {
    e.tick += dt;
    if (e.tick > 0.55) {
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
  state = parseLevel(stage);
  state.rewinds = oldRewinds;
  ui.rewinds.textContent = state.rewinds;
  setMessage('敵に見つかった！ 時間が巻き戻った。ルートを変えてみよう。');
}

function interact() {
  const p = state.player;
  const near = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;

  const npc = state.npcs.find(n => !n.rescued && near(p, n));
  if (npc) {
    npc.rescued = true;
    const done = state.npcs.filter(n => n.rescued).length;
    ui.rescued.textContent = done;
    if (done >= state.npcs.length) {
      clearStage();
    } else {
      setMessage(`「ありがとう！」 住人を助けた。あと${state.npcs.length - done}人。`);
    }
    return;
  }

  const switchTile = findTile('S');
  if (switchTile && near(p, switchTile)) {
    state.switchOn = !state.switchOn;
    if (state.door) state.door.open = state.switchOn;
    setMessage(state.switchOn ? 'カチッ。どこかの扉が開いた！' : 'カチッ。扉が閉じた。');
    return;
  }

  setMessage('近くに助けられる人や仕掛けはない。');
}

function findTile(ch) {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (levels[stage].map[y][x] === ch) return { x, y };
    }
  }
  return null;
}

function clearStage() {
  cancelAnimationFrame(animId);
  const elapsed = Math.max(1, Math.round((performance.now() - state.startedAt) / 1000));
  ui.clearText.textContent = `${levels[stage].name}を${elapsed}秒でクリア。救助の腕が上がっている！`;
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

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
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

  const s = findTile('S');
  if (s) {
    drawTile(s.x, s.y, state.switchOn ? '#75d1ff' : '#2d7494', 7);
    ctx.fillStyle = '#e8fbff';
    ctx.fillRect(s.x * TILE + 13, s.y * TILE + 10, 6, 12);
  }

  if (state.door) {
    drawTile(state.door.x, state.door.y, state.door.open ? '#38533a' : '#8b5b2c', 3);
    if (state.door.open) {
      ctx.fillStyle = '#73e087';
      ctx.fillRect(state.door.x * TILE + 8, state.door.y * TILE + 14, 16, 4);
    }
  }

  for (const n of state.npcs) {
    if (n.rescued) {
      drawTile(n.x, n.y, '#3e5e46', 8);
      ctx.fillStyle = '#d9ffe0';
      ctx.fillText('✓', n.x * TILE + 12, n.y * TILE + 21);
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

canvas.addEventListener('pointerdown', (ev) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((ev.clientX - rect.left) / rect.width * MAP_W);
  const y = Math.floor((ev.clientY - rect.top) / rect.height * MAP_H);
  goTo(x, y);
});

document.getElementById('startBtn').addEventListener('click', () => startStage(0));
document.getElementById('interactBtn').addEventListener('click', interact);
document.getElementById('resetBtn').addEventListener('click', () => startStage(stage));
document.getElementById('nextBtn').addEventListener('click', () => startStage(stage + 1));

ui.rescued.textContent = '0';
ui.goal.textContent = '3';
show('title');
