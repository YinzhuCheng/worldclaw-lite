// ---------- Player + game state ----------
const player={x:0,y:0,z:20,yaw:0,pitch:-.08,vy:0,onGround:false,speed:31};
let keys=new Set();
let running=false;
let gameWon=false;
let collected=0;
let last=performance.now();
let worldTime=6.2;
let toastTimer=0;
let bob=0;

const UI={
  hud:document.querySelector('#hud'), start:document.querySelector('#start-screen'), pause:document.querySelector('#pause-screen'),
  play:document.querySelector('#play-button'), resume:document.querySelector('#resume-button'), seedInput:document.querySelector('#seed-input'),
  seed:document.querySelector('#seed-label'), pos:document.querySelector('#position-label'), time:document.querySelector('#time-label'), quest:document.querySelector('#quest'),
  counter:document.querySelector('#counter'), fill:document.querySelector('#progress-fill'), toast:document.querySelector('#toast'), minimap:document.querySelector('#minimap')
};

function resetPlayer(){ player.x=0;player.z=22;player.y=baseHeight(player.x,player.z)+4.4;player.yaw=0;player.pitch=-.08;player.vy=0;collected=0;gameWon=false;worldTime=6.2;buildWorld();updateQuest(); }
function updateQuest(){
  if(gameWon){UI.quest.textContent='World signal restored';UI.counter.textContent='ALTAR ONLINE';UI.fill.style.width='100%';return;}
  if(collected>=crystals.length){UI.quest.textContent='Return to the forgotten altar';UI.counter.textContent='Signal complete';UI.fill.style.width='100%';return;}
  UI.quest.textContent='Collect 8 signal crystals';UI.counter.textContent=`${collected} / ${crystals.length}`;UI.fill.style.width=`${collected/crystals.length*100}%`;
}
function toast(msg){UI.toast.textContent=msg;UI.toast.classList.add('show');toastTimer=2.4;}

function requestLock(){ canvas.requestPointerLock?.(); }
UI.play.addEventListener('click',()=>{
  seedText=(UI.seedInput.value.trim()||'WORLDCLAW-2608').toUpperCase(); seedValue=hashString(seedText); UI.seed.textContent=seedText; resetPlayer(); UI.start.classList.add('hidden'); UI.hud.classList.remove('hidden'); running=true; requestLock();
});
UI.resume.addEventListener('click',()=>{running=true;UI.pause.classList.add('hidden');requestLock();});
canvas.addEventListener('click',()=>{if(!UI.start.classList.contains('hidden')&&running)return;if(running && document.pointerLockElement!==canvas)requestLock();});
document.addEventListener('pointerlockchange',()=>{
  if(UI.start.classList.contains('hidden')){
    if(document.pointerLockElement===canvas){running=true;UI.pause.classList.add('hidden');}
    else if(!gameWon){running=false;UI.pause.classList.remove('hidden');}
  }
});
document.addEventListener('keydown',e=>{keys.add(e.code);if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();});
document.addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement!==canvas || !running)return;
  player.yaw -= e.movementX*.0018; player.pitch -= e.movementY*.0017; player.pitch=clamp(player.pitch,-1.35,1.35);
});

function lakeSurfaceAt(x,z){ const d=((x-lake.x)/lake.rx)**2+((z-lake.z)/lake.rz)**2; return d<1; }
function updatePlayer(dt){
  const ground=baseHeight(player.x,player.z)+4.2;
  const f=[-Math.sin(player.yaw),0,-Math.cos(player.yaw)], r=[Math.cos(player.yaw),0,-Math.sin(player.yaw)];
  let dx=0,dz=0;
  if(keys.has('KeyW')){dx+=f[0];dz+=f[2]} if(keys.has('KeyS')){dx-=f[0];dz-=f[2]} if(keys.has('KeyA')){dx-=r[0];dz-=r[2]} if(keys.has('KeyD')){dx+=r[0];dz+=r[2]}
  const mag=Math.hypot(dx,dz); const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight'); const speed=player.speed*(sprint?1.65:1)*(lakeSurfaceAt(player.x,player.z)?.58:1);
  if(mag>0){dx/=mag;dz/=mag;player.x+=dx*speed*dt;player.z+=dz*speed*dt;bob+=dt*(sprint?13:9);} else bob*=.92;
  player.x=clamp(player.x,-HALF+8,HALF-8);player.z=clamp(player.z,-HALF+8,HALF-8);
  const newGround=baseHeight(player.x,player.z)+4.2;
  if(keys.has('Space')&&player.onGround){player.vy=13.5;player.onGround=false;}
  player.vy-=31*dt;player.y+=player.vy*dt;
  if(player.y<=newGround){player.y=newGround;player.vy=0;player.onGround=true;}

  crystals.forEach(c=>{
    if(!c.collected && Math.hypot(player.x-c.x,player.z-c.z)<4.8 && Math.abs(player.y-c.y)<7){
      c.collected=true; collected++; const obj=objects.find(o=>o.tag===`crystal-${c.id}`); if(obj)obj.hidden=true;
      toast(`SIGNAL CRYSTAL ${collected}/${crystals.length} RECOVERED`); updateQuest();
    }
  });
  if(collected>=crystals.length && !gameWon && Math.hypot(player.x-altar[0],player.z-altar[1])<12){gameWon=true;toast('WORLD SIGNAL RESTORED');updateQuest(); const a=objects.find(o=>o.tag==='altar-core');if(a)a.emissive=1.3;}
}
