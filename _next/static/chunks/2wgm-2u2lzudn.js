(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,10770,e=>{"use strict";var t=e.i(43476),r=e.i(71645),a=e.i(94800),i=e.i(48546),n=e.i(90072),o=e.i(55448),l=e.i(17448),s=e.i(87269),u=e.i(29236),c=e.i(60284),f=e.i(27225),m=e.i(49184);let v=e=>440*Math.pow(2,(e-69)/12),d=[[76,1],[74,.5],[72,.5],[71,1],[69,1],[72,.5],[74,.5],[76,1],[74,.5],[72,.5],[71,1],[76,1],[74,.5],[72,.5],[71,1],[69,1],[67,.5],[69,.5],[71,1],[69,2],[81,1],[79,.5],[78,.5],[76,1],[74,1],[76,.5],[78,.5],[79,1],[76,1],[74,1],[81,1],[79,.5],[78,.5],[76,1],[74,.5],[72,.5],[71,.5],[72,.5],[74,1],[69,2]],h=[[8,16]];function p(e,t){e.addEventListener("ended",()=>t.forEach(e=>e.disconnect()),{once:!0})}d.reduce((e,[,t])=>e+t,0);class g{graph=null;duck=-1;releasing=0;hurry=1;update(e){let t=l.ambience.bus(),r=t?Math.max(0,Math.min(1,e)):0;if((Math.abs(r-this.duck)>.03||0===r&&0!==this.duck)&&(this.duck=r,l.ambience.setMusicDuck("festnoz",.85*Math.min(1,1.15*r))),!t||r<=.004)return void this.release();this.graph&&this.graph.context===t.context||(this.disposeNow(),this.graph=this.build(t.context,t.destination));let a=this.graph;this.releasing=0,a.out.gain.setTargetAtTime(.5*Math.pow(r,1.3),a.context.currentTime,.35),this.schedule(a,a.context.currentTime+.6)}dispose(){this.disposeNow(),this.duck=0,l.ambience.setMusicDuck("festnoz",0)}release(){let e=this.graph;e&&(this.releasing?e.context.currentTime-this.releasing>1.5&&this.disposeNow():(this.releasing=e.context.currentTime,e.out.gain.setTargetAtTime(0,e.context.currentTime,.25)))}disposeNow(){let e=this.graph;if(!e)return;this.graph=null,this.releasing=0;let t=e.context.currentTime;e.sources.forEach(e=>{try{e.stop(t+.05)}catch{}}),window.setTimeout(()=>e.nodes.forEach(e=>e.disconnect()),200)}build(e,t){let r=[],a=[],i=e.createGain();i.gain.value=0,i.connect(t);let n=e.createBiquadFilter();n.type="bandpass",n.frequency.value=1250,n.Q.value=.85;let o=e.createBiquadFilter();o.type="peaking",o.frequency.value=2500,o.gain.value=5,n.connect(o).connect(i);let l=e.createBiquadFilter();l.type="bandpass",l.frequency.value=2200,l.Q.value=1.2,l.connect(i);let s=e.createOscillator();s.frequency.value=5.4;let u=e.createGain();u.gain.value=7,s.connect(u),s.start(),r.push(s);let c=e.createBiquadFilter();c.type="lowpass",c.frequency.value=700;let f=e.createGain();for(let t of(f.gain.value=1e-4,f.gain.setTargetAtTime(.03,e.currentTime,.8),c.connect(f).connect(i),[v(45),1.004*v(45),v(52)])){let a=e.createOscillator();a.type="sawtooth",a.frequency.value=t,a.connect(c),a.start(),r.push(a)}a.push(i,n,o,l,s,u,c,f);let m=e.currentTime+.15;return{context:e,out:i,reed:n,pipe:l,vibrato:u,sources:r,nodes:a,nextAt:m,beatInLoop:0,index:0,nextStomp:m,stompBeat:0}}beat(){return 60/(124*this.hurry)}tone(e,t,r,a,i,n,o,l=0){let{context:s}=e,u=s.createOscillator();u.type=t,u.frequency.value=r,u.detune.value=l,e.vibrato.connect(u.frequency);let c=s.createGain();c.gain.setValueAtTime(1e-4,a),c.gain.exponentialRampToValueAtTime(o,a+.018),c.gain.setValueAtTime(.85*o,a+Math.max(.03,.8*i)),c.gain.exponentialRampToValueAtTime(1e-4,a+i+.06),u.connect(c).connect(n),u.start(a),u.stop(a+i+.1),p(u,[u,c]),u.addEventListener("ended",()=>{try{e.vibrato.disconnect(u.frequency)}catch{}},{once:!0})}schedule(e,t){let r=this.beat(),a=e.context.currentTime;for(e.nextAt<a&&(e.nextAt=a+.08),e.nextStomp<a&&(e.nextStomp=a+.08);e.nextAt<t;){let[t,a]=d[e.index],i=e.nextAt,n=a*r;if(null!==t){let r=h.some(([t,r])=>e.beatInLoop>=t&&e.beatInLoop<r);r||(a>=1&&this.tone(e,"sawtooth",v(t-10),i-.05,.035,e.reed,.05),this.tone(e,"sawtooth",v(t-12),i,.92*n,e.reed,.075),this.tone(e,"square",v(t-12),i,.92*n,e.reed,.035,5)),this.tone(e,"square",v(t),i,.9*n,e.pipe,r?.05:.032,-4)}e.nextAt+=n,e.beatInLoop+=a,e.index+=1,e.index>=d.length&&(e.index=0,e.beatInLoop=0)}for(;e.nextStomp<t;){let t=e.nextStomp,a=e.stompBeat%2==0,{context:i}=e,n=i.createOscillator();n.type="sine",n.frequency.setValueAtTime(a?105:130,t),n.frequency.exponentialRampToValueAtTime(48,t+.11);let o=i.createGain();o.gain.setValueAtTime(1e-4,t),o.gain.exponentialRampToValueAtTime(a?.16:.07,t+.006),o.gain.exponentialRampToValueAtTime(1e-4,t+.18),n.connect(o).connect(e.out),n.start(t),n.stop(t+.22),p(n,[n,o]),e.nextStomp+=r,e.stompBeat=(e.stompBeat+1)%4}}}var y=e.i(95924),b=e.i(98999);let x=`
attribute vec2 aCorner;
attribute vec4 aFlame;
uniform float uFire;
uniform float uTime;
varying vec2 vCorner;
varying float vPhase;
void main() {
  vCorner = aCorner;
  vPhase = aFlame.w;
  float height = aFlame.z * uFire * (0.86 + 0.14 * sin(uTime * 6.0 + aFlame.w * 5.0));
  vec3 base = position + vec3(aFlame.x, 0.0, aFlame.y);
  vec4 world = modelMatrix * vec4(base, 1.0);
  // Panneau tourn\xe9 vers la cam\xe9ra autour de la verticale.
  vec2 toCamera = normalize(cameraPosition.xz - world.xz + vec2(1e-4, 0.0));
  // (Sens choisi pour que le panneau pr\xe9sente sa face avant \xe0 la cam\xe9ra.)
  vec3 right = vec3(toCamera.y, 0.0, -toCamera.x);
  world.xyz += right * aCorner.x * height * 0.36 + vec3(0.0, aCorner.y * height, 0.0);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`,w=`
uniform float uTime;
uniform float uFire;
varying vec2 vCorner;
varying float vPhase;
float flameHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float flameNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(flameHash(i), flameHash(i + vec2(1.0, 0.0)), f.x), mix(flameHash(i + vec2(0.0, 1.0)), flameHash(i + 1.0), f.x), f.y);
}
void main() {
  // Langue de feu de dessin anim\xe9 : trois couches nettes (rouge, orange, cœur jaune p\xe2le).
  float y = vCorner.y;
  float wobble = sin(y * 5.0 - uTime * 7.5 + vPhase * 3.0) * 0.16 * y;
  float width = (1.0 - y) * (0.55 + 0.45 * sqrt(max(1.0 - y, 0.0))) * smoothstep(0.0, 0.12, y + 0.06);
  float n = flameNoise(vec2(vCorner.x * 2.0 + vPhase, y * 3.0 - uTime * 3.2));
  float d = abs(vCorner.x + wobble) / max(width, 0.001) + (n - 0.5) * 0.45 * y;
  float body = 1.0 - smoothstep(0.9, 1.0, d);
  if (body < 0.01) discard;
  vec3 color = vec3(1.0, 0.36, 0.12);
  color = mix(color, vec3(1.0, 0.66, 0.2), smoothstep(0.7, 0.62, d));
  color = mix(color, vec3(1.0, 0.94, 0.66), smoothstep(0.4, 0.32, d + y * 0.25));
  gl_FragColor = vec4(color, body * uFire);
  #include <colorspace_fragment>
}
`,T=`
attribute float aSeed;
uniform float uTime;
uniform float uFire;
varying float vLife;
void main() {
  float life = fract(uTime * (0.32 + aSeed * 0.25) + aSeed * 7.3);
  vLife = life;
  vec3 p = position;
  p.x += sin(aSeed * 40.0 + uTime * 1.3) * 0.22 * life;
  p.z += cos(aSeed * 23.0 + uTime * 1.1) * 0.22 * life;
  p.y += 0.25 + life * 1.9;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.0 - life) * uFire * 90.0 / max(1.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`,A=`
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  vec3 color = mix(vec3(1.0, 0.86, 0.45), vec3(1.0, 0.35, 0.1), vLife);
  gl_FragColor = vec4(color, (1.0 - smoothstep(0.2, 0.5, d)) * (1.0 - vLife));
  #include <colorspace_fragment>
}
`,M=`
varying vec2 vLocal;
void main() {
  vLocal = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,F=`
uniform float uFire;
varying vec2 vLocal;
void main() {
  float r = length(vLocal) / 3.6;
  float glow = exp(-r * r * 2.4) * (1.0 - smoothstep(0.7, 1.0, r));
  gl_FragColor = vec4(vec3(1.0, 0.6, 0.26), glow * uFire * 0.9);
  #include <colorspace_fragment>
}
`,C=`
attribute vec3 aOffset;
attribute vec3 aTint;
attribute float aOn;
uniform float uNight;
uniform float uTime;
varying vec2 vUv;
varying vec3 vTint;
varying float vLit;
void main() {
  vUv = uv;
  vTint = aTint;
  vLit = smoothstep(aOn, aOn + 0.05, uNight) * (0.85 + 0.15 * sin(uTime * 5.3 + aOn * 97.0));
  vec4 mv = modelViewMatrix * vec4(aOffset, 1.0);
  mv.xy += position.xy * 1.15;
  gl_Position = projectionMatrix * mv;
}
`,B=`
varying vec2 vUv;
varying vec3 vTint;
varying float vLit;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float glow = exp(-dot(p, p) * 4.5);
  if (glow * vLit < 0.01) discard;
  gl_FragColor = vec4(mix(vTint, vec3(1.0, 0.92, 0.75), 0.45), glow * vLit * 0.85);
  #include <colorspace_fragment>
}
`,O=(0,b.fireLitMaterial)("players"),S=(0,b.dancerMaterial)(),L=new n.Vector3,P=new n.Matrix4;e.s(["default",0,function({layout:e,isletX:v,isletZ:d}){let h=(0,f.useWorld)(e=>e.quality),p=(0,i.useThree)(e=>e.clock),R=(0,r.useRef)(null),q=(0,r.useRef)(null),U=(0,r.useRef)([]),j=(0,r.useRef)(null),E=(0,r.useRef)(null),k=(0,r.useRef)(null),_=(0,r.useRef)(null),I=(0,r.useRef)({beat:0,ring:0,spinUntil:-10,fire:0,audioClock:0}),G=(0,r.useRef)(null),N="low"===h?8:10,V=(0,r.useMemo)(()=>{let t,r,a,i,o,l,s,u,c,f,v,d,h,p;return{dancers:function(e){let t=(0,y.dancerGeometry)(),r=new Float32Array(4*e),a=new Float32Array(3*e),i=new Float32Array(3*e),o=new n.Color;for(let t=0;t<e;t++)r.set([t,(0,m.hash)(4.7*t+.3),t%2,.34+7*t%e/e*.24],4*t),o.set(y.DANCER_TOPS[t%y.DANCER_TOPS.length]).toArray(a,3*t),o.set(y.DANCER_BOTTOMS[t%y.DANCER_BOTTOMS.length]).toArray(i,3*t);return t.setAttribute("aDancer",new n.InstancedBufferAttribute(r,4)),t.setAttribute("aTop",new n.InstancedBufferAttribute(a,3)),t.setAttribute("aBottom",new n.InstancedBufferAttribute(i,3)),t}(N),bombarde:(0,y.playerGeometry)("bombarde"),biniou:(0,y.playerGeometry)("biniou"),flames:(r=[[-1,0],[1,0],[1,1],[-1,1]],a=new Float32Array(12*(t=[[0,0,1.35,.1],[.14,.08,.95,1.7],[-.13,.06,.88,3.1],[.04,-.14,1,4.4],[-.07,-.03,.72,5.6],[.09,-.04,.6,2.4]]).length),i=new Float32Array(8*t.length),o=new Float32Array(16*t.length),l=[],t.forEach((e,t)=>{r.forEach((r,a)=>{i.set(r,(4*t+a)*2),o.set(e,(4*t+a)*4)}),l.push(4*t,4*t+1,4*t+2,4*t,4*t+2,4*t+3)}),(s=new n.BufferGeometry).setAttribute("position",new n.BufferAttribute(a,3)),s.setAttribute("aCorner",new n.BufferAttribute(i,2)),s.setAttribute("aFlame",new n.BufferAttribute(o,4)),s.setIndex(l),s),embers:function(){let e=new n.BufferGeometry,t=new Float32Array(54),r=new Float32Array(18);for(let e=0;e<18;e++)t.set([((0,m.hash)(3.1*e)-.5)*.3,0,((0,m.hash)(5.7*e)-.5)*.3],3*e),r[e]=(0,m.hash)(9.3*e+1.1);return e.setAttribute("position",new n.BufferAttribute(t,3)),e.setAttribute("aSeed",new n.BufferAttribute(r,1)),e}(),pool:new n.CircleGeometry(3.6,32).rotateX(-Math.PI/2),halos:(u=new n.PlaneGeometry(1,1),(c=new n.InstancedBufferGeometry).index=u.index,c.setAttribute("position",u.getAttribute("position")),c.setAttribute("uv",u.getAttribute("uv")),v=new Float32Array(3*(f=e.lampions.length)),d=new Float32Array(3*f),h=new Float32Array(f),p=new n.Color,e.lampions.forEach((e,t)=>{v.set(e.at,3*t),p.set(e.color).toArray(d,3*t),h[t]=e.on}),c.setAttribute("aOffset",new n.InstancedBufferAttribute(v,3)),c.setAttribute("aTint",new n.InstancedBufferAttribute(d,3)),c.setAttribute("aOn",new n.InstancedBufferAttribute(h,1)),c.instanceCount=f,c)}},[N,e]),z=(0,r.useMemo)(()=>{let e=(e,t,r)=>new n.ShaderMaterial({uniforms:r,vertexShader:e,fragmentShader:t,transparent:!0,depthWrite:!1,blending:n.AdditiveBlending,fog:!1});return{flames:e(x,w,{uFire:{value:0},uTime:{value:0}}),embers:e(T,A,{uFire:{value:0},uTime:{value:0}}),pool:e(M,F,{uFire:{value:0}}),halos:e(C,B,{uNight:{value:0},uTime:{value:0}})}},[]);(0,r.useEffect)(()=>()=>Object.values(V).forEach(e=>e.dispose()),[V]),(0,r.useEffect)(()=>()=>Object.values(z).forEach(e=>e.dispose()),[z]),(0,r.useEffect)(()=>{let e=q.current;if(e){for(let t=0;t<e.count;t++)e.setMatrixAt(t,P);e.instanceMatrix.needsUpdate=!0}},[N]),(0,r.useEffect)(()=>{let e=new g;return G.current=e,()=>{e.dispose(),G.current=null,b.fireUniforms.uFireGlow.value=0}},[]),(0,a.useFrame)((t,r)=>{let a=Math.min(r,1/30),i=t.clock.elapsedTime,n=c.skyState.dayNight,{reducedMotion:o}=f.useWorld.getState(),l=I.current,u=(0,m.smoothstep)(0,1.2,l.spinUntil-i),h=1+.55*u;o||(l.beat+=124/60*a*h,l.ring+=.16*a*(1+3*u)),l.fire=(0,m.damp)(l.fire,(0,m.smoothstep)(.25,.45,n),2.5,a);let p=.82+.1*Math.sin(11.3*i)+.08*Math.sin(17.9*i+1.3);b.danceUniforms.uBeat.value=l.beat,b.danceUniforms.uRing.value=l.ring,b.danceUniforms.uPresence.value=n,b.danceUniforms.uCenter.value.set(0,0,0),b.danceUniforms.uRadius.value=e.radius,b.danceUniforms.uCount.value=N,b.danceUniforms.uMotion.value=+!o;let g=R.current;g&&(L.set(e.center[0],e.center[1]+.45,e.center[2]),g.localToWorld(L).applyMatrix4(t.camera.matrixWorldInverse),b.fireUniforms.uFireView.value.copy(L)),b.fireUniforms.uFireGlow.value=l.fire*p*2.6;let y=l.fire*(o?1:p);for(let e of[j.current,E.current,k.current]){let t=e?.material;t&&(t.uniforms.uFire.value=y,t.uniforms.uTime&&(t.uniforms.uTime.value=o?0:i))}j.current&&(j.current.visible=l.fire>.01),E.current&&(E.current.visible=l.fire>.01&&!o),k.current&&(k.current.visible=l.fire>.01);let x=_.current?.material;x&&(x.uniforms.uNight.value=n,x.uniforms.uTime.value=i);let w=(0,m.smoothstep)(.28,.4,n);if(U.current.forEach((t,r)=>{if(!t)return;let a=l.beat*Math.PI+.7*r,i=w<1?Math.min(1,1.15*w):1;t.visible=w>.01,t.scale.setScalar(i);let n=+!o;t.position.y=e.players[r].at[1]+.025*Math.abs(Math.sin(a))*n,t.rotation.set((0===r?-.08-.06*Math.sin(.25*l.beat*Math.PI):.03)*n,e.players[r].yaw+.08*Math.sin(.5*a)*n,.05*Math.sin(.5*a)*n)}),l.audioClock+=a,l.audioClock>.2&&G.current){l.audioClock=0;let t=Math.hypot(s.boatState.position.x-(v+e.center[0]),s.boatState.position.z-(d+e.center[2]));G.current.hurry=h,G.current.update((1-(0,m.smoothstep)(12,50,t))*w)}});let[D,H,W]=e.center;return(0,t.jsxs)("group",{ref:R,children:[(0,t.jsxs)(o.Hotspot,{position:[D,H,W],hoverScale:1.04,onActivate:()=>{I.current.spinUntil=p.elapsedTime+4,l.ambience.chime([659,784,988,1319],.08),u.logbook.stamp("festnoz")},children:[(0,t.jsx)("instancedMesh",{ref:q,args:[V.dancers,S,N],frustumCulled:!1,raycast:()=>null}),(0,t.jsx)("mesh",{"position-y":.55,visible:!1,children:(0,t.jsx)("cylinderGeometry",{args:[e.radius+.45,e.radius+.45,1.1,12]})})]}),e.players.map((e,r)=>(0,t.jsx)("group",{ref:e=>{U.current[r]=e},position:e.at,visible:!1,children:(0,t.jsx)("mesh",{geometry:"bombarde"===e.kind?V.bombarde:V.biniou,material:O,raycast:()=>null})},e.kind)),(0,t.jsx)("mesh",{ref:j,geometry:V.flames,material:z.flames,position:[D,H+.04,W],renderOrder:8,frustumCulled:!1,visible:!1,raycast:()=>null}),"low"!==h&&(0,t.jsx)("points",{ref:E,geometry:V.embers,material:z.embers,position:[D,H,W],renderOrder:8,frustumCulled:!1,visible:!1,raycast:()=>null}),(0,t.jsx)("mesh",{ref:k,geometry:V.pool,material:z.pool,position:[D,H+.06,W],renderOrder:4,visible:!1,raycast:()=>null}),"low"!==h&&(0,t.jsx)("mesh",{ref:_,geometry:V.halos,material:z.halos,renderOrder:9,frustumCulled:!1,raycast:()=>null})]})}],10770)}]);