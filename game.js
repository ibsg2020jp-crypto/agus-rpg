const TILE = 32;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const STAGES = window.AGU_STAGES || [];
const CONFIG = window.AGU_GAME_CONFIG || { totalRescueGoal: 30, targetStageSeconds: 120 };
const CHARACTERS = window.AGU_CHARACTERS || {};
const ITEMS = window.AGU_ITEMS || {};
const COLLECTIONS = window.AGU_COLLECTIONS || {};
const OPENING = window.AGU_OPENING || [];

const screens = {
  title: document.getElementById('titleScreen'),
  town: document.getElementById('townScreen'),
  game: document.getElementById('gameScreen'),
  clear: document.getElementById('clearScreen'),
  ending: document.getElementById('endingScreen'),
};

const ui = {
  stageNo: document.getElementById('stageNo'), stageTotal: document.getElementById('stageTotal'), stageName: document.getElementById('stageName'),
  rescued: document.getElementById('rescuedCount'), totalRescued: document.getElementById('totalRescuedCount'), goal: document.getElementById('goalCount'),
  campaignGoal: document.getElementById('campaignGoalCount'), rewinds: document.getElementById('rewindCount'), message: document.getElementById('message'),
  clearTitle: document.getElementById('clearTitle'), clearText: document.getElementById('clearText'), nextBtn: document.getElementById('nextBtn'),
  townText: document.getElementById('townText'), townRescued: document.getElementById('townRescued'), townItems: document.getElementById('townItems'),
  townCollections: document.getElementById('townCollections'), modeText: document.getElementById('modeText'),
};

const dialogueEls = {
  overlay: document.getElementById('dialogueOverlay'), portrait: document.getElementById('dialoguePortrait'), speaker: document.getElementById('dialogueSpeaker'),
  role: document.getElementById('dialogueRole'), design: document.getElementById('dialogueDesign'), text: document.getElementById('dialogueText'),
  nextBtn: document.getElementById('dialogueNextBtn'),
};

const THEMES = {
  forest: { floor1: '#263e2c', floor2: '#1f3328', wall: '#456039', deep: '#1a251b', far: '森の遠景：黒い木々が朝霧に沈んでいる。' },
  abandoned_village: { floor1: '#3a332c', floor2: '#2b2928', wall: '#665647', deep: '#211d1b', far: '廃村の遠景：崩れた屋根と空の井戸が見える。' },
  cave: { floor1: '#242d3d', floor2: '#1c2330', wall: '#4b5364', deep: '#121722', far: '洞窟の遠景：奥で青い鉱石がかすかに光る。' },
  mountain: { floor1: '#33403c', floor2: '#283632', wall: '#5a625b', deep: '#1c2724', far: '山の遠景：崖の向こうに雲海が広がる。' },
  ruins: { floor1: '#39384b', floor2: '#2d2c3d', wall: '#676283', deep: '#202030', far: '遺跡の遠景：古い柱と封印の紋章が並ぶ。' },
  ruined_castle: { floor1: '#3b2e3f', floor2: '#2a2330', wall: '#63506a', deep: '#1d1723', far: '廃城の遠景：最奥の塔から赤い光が漏れている。' },
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
    const saved = JSON.parse(localStorage.getItem('agus-rpg-save-v3') || '{}');
    return {
      totalRescued: Number(saved.totalRescued || 0),
      stageProgress: saved.stageProgress || {},
      clearedStages: Array.isArray(saved.clearedStages) ? saved.clearedStages : [],
      metCharacters: Array.isArray(saved.metCharacters) ? saved.metCharacters : [],
      items: Array.isArray(saved.items) ? saved.items : [],
      collections: Array.isArray(saved.collections) ? saved.collections : [],
    };
  } catch {
    return { totalRescued: 0, stageProgress: {}, clearedStages: [], metCharacters: [], items: [], collections: [] };
  }
}
function saveCampaign() { localStorage.setItem('agus-rpg-save-v3', JSON.stringify(campaign)); }
function show(name) { Object.values(screens).forEach(s => s?.classList.remove('active')); screens[name]?.classList.add('active'); }
function currentStage() { return STAGES[stageIndex]; }
function stageProgress(stage) { return Number(campaign.stageProgress[stage.id] || 0); }
function stageComplete(stage) { return stageProgress(stage) >= (stage.residents?.length || stage.rescuedPeople || 0); }
function nextStageIndex() { const i = STAGES.findIndex(st => !stageComplete(st)); return i < 0 ? STAGES.length - 1 : i; }

