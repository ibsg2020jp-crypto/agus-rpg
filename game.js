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
  title: document.getElementById('titleScreen'), town: document.getElementById('townScreen'), game: document.getElementById('gameScreen'),
  book: document.getElementById('bookScreen'), clear: document.getElementById('clearScreen'), ending: document.getElementById('endingScreen'),
};
const ui = {
  stageNo: document.getElementById('stageNo'), stageTotal: document.getElementById('stageTotal'), stageName: document.getElementById('stageName'),
  rescued: document.getElementById('rescuedCount'), totalRescued: document.getElementById('totalRescuedCount'), goal: document.getElementById('goalCount'),
  campaignGoal: document.getElementById('campaignGoalCount'), rewinds: document.getElementById('rewindCount'), message: document.getElementById('message'),
  clearTitle: document.getElementById('clearTitle'), clearText: document.getElementById('clearText'), nextBtn: document.getElementById('nextBtn'),
  townText: document.getElementById('townText'), townRescued: document.getElementById('townRescued'), townItems: document.getElementById('townItems'),
  townCollections: document.getElementById('townCollections'), modeText: document.getElementById('modeText'), bookTitle: document.getElementById('bookTitle'), bookList: document.getElementById('bookList'),
};
const dialogueEls = {
  overlay: document.getElementById('dialogueOverlay'), portrait: document.getElementById('dialoguePortrait'), speaker: document.getElementById('dialogueSpeaker'),
  role: document.getElementById('dialogueRole'), design: document.getElementById('dialogueDesign'), text: document.getElementById('dialogueText'), nextBtn: document.getElementById('dialogueNextBtn'),
};

const THEMES = {
  forest: { floor1:'#263e2c', floor2:'#1f3328', wall:'#456039', deep:'#1a251b', far:'黒い木々が朝霧に沈む森' },
  abandoned_village: { floor1:'#3a332c', floor2:'#2b2928', wall:'#665647', deep:'#211d1b', far:'崩れた屋根と空の井戸が残る廃村' },
  cave: { floor1:'#242d3d', floor2:'#1c2330', wall:'#4b5364', deep:'#121722', far:'青い鉱石がかすかに光る洞窟' },
  mountain: { floor1:'#33403c', floor2:'#283632', wall:'#5a625b', deep:'#1c2724', far:'雲海の上に伸びる山道' },
  ruins: { floor1:'#39384b', floor2:'#2d2c3d', wall:'#676283', deep:'#202030', far:'封印の紋章が並ぶ遺跡' },
  ruined_castle: { floor1:'#3b2e3f', floor2:'#2a2330', wall:'#63506a', deep:'#1d1723', far:'赤い光が漏れる廃城の塔' },
  outskirts: { floor1:'#30442e', floor2:'#273728', wall:'#566548', deep:'#172018', far:'村のはずれ。草と古い祠だけが残る' },
};

const OUTSKIRTS = {
  id:'outskirts', name:'村のはずれ', residents:[], rescuedPeople:0,
  intro:'のんびり採集できる場所。草むら、切り株、井戸、祠を調べよう。',
  map:['############','#P.........#','#..G..#..C.#','#.....#....#','#..T..#..G.#','#.....L....#','#..W..#..R.#','#.....#....#','#..G.....C.#','#.....H....#','#..........#','############'],
  enemies: [],
};

let stageIndex = 0, state, lastTime = 0, animId;
let selectedTool = 'hand';
let mode = 'main';
let openingPlayed = false;
let dialogue = { active:false, lines:[], index:0, onFinish:null };
let campaign = loadCampaign();

