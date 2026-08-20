const canvas = document.querySelector('#game');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });

if (!gl) {
  document.querySelector('#unsupported').classList.remove('hidden');
  throw new Error('WebGL 2 unavailable');
}

// ---------- Small math layer ----------
const V3 = {
  add: (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]],
  sub: (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]],
  scale: (a,s) => [a[0]*s, a[1]*s, a[2]*s],
  dot: (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross: (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  len: a => Math.hypot(a[0],a[1],a[2]),
  norm(a) { const l = this.len(a) || 1; return [a[0]/l,a[1]/l,a[2]/l]; },
};

const M4 = {
  identity() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },
  multiply(a,b) {
    const o = new Float32Array(16);
    for (let c=0;c<4;c++) for (let r=0;r<4;r++) {
      o[c*4+r] = a[0*4+r]*b[c*4+0] + a[1*4+r]*b[c*4+1] + a[2*4+r]*b[c*4+2] + a[3*4+r]*b[c*4+3];
    }
    return o;
  },
  perspective(fov, aspect, near, far) {
    const f=1/Math.tan(fov/2), nf=1/(near-far);
    return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
  },
  lookAt(eye,target,up=[0,1,0]) {
    const z=V3.norm(V3.sub(eye,target));
    const x=V3.norm(V3.cross(up,z));
    const y=V3.cross(z,x);
    return new Float32Array([
      x[0],y[0],z[0],0,
      x[1],y[1],z[1],0,
      x[2],y[2],z[2],0,
      -V3.dot(x,eye),-V3.dot(y,eye),-V3.dot(z,eye),1
    ]);
  },
  trs(t=[0,0,0], rY=0, s=[1,1,1]) {
    const c=Math.cos(rY), sn=Math.sin(rY);
    return new Float32Array([
      c*s[0],0,-sn*s[0],0,
      0,s[1],0,0,
      sn*s[2],0,c*s[2],0,
      t[0],t[1],t[2],1
    ]);
  },
};

function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function lerp(a,b,t){ return a+(b-a)*t; }
function smoothstep(a,b,x){ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
function dist2(a,b){ return Math.hypot(a[0]-b[0], a[1]-b[1]); }

// ---------- Deterministic world seed ----------
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

let seedText = 'WORLDCLAW-2608';
let seedValue = hashString(seedText);
let rng = mulberry32(seedValue);