function updateTown() {
  ui.townRescued.textContent = campaign.totalRescued;
  ui.townItems.textContent = campaign.items.length;
  ui.townCollections.textContent = campaign.collections.length;
  const next = STAGES[nextStageIndex()];
  if (campaign.totalRescued >= CONFIG.totalRescueGoal) {
    ui.townText.textContent = '村には声が戻った。けれど、集めていない思い出がまだ各地に眠っている。';
  } else {
    const left = (next.residents?.length || 0) - stageProgress(next);
    ui.townText.textContent = `次の目的地：${next.name}。この地域にはあと${left}人の気配がある。`;
  }
}
function showTown(text) { if (text) ui.townText.textContent = text; updateTown(); show('town'); }
function startGame() {
  if (!openingPlayed && OPENING.length) { openingPlayed = true; show('game'); openDialogue(OPENING, () => showTown()); }
  else showTown();
}

function mapSize(stage) { return { width: stage.map[0].length, height: stage.map.length }; }
function pickResident(stage) {
  const idx = Math.min(stageProgress(stage), (stage.residents?.length || 1) - 1);
  return { idx, id: stage.residents?.[idx] || null };
}
function parseStage(index) {
  const src = STAGES[index];
  const walls = new Set(), switches = [], doors = [], keys = [], lockedGates = [], npcSpots = [];
  let player = { x: 1, y: 1, px: 1, py: 1, target: null, moving: false, progress: 1 };
  src.map.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '#') walls.add(`${x},${y}`);
    if (ch === 'P') player = { x, y, px: x, py: y, target: null, moving: false, progress: 1 };
    if (ch === 'S') switches.push({ x, y, on: false });
    if (ch === 'D') doors.push({ x, y, open: false });
    if (ch === 'K') keys.push({ x, y, taken: false });
    if (ch === 'L') lockedGates.push({ x, y, open: false });
    if (ch === 'N') npcSpots.push({ x, y });
  }));
  const chosen = pickResident(src);
  const spot = npcSpots[chosen.idx % Math.max(1, npcSpots.length)] || { x: 9, y: 9 };
  const npcs = [{ x: spot.x, y: spot.y, rescued: false, characterId: chosen.id }];
  return {
    stage: src, size: mapSize(src), walls, switches, doors, keys, lockedGates, npcs, player,
    enemies: (src.enemies || []).map(e => ({ path: e.path.map(p => [...p]), speed: (e.speed || 0.6) * 1.35, step: 0, tick: 0, x: e.path[0][0], y: e.path[0][1], dormant: !!e.dormant, chase: !!e.chase })),
    rewinds: state?.rewinds ?? 0, startedAt: performance.now(), residentIndex: chosen.idx,
  };
}

function startStage(index) {
  stageIndex = Math.max(0, Math.min(index, STAGES.length - 1));
  state = parseStage(stageIndex);
  canvas.width = state.size.width * TILE; canvas.height = state.size.height * TILE;
  ui.stageNo.textContent = stageIndex + 1; ui.stageTotal.textContent = STAGES.length;
  ui.stageName.textContent = `${state.stage.name}：${THEMES[state.stage.id]?.far || ''}`;
  ui.goal.textContent = '1'; ui.rescued.textContent = '0';
  ui.totalRescued.textContent = campaign.totalRescued; ui.campaignGoal.textContent = CONFIG.totalRescueGoal; ui.rewinds.textContent = state.rewinds;
  const chara = CHARACTERS[state.npcs[0]?.characterId];
  setMessage(`${state.stage.name} - ${chara ? chara.name + 'を探そう。' : state.stage.intro}`);
  show('game'); cancelAnimationFrame(animId); lastTime = performance.now(); loop(lastTime);
  if (state.residentIndex === 0 && state.stage.openingCutscene?.length) openDialogue(state.stage.openingCutscene);
}