function loadCampaign(){
  try{ const s=JSON.parse(localStorage.getItem('agus-rpg-save-v4')||'{}'); return { totalRescued:+(s.totalRescued||0), stageProgress:s.stageProgress||{}, clearedStages:Array.isArray(s.clearedStages)?s.clearedStages:[], metCharacters:Array.isArray(s.metCharacters)?s.metCharacters:[], items:Array.isArray(s.items)?s.items:[], collections:Array.isArray(s.collections)?s.collections:[] }; }
  catch{ return { totalRescued:0, stageProgress:{}, clearedStages:[], metCharacters:[], items:[], collections:[] }; }
}
function saveCampaign(){ localStorage.setItem('agus-rpg-save-v4', JSON.stringify(campaign)); }
function show(name){ Object.values(screens).forEach(s=>s?.classList.remove('active')); screens[name]?.classList.add('active'); }
function setMessage(text){ ui.message.textContent = text; }
function currentStage(){ return mode === 'outskirts' ? OUTSKIRTS : STAGES[stageIndex]; }
function stageProgress(stage){ return +(campaign.stageProgress[stage.id]||0); }
function stageComplete(stage){ return stageProgress(stage) >= (stage.residents?.length || stage.rescuedPeople || 0); }
function nextStageIndex(){ const i=STAGES.findIndex(st=>!stageComplete(st)); return i<0 ? STAGES.length-1 : i; }
function hasItem(id){ return campaign.items.includes(id); }
function gainItem(id){ if(id && !campaign.items.includes(id)) campaign.items.push(id); }
function gainCollection(id){ if(id && !campaign.collections.includes(id)){ campaign.collections.push(id); saveCampaign(); return true; } return false; }

function updateTown(){
  ui.townRescued.textContent = campaign.totalRescued;
  ui.townItems.textContent = campaign.items.length;
  ui.townCollections.textContent = campaign.collections.length;
  const next = STAGES[nextStageIndex()];
  ui.townText.textContent = campaign.totalRescued >= CONFIG.totalRescueGoal ? '村には声が戻った。次は、失われた思い出を集めよう。' : `次の目的地：${next.name}。あと${(next.residents?.length||0)-stageProgress(next)}人の気配がある。`;
}
function showTown(text){ if(text) ui.townText.textContent = text; updateTown(); show('town'); }
function startGame(){ if(!openingPlayed && OPENING.length){ openingPlayed=true; show('game'); openDialogue(OPENING,()=>showTown()); } else showTown(); }

function createProps(stage){
  const props=[];
  stage.map.forEach((row,y)=>[...row].forEach((ch,x)=>{ if('GCTWRH'.includes(ch)) props.push({x,y,type:ch}); }));
  if(stage.id==='cave') props.push({x:6,y:6,type:'dark',collection:'stone_fragment'});
  if(stage.id==='mountain') props.push({x:9,y:9,type:'hook',opens:'gates'});
  if(stage.id==='ruins') props.push({x:5,y:5,type:'mirror',collection:'elder_note'});
  if(stage.id==='ruined_castle') props.push({x:6,y:5,type:'crack',collection:'castle_lullaby'});
  return props;
}
function mapSize(stage){ return { width: stage.map[0].length, height: stage.map.length }; }
function pickResident(stage){ const idx=Math.min(stageProgress(stage),(stage.residents?.length||1)-1); return { idx, id:stage.residents?.[idx]||null }; }
function parseStage(index, stageOverride=null){
  const src = stageOverride || STAGES[index];
  const walls=new Set(), switches=[], doors=[], keys=[], lockedGates=[], spots=[];
  let player={x:1,y:1,px:1,py:1,target:null,moving:false,progress:1};
  src.map.forEach((row,y)=>[...row].forEach((ch,x)=>{
    if(ch==='#') walls.add(`${x},${y}`); if(ch==='P') player={x,y,px:x,py:y,target:null,moving:false,progress:1}; if(ch==='S') switches.push({x,y,on:false}); if(ch==='D') doors.push({x,y,open:false}); if(ch==='K') keys.push({x,y,taken:false}); if(ch==='L') lockedGates.push({x,y,open:false}); if(ch==='N') spots.push({x,y});
  }));
  const chosen = stageOverride ? {idx:0,id:null} : pickResident(src);
  const spot = spots[chosen.idx % Math.max(1,spots.length)] || {x:9,y:9};
  const npcs = chosen.id ? [{x:spot.x,y:spot.y,rescued:false,characterId:chosen.id}] : [];
  return { stage:src, size:mapSize(src), walls, switches, doors, keys, lockedGates, props:createProps(src), npcs, player, enemies:(src.enemies||[]).map(e=>({path:e.path.map(p=>[...p]), speed:(e.speed||0.6)*1.35, step:0, tick:0, x:e.path[0][0], y:e.path[0][1], dormant:!!e.dormant, chase:!!e.chase})), rewinds:state?.rewinds||0, startedAt:performance.now(), residentIndex:chosen.idx };
}
function startStage(index){ mode='main'; stageIndex=Math.max(0,Math.min(index,STAGES.length-1)); state=parseStage(stageIndex); setupScene(); const c=CHARACTERS[state.npcs[0]?.characterId]; setMessage(`${state.stage.name} - ${c?c.name+'を探そう。':state.stage.intro}`); if(state.residentIndex===0 && state.stage.openingCutscene?.length) openDialogue(state.stage.openingCutscene); }
function startOutskirts(){ mode='outskirts'; state=parseStage(0, OUTSKIRTS); setupScene(); setMessage('村のはずれ。採集ポイントをタップ、または近づいて調べよう。いつでも村へ戻れる。'); }
function setupScene(){
  canvas.width=state.size.width*TILE; canvas.height=state.size.height*TILE;
  ui.stageNo.textContent = mode==='outskirts' ? '-' : stageIndex+1; ui.stageTotal.textContent = STAGES.length;
  ui.stageName.textContent = `${state.stage.name}：${THEMES[state.stage.id]?.far||''}`;
  ui.goal.textContent = mode==='outskirts' ? '採集' : '1'; ui.rescued.textContent='0'; ui.totalRescued.textContent=campaign.totalRescued; ui.campaignGoal.textContent=CONFIG.totalRescueGoal; ui.rewinds.textContent=state.rewinds;
  show('game'); cancelAnimationFrame(animId); lastTime=performance.now(); loop(lastTime); updateToolButtons();
}

