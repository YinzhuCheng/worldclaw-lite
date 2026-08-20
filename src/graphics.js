// ---------- Shaders ----------
const vs = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform vec3 uColor;
uniform vec3 uCamera;
out vec3 vNormal;
out vec3 vWorldPos;
out vec3 vColor;
void main(){
  vec4 wp = uModel * vec4(aPosition, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  vColor = uColor;
  gl_Position = uProjection * uView * wp;
}`;

const fs = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorldPos;
in vec3 vColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uCamera;
uniform float uEmissive;
out vec4 outColor;
void main(){
  float ndl = max(dot(normalize(vNormal), normalize(-uSunDir)), 0.0);
  float hemi = clamp(vNormal.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 lit = vColor * (uAmbient * (0.72 + 0.28 * hemi) + uSunColor * ndl * 0.78);
  lit += vColor * uEmissive;
  float d = distance(vWorldPos.xz, uCamera.xz);
  float fog = smoothstep(uFogNear, uFogFar, d);
  outColor = vec4(mix(lit, uFogColor, fog), 1.0);
}`;

function shader(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const program=gl.createProgram(); gl.attachShader(program,shader(gl.VERTEX_SHADER,vs)); gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(program);
if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program);
const U = {};
for (const n of ['uProjection','uView','uModel','uColor','uCamera','uSunDir','uSunColor','uAmbient','uFogColor','uFogNear','uFogFar','uEmissive']) U[n]=gl.getUniformLocation(program,n);

// ---------- Mesh helpers ----------
function mesh(vertices, normals, indices) {
  const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vb); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
  const nb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,nb); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(normals),gl.STATIC_DRAW); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);
  const ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return {vao,count:indices.length};
}

function cubeMesh(){
  const p=[
    -1,-1,1, 1,-1,1, 1,1,1, -1,1,1,
    1,-1,-1, -1,-1,-1, -1,1,-1, 1,1,-1,
    -1,1,1, 1,1,1, 1,1,-1, -1,1,-1,
    -1,-1,-1, 1,-1,-1, 1,-1,1, -1,-1,1,
    1,-1,1, 1,-1,-1, 1,1,-1, 1,1,1,
    -1,-1,-1, -1,-1,1, -1,1,1, -1,1,-1
  ];
  const n=[]; [[0,0,1],[0,0,-1],[0,1,0],[0,-1,0],[1,0,0],[-1,0,0]].forEach(v=>{for(let i=0;i<4;i++)n.push(...v)});
  const idx=[]; for(let f=0;f<6;f++){const o=f*4;idx.push(o,o+1,o+2,o,o+2,o+3)}
  return mesh(p,n,idx);
}

function coneMesh(segments=7){
  const p=[[0,1,0]], n=[[0,1,0]];
  for(let i=0;i<segments;i++){ const a=i/segments*Math.PI*2; p.push([Math.cos(a),-1,Math.sin(a)]); n.push(V3.norm([Math.cos(a),.45,Math.sin(a)])); }
  p.push([0,-1,0]); n.push([0,-1,0]);
  const idx=[]; for(let i=0;i<segments;i++){ const a=1+i,b=1+(i+1)%segments; idx.push(0,a,b); idx.push(p.length-1,b,a); }
  return mesh(p.flat(),n.flat(),idx);
}

function cylinderMesh(segments=8){
  const p=[],n=[],idx=[];
  for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,c=Math.cos(a),s=Math.sin(a); p.push(c,-1,s,c,1,s);n.push(c,0,s,c,0,s);}
  for(let i=0;i<segments;i++){const a=i*2,b=((i+1)%segments)*2;idx.push(a,b,a+1,b,b+1,a+1)}
  return mesh(p,n,idx);
}

function diamondMesh(){
  const p=[[0,1.2,0],[.55,0,0],[0,0,.55],[-.55,0,0],[0,0,-.55],[0,-1.2,0]];
  const faces=[[0,1,2],[0,2,3],[0,3,4],[0,4,1],[5,2,1],[5,3,2],[5,4,3],[5,1,4]];
  const verts=[], norms=[], idx=[];
  faces.forEach((f,fi)=>{const a=p[f[0]],b=p[f[1]],c=p[f[2]], no=V3.norm(V3.cross(V3.sub(b,a),V3.sub(c,a))); const o=verts.length/3; verts.push(...a,...b,...c);norms.push(...no,...no,...no);idx.push(o,o+1,o+2)});
  return mesh(verts,norms,idx);
}

const meshes={cube:cubeMesh(),cone:coneMesh(),cylinder:cylinderMesh(),diamond:diamondMesh()};