function setMessage(text) { ui.message.textContent = text; }
function isBlocked(x, y) { return x < 0 || y < 0 || x >= state.size.width || y >= state.size.height || state.walls.has(`${x},${y}`) || state.doors.some(d => !d.open && d.x === x && d.y === y) || state.lockedGates.some(g => !g.open && g.x === x && g.y === y); }
function neighbors(node) { return [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({ x: node.x + dx, y: node.y + dy })).filter(p => !isBlocked(p.x, p.y)); }
function findPath(start, goal) { if (isBlocked(goal.x, goal.y)) return null; const key = p => `${p.x},${p.y}`; const q = [start], came = new Map([[key(start), null]]); while(q.length){ const cur=q.shift(); if(cur.x===goal.x&&cur.y===goal.y) break; for(const n of neighbors(cur)){ const k=key(n); if(!came.has(k)){came.set(k,cur); q.push(n);}}} if(!came.has(key(goal))) return null; const path=[]; let cur=goal; while(cur){path.unshift(cur); cur=came.get(key(cur));} return path.slice(1); }
function goTo(tileX, tileY) { if (dialogue.active) return; const p = state.player; const path = findPath({ x:p.x, y:p.y }, { x:tileX, y:tileY }); if(!path || !path.length){ setMessage('そこへは行けない。別の道具や仕掛けが必要かも。'); return; } p.target = path; p.moving = false; }

function updatePlayer(dt) { const p=state.player; if(!p.moving && p.target?.length){ const next=p.target.shift(); p.px=p.x; p.py=p.y; p.x=next.x; p.y=next.y; p.progress=0; p.moving=true; } if(p.moving){ p.progress += dt * 4.6; if(p.progress>=1){ p.progress=1; p.moving=false; handlePlayerTile(); } } }
function handlePlayerTile() { const p=state.player; const keyTile=state.keys.find(k=>!k.taken&&k.x===p.x&&k.y===p.y); if(keyTile){ keyTile.taken=true; state.lockedGates.forEach(g=>g.open=true); setMessage('鍵を手に入れた！ 鍵付きゲートが開いた。'); } }
function updateEnemies(dt) { for(const e of state.enemies){ if(e.dormant && !state.switches.some(s=>s.on)) continue; if(e.chase){ const p=state.player; e.tick += dt; if(e.tick > e.speed){ e.tick=0; if(Math.abs(p.x-e.x)>Math.abs(p.y-e.y)) e.x += Math.sign(p.x-e.x); else e.y += Math.sign(p.y-e.y); } continue; } e.tick += dt; if(e.tick > e.speed){ e.tick=0; e.step=(e.step+1)%e.path.length; e.x=e.path[e.step][0]; e.y=e.path[e.step][1]; } } }
function checkEnemyHit() { const p=state.player; if(state.enemies.some(e=>e.x===p.x&&e.y===p.y)) rewindTime(); }
function rewindTime() { const old=state.rewinds+1; state=parseStage(stageIndex); state.rewinds=old; ui.rewinds.textContent=old; ui.rescued.textContent='0'; setMessage('敵に遭遇した！ 時間が巻き戻った。'); }
function near(a,b){ return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<=1; }