function isBlocked(x,y){ return x<0||y<0||x>=state.size.width||y>=state.size.height||state.walls.has(`${x},${y}`)||state.doors.some(d=>!d.open&&d.x===x&&d.y===y)||state.lockedGates.some(g=>!g.open&&g.x===x&&g.y===y); }
function neighbors(n){ return [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:n.x+dx,y:n.y+dy})).filter(p=>!isBlocked(p.x,p.y)); }
function findPath(s,g){ if(isBlocked(g.x,g.y))return null; const key=p=>`${p.x},${p.y}`,q=[s],came=new Map([[key(s),null]]); while(q.length){const c=q.shift(); if(c.x===g.x&&c.y===g.y)break; for(const n of neighbors(c)){const k=key(n); if(!came.has(k)){came.set(k,c);q.push(n);}}} if(!came.has(key(g)))return null; const path=[]; let cur=g; while(cur){path.unshift(cur);cur=came.get(key(cur));} return path.slice(1); }
function near(a,b){ return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<=1; }
function goTo(x,y){ if(dialogue.active)return; const path=findPath({x:state.player.x,y:state.player.y},{x,y}); if(!path?.length){ setMessage('そこへは行けない。装備や仕掛けを使う必要があるかも。'); return; } state.player.target=path; state.player.moving=false; }
function updatePlayer(dt){ const p=state.player; if(!p.moving&&p.target?.length){const n=p.target.shift(); p.px=p.x;p.py=p.y;p.x=n.x;p.y=n.y;p.progress=0;p.moving=true;} if(p.moving){p.progress+=dt*4.6; if(p.progress>=1){p.progress=1;p.moving=false;handlePlayerTile();}} }
function handlePlayerTile(){ const p=state.player; const k=state.keys.find(k=>!k.taken&&k.x===p.x&&k.y===p.y); if(k){k.taken=true; state.lockedGates.forEach(g=>g.open=true); setMessage('鍵を手に入れた！ 鍵付きゲートが開いた。');} }
function updateEnemies(dt){ if(mode==='outskirts')return; for(const e of state.enemies){ if(e.dormant&&!state.switches.some(s=>s.on))continue; if(e.chase){e.tick+=dt; if(e.tick>e.speed){e.tick=0; const p=state.player; if(Math.abs(p.x-e.x)>Math.abs(p.y-e.y))e.x+=Math.sign(p.x-e.x); else e.y+=Math.sign(p.y-e.y);} continue;} e.tick+=dt; if(e.tick>e.speed){e.tick=0;e.step=(e.step+1)%e.path.length;e.x=e.path[e.step][0];e.y=e.path[e.step][1];}} }
function checkEnemyHit(){ const p=state.player; if(state.enemies.some(e=>e.x===p.x&&e.y===p.y)) rewindTime(); }
function rewindTime(){ const old=state.rewinds+1; state=parseStage(stageIndex); state.rewinds=old; ui.rewinds.textContent=old; ui.rescued.textContent='0'; setMessage('敵に遭遇した！ 時間が巻き戻った。'); }

function useTool(x,y){
  const prop=state.props.find(p=>p.x===x&&p.y===y);
  if(!prop){ setMessage(`${toolName(selectedTool)}を使う対象がない。`); return; }
  if(prop.type==='G'||prop.type==='C'||prop.type==='T'||prop.type==='W'||prop.type==='R'||prop.type==='H') return gatherAt(prop);
  if(selectedTool==='lantern' && prop.type==='dark'){ if(gainCollection(prop.collection)){ setMessage('ランタンが暗がりを照らし、石板の欠片を見つけた。'); } else setMessage('ランタンの光が、もう何もない暗がりを照らした。'); return; }
  if(selectedTool==='hook' && prop.type==='hook'){ state.lockedGates.forEach(g=>g.open=true); setMessage('フックが杭にかかった！ 遠くの足場へ渡る道が開いた。'); return; }
  if(selectedTool==='bomb' && prop.type==='crack'){ state.doors.forEach(d=>d.open=true); state.lockedGates.forEach(g=>g.open=true); if(gainCollection(prop.collection)) setMessage('爆弾でヒビ壁を壊した。奥から古い歌の断片が出てきた。'); else setMessage('ヒビ壁はすでに崩れている。'); return; }
  if(selectedTool==='hand' && prop.type==='mirror'){ state.doors.forEach(d=>d.open=true); if(gainCollection(prop.collection)) setMessage('鏡の向きを変えた。光が封印を解き、村長の手記が現れた。'); else setMessage('鏡は静かに光を返している。'); return; }
  setMessage(`${toolName(selectedTool)}では反応しない。別の装備を試そう。`);
}
function gatherAt(prop){
  const table={G:'old_notice',C:'memory_ami_ribbon',T:'weathered_medal',W:'stone_fragment',R:'castle_lullaby',H:'elder_note'};
  const id=table[prop.type]||'old_notice';
  if(gainCollection(id)) setMessage(`${COLLECTIONS[id]?.name||'収集品'}を見つけた。図鑑に記録された。`);
  else setMessage('ここはもう調べ尽くしたようだ。');
}
function toolName(t){ return {hand:'手',lantern:'ランタン',hook:'フック',bomb:'爆弾'}[t]||t; }
function setTool(t){ selectedTool=t; updateToolButtons(); setMessage(`${toolName(t)}を選んだ。対象をタップして使おう。`); }
function updateToolButtons(){ document.querySelectorAll('#equipmentBar button').forEach(b=>b.classList.toggle('active', b.dataset.tool===selectedTool)); }

function interact(){ if(dialogue.active)return; const p=state.player; const npc=state.npcs.find(n=>!n.rescued&&near(p,n)); if(npc){ const c=CHARACTERS[npc.characterId]||{name:'村人',job:'村人',age:'?',rescueLine:'助かった！',personality:'村の大切な人。'}; const line=state.stage.isFinalStage&&npc.characterId==='ami'?(c.finalRescueLine||c.rescueLine):c.rescueLine; openDialogue([{characterId:npc.characterId,speaker:c.name,role:`${c.job} / ${c.age}歳`,text:line},{characterId:npc.characterId,speaker:c.name,role:c.relation||c.personality||'',text:`【人物メモ】${c.personality||'村の大切な人。'}`}],()=>finishRescue(npc)); return;} const sw=state.switches.find(s=>near(p,s)); if(sw){sw.on=!sw.on; state.doors.forEach(d=>d.open=state.switches.some(s=>s.on)); setMessage(sw.on?'スイッチ作動！ 扉が開いた。':'スイッチ解除。扉が閉じた。'); return;} const prop=state.props.find(q=>near(p,q)); if(prop){ if(prop.type==='mirror'||'GCTWRH'.includes(prop.type)) useTool(prop.x,prop.y); else setMessage('これは装備で反応しそうだ。'); return;} setMessage('近くに救助できる人や仕掛けはない。'); }
function finishRescue(npc){ npc.rescued=true; const st=currentStage(); const before=stageProgress(st); campaign.stageProgress[st.id]=before+1; campaign.totalRescued+=1; if(npc.characterId&&!campaign.metCharacters.includes(npc.characterId))campaign.metCharacters.push(npc.characterId); if(stageComplete(st)&&!campaign.clearedStages.includes(st.id)){campaign.clearedStages.push(st.id); gainItem(st.clearReward);} saveCampaign(); ui.rescued.textContent='1'; clearScene(); }
function clearScene(){ cancelAnimationFrame(animId); const st=currentStage(), done=stageComplete(st), c=CHARACTERS[state.npcs[0]?.characterId]; ui.clearTitle.textContent=st.isFinalStage&&done?'ami救出！':'救助成功！'; ui.clearText.textContent=`${c?.name||'村人'}を救助した。\n${done?st.clearMessage:`${st.name}には、まだ助けを待つ人がいる。`}\n累計救助: ${campaign.totalRescued}/${CONFIG.totalRescueGoal}`; ui.nextBtn.textContent=st.isFinalStage&&done?'エンドロールへ':'村へ戻る'; show('clear'); }

function openDialogue(lines,onFinish=null){ dialogue={active:true,lines,index:0,onFinish}; renderDialogueLine(); }
function renderDialogueLine(){ const line=dialogue.lines[dialogue.index], c=line.characterId?CHARACTERS[line.characterId]:null; dialogueEls.speaker.textContent=line.speaker||c?.name||'語り手'; dialogueEls.role.textContent=line.role||c?.job||''; dialogueEls.design.textContent=c?.design||''; dialogueEls.text.textContent=line.text||''; dialogueEls.portrait.style.background=c?.important?'linear-gradient(180deg,#ffd58a,#5b4b75)':'linear-gradient(180deg,#8eb8ff,#5b4b75)'; dialogueEls.overlay.classList.remove('hidden'); }
function nextDialogue(){ if(!dialogue.active)return; if(dialogue.index<dialogue.lines.length-1){dialogue.index++;renderDialogueLine();return;} dialogueEls.overlay.classList.add('hidden'); const f=dialogue.onFinish; dialogue={active:false,lines:[],index:0,onFinish:null}; if(typeof f==='function')f(); }

function renderVillagerBook(){ ui.bookTitle.textContent='住民図鑑'; ui.bookList.innerHTML=Object.entries(CHARACTERS).map(([id,c])=>{const met=campaign.metCharacters.includes(id); return `<div class="book-card ${met?'':'locked'}"><strong>${met?c.name:'？？？'}</strong><small>${met?`${c.gender} / ${c.age}歳 / ${c.job}`:'未救助'}</small><p>${met?c.design:'まだ記録がない。'}</p><p>${met?c.personality:''}</p></div>`}).join(''); show('book'); }
function renderCollectionBook(){ ui.bookTitle.textContent='コレクション図鑑'; ui.bookList.innerHTML=Object.entries(COLLECTIONS).map(([id,c])=>{const got=campaign.collections.includes(id); return `<div class="book-card ${got?'':'locked'}"><strong>${got?c.name:'？？？'}</strong><small>${got?`${c.category} / ${c.location}`:'未発見'}</small><p>${got?c.description:'失われた記憶は、まだ土の下か闇の奥に眠っている。'}</p></div>`}).join(''); show('book'); }

function drawBackdrop(theme){ ctx.fillStyle=theme.deep; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='rgba(255,255,255,.08)'; for(let i=0;i<6;i++){ctx.fillRect((i*71+stageIndex*19)%canvas.width,8,24,28+(i%3)*18);} }
function drawTile(x,y,color,inset=0){ctx.fillStyle=color;ctx.fillRect(x*TILE+inset,y*TILE+inset,TILE-inset*2,TILE-inset*2);} function drawPerson(x,y,ch={},base='#f7efd4'){const age=+(ch.age||30),child=age<15,elder=age>=60,female=ch.gender==='女',w=child?14:18,h=child?17:22,ox=(TILE-w)/2,oy=child?11:6;ctx.fillStyle=base;ctx.fillRect(x*TILE+ox,y*TILE+oy,w,h);ctx.fillStyle=female?'#3a1f2d':'#2d2116';ctx.fillRect(x*TILE+ox+(female?-2:2),y*TILE+oy-3,w+(female?4:-4),female?8:5);ctx.fillStyle='#111';ctx.fillRect(x*TILE+ox+4,y*TILE+oy+7,3,3);ctx.fillRect(x*TILE+ox+w-7,y*TILE+oy+7,3,3);if(elder){ctx.fillStyle='#eee';ctx.fillRect(x*TILE+ox+4,y*TILE+oy+13,w-8,4);} if(ch.job==='兵士'){ctx.strokeStyle='#9ed1ff';ctx.strokeRect(x*TILE+ox-1,y*TILE+oy-1,w+2,h+2);} }
function draw(){ if(!state)return; const theme=THEMES[state.stage.id]||THEMES.forest; drawBackdrop(theme); for(let y=0;y<state.size.height;y++)for(let x=0;x<state.size.width;x++){drawTile(x,y,(x+y)%2?theme.floor1:theme.floor2);ctx.strokeStyle='rgba(255,255,255,.03)';ctx.strokeRect(x*TILE,y*TILE,TILE,TILE);} state.walls.forEach(k=>{const[x,y]=k.split(',').map(Number);drawTile(x,y,theme.wall,2);drawTile(x,y,theme.deep,8);}); state.switches.forEach(s=>drawTile(s.x,s.y,s.on?'#75d1ff':'#2d7494',7)); state.doors.forEach(d=>drawTile(d.x,d.y,d.open?'#38533a':'#8b5b2c',3)); state.keys.forEach(k=>{if(!k.taken){drawTile(k.x,k.y,'#8a6b18',8);ctx.fillStyle='#ffea8a';ctx.fillRect(k.x*TILE+14,k.y*TILE+10,4,12);}}); state.lockedGates.forEach(g=>drawTile(g.x,g.y,g.open?'#39503d':'#6c4d1d',4)); state.props.forEach(p=>{const colors={G:'#5da35d',C:'#8b6a37',T:'#8b5b2c',W:'#3b6f8c',R:'#777',H:'#79a',dark:'#111',hook:'#9ed1ff',mirror:'#d5efff',crack:'#7a5945'};drawTile(p.x,p.y,colors[p.type]||'#aaa',9);}); state.npcs.forEach(n=>n.rescued?drawTile(n.x,n.y,'#3e5e46',8):drawPerson(n.x,n.y,CHARACTERS[n.characterId]||{},CHARACTERS[n.characterId]?.important?'#ffd58a':'#f7efd4')); state.enemies.forEach(e=>drawPerson(e.x,e.y,{gender:'男',age:99},'#ff6b6b')); const p=state.player,ix=p.moving?p.px+(p.x-p.px)*p.progress:p.x,iy=p.moving?p.py+(p.y-p.py)*p.progress:p.y; drawPerson(ix,iy,{gender:'男',age:20,job:'若者'},'#f5b642'); }
function loop(now){const dt=Math.min(0.05,(now-lastTime)/1000);lastTime=now;if(!dialogue.active){updatePlayer(dt);updateEnemies(dt);checkEnemyHit();}draw();animId=requestAnimationFrame(loop);}

canvas.addEventListener('pointerdown',ev=>{if(!state||dialogue.active)return;const r=canvas.getBoundingClientRect();const x=Math.floor((ev.clientX-r.left)/r.width*state.size.width),y=Math.floor((ev.clientY-r.top)/r.height*state.size.height); if(selectedTool==='hand')goTo(x,y); else useTool(x,y);});
document.querySelectorAll('#equipmentBar button').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
document.getElementById('startBtn').addEventListener('click',startGame);
document.getElementById('townNextBtn').addEventListener('click',()=>startStage(nextStageIndex()));
document.getElementById('townGatherBtn').addEventListener('click',startOutskirts);
document.getElementById('townEquipBtn').addEventListener('click',()=>{ui.modeText.textContent=`装備：${toolName(selectedTool)}を選択中。下の装備スロットで、ランタン・フック・爆弾を切り替えられる。`;});
document.getElementById('villagerBookBtn').addEventListener('click',renderVillagerBook);
document.getElementById('collectionBookBtn').addEventListener('click',renderCollectionBook);
document.getElementById('townReplayBtn').addEventListener('click',()=>startStage(0));
document.getElementById('bookBackBtn').addEventListener('click',()=>showTown());
document.getElementById('interactBtn').addEventListener('click',interact);
document.getElementById('resetBtn').addEventListener('click',()=>mode==='outskirts'?startOutskirts():startStage(stageIndex));
document.getElementById('nextBtn').addEventListener('click',()=>{if(currentStage()?.isFinalStage&&stageComplete(currentStage()))show('ending');else showTown();});
document.getElementById('endingBackBtn')?.addEventListener('click',()=>show('title'));
dialogueEls.nextBtn.addEventListener('click',nextDialogue);dialogueEls.overlay.addEventListener('pointerdown',e=>{if(e.target===dialogueEls.overlay)nextDialogue();});
ui.stageTotal.textContent=STAGES.length;ui.totalRescued.textContent=campaign.totalRescued;ui.campaignGoal.textContent=CONFIG.totalRescueGoal;show('title');
