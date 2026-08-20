// ---------- World terrain ----------
const WORLD_SIZE=760;
const HALF=WORLD_SIZE/2;
const lake={x:38,z:142,rx:82,rz:54,level:-2.7};
const altar=[116,-86];
const tower=[-190,156];

function baseHeight(x,z){
  const large=Math.sin(x*.012)*6 + Math.cos(z*.014)*5 + Math.sin((x+z)*.008)*4;
  const detail=Math.sin(x*.043+1.7)*1.5 + Math.cos(z*.037-0.8)*1.4;
  const ridge=Math.sin(Math.hypot(x+80,z-40)*.028)*2.2;
  const edge=Math.pow(Math.max(0,Math.hypot(x,z)-245)/145,2)*16;
  let h=large+detail+ridge+edge;
  const lakeD=((x-lake.x)/lake.rx)**2+((z-lake.z)/lake.rz)**2;
  if(lakeD<1.35){ const t=smoothstep(1.35,.52,lakeD); h=lerp(h,lake.level-2.5,t); }
  const altarD=Math.hypot(x-altar[0],z-altar[1]); if(altarD<34) h=lerp(h,3.2,smoothstep(34,12,altarD));
  const towerD=Math.hypot(x-tower[0],z-tower[1]); if(towerD<22) h=lerp(h,8.8,smoothstep(22,8,towerD));
  return h;
}

function terrainMesh(res=82){
  const verts=[], norms=[], idx=[];
  for(let z=0;z<=res;z++) for(let x=0;x<=res;x++){
    const wx=-HALF+x/res*WORLD_SIZE, wz=-HALF+z/res*WORLD_SIZE, y=baseHeight(wx,wz);
    verts.push(wx,y,wz);
    const e=1.2, dx=baseHeight(wx+e,wz)-baseHeight(wx-e,wz), dz=baseHeight(wx,wz+e)-baseHeight(wx,wz-e);
    normals.push(...V3.norm([-dx,2*e,-dz]));
  }
  for(let z=0;z<res;z++) for(let x=0;x<res;x++){const a=z*(res+1)+x,b=a+1,c=a+(res+1),d=c+1;idx.push(a,c,b,b,c,d)}
  return mesh(verts,norms,idx);
}
meshes.terrain=terrainMesh();

// ---------- Scene objects ----------
let objects=[];
let crystals=[];
let landmarks=[];

function add(type,pos,scale,color,rot=0,emissive=0,tag=''){ objects.push({type,pos,scale,color,rot,emissive,tag}); }
function color(hex){ const n=parseInt(hex.replace('#',''),16); return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]; }

const C={
  terrain:color('#55784a'), trunk:color('#4b3525'), pine:color('#315c3b'), pine2:color('#416e43'),
  stone:color('#7a8073'), stoneDark:color('#525a50'), water:color('#2f7183'), crystal:color('#7ee8ff'),
  altar:color('#8c8c79'), glow:color('#b9ff6d'), ruin:color('#686b5f'), wood:color('#5a4030')
};

function buildWorld(){
  objects=[]; crystals=[]; landmarks=[]; rng=mulberry32(seedValue);

  // Forest — combined from low-poly trunks + canopies.
  for(let i=0;i<185;i++){
    const x=(rng()-.5)*(WORLD_SIZE-80), z=(rng()-.5)*(WORLD_SIZE-80);
    const lakeD=((x-lake.x)/lake.rx)**2+((z-lake.z)/lake.rz)**2;
    if(lakeD<1.18 || Math.hypot(x-altar[0],z-altar[1])<45 || Math.hypot(x-tower[0],z-tower[1])<32){i--;continue;}
    const y=baseHeight(x,z), s=.75+rng()*.9, lean=(rng()-.5)*.12;
    add('cylinder',[x,y+3.0*s,z],[1.05*s,3.2*s,1.05*s],C.trunk,lean);
    add('cone',[x,y+7.6*s,z],[3.8*s,5.1*s,3.8*s],rng()>.5?C.pine:C.pine2,rng()*Math.PI);
    if(rng()>.72) add('cone',[x,y+10.5*s,z],[2.6*s,3.7*s,2.6*s],C.pine2,rng()*Math.PI);
  }

  // Rocks.
  for(let i=0;i<78;i++){
    const x=(rng()-.5)*(WORLD_SIZE-55), z=(rng()-.5)*(WORLD_SIZE-55), y=baseHeight(x,z), s=1.2+rng()*3.8;
    if(((x-lake.x)/lake.rx)**2+((z-lake.z)/lake.rz)**2<1.0) continue;
    add('cube',[x,y+s*.35,z],[s,s*.55,s*.7],rng()>.5?C.stone:C.stoneDark,rng()*Math.PI);
  }

  // Central altar ruins.
  const ay=baseHeight(...altar);
  add('cylinder',[altar[0],ay+.8,altar[1]],[9,0.8,9],C.stoneDark,0);
  add('cylinder',[altar[0],ay+1.55,altar[1]],[6.4,.8,6.4],C.altar,0);
  add('diamond',[altar[0],ay+4.3,altar[1]],[1.8,2.8,1.8],C.glow,0,0.12,'altar-core');
  for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; const x=altar[0]+Math.cos(a)*15,z=altar[1]+Math.sin(a)*15,y=baseHeight(x,z); add('cube',[x,y+3.6,z],[1.5,3.6,1.5],C.ruin,a); }
  landmarks.push({name:'ALTAR',x:altar[0],z:altar[1],kind:'altar'});

  // Broken watchtower.
  const ty=baseHeight(...tower);
  for(let y=0;y<4;y++){
    add('cube',[tower[0],ty+2.4+y*4.6,tower[1]],[6.4,2.1,6.4],C.ruin,(y%2)*.08);
    if(y<3) add('cube',[tower[0]+5.5,ty+4.2+y*4.6,tower[1]],[.8,2.2,.8],C.wood,.06);
  }
  add('cube',[tower[0],ty+20.1,tower[1]],[8,.55,8],C.wood,.08);
  landmarks.push({name:'WATCHTOWER',x:tower[0],z:tower[1],kind:'tower'});
  landmarks.push({name:'LAKE',x:lake.x,z:lake.z,kind:'lake'});

  // Crystals placed around the whole map, avoiding trivial altar proximity.
  const anchors=[[255,220],[-265,-185],[240,-220],[-235,245],[10,-280],[-45,275],[280,15],[-290,35]];
  anchors.forEach((a,i)=>{
    const x=a[0]+(rng()-.5)*34,z=a[1]+(rng()-.5)*34,y=baseHeight(x,z);
    const c={x,y:y+2.2,z,collected:false,id:i}; crystals.push(c);
    add('diamond',[x,y+2.2,z],[1.35,2.2,1.35],C.crystal,0,0.72,`crystal-${i}`);
    add('cylinder',[x,y+.35,z],[2.7,.35,2.7],C.stoneDark,0);
  });
}

buildWorld();