function interact() { if(dialogue.active) return; const p=state.player; const npc=state.npcs.find(n=>!n.rescued&&near(p,n)); if(npc){ const c=CHARACTERS[npc.characterId] || { name:'村人', job:'村人', age:'?', rescueLine:'助かった！', personality:'村の大切な人。' }; const line=state.stage.isFinalStage&&npc.characterId==='ami' ? (c.finalRescueLine||c.rescueLine) : c.rescueLine; openDialogue([{characterId:npc.characterId,speaker:c.name,role:`${c.job} / ${c.age}歳`,text:line},{characterId:npc.characterId,speaker:c.name,role:c.relation||c.personality||'',text:`【人物メモ】${c.personality||'村の大切な人。'}`}],()=>finishRescue(npc)); return; } const sw=state.switches.find(s=>near(p,s)); if(sw){ sw.on=!sw.on; state.doors.forEach(d=>d.open=state.switches.some(s=>s.on)); setMessage(sw.on?'スイッチ作動！ 扉が開いた。眠っていた敵も動き出すかも。':'スイッチ解除。扉が閉じた。'); return; } setMessage('近くに救助できる人や仕掛けはない。'); }
function finishRescue(npc) { npc.rescued=true; const st=currentStage(); const before=stageProgress(st); campaign.stageProgress[st.id]=before+1; campaign.totalRescued+=1; if(npc.characterId&&!campaign.metCharacters.includes(npc.characterId)) campaign.metCharacters.push(npc.characterId); if(stageComplete(st) && !campaign.clearedStages.includes(st.id)){ campaign.clearedStages.push(st.id); if(st.clearReward&&!campaign.items.includes(st.clearReward)) campaign.items.push(st.clearReward); } saveCampaign(); ui.rescued.textContent='1'; clearScene(); }
function clearScene(){ cancelAnimationFrame(animId); const st=currentStage(); const stageDone=stageComplete(st); ui.clearTitle.textContent = st.isFinalStage && stageDone ? 'ami救出！' : '救助成功！'; const c=CHARACTERS[state.npcs[0]?.characterId]; ui.clearText.textContent = `${c?.name || '村人'}を救助した。\n${stageDone ? st.clearMessage : `${st.name}には、まだ助けを待つ人がいる。`}\n累計救助: ${campaign.totalRescued}/${CONFIG.totalRescueGoal}`; ui.nextBtn.textContent = st.isFinalStage && stageDone ? 'エンドロールへ' : '村へ戻る'; show('clear'); }

function openDialogue(lines,onFinish=null){ dialogue={active:true,lines,index:0,onFinish}; renderDialogueLine(); }
function renderDialogueLine(){ const line=dialogue.lines[dialogue.index]; const c=line.characterId?CHARACTERS[line.characterId]:null; dialogueEls.speaker.textContent=line.speaker||c?.name||'語り手'; dialogueEls.role.textContent=line.role||c?.job||''; dialogueEls.design.textContent=c?.design||''; dialogueEls.text.textContent=line.text||''; dialogueEls.portrait.style.background=c?.important?'linear-gradient(180deg,#ffd58a,#5b4b75)':'linear-gradient(180deg,#8eb8ff,#5b4b75)'; dialogueEls.overlay.classList.remove('hidden'); }
function nextDialogue(){ if(!dialogue.active) return; if(dialogue.index<dialogue.lines.length-1){ dialogue.index++; renderDialogueLine(); return; } dialogueEls.overlay.classList.add('hidden'); const f=dialogue.onFinish; dialogue={active:false,lines:[],index:0,onFinish:null}; if(typeof f==='function') f(); }

