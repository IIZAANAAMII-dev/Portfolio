(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,38817,e=>{"use strict";var t=e.i(43476),a=e.i(71645),o=e.i(94800),r=e.i(48546),n=e.i(90072),i=e.i(58158),l=e.i(64803),s=e.i(95924),u=e.i(60284),d=e.i(98999);let c=(0,d.fireLitMaterial)("setup"),f=(0,d.lampionMaterial)();function m({layout:e}){let r=(0,a.useRef)(null),i=(0,a.useMemo)(()=>(0,s.setupGeometry)(e),[e]),l=(0,a.useMemo)(()=>{let t=(0,s.lampionGeometry)();return t.setAttribute("aOn",new n.InstancedBufferAttribute(new Float32Array(e.lampions.map(e=>e.on)),1)),t},[e]);return(0,a.useEffect)(()=>()=>i.dispose(),[i]),(0,a.useEffect)(()=>()=>l.dispose(),[l]),(0,a.useLayoutEffect)(()=>{let t=r.current;if(!t)return;let a=new n.Object3D,o=new n.Color;e.lampions.forEach((e,r)=>{a.position.set(e.at[0],e.at[1],e.at[2]),a.rotation.set(0,1.3*r,0),a.scale.setScalar(.9+7*r%5*.06),a.updateMatrix(),t.setMatrixAt(r,a.matrix),t.setColorAt(r,o.set(e.color))}),t.instanceMatrix.needsUpdate=!0,t.instanceColor&&(t.instanceColor.needsUpdate=!0),t.computeBoundingSphere()},[e]),(0,o.useFrame)(e=>{d.lampionUniforms.uNight.value=u.skyState.dayNight,d.lampionUniforms.uTime.value=e.clock.elapsedTime}),(0,t.jsxs)("group",{children:[(0,t.jsx)("mesh",{geometry:i,material:c,castShadow:!0,receiveShadow:!0,raycast:()=>null}),(0,t.jsx)("instancedMesh",{ref:r,args:[l,f,e.lampions.length],raycast:()=>null})]})}var h=e.i(29778),p=e.i(61876),g=e.i(76432),v=e.i(43066),y=e.i(17448),x=e.i(29236),w=e.i(27225),b=e.i(49184);let M=(0,a.lazy)(()=>e.A(22388)),S={x:-10.4,z:2.6,yaw:Math.PI/2,length:3.4,width:1.8,top:.55},C=new n.MeshStandardMaterial({color:"#e0a296",roughness:.9,flatShading:!0});function G(){let e=document.createElement("canvas");e.width=384,e.height=256;let t=e.getContext("2d"),a=e.height/9;for(let o=0;o<9;o++)t.fillStyle=o%2==0?"#121212":"#f6f2ea",t.fillRect(0,o*a,e.width,a+1);let o=.42*e.width,r=5*a;t.fillStyle="#f6f2ea",t.fillRect(0,0,o,r),[4,3,4].forEach((e,a)=>{for(let s=0;s<e;s++){var n=o*(4===e?(s+.5)/4:(s+1)/4),i=r*(a+.52)/3,l=.26*r;for(let[e,a]of(t.fillStyle="#121212",[[0,-.44],[-.21,-.3],[.21,-.3]]))t.beginPath(),t.arc(n+e*l,i+a*l,.1*l,0,2*Math.PI),t.fill();t.beginPath(),t.moveTo(n,i-.24*l),t.quadraticCurveTo(n+.09*l,i+.1*l,n+.27*l,i+.46*l),t.lineTo(n+.1*l,i+.35*l),t.lineTo(n,i+.52*l),t.lineTo(n-.1*l,i+.35*l),t.lineTo(n-.27*l,i+.46*l),t.quadraticCurveTo(n-.09*l,i+.1*l,n,i-.24*l),t.fill()}});let i=new n.CanvasTexture(e);return i.colorSpace=n.SRGBColorSpace,i.anisotropy=4,i}let P={value:0};function j({position:e}){let n=(0,a.useRef)({strength:0,speed:.7,angle:2.4}),i=(0,a.useRef)(null),l=(0,a.useRef)(-10),s=(0,r.useThree)(e=>e.clock);return(0,o.useFrame)(e=>{let t=u.skyState.dayNight,a=Math.max(0,1-(e.clock.elapsedTime-l.current)/4.5),o=n.current;o.strength=Math.max(.8*t,.75*a),o.speed=.7+3.2*a,i.current&&(i.current.material.emissiveIntensity=.6+3.2*Math.max(t,a)+.15*Math.sin(2.2*e.clock.elapsedTime))}),(0,t.jsxs)("group",{position:e,onClick:e=>{e.stopPropagation(),l.current=s.elapsedTime,y.ambience.chime([523,659,784,1047],.09),x.logbook.stamp("lighthouse")},children:[(0,t.jsxs)("mesh",{castShadow:!0,receiveShadow:!0,"position-y":2.6,children:[(0,t.jsx)("cylinderGeometry",{args:[.62,.92,5.2,14]}),(0,t.jsx)("meshStandardMaterial",{color:"#f3eee4",roughness:.75})]}),(0,t.jsxs)("mesh",{castShadow:!0,"position-y":3.9,children:[(0,t.jsx)("cylinderGeometry",{args:[.71,.75,.62,14]}),(0,t.jsx)("meshStandardMaterial",{color:"#1b1d22",roughness:.6})]}),(0,t.jsxs)("mesh",{castShadow:!0,"position-y":5.26,children:[(0,t.jsx)("cylinderGeometry",{args:[1.02,1.02,.14,14]}),(0,t.jsx)("meshStandardMaterial",{color:"#2a2c33",roughness:.5,metalness:.4})]}),(0,t.jsxs)("mesh",{ref:i,"position-y":5.78,children:[(0,t.jsx)("cylinderGeometry",{args:[.5,.5,.86,10]}),(0,t.jsx)("meshStandardMaterial",{color:"#fff2cf",emissive:"#ffc76e",emissiveIntensity:.6,roughness:.2})]}),(0,t.jsxs)("mesh",{castShadow:!0,"position-y":6.5,children:[(0,t.jsx)("coneGeometry",{args:[.66,.66,10]}),(0,t.jsx)("meshStandardMaterial",{color:"#c8382f",roughness:.55})]}),(0,t.jsxs)("mesh",{"position-y":6.92,children:[(0,t.jsx)("sphereGeometry",{args:[.1,8,6]}),(0,t.jsx)("meshStandardMaterial",{color:"#2a2c33",roughness:.4,metalness:.6})]}),(0,t.jsx)(g.SweepBeam,{id:"breizh",controlRef:n,count:1,length:28,radius:2.6,tilt:.08,position:[0,5.78,0]})]})}function T({position:e,rotation:r}){let i=(0,a.useMemo)(()=>{var e;let t;return e=G(),(t=new n.MeshStandardMaterial({map:e,side:n.DoubleSide,roughness:.92})).onBeforeCompile=e=>{e.uniforms.uTime=P,e.vertexShader=e.vertexShader.replace("#include <common>","#include <common>\nuniform float uTime;").replace("#include <begin_vertex>",`#include <begin_vertex>
        // Le drapeau ondule \xe0 partir de la hampe (x = 0), libre au bout.
        float flagFree = clamp(position.x / 2.10, 0.0, 1.0);
        float flagWave = sin(position.x * 3.4 - uTime * 4.6) * 0.16 + sin(position.x * 6.1 - uTime * 7.3 + position.y * 2.0) * 0.05;
        transformed.z += flagWave * flagFree;
        transformed.y -= flagFree * flagFree * 0.1;`)},t.customProgramCacheKey=()=>"gwenn-ha-du-v1",t},[]),l=(0,a.useMemo)(()=>new n.PlaneGeometry(2.1,1.4,16,6).translate(1.05,0,0),[]);return(0,o.useFrame)(e=>{P.value=e.clock.elapsedTime}),(0,t.jsxs)("group",{position:e,"rotation-y":r,children:[(0,t.jsxs)("mesh",{castShadow:!0,"position-y":2,children:[(0,t.jsx)("cylinderGeometry",{args:[.05,.07,4,6]}),(0,t.jsx)("meshStandardMaterial",{color:"#e9e3d6",roughness:.6})]}),(0,t.jsxs)("mesh",{"position-y":4.04,children:[(0,t.jsx)("sphereGeometry",{args:[.1,8,6]}),(0,t.jsx)("meshStandardMaterial",{color:"#d4a74a",roughness:.35,metalness:.6})]}),(0,t.jsx)("mesh",{geometry:l,material:i,castShadow:!0,position:[.05,3.25,0]})]})}function B({sampler:e,start:o,direction:r}){let i=(0,a.useMemo)(()=>{let e=new n.BoxGeometry(.85,1,.55,2,4,2),t=e.attributes.position;for(let e=0;e<t.count;e++){let a=t.getY(e),o=1-(a+.5)*.35;t.setX(e,t.getX(e)*o+((0,b.hash)(1.7*e)-.5)*.08),t.setZ(e,t.getZ(e)*o+((0,b.hash)(2.9*e)-.5)*.08),a>.4&&t.setY(e,a-.4*Math.abs(t.getX(e)))}return e.translate(0,.5,0),e.computeVertexNormals(),e},[]),s=(0,a.useMemo)(()=>Array.from({length:5},(t,a)=>{let n=o[0]+Math.cos(r)*a*1.25,i=o[1]+Math.sin(r)*a*1.25;return{position:[n,(0,l.groundAt)(e,n,i,.4)-.15,i],height:2.5-.32*a,tilt:((0,b.hash)(4.1*a+2)-.5)*.12,yaw:(0,b.hash)(3.3*a)*Math.PI}}),[r,e,o]);return(0,t.jsx)("group",{children:s.map((e,a)=>(0,t.jsx)("mesh",{geometry:i,position:e.position,rotation:[e.tilt,e.yaw,.6*e.tilt],scale:[1,e.height,1],castShadow:!0,receiveShadow:!0,children:(0,t.jsx)("meshStandardMaterial",{color:"#a19d96",roughness:.95,flatShading:!0})},a))})}function z({sampler:e,radius:o,seed:r}){let i=(0,a.useRef)(null),l=(0,a.useMemo)(()=>{let e=new n.IcosahedronGeometry(1,1),t=e.attributes.position;for(let e=0;e<t.count;e++){let a=.82+.3*(0,b.hash)(Math.round(7*t.getX(e)+13*t.getY(e)+17*t.getZ(e)));t.setXYZ(e,t.getX(e)*a,t.getY(e)*a*.72,t.getZ(e)*a)}return e.computeVertexNormals(),e},[]),s=(0,a.useMemo)(()=>new n.MeshStandardMaterial({color:"#e0a296",roughness:.9,flatShading:!0}),[]);return(0,a.useLayoutEffect)(()=>{let t=i.current;if(!t)return;let a=new n.Object3D,l=new n.Color;for(let n=0;n<9;n++){let i=n/9*Math.PI*2+.5*(0,b.hash)(r+n),s=o*(.92+.16*(0,b.hash)(r+2.1*n)),u=Math.cos(i)*s,d=Math.sin(i)*s,c=.55+.75*(0,b.hash)(r+3.7*n);a.position.set(u,e(u,d)-.25*c,d),a.rotation.set(0,(0,b.hash)(r+5.1*n)*Math.PI*2,((0,b.hash)(r+6.3*n)-.5)*.4),a.scale.set(1.25*c,c,c),a.updateMatrix(),t.setMatrixAt(n,a.matrix),t.setColorAt(n,l.set("#ffffff").multiplyScalar(.85+.25*(0,b.hash)(r+7.7*n)))}t.instanceMatrix.needsUpdate=!0,t.instanceColor&&(t.instanceColor.needsUpdate=!0),t.computeBoundingSphere()},[o,e,r]),(0,t.jsx)("instancedMesh",{ref:i,args:[l,s,9],castShadow:!0,receiveShadow:!0})}e.s(["BreizhDecor",0,function({islet:e,sampler:o,features:r}){let n=(0,a.useContext)(i.ClearingContext),u=(0,w.useWorld)(e=>e.quality),d=(0,p.useNightGate)(),{hillX:c,hillZ:f}=r,g=(0,l.groundAt)(o,c,f,1)-.1,y=[c,g,f],x=c+2.1,b=f+1.2,G=[-(.5*e.radius),.12*e.radius],P=(0,a.useMemo)(()=>(0,s.festLayout)(o,[c,g,f],u),[c,f,u,o,g]),R=(0,a.useMemo)(()=>(0,v.wordRockGroup)(e.seed+.7,S.length,S.width,S.top),[e.seed]);return(0,a.useEffect)(()=>()=>R.dispose(),[R]),(0,a.useLayoutEffect)(()=>{let e=(0,i.addClearing)(n,c,f,1.4),t=(0,i.addClearing)(n,x,b,.4),a=(0,i.addClearing)(n,P.center[0],P.center[2],P.radius+.55),o=(0,i.addClearing)(n,P.stage.x,P.stage.z,1);return()=>{e?.(),t?.(),a?.(),o?.()}},[n,P,x,b,c,f]),(0,t.jsxs)("group",{children:[(0,t.jsx)(j,{position:y}),(0,t.jsx)(T,{position:[x,(0,l.groundAt)(o,x,b,.3)-.05,b],rotation:-.6}),(0,t.jsx)(B,{sampler:o,start:G,direction:-.95}),(0,t.jsx)(z,{sampler:o,radius:e.radius,seed:e.seed}),(0,t.jsx)(m,{layout:P}),(0,t.jsx)("mesh",{geometry:R,material:C,position:[S.x,0,S.z],"rotation-y":S.yaw,castShadow:!0,receiveShadow:!0,raycast:()=>null}),d&&(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(h.GlowWord,{text:"Mor",beam:"breizh",position:[S.x,S.top+.015,S.z],rotation:S.yaw,width:.8*S.length}),(0,t.jsx)(a.Suspense,{fallback:null,children:(0,t.jsx)(M,{layout:P,isletX:e.position[0],isletZ:e.position[1]})})]})]})},"gwennHaDu",0,G],38817)},29778,15079,61876,76432,43066,e=>{"use strict";var t=e.i(43476),a=e.i(71645),o=e.i(94800),r=e.i(90072),n=e.i(55448),i=e.i(60284),l=e.i(49184);let s=new Map;e.s(["beamLight",0,function(e,t,a=0){let o=0;return s.forEach(r=>{var n;let i,s;if(r.strength<.01)return;let u=e-r.x,d=t-r.z,c=Math.hypot(u,d);if(c>r.reach||c<.5)return;let f=r.spread+Math.atan2(a,c),m=(n=Math.atan2(d,u),i=2*Math.PI/r.count,Math.min(s=((n-r.bearing)%i+i)%i,i-s)),h=(1-(0,l.smoothstep)(.55*f,f,m))*(1-(0,l.smoothstep)(.8*r.reach,r.reach,c))*r.strength;h>o&&(o=h)}),o},"beams",0,s],15079);let u=`
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`,d=`
uniform sampler2D uMap;
uniform vec2 uLamp;
uniform float uBearing;
uniform float uSpin;
uniform float uCount;
uniform float uSpread;
uniform float uStrength;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vec4 paint = texture2D(uMap, vUv);
  if (paint.a < 0.01) discard;
  vec2 rel = vWorld.xz - uLamp;
  float sector = 6.2831853 / uCount;
  // Angle parcouru par le faisceau depuis son dernier passage sur ce point → temps \xe9coul\xe9.
  float swept = mod((uBearing - atan(rel.y, rel.x)) * sign(uSpin), sector);
  float since = swept / max(abs(uSpin), 0.05);
  float charge = exp(-since / 2.4);
  float inBeam = exp(-pow(min(swept, sector - swept) / max(uSpread, 0.02), 2.0));
  float shimmer = 0.92 + 0.08 * sin(uTime * 3.1 + vWorld.x * 1.7 + vWorld.z * 1.3);
  float glow = clamp(charge * 0.9 * shimmer + inBeam * 0.55, 0.0, 1.3) * uStrength;
  // Cœur des lettres plus blanc, halo dor\xe9.
  vec3 color = mix(uColor, vec3(1.0, 0.98, 0.92), smoothstep(0.75, 1.0, paint.a) * (0.35 + 0.5 * inBeam));
  gl_FragColor = vec4(color, paint.a * glow);
  #include <colorspace_fragment>
}
`;function c(e=.08,t=.03){let[r,n]=(0,a.useState)(()=>i.skyState.dayNight>e);return(0,o.useFrame)(()=>{let a=i.skyState.dayNight;!r&&a>e?n(!0):r&&a<t&&n(!1)}),r}e.s(["GlowWord",0,function({text:e,beam:c,position:f,rotation:m=0,width:h,color:p="#ffd98c"}){let g=(0,a.useRef)(null),[v,y]=(0,a.useState)(null);(0,a.useEffect)(()=>{let e=!1;return(0,n.loadHandFont)().then(t=>{e||y(t)}),()=>{e=!0}},[]);let x=(0,a.useMemo)(()=>{let t,a,o,n,i;return v?((t=document.createElement("canvas")).width=1024,t.height=256,(a=t.getContext("2d")).textAlign="center",a.textBaseline="middle",o=200,a.font=`500 ${o}px ${v}`,(n=a.measureText(e).width)>880&&(o=Math.floor(880*o/n)),a.font=`500 ${o}px ${v}`,a.lineJoin="round",a.fillStyle="rgba(255, 255, 255, 0.5)",a.strokeStyle="rgba(255, 255, 255, 0.5)",a.lineWidth=10,a.shadowColor="rgba(255, 255, 255, 0.95)",a.shadowBlur=34,a.fillText(e,512,136),a.shadowBlur=12,a.strokeText(e,512,136),a.shadowBlur=0,a.fillStyle="#ffffff",a.strokeStyle="#ffffff",a.lineWidth=7,a.strokeText(e,512,136),a.fillText(e,512,136),(i=new r.CanvasTexture(t)).colorSpace=r.SRGBColorSpace,i.anisotropy=4,i):null},[v,e]),w=(0,a.useMemo)(()=>new r.PlaneGeometry(h,h/4).rotateX(-Math.PI/2),[h]),b=(0,a.useMemo)(()=>new r.ShaderMaterial({uniforms:{uMap:{value:null},uLamp:{value:new r.Vector2},uBearing:{value:0},uSpin:{value:.5},uCount:{value:1},uSpread:{value:.1},uStrength:{value:0},uTime:{value:0},uColor:{value:new r.Color(p)}},vertexShader:u,fragmentShader:d,transparent:!0,depthWrite:!1,blending:r.AdditiveBlending,fog:!1,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),[p]);return(0,a.useEffect)(()=>()=>x?.dispose(),[x]),(0,a.useEffect)(()=>()=>w.dispose(),[w]),(0,a.useEffect)(()=>()=>b.dispose(),[b]),(0,o.useFrame)(e=>{let t=g.current;if(!t)return;let a=s.get(c),o=a?a.strength*(0,l.smoothstep)(.3,.7,i.skyState.dayNight):0;if(t.visible=o>.01&&null!==x,!t.visible||!a)return;let r=t.material.uniforms;r.uMap.value=x,r.uLamp.value.set(a.x,a.z),r.uBearing.value=a.bearing,r.uSpin.value=a.spin,r.uCount.value=a.count,r.uSpread.value=a.spread,r.uStrength.value=o,r.uTime.value=e.clock.elapsedTime}),(0,t.jsx)("mesh",{ref:g,geometry:w,material:b,position:f,"rotation-y":m,renderOrder:6,visible:!1,raycast:()=>null})}],29778),e.s(["NightOnly",0,function({children:e}){return c()?e:null},"useNightGate",0,c],61876);var f=e.i(52260),m=e.i(27225);let h=`
float beamHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float beamNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(beamHash(i), beamHash(i + vec2(1.0, 0.0)), f.x),
             mix(beamHash(i + vec2(0.0, 1.0)), beamHash(i + 1.0), f.x), f.y);
}
`,p=`
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vView;
varying vec3 vNormalView;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mv = viewMatrix * world;
  vView = -mv.xyz;
  vNormalView = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}
`,g=`
uniform float uStrength;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vView;
varying vec3 vNormalView;
${h}
void main() {
  // uv.y = 1 \xe0 la lanterne, 0 au bout du c\xf4ne.
  float along = vUv.y;
  float body = smoothstep(0.0, 0.6, along) * (0.45 + 0.55 * along);
  // Vu de biais, le bord du c\xf4ne s'efface : un volume de lumi\xe8re, pas un cornet.
  float facing = abs(dot(normalize(vNormalView), normalize(vView)));
  float soft = smoothstep(0.06, 0.7, facing);
  // Embruns qui d\xe9rivent dans le faisceau : il balaie une brume vivante.
  float mist = beamNoise(vWorld.xz * 0.3 + vec2(uTime * 0.32, uTime * 0.11)) * 0.6
    + beamNoise(vWorld.xz * 0.85 - vec2(uTime * 0.21, -uTime * 0.17)) * 0.4;
  float aboveSea = smoothstep(0.15, 1.3, vWorld.y);
  float alpha = body * soft * (0.45 + 0.75 * mist) * aboveSea * uStrength * 0.4;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
`,v=`
attribute vec2 aBeam;
varying vec2 vBeam;
varying vec3 vWorld;
void main() {
  vBeam = aBeam;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`,y=`
uniform float uStrength;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vBeam;
varying vec3 vWorld;
${h}
void main() {
  // x : 0 au pied du phare → 1 au bout ; y : -1..1 d'un bord \xe0 l'autre.
  float across = exp(-vBeam.y * vBeam.y * 2.6);
  float reach = smoothstep(0.02, 0.3, vBeam.x) * (1.0 - smoothstep(0.62, 1.0, vBeam.x));
  float glint = beamNoise(vWorld.xz * 0.8 + vec2(uTime * 0.7, -uTime * 0.4))
    * beamNoise(vWorld.xz * 1.7 - vec2(uTime * 0.5, uTime * 0.6));
  glint = smoothstep(0.34, 0.6, glint);
  float alpha = across * reach * (0.12 + glint * 0.75) * uStrength;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
`,x=new r.Vector3,w=new r.Vector3,b=new r.Quaternion;function M(e,t,a,o=.6,n=1.8){let i=new r.IcosahedronGeometry(1,2),l=i.attributes.position;for(let r=0;r<l.count;r++){let i=l.getX(r),s=l.getY(r),u=l.getZ(r),d=1+Math.sin(3.1*i+e)*Math.sin(2.7*u-.7*e)*.07+.05*Math.sin(4.3*s+1.3*e),c=s>=.35,f=c?o:o-(.35-s)/1.35*(o+n),m=c?1:d*(1.04+(.35-s)*.06);l.setXYZ(r,i*m*t*.5,f,u*m*a*.5)}return i.computeVertexNormals(),i}function S(e,t,a){let o=[];for(let n=0;n<3;n++){let i=new r.IcosahedronGeometry(1,1),s=i.attributes.position,u=.45+.5*(0,l.hash)(e+3.1*n);for(let t=0;t<s.count;t++){let a=s.getX(t),o=s.getY(t),r=s.getZ(t),i=1+Math.sin(2.9*a+e+n)*Math.sin(2.3*r-e)*.14;s.setXYZ(t,a*i*u*1.2,Math.max(o,-.4)*i*u*.8,r*i*u)}i.computeVertexNormals();let d=(0,l.hash)(e+5.7*n)*Math.PI*2,c=0===n?1:-1;i.translate(c*(.5*t+.4*u)*Math.abs(Math.cos(d))+(2===n?-(.18*t):0),.15*u-.05,(.5*a+.3*u)*Math.sin(d)*(2===n?1.1:.6)),o.push(i)}return o}e.s(["SweepBeam",0,function({id:e,controlRef:n,count:i=2,length:l=32,radius:u=2.8,tilt:d=.06,color:c="#ffe2a8",position:h}){let M=(0,a.useRef)(null),S=(0,m.useWorld)(e=>"low"===e.quality),C=(0,a.useRef)(null),G=(0,a.useRef)(null),P=(0,a.useRef)({x:0,y:0,z:0,bearing:0,count:i,spin:0,spread:0,reach:0,strength:0}),j=Math.atan2(u,l),T=(0,a.useMemo)(()=>({cone:function(e,t,a,o){let n=[];for(let i=0;i<e;i++)n.push(new r.ConeGeometry(a,t,24,1,!0).rotateZ(Math.PI/2).translate(t/2,0,0).rotateZ(-o).rotateY(i/e*Math.PI*2));let i=(0,f.mergeGeometries)(n);return n.forEach(e=>e.dispose()),i}(i,l,u,d),wedge:function(e,t,a){let o=[];for(let n=0;n<e;n++){let i=new r.RingGeometry(1.2,t,20,6,-a,2*a),l=i.attributes.position,s=new Float32Array(2*l.count);for(let e=0;e<l.count;e++){let o=l.getX(e),r=l.getY(e);s[2*e]=(Math.hypot(o,r)-1.2)/(t-1.2),s[2*e+1]=Math.atan2(r,o)/a}i.setAttribute("aBeam",new r.BufferAttribute(s,2)),i.deleteAttribute("uv"),i.deleteAttribute("normal"),o.push(i.rotateX(-Math.PI/2).rotateY(n/e*Math.PI*2))}let n=(0,f.mergeGeometries)(o);return o.forEach(e=>e.dispose()),n}(i,1.08*l,1.25*j)}),[i,l,u,j,d]),B=(0,a.useMemo)(()=>{let e=new r.Color(c),t=(t,a)=>new r.ShaderMaterial({uniforms:{uStrength:{value:0},uTime:{value:0},uColor:{value:e.clone()}},vertexShader:t,fragmentShader:a,transparent:!0,depthWrite:!1,blending:r.AdditiveBlending,side:r.DoubleSide,fog:!1});return{cone:t(p,g),wedge:t(v,y)}},[c]);return(0,a.useEffect)(()=>()=>{T.cone.dispose(),T.wedge.dispose()},[T]),(0,a.useEffect)(()=>()=>{B.cone.dispose(),B.wedge.dispose()},[B]),(0,a.useEffect)(()=>{let t=P.current;s.set(e,t);let a=window;return()=>{s.get(e)===t&&s.delete(e),a.__beams&&delete a.__beams[e]}},[n,e]),(0,o.useFrame)((e,t)=>{let a=M.current,o=n.current,r=P.current;if(!a||!o)return;let s=Math.min(t,1/30);o.angle=(o.angle+s*o.speed)%(2*Math.PI),a.rotation.y=o.angle;let u=o.strength,d=u>.02;if(a.visible=d,r.strength=d?u:0,!d)return;a.getWorldPosition(x),w.set(1,0,0).applyQuaternion(a.getWorldQuaternion(b)),r.x=x.x,r.y=x.y,r.z=x.z,r.bearing=Math.atan2(w.z,w.x),r.count=i,r.spin=-o.speed,r.spread=j,r.reach=1.05*l;let c=e.clock.elapsedTime;for(let e of[C.current,G.current]){let t=e?.material;t&&(t.uniforms.uStrength.value=u,t.uniforms.uTime.value=c)}G.current&&(G.current.position.y=.32-x.y)}),(0,t.jsxs)("group",{ref:M,position:h,visible:!1,children:[(0,t.jsx)("mesh",{ref:C,geometry:T.cone,material:B.cone,renderOrder:7,raycast:()=>null}),!S&&(0,t.jsx)("mesh",{ref:G,geometry:T.wedge,material:B.wedge,renderOrder:5,raycast:()=>null})]})}],76432),e.s(["slabCompanions",0,S,"wordRockGroup",0,function(e,t,a,o=.6){let r=[M(e,t,a,o),...S(e,t,a)],n=(0,f.mergeGeometries)(r);return r.forEach(e=>e.dispose()),n},"wordSlab",0,M],43066)},95924,98999,e=>{"use strict";var t=e.i(90072),a=e.i(52260),o=e.i(64803),r=e.i(49184);let n=new t.Euler,i=new t.Quaternion,l=new t.Vector3,s=new t.Vector3,u=new t.Color;function d(e=[0,0,0],a=[0,0,0],o=1){return n.set(a[0],a[1],a[2]),i.setFromEuler(n),l.set(e[0],e[1],e[2]),"number"==typeof o?s.setScalar(o):s.set(o[0],o[1],o[2]),new t.Matrix4().compose(l,i,s)}class c{animated;parts;constructor(e=!1){this.animated=e,this.parts=[]}add(e,a,o,r=0,n=0,i=[0,0]){let l=e.index?e.toNonIndexed():e.clone();e.dispose(),l.applyMatrix4(a),l.attributes.uv&&l.deleteAttribute("uv"),l.computeVertexNormals();let s=l.attributes.position,d=s.count,c=new Float32Array(3*d);for(let e=0;e<d;e+=3){let t=e,a=(s.getX(t)+s.getX(t+1)+s.getX(t+2))/3,r=(s.getY(t)+s.getY(t+1)+s.getY(t+2))/3,n=(s.getZ(t)+s.getZ(t+1)+s.getZ(t+2))/3;u.set("function"==typeof o?o(a,r,n):o);for(let e=0;e<3;e++)u.toArray(c,(t+e)*3)}if(l.setAttribute("color",new t.BufferAttribute(c,3)),this.animated){let e=new Float32Array(4*d);for(let t=0;t<d;t++)e.set([r,n,i[0],i[1]],4*t);l.setAttribute("aPiece",new t.BufferAttribute(e,4))}return this.parts.push(l),this}build(){let e=(0,a.mergeGeometries)(this.parts,!1);return this.parts.forEach(e=>e.dispose()),this.parts=[],e?.computeBoundingSphere(),e}}let f=["#e8463c","#f6c445","#f28c38","#f5efe2","#5aa6dd","#ef7aa1"];function m(e,t,a,o){return[e[0]+(t[0]-e[0])*a,e[1]+(t[1]-e[1])*a-4*o*a*(1-a),e[2]+(t[2]-e[2])*a]}let h="#f1c6a0",p="#2b2731",g="#1b181d",v="#ffffff",y="#f6f2ea",x="#1d1c22";function w(e){return Math.floor(e/.034)%2==0?v:y}function b(e,a,o,r,n){let i=new t.Vector3(...a),l=new t.Vector3(...o),s=l.clone().sub(i),u=s.length(),d=i.add(l).multiplyScalar(.5),c=new t.Quaternion().setFromUnitVectors(new t.Vector3(0,1,0),s.normalize());e.add(new t.CylinderGeometry(r,.9*r,u,6),new t.Matrix4().compose(d,c,new t.Vector3(1,1,1)),n)}let M=["#c98d55","#b97a48","#d49f66","#bf8450","#ad7145"];e.s(["DANCER_BOTTOMS",0,["#24222c","#1f3657","#5c1f2a","#24222c","#2b4a3a","#1f3657","#24222c","#4a2a55","#24222c","#5c1f2a"],"DANCER_TOPS",0,["#2f5fa8","#c8382f","#2f5fa8","#e9b949","#3f8f6a","#c8382f","#7a4aa0","#2f5fa8","#d9673a","#3f8f6a"],"dancerGeometry",0,function(){let e=new c(!0);for(let[a,o]of[[1,3],[-1,4]])e.add(new t.CylinderGeometry(.043,.038,.33,6),d([.07*a,.2,0]),p,o),e.add(new t.BoxGeometry(.075,.05,.13),d([.07*a,.028,.025]),g,o);for(let a of(e.add(new t.SphereGeometry(.105,10,8),d([0,.8,0]),h),e.add(new t.SphereGeometry(.11,10,6,0,2*Math.PI,0,.55*Math.PI),d([0,.815,-.012],[-.35,0,0]),"#5b3a29"),[-1,1]))e.add(new t.SphereGeometry(.014,5,4),d([.036*a,.81,.097]),"#2a221d");for(let a of(e.add(new t.CylinderGeometry(.105,.12,.2,9),d([0,.6,0]),p,0,1),e.add(new t.TorusGeometry(.1,.022,5,12),d([0,.69,0],[Math.PI/2,0,0]),y,0,1),e.add(new t.CylinderGeometry(.11,.23,.34,11),d([0,.37,0]),v,0,1,[0,1]),e.add(new t.BoxGeometry(.17,.27,.025),d([0,.4,.17],[-.2,0,0]),v,0,1,[1,0]),e.add(new t.SphereGeometry(.118,10,6,0,2*Math.PI,0,Math.PI/2),d([0,.835,-.01],[-.25,0,0],[1,.95,1.06]),y,0,1),e.add(new t.BoxGeometry(.07,.11,.09),d([0,.95,-.03],[-.2,0,0]),y,0,1),[-1,1]))e.add(new t.BoxGeometry(.1,.075,.012),d([.085*a,.86,-.1],[.3,.5*a,.35*a]),y,0,1);for(let a of(e.add(new t.CylinderGeometry(.118,.122,.32,10,9),d([0,.52,0]),(e,t)=>w(t),0,2,[1,0]),e.add(new t.TorusGeometry(.1,.02,5,12),d([0,.685,0],[Math.PI/2,0,0]),y,0,2),e.add(new t.CylinderGeometry(.17,.17,.018,14),d([0,.885,0]),x,0,2),e.add(new t.CylinderGeometry(.094,.104,.075,12),d([0,.93,0]),x,0,2),e.add(new t.CylinderGeometry(.106,.106,.022,12),d([0,.905,0]),v,0,2,[1,0]),[-1,1]))e.add(new t.BoxGeometry(.03,.16,.008),d([.03*a,.83,-.16],[.25,0,.12*a]),x,0,2);for(let[a,o]of[[1,1],[-1,2]]){let r=.15*a;e.add(new t.CylinderGeometry(.036,.032,.27,6),d([r,.485,0]),(e,t)=>w(t+.017),o,2,[1,0]),e.add(new t.CylinderGeometry(.036,.032,.27,6),d([r,.485,0]),p,o,1),e.add(new t.SphereGeometry(.038,7,5),d([r,.33,0]),h,o)}return e.build()},"festLayout",0,function(e,t,a){let r=(0,o.groundAt)(e,4,1.35,1.2),n=(0,o.groundAt)(e,4,-1,.8),i={x:4,z:-1,ground:n,top:n+.24,halfX:.85,halfZ:.5},l=[{at:[3.64,i.top,-.95],yaw:.18,kind:"bombarde"},{at:[4.36,i.top,-.98],yaw:-.14,kind:"biniou"}],s=[[5.35,-.35],[5.65,2],[3.6,3.25]].map(([t,a])=>{let o=e(t,a)-.06;return{foot:[t,o,a],top:[t,o+2.35,a]}}),u=4-t[0],d=1.35-t[2],c=Math.hypot(u,d)||1,h=[t[0]+u/c*1,t[1]+5.3,t[2]+d/c*1],p=[[h,s[0].top],[h,s[1].top],[h,s[2].top],[s[0].top,s[1].top],[s[1].top,s[2].top]],g=[],v=[],y="low"===a?1.25:1.7,x=0,w=p.reduce((e,[t,a])=>e+Math.max(3,Math.round(Math.hypot(a[0]-t[0],a[1]-t[1],a[2]-t[2])*y)),0);return p.forEach(([e,t],a)=>{let o=Math.hypot(t[0]-e[0],t[1]-e[1],t[2]-e[2]),r=.18+.045*o,n=[];for(let a=0;a<=14;a++)n.push(m(e,t,a/14,r));g.push(n);let i=Math.max(3,Math.round(o*y));for(let o=0;o<i;o++){let n=m(e,t,(o+.5)/i,r);n[1]-=.16,v.push({at:n,color:f[(o+2*a)%f.length],on:.1+x/Math.max(1,w-1)*.32}),x+=1}}),{center:[4,r,1.35],radius:1.42,stage:i,players:l,poles:s,anchor:h,garlands:p,lampions:v,strings:g}},"lampionGeometry",0,function(){let e=new c(!1);return e.add(new t.SphereGeometry(.155,9,6),d([0,0,0],[0,0,0],[1,.82,1]),v),e.add(new t.CylinderGeometry(.07,.07,.035,8),d([0,.13,0]),"#3a2c22"),e.add(new t.CylinderGeometry(.07,.07,.035,8),d([0,-.13,0]),"#3a2c22"),e.add(new t.CylinderGeometry(.004,.004,.1,3),d([0,.19,0]),"#3a2c22"),e.build()},"playerGeometry",0,function(e){let a=new c(!1),o="bombarde"===e?"#1f3657":"#5c1f2a";for(let e of[-1,1])a.add(new t.CylinderGeometry(.045,.04,.34,6),d([.075*e,.2,0]),p),a.add(new t.BoxGeometry(.08,.05,.14),d([.075*e,.028,.025]),g);for(let e of(a.add(new t.CylinderGeometry(.125,.13,.33,10,9),d([0,.53,0]),(e,t)=>Math.floor(t/.034)%2==0?"#f6f2ea":"#2f5fa8"),a.add(new t.CylinderGeometry(.135,.14,.27,10,1,!0,.12*Math.PI,1.76*Math.PI),d([0,.55,0]),o),a.add(new t.BoxGeometry(.012,.2,.012),d([.05,.56,.13]),"#e2b04a"),a.add(new t.SphereGeometry(.11,10,8),d([0,.82,0]),h),[-1,1]))a.add(new t.SphereGeometry(.04,6,5),d([.06*e,.795,.07]),"#f0a49a");if(a.add(new t.CylinderGeometry(.17,.17,.018,14),d([0,.905,0]),x),a.add(new t.CylinderGeometry(.095,.105,.075,12),d([0,.95,0]),x),a.add(new t.CylinderGeometry(.107,.107,.022,12),d([0,.925,0]),"#d9a441"),"bombarde"===e){let e=e=>[0,.79-.5816830894638836*e,.11+.8134155047893737*e];for(let[r,n]of(a.add(new t.CylinderGeometry(.026,.016,.3,8),d(e(.15),[Math.PI-.95,0,0]),"#5a3a24"),a.add(new t.ConeGeometry(.06,.08,10,1,!0),d(e(.33),[-.95,0,0]),"#6b4529"),a.add(new t.CylinderGeometry(.03,.03,.025,8),d(e(.28),[Math.PI-.95,0,0]),"#efe6d2"),[[1,.1],[-1,.2]])){let i=e(n);b(a,[.15*r,.64,0],[i[0]+.025*r,i[1],i[2]],.035,o),a.add(new t.SphereGeometry(.036,7,5),d([i[0]+.02*r,i[1],i[2]]),h)}}else for(let[e,r]of(a.add(new t.SphereGeometry(.1,10,8),d([.13,.6,.08],[0,0,.3],[1.1,.8,1]),"#b8312f"),a.add(new t.CylinderGeometry(.012,.012,.16,6),d([.05,.72,.1],[.4,0,.6]),"#4a3020"),a.add(new t.CylinderGeometry(.014,.02,.2,8),d([.03,.52,.22],[.6,0,0]),"#3e2818"),a.add(new t.CylinderGeometry(.018,.018,.02,8),d([.03,.6,.16],[.6,0,0]),"#efe6d2"),a.add(new t.CylinderGeometry(.013,.016,.34,8),d([-.08,.8,-.06],[-.55,0,.45]),"#3e2818"),a.add(new t.CylinderGeometry(.024,.024,.03,8),d([-.155,.93,-.15],[-.55,0,.45]),"#efe6d2"),[[1,[.06,.5,.25]],[-1,[.01,.56,.2]]]))b(a,[.15*e,.64,0],r,.035,o),a.add(new t.SphereGeometry(.036,7,5),d(r),h);return a.build()},"setupGeometry",0,function(e){var a,o,n,i,l,s;let u=new c(!1),{stage:f,center:m}=e;for(let e=0;e<5;e++){let a=f.x-f.halfX+(e+.5)/5*f.halfX*2;u.add(new t.BoxGeometry(2*f.halfX/5-.03,.06,2*f.halfZ),d([a,f.top-.03,f.z],[0,((0,r.hash)(3.1*e)-.5)*.02,0]),M[e%M.length])}for(let e of[-1,1])for(let a of[-1,1]){let o=f.x+e*(f.halfX-.08),r=f.z+a*(f.halfZ-.08);u.add(new t.BoxGeometry(.09,f.top-f.ground+.3,.09),d([o,(f.top+f.ground-.3)/2,r]),"#7a4e33")}for(let a of(u.add(new t.BoxGeometry(.6,.06,.24),d([f.x,f.ground+.1,f.z+f.halfZ+.14]),"#b97a48"),e.poles)){let e=a.top[1]-a.foot[1];u.add(new t.CylinderGeometry(.035,.05,e+.25,6),d([a.foot[0],a.foot[1]+(e+.25)/2-.25,a.foot[2]]),"#8a5a3a"),u.add(new t.BoxGeometry(.34,.04,.04),d([a.top[0],a.top[1]+.02,a.top[2]],[0,3*(0,r.hash)(a.foot[0]),0]),"#7a4e33"),u.add(new t.SphereGeometry(.05,6,5),d([a.top[0],a.top[1]+.12,a.top[2]]),"#e2b04a")}for(let t of e.strings)for(let e=0;e<t.length-1;e++){a=u,o=t[e],n=t[e+1],b(a,o,n,.011,"#3a2c22")}for(let e=0;e<9;e++){let a=e/9*Math.PI*2,o=new t.IcosahedronGeometry(.075+.03*(0,r.hash)(1.9*e),0);u.add(o,d([m[0]+.4*Math.cos(a),m[1]+.03,m[2]+.4*Math.sin(a)],[(0,r.hash)(e),3*(0,r.hash)(2.3*e),0],[1.2,.8,1]),e%2?"#9a938c":"#b1a9a0")}for(let e=0;e<6;e++){let t=e/6*Math.PI*2+.3,a=[m[0]+.28*Math.cos(t),m[1],m[2]+.28*Math.sin(t)];i=u,l=a,s=[m[0]+.04*Math.cos(t),m[1]+.5,m[2]+.04*Math.sin(t)],b(i,l,s,.035,e%2?"#6b4529":"#7d5233")}u.add(new t.CylinderGeometry(.2,.22,.03,10),d([m[0],m[1]+.01,m[2]]),"#2d2522");let h=[f.x+f.halfX+.32,f.ground+.22,f.z+.1];for(let e of(u.add(new t.CylinderGeometry(.17,.17,.42,10),d(h,[Math.PI/2,.4,0]),"#a8703f"),[-.13,.13]))u.add(new t.TorusGeometry(.175,.012,4,14),d([h[0]+.9210609940028851*e,h[1],h[2]-.3894183423086505*e],[0,.4+Math.PI/2,0]),"#3b3330");return u.build()}],95924);let S={uFireView:{value:new t.Vector3(0,-1e3,0)},uFireColor:{value:new t.Color("#ffb15c")},uFireGlow:{value:0}},C={uBeat:{value:0},uRing:{value:0},uPresence:{value:0},uCenter:{value:new t.Vector3},uRadius:{value:1.3},uCount:{value:10},uMotion:{value:1},uSize:{value:1.25}},G={uNight:{value:0},uTime:{value:0}},P=`
uniform vec3 uFireView;
uniform vec3 uFireColor;
uniform float uFireGlow;
`,j=`
#include <emissivemap_fragment>
{
  vec3 fnToFire = uFireView + vViewPosition;
  float fnDist = length(fnToFire);
  float fnFacing = max(dot(normal, fnToFire / max(fnDist, 1e-3)), 0.0);
  float fnLight = uFireGlow * (0.25 + 0.75 * fnFacing) / (1.0 + fnDist * fnDist * 0.32);
  // Une lumi\xe8re chaude mais p\xe2le : les couleurs des costumes restent lisibles la nuit.
  totalEmissiveRadiance += (diffuseColor.rgb * vec3(1.0, 0.9, 0.78) + uFireColor * 0.06) * fnLight;
}
`,T=`
// aPiece : pi\xe8ce (0 corps, 1-2 bras, 3-4 jambes), variante (1 danseuse, 2 danseur),
// teintures du haut et du bas. aDancer : place dans la ronde, graine, genre, heure d'entr\xe9e.
attribute vec4 aPiece;
attribute vec4 aDancer;
attribute vec3 aTop;
attribute vec3 aBottom;
uniform float uBeat;
uniform float uRing;
uniform float uPresence;
uniform vec3 uCenter;
uniform float uRadius;
uniform float uCount;
uniform float uMotion;
uniform float uSize;

mat3 fnRotX(float a) { float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 fnRotY(float a) { float c = cos(a); float s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 fnRotZ(float a) { float c = cos(a); float s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

// An-dro : la cha\xeene avance vers la gauche, petits doigts accroch\xe9s ; les bras balancent
// d'avant en arri\xe8re en cercle (un cycle de quatre temps), un pas chass\xe9 par temps, le corps
// rebondit. Chaque danseur pousse du sol \xe0 son heure (ressort), face au feu.
void festDance(inout vec3 p, inout vec3 n) {
  float aPart = aPiece.x;
  float aVariant = aPiece.y;
  float aSlot = aDancer.x;
  float aSeed = aDancer.y;
  float aKind = aDancer.z;
  float aOn = aDancer.w;
  float ph = uBeat * 1.5707963 + aSeed * 0.18;
  float stepPhase = uBeat * 3.14159265 + aSeed * 0.12;
  if (aPart > 0.5 && aPart < 2.5) {
    float side = aPart < 1.5 ? 1.0 : -1.0;
    vec3 pivot = vec3(side * 0.15, 0.62, 0.0);
    float abduct = side * (0.84 + 0.12 * cos(ph) * uMotion);
    float swing = -(0.55 * sin(ph) + 0.2) * uMotion - 0.15;
    mat3 r = fnRotX(swing) * fnRotZ(abduct);
    p = pivot + r * (p - pivot);
    n = r * n;
  } else if (aPart > 2.5) {
    float side = aPart < 3.5 ? 1.0 : -1.0;
    vec3 pivot = vec3(side * 0.07, 0.36, 0.0);
    float lift = max(0.0, sin(stepPhase + (side > 0.0 ? 0.0 : 3.14159265))) * uMotion;
    mat3 r = fnRotZ(side * 0.3 * lift) * fnRotX(-0.15 * lift);
    p = pivot + r * (p - pivot);
    n = r * n;
  }
  // Variante inutile (coiffe d'un danseur, chapeau d'une danseuse…) : \xe9cras\xe9e.
  float hidden = (aVariant > 0.5 && aVariant < 1.5 && aKind > 0.5) || (aVariant > 1.5 && aKind < 0.5) ? 1.0 : 0.0;
  // Rebond \xe0 chaque pas, l\xe9ger roulis.
  mat3 body = fnRotZ(sin(stepPhase) * 0.05 * uMotion);
  p = body * p;
  n = body * n;
  p.y += abs(sin(stepPhase)) * 0.035 * uMotion;
  // Entr\xe9e dans la ronde : il pousse du sol avec un petit d\xe9passement.
  float t = clamp((uPresence - aOn) / 0.12, 0.0, 1.0);
  float u = t - 1.0;
  float grow = 1.0 + 2.70158 * u * u * u + 1.70158 * u * u;
  p *= max(grow, 0.0) * (1.0 - hidden) * uSize;
  // Place sur le cercle, face au centre (le feu).
  float theta = uRing + aSlot * 6.2831853 / uCount;
  mat3 face = fnRotY(atan(-cos(theta), -sin(theta)));
  p = face * p + uCenter + vec3(cos(theta), 0.0, sin(theta)) * uRadius;
  n = face * n;
}
`;e.s(["danceUniforms",0,C,"dancerMaterial",0,function(){let e=new t.MeshStandardMaterial({vertexColors:!0,roughness:.85,flatShading:!0});return e.onBeforeCompile=e=>{Object.assign(e.uniforms,S,C),e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
${T}`).replace("#include <beginnormal_vertex>",`#include <beginnormal_vertex>
        vec3 fnPosition = position;
        vec3 fnNormal = objectNormal;
        festDance(fnPosition, fnNormal);
        objectNormal = fnNormal;`).replace("#include <begin_vertex>","vec3 transformed = fnPosition;").replace("#include <color_vertex>",`#include <color_vertex>
        #ifdef USE_COLOR
          // Seul le blanc pur prend la couleur du danseur (rayures \xe9crues intactes).
          float fnPure = step(0.98, min(min(color.r, color.g), color.b));
          vColor.rgb *= mix(vec3(1.0), aTop, aPiece.z * fnPure);
          vColor.rgb *= mix(vec3(1.0), aBottom, aPiece.w * fnPure);
        #endif`),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
${P}`).replace("#include <emissivemap_fragment>",j)},e.customProgramCacheKey=()=>"festnoz-dancer-v2",e},"fireLitMaterial",0,function(e){let a=new t.MeshStandardMaterial({vertexColors:!0,roughness:.85,flatShading:!0});return a.onBeforeCompile=e=>{Object.assign(e.uniforms,S),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
${P}`).replace("#include <emissivemap_fragment>",j)},a.customProgramCacheKey=()=>`festnoz-fire-${e}`,a},"fireUniforms",0,S,"lampionMaterial",0,function(){let e=new t.MeshStandardMaterial({vertexColors:!0,roughness:.7});return e.onBeforeCompile=e=>{Object.assign(e.uniforms,G),e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
        attribute float aOn;
        uniform float uNight;
        uniform float uTime;
        varying float vLit;`).replace("#include <begin_vertex>",`#include <begin_vertex>
        vLit = smoothstep(aOn, aOn + 0.05, uNight) * (0.86 + 0.14 * sin(uTime * 5.3 + aOn * 97.0));`),e.fragmentShader=e.fragmentShader.replace("#include <common>","#include <common>\nvarying float vLit;").replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
        totalEmissiveRadiance += vColor.rgb * vLit * 3.2;`)},e.customProgramCacheKey=()=>"festnoz-lampion-v1",e},"lampionUniforms",0,G],98999)}]);