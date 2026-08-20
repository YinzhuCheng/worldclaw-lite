// ---------- Rendering ----------
gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);

function draw(meshObj,model,col,emissive=0){
  gl.uniformMatrix4fv(U.uModel,false,model); gl.uniform3fv(U.uColor,col); gl.uniform1f(U.uEmissive,emissive); gl.bindVertexArray(meshObj.vao); gl.drawElements(gl.TRIANGLES,meshObj.count,gl.UNSIGNED_INT,0);
}

function daylight(t){
  const a=(t/24)*Math.PI*2 - Math.PI/2;
  const sunY=Math.sin(a), day=smoothstep(-.12,.2,sunY);
  const dawn=1-Math.min(1,Math.abs(sunY)*3.2);
  return {
    sunDir:V3.norm([Math.cos(a)*.7,-Math.max(.08,sunY),-.42]),
    sun:[lerp(.34,1,day),lerp(.42,.93,day),lerp(.6,.72,day)],
    ambient:[lerp(.08,.28,day),lerp(.11,.34,day),lerp(.16,.31,day)],
    sky:[lerp(.025,.42,day)+dawn*.08,lerp(.045,.64,day)+dawn*.03,lerp(.09,.73,day)],
    fog:[lerp(.05,.43,day),lerp(.08,.57,day),lerp(.12,.58,day)]
  };
}

function resize(){
  const dpr=Math.min(devicePixelRatio||1,1.7),w=Math.floor(innerWidth*dpr),h=Math.floor(innerHeight*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
}

function render(dt){
  resize(); worldTime=(worldTime+dt*.055)%24; const light=daylight(worldTime);
  gl.clearColor(...light.sky,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const aspect=canvas.width/canvas.height; gl.uniformMatrix4fv(U.uProjection,false,M4.perspective(Math.PI/3.15,aspect,.15,670));
  const eyeBob=(keys.size && player.onGround)?Math.sin(bob)*.09:0;
  const cp=Math.cos(player.pitch), dir=[-Math.sin(player.yaw)*cp,Math.sin(player.pitch),-Math.cos(player.yaw)*cp];
  const eye=[player.x,player.y+eyeBob,player.z], target=V3.add(eye,dir); gl.uniformMatrix4fv(U.uView,false,M4.lookAt(eye,target));
  gl.uniform3fv(U.uCamera,eye);gl.uniform3fv(U.uSunDir,light.sunDir);gl.uniform3fv(U.uSunColor,light.sun);gl.uniform3fv(U.uAmbient,light.ambient);gl.uniform3fv(U.uFogColor,light.fog);gl.uniform1f(U.uFogNear,170);gl.uniform1f(U.uFogFar,590);

  draw(meshes.terrain,M4.identity(),C.terrain,0);

  // Water surface.
  const waterY=lake.level-.25;
  draw(meshes.cube,M4.trs([lake.x,waterY,lake.z],0,[lake.rx,.14,lake.rz]),C.water,.05);

  // Sort transparent-free objects roughly by importance only; all opaque.
  for(const o of objects){
    if(o.hidden)continue;
    let rot=o.rot;
    if(o.tag?.startsWith('crystal-')||o.tag==='altar-core')rot=performance.now()*.0007 + (o.pos[0]*.01);
    draw(meshes[o.type],M4.trs(o.pos,rot,o.scale),o.color,o.emissive||0);
  }
}

function updateHUD(){
  UI.pos.textContent=`${Math.round(player.x)}, ${Math.round(player.z)}`;
  const hh=Math.floor(worldTime)%24, mm=Math.floor((worldTime%1)*60); UI.time.textContent=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  drawMinimap();
}

function drawMinimap(){
  const c=UI.minimap,ctx=c.getContext('2d'),w=c.width,h=c.height,range=210,scale=w/(range*2);
  ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(w/2,h/2);
  ctx.fillStyle='rgba(7,18,13,.88)';ctx.beginPath();ctx.arc(0,0,w/2,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(184,255,200,.08)';ctx.lineWidth=1;for(let r=40;r<90;r+=28){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();}
  const mapPoint=(x,z)=>[(x-player.x)*scale,(z-player.z)*scale];
  // Lake.
  let [lx,lz]=mapPoint(lake.x,lake.z);ctx.fillStyle='rgba(70,164,190,.35)';ctx.beginPath();ctx.ellipse(lx,lz,lake.rx*scale,lake.rz*scale,0,0,Math.PI*2);ctx.fill();
  landmarks.forEach(l=>{const [x,z]=mapPoint(l.x,l.z);if(Math.hypot(x,z)>w*.5-8)return;ctx.fillStyle=l.kind==='altar'?'#b9ff6d':'#d5ddd5';ctx.fillRect(x-2,z-2,4,4);});
  crystals.forEach(cr=>{if(cr.collected)return;const [x,z]=mapPoint(cr.x,cr.z);if(Math.hypot(x,z)>w*.5-5)return;ctx.fillStyle='#73e6ff';ctx.beginPath();ctx.arc(x,z,2.4,0,Math.PI*2);ctx.fill();});
  ctx.rotate(-player.yaw);ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(-5,6);ctx.lineTo(5,6);ctx.closePath();ctx.fill();ctx.restore();
}

function loop(now){
  const dt=Math.min(.033,(now-last)/1000||.016);last=now;if(running)updatePlayer(dt); if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)UI.toast.classList.remove('show');} render(dt);updateHUD();requestAnimationFrame(loop);
}

UI.seed.textContent=seedText;resetPlayer();requestAnimationFrame(loop);