function drawStageBackdrop(theme){ ctx.fillStyle=theme.deep; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='rgba(255,255,255,.08)'; for(let i=0;i<6;i++){ const x=(i*71+stageIndex*19)%canvas.width; const h=28+(i%3)*18; ctx.fillRect(x, 8, 24, h); } }
function drawTile(x,y,color,inset=0){ ctx.fillStyle=color; ctx.fillRect(x*TILE+inset,y*TILE+inset,TILE-inset*2,TILE-inset*2); }
function drawHero(x,y){ drawPerson(x,y,{gender:'男',age:20,job:'若者'},'#f5b642'); }
function drawPerson(x,y,chara={},base='#f7efd4'){ const age=Number(chara.age||30); const child=age<15; const elder=age>=60; const female=chara.gender==='女'; const w=child?14:18,h=child?17:22,ox=(TILE-w)/2,oy=child?11:6; ctx.fillStyle=base; ctx.fillRect(x*TILE+ox,y*TILE+oy,w,h); ctx.fillStyle=female?'#3a1f2d':'#2d2116'; if(female) ctx.fillRect(x*TILE+ox-2,y*TILE+oy-3,w+4,8); else ctx.fillRect(x*TILE+ox+2,y*TILE+oy-3,w-4,5); ctx.fillStyle='#111'; ctx.fillRect(x*TILE+ox+4,y*TILE+oy+7,3,3); ctx.fillRect(x*TILE+ox+w-7,y*TILE+oy+7,3,3); if(elder){ ctx.fillStyle='#eee'; ctx.fillRect(x*TILE+ox+4,y*TILE+oy+13,w-8,4); } if(chara.job==='兵士'){ ctx.strokeStyle='#9ed1ff'; ctx.strokeRect(x*TILE+ox-1,y*TILE+oy-1,w+2,h+2); } if(chara.job==='子供'){ ctx.fillStyle='#fff'; ctx.fillRect(x*TILE+ox+w,y*TILE+oy-2,4,4); } }
function draw(){ if(!state) return; const theme=THEMES[state.stage.id]||THEMES.forest; drawStageBackdrop(theme); for(let y=0;y<state.size.height;y++) for(let x=0;x<state.size.width;x++){ drawTile(x,y,(x+y)%2?theme.floor1:theme.floor2); ctx.strokeStyle='rgba(255,255,255,.03)'; ctx.strokeRect(x*TILE,y*TILE,TILE,TILE); } state.walls.forEach(k=>{const[x,y]=k.split(',').map(Number); drawTile(x,y,theme.wall,2); drawTile(x,y,theme.deep,8);}); state.switches.forEach(s=>{drawTile(s.x,s.y,s.on?'#75d1ff':'#2d7494',7);}); state.doors.forEach(d=>drawTile(d.x,d.y,d.open?'#38533a':'#8b5b2c',3)); state.keys.forEach(k=>{if(!k.taken){drawTile(k.x,k.y,'#8a6b18',8);ctx.fillStyle='#ffea8a';ctx.fillRect(k.x*TILE+14,k.y*TILE+10,4,12);}}); state.lockedGates.forEach(g=>drawTile(g.x,g.y,g.open?'#39503d':'#6c4d1d',4)); state.npcs.forEach(n=>{ if(n.rescued) drawTile(n.x,n.y,'#3e5e46',8); else drawPerson(n.x,n.y,CHARACTERS[n.characterId]||{},CHARACTERS[n.characterId]?.important?'#ffd58a':'#f7efd4'); }); state.enemies.forEach(e=>{ if(e.dormant&&!state.switches.some(s=>s.on)) drawTile(e.x,e.y,'#6b4646',7); else drawPerson(e.x,e.y,{gender:'男',age:99},'#ff6b6b'); }); const p=state.player, ix=p.moving?p.px+(p.x-p.px)*p.progress:p.x, iy=p.moving?p.py+(p.y-p.py)*p.progress:p.y; drawHero(ix,iy); }
function loop(now){ const dt=Math.min(0.05,(now-lastTime)/1000); lastTime=now; if(!dialogue.active){ updatePlayer(dt); updateEnemies(dt); checkEnemyHit(); } draw(); animId=requestAnimationFrame(loop); }

canvas.addEventListener('pointerdown',ev=>{if(!state||dialogue.active)return;const r=canvas.getBoundingClientRect();goTo(Math.floor((ev.clientX-r.left)/r.width*state.size.width),Math.floor((ev.clientY-r.top)/r.height*state.size.height));});
document.getElementById('startBtn').addEventListener('click',startGame);
document.getElementById('townNextBtn').addEventListener('click',()=>startStage(nextStageIndex()));
document.getElementById('townReplayBtn').addEventListener('click',()=>startStage(0));
document.getElementById('townGatherBtn').addEventListener('click',()=>{ui.modeText.textContent=`採集モード：今は ${campaign.items.length} 個の道具がある。森の守り札、ランタン、登山靴などで隠し場所を探せるようにする予定。`;});
document.getElementById('townEquipBtn').addEventListener('click',()=>{ui.modeText.textContent=`装備モード：現在の道具 ${campaign.items.map(id=>ITEMS[id]?.name||id).join('、')||'なし'}。次は爆弾・フック・ランタンを切り替え可能にする。`;});
document.getElementById('interactBtn').addEventListener('click',interact);
document.getElementById('resetBtn').addEventListener('click',()=>startStage(stageIndex));
document.getElementById('nextBtn').addEventListener('click',()=>{ if(currentStage()?.isFinalStage&&stageComplete(currentStage())) show('ending'); else showTown(); });
document.getElementById('endingBackBtn')?.addEventListener('click',()=>show('title'));
dialogueEls.nextBtn.addEventListener('click',nextDialogue);
dialogueEls.overlay.addEventListener('pointerdown',e=>{if(e.target===dialogueEls.overlay)nextDialogue();});

ui.stageTotal.textContent=STAGES.length; ui.totalRescued.textContent=campaign.totalRescued; ui.campaignGoal.textContent=CONFIG.totalRescueGoal; show('title');
