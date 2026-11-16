(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,84491,e=>{"use strict";var t=e.i(4076),a=e.i(43911),r=e.i(30781),o=e.i(23243);let n=null,l={x:NaN,z:NaN,heading:NaN},s=6.4*Math.sqrt(1-.56*.56),i=3.5840000000000005/s;e.s(["RISE_SETTLE",0,1.7,"SWEEP_FROM",0,1.6,"SWEEP_SPAN",0,3,"risePose",0,function(e,t,a,r){if(e<0)return r.visible=!1,r.y=-t,r.sy=1,r.sxz=1,r.tiltX=0,r.tiltZ=0,r;if(r.visible=!0,e>=1.7)return r.y=0,r.sy=1,r.sxz=1,r.tiltX=0,r.tiltZ=0,r;let o=Math.exp(-3.5840000000000005*e),n=Math.cos(s*e),l=Math.sin(s*e),c=1-Math.min(1,Math.max(0,(e-1.35)/.35));r.y=-t*(1-(1-o*(n+i*l)))*c;let h=1+6.4/s*o*l*.3*c;r.sy=h,r.sxz=1/Math.sqrt(h);let u=Math.exp(-3.1*e)*c;return r.tiltX=.045*u*Math.sin(8.4*e+a),r.tiltZ=.04*u*Math.sin(7.1*e+1.7*a),r},"riseSchedule",0,function(e,s,i){if(n&&l.x===e&&l.z===s&&l.heading===i)return n;l.x=e,l.z=s,l.heading=i;let c=`${e.toFixed(2)}|${s.toFixed(2)}|${i.toFixed(3)}`;if(n&&n.key===c)return n;let h=[],u=(t,a,r)=>{let n=Math.hypot(t-e,a-s),l=Math.atan2(a-s,t-e)-i;return Math.max(1.6+((l=Math.atan2(Math.sin(l),Math.cos(l)))+Math.PI)/(2*Math.PI)*3,(0,o.frontSeconds)(n-.45*r)+.05)},[f,d]=t.homeIsland.position;for(let a of(h.push({id:"home",x:f,z:d,radius:t.homeIsland.radius,footprint:1.5*t.homeIsland.radius,start:(0,o.frontSeconds)(Math.hypot(f-e,d-s)-4.5),rises:!1}),t.islands)){let[e,t]=a.position;h.push({id:a.id,x:e,z:t,radius:a.radius,footprint:1.45*a.radius,start:u(e,t,a.radius),rises:!0})}for(let e of a.islets){let[t,a]=e.position;h.push({id:`islet:${e.id}`,x:t,z:a,radius:e.radius,footprint:1.5*e.radius,start:u(t,a,e.radius),rises:!0})}let[m,p]=r.yellowStaticIsland.position;return h.push({id:"static",x:m,z:p,radius:r.yellowStaticIsland.radius,footprint:1.5*r.yellowStaticIsland.radius,start:(0,o.frontSeconds)(Math.hypot(m-e,p-s)-4.5),rises:!1}),n={key:c,slots:h,byId:new Map(h.map(e=>[e.id,e]))}},"sweepBearing",0,function(e,t){return t-Math.PI+(e-1.6)/3*Math.PI*2}])},9037,e=>{"use strict";var t=e.i(43476),a=e.i(71645),r=e.i(90072),o=e.i(86444),n=e.i(64803);e.s(["Terrain",0,function({shape:e,sampler:l,cliff:s="island_cliff",top:i="wild_grass",cliffTint:c}){let h=(0,a.useMemo)(()=>(0,n.buildTerrainGeometry)(e,l),[e,l]),u=(0,a.useMemo)(()=>(0,o.getPaintedTerrainMaterial)(s,i,c),[s,c,i]),f=(0,a.useMemo)(()=>(function(e,t){let a=new r.RingGeometry(1.22*e,1.5*e,40,2),o=a.attributes.position;for(let e=0;e<o.count;e++){let a=o.getX(e),r=o.getY(e);if(.001>Math.hypot(a,r))continue;let n=Math.atan2(r,a),l=1+.075*Math.sin(3*n+t)+.04*Math.sin(7*n-.7*t)+.018*Math.sin(13*n+1.9*t);o.setXY(e,a*l,r*l)}return o.needsUpdate=!0,a})(e.radius,e.seed+8.1),[e.radius,e.seed]);return(0,t.jsxs)("group",{children:[(0,t.jsx)("mesh",{geometry:f,"rotation-x":-Math.PI/2,"position-y":-1.7,receiveShadow:!0,children:(0,t.jsx)("meshStandardMaterial",{color:"#68c7b0",roughness:1,transparent:!0,opacity:.28,depthWrite:!1})}),(0,t.jsx)("mesh",{geometry:h,material:u,castShadow:!0,receiveShadow:!0})]})}])},87436,e=>{"use strict";let t,a,r,o;var n=e.i(43476),l=e.i(71645),s=e.i(94800),i=e.i(90072),c=e.i(60284),h=e.i(27225),u=e.i(49184),f=e.i(58158),d=e.i(45101);let m=function(){let e=[0,0,0];for(let t=0;t<6;t++){let a=t/6*Math.PI*2+Math.PI/2;e.push(.42*Math.cos(a),.5*Math.sin(a),0)}let t=[];for(let e=1;e<=6;e++)t.push(0,e,e%6+1);let a=new i.BufferGeometry;return a.setAttribute("position",new i.BufferAttribute(new Float32Array(e),3)),a.setAttribute("normal",new i.BufferAttribute(new Float32Array(21).map((e,t)=>+(t%3==2)),3)),a.setIndex(t),a}(),p=new i.CylinderGeometry(.72,1,1,7,3).translate(0,.5,0),M=((t=new i.BufferGeometry).setAttribute("position",new i.BufferAttribute(new Float32Array([0,0,-.08,.055,0,0,0,0,.08,-.055,0,0]),3)),t.setAttribute("normal",new i.BufferAttribute(new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),3)),t.setIndex([0,1,2,0,2,3]),t),y=`
attribute vec4 aTree;
${d.WIND_GLSL}

vec3 treeBend( vec3 p ) {
  vec2 rootWorld = ( modelMatrix * vec4( aTree.xyz, 1.0 ) ).xz;
  float gust = windGust( rootWorld );
  float h = clamp( ( p.y - aTree.y ) / aTree.w, 0.0, 1.3 );
  float bend = h * h;
  float breathe = sin( uWindTime * 0.83 + aTree.x * 0.37 + aTree.z * 0.29 );
  vec3 offset = uWindDir * bend * ( 0.06 + breathe * 0.035 + gust * 0.34 );
  // Le houppier s'\xe9crase un peu sous la rafale et oscille en travers.
  offset += vec3( - uWindDir.z, 0.0, uWindDir.x ) * bend * sin( uWindTime * 1.31 + aTree.x ) * ( 0.02 + gust * 0.05 );
  offset.y -= bend * gust * 0.06;
  return offset;
}
`,x=`
attribute vec3 aSphereNormal;
attribute float aSway;
${y}

float leafFlutter( vec3 leafAt ) {
  return windFlutter( leafAt.xz * 3.1 + leafAt.y * 1.7, 7.0 );
}
`,g=`
vec3 leafAt = instanceMatrix[ 3 ].xyz;
float leafGust = windGust( ( modelMatrix * vec4( aTree.xyz, 1.0 ) ).xz );
float leafFlicker = leafFlutter( leafAt );
vec3 transformedNormal = normalMatrix * normalize( aSphereNormal + uWindDir * leafGust * 0.42 * aSway + vec3( 0.0, leafFlicker * 0.18 * aSway, 0.0 ) );
`,v=`
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
{
  vec3 at = instanceMatrix[ 3 ].xyz;
  float flutter = leafFlutter( at );
  float gust = windGust( ( modelMatrix * vec4( aTree.xyz, 1.0 ) ).xz );
  vec3 flutterDir = normalize( vec3( sin( at.x * 12.9 + at.y ), 0.7, cos( at.z * 7.3 - at.y ) ) );
  mvPosition.xyz += treeBend( at ) + flutterDir * flutter * ( 0.016 + gust * 0.045 ) * aSway;
  #ifdef LEAF_SHIMMER
    // Les feuilles qui se retournent accrochent la lumi\xe8re : le houppier miroite.
    vColor.rgb *= 1.0 + flutter * ( 0.04 + gust * 0.1 ) * aSway;
  #endif
}
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`,w=`
#include <begin_vertex>
{
  // Contreforts au pied du tronc (aFlare = 1) : cinq racines qui s'\xe9vasent.
  float rootMask = aFlare * pow( 1.0 - clamp( position.y, 0.0, 1.0 ), 4.0 );
  float around = atan( position.z, position.x );
  float roots = 0.55 + 0.45 * cos( around * 5.0 + aTree.x * 3.0 );
  transformed.xz *= 1.0 + rootMask * ( 0.6 + 1.3 * roots );
}
`,S=`
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition.xyz += treeBend( mvPosition.xyz );
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;
`,b=`
float faceDirection = 1.0;
vec3 normal = normalize( vNormal );
vec3 nonPerturbedNormal = normal;
`;function A(e,t,a,r){let o=new i.MeshDepthMaterial;return o.onBeforeCompile=a=>{Object.assign(a.uniforms,d.windUniforms),a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>
${e}`).replace("#include <project_vertex>",t),r&&(a.vertexShader=a.vertexShader.replace("#include <begin_vertex>",r))},o.customProgramCacheKey=()=>a,o}let I=`
attribute vec4 aPetal;
attribute vec4 aSpin;
${y}

vec3 petalRotate( vec3 v, vec3 axis, float angle ) {
  float c = cos( angle );
  float s = sin( angle );
  return v * c + cross( axis, v ) * s + axis * dot( axis, v ) * ( 1.0 - c );
}
`,P=`
vec4 mvPosition;
{
  float period = 7.5 + aSpin.w * 4.0;
  float life = fract( uWindTime / period + aPetal.w );
  vec3 start = aTree.xyz + aPetal.xyz;
  float drop = max( aPetal.y, 0.5 );
  float fall = smoothstep( 0.0, 1.0, life );
  vec3 p = start;
  p.y -= drop * fall;
  // D\xe9rive sous le vent et balancement de feuille morte.
  p.xz += uWindDir.xz * fall * ( 1.6 + windGust( ( modelMatrix * vec4( start, 1.0 ) ).xz ) * 2.2 );
  p.xz += vec2( - uWindDir.z, uWindDir.x ) * sin( life * 18.0 + aPetal.w * 6.2831 ) * 0.35 * fall;
  // Accroch\xe9 au houppier au d\xe9but (il plie avec l'arbre), libre ensuite.
  p += treeBend( start ) * ( 1.0 - fall );
  float size = smoothstep( 0.0, 0.06, life ) * ( 1.0 - smoothstep( 0.82, 1.0, life ) ) * length( instanceMatrix[ 0 ].xyz );
  vec3 local = petalRotate( transformed, normalize( aSpin.xyz ), uWindTime * ( 2.0 + aSpin.w * 3.0 ) + aPetal.w * 6.2831 );
  mvPosition = modelViewMatrix * vec4( p + local * size, 1.0 );
}
gl_Position = projectionMatrix * mvPosition;
`,z=`
attribute vec4 aFly;
uniform float uTime;
uniform float uNight;
varying float vGlow;
void main() {
  float t = uTime * ( 0.35 + aFly.w * 0.3 ) + aFly.w * 31.0;
  vec3 p = position;
  p.x += sin( t * 1.3 ) * 0.7 + sin( t * 2.9 + 1.7 ) * 0.25;
  p.z += cos( t * 1.1 + 0.6 ) * 0.7 + sin( t * 3.3 ) * 0.2;
  p.y += sin( t * 0.9 + aFly.w * 4.0 ) * 0.45;
  // Clignotement : longues pauses, br\xe8ves lueurs.
  float blink = smoothstep( 0.55, 1.0, sin( uTime * ( 1.3 + aFly.w * 1.7 ) + aFly.w * 47.0 ) );
  vGlow = uNight * ( 0.25 + blink * 0.75 );
  vec4 mv = modelViewMatrix * vec4( p, 1.0 );
  gl_PointSize = clamp( ( 2.0 + blink * 2.5 ) * ( 120.0 / max( 1.0, - mv.z ) ), 1.5, 9.0 );
  gl_Position = projectionMatrix * mv;
}
`,T=`
varying float vGlow;
void main() {
  float d = length( gl_PointCoord - 0.5 ) * 2.0;
  float a = ( 1.0 - smoothstep( 0.0, 1.0, d ) ) * vGlow;
  if ( a < 0.01 ) discard;
  gl_FragColor = vec4( vec3( 1.0, 0.88, 0.45 ) * ( 0.6 + ( 1.0 - d ) * 0.8 ), a );
}
`,C=((a=new i.MeshStandardMaterial({color:"#ffffff",roughness:1,metalness:0,side:i.DoubleSide})).name="tree-leaves",a.defines={LEAF_SHIMMER:""},a.onBeforeCompile=e=>{Object.assign(e.uniforms,d.windUniforms),e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
${x}`).replace("#include <defaultnormal_vertex>",g).replace("#include <project_vertex>",v),e.fragmentShader=e.fragmentShader.replace("#include <normal_fragment_begin>",b)},a.customProgramCacheKey=()=>"tree-leaves-v2",a),R=A(x,v.replace("#ifdef LEAF_SHIMMER","#if 0"),"tree-leaves-depth-v2"),G=((r=new i.MeshStandardMaterial({color:"#ffffff",roughness:1,metalness:0,flatShading:!0})).name="tree-wood",r.onBeforeCompile=e=>{Object.assign(e.uniforms,d.windUniforms),e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
attribute float aFlare;
${y}`).replace("#include <begin_vertex>",w).replace("#include <project_vertex>",S)},r.customProgramCacheKey=()=>"tree-wood-v2",r),E=A(`attribute float aFlare;
${y}`,S,"tree-wood-depth-v2",w),H=((o=new i.MeshStandardMaterial({color:"#ffffff",roughness:.9,metalness:0,side:i.DoubleSide})).name="tree-petals",o.onBeforeCompile=e=>{Object.assign(e.uniforms,d.windUniforms),e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
${I}`).replace("#include <project_vertex>",P),e.fragmentShader=e.fragmentShader.replace("#include <normal_fragment_begin>",b)},o.customProgramCacheKey=()=>"tree-petals-v1",o),k=new i.Vector3(0,0,1),N=new i.Color("#5e9a44"),O=new i.Color("#9cc35a"),_=new i.Color("#4f8238"),D=new i.Color("#ffc36b"),F=new i.Color("#7a5034"),B=new i.Color("#5f9c3f"),W=new i.Color("#b4cf5a"),L=new i.Color("#c9a85a"),V=new i.Color("#a88a66"),U=new i.Color("#7f6448"),K=new i.Color("#6b6a2c");function j(e,t,a,r,o,n){let l=t.clone().lerp(a,.5).add(new i.Vector3(((0,u.hash)(o)-.5)*.3,.22+.2*(0,u.hash)(o+1.1),((0,u.hash)(o+2.3)-.5)*.3));e.push({from:t.clone(),to:l,radius:r,flare:0,color:n}),e.push({from:l,to:a.clone(),radius:.74*r,flare:0,color:n})}let Y=new i.Matrix4,q=new i.Vector3,Q=new i.Vector3;function $(e,t,a){let r=Math.hypot(e(t+.5,a)-e(t-.5,a),e(t,a+.5)-e(t,a-.5));return r/Math.sqrt(1+r*r)}function X(e,t){return Math.abs(((e-t)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI)}function Z(e,t,a,r=4.2,o=[],n=1.4){let l=[];for(let s of e){if(l.length>=t)break;!(a.some(e=>Math.hypot(s.x-e.x,s.z-e.z)<e.radius+n)||l.some(e=>Math.hypot(s.x-e.x,s.z-e.z)<r))&&(o.some(e=>2.4>Math.hypot(s.x-e.x,s.z-e.z))||l.push(s))}return l}let J=new i.Matrix4,ee=new i.Quaternion,et=new i.Quaternion,ea=new i.Vector3,er=new i.Vector3,eo=new i.Vector3,en=new i.Vector3,el=new i.Vector3,es=new i.Vector3(0,1,0);e.s(["Trees",0,function({sampler:e,radius:t,plateau:a,avoidAngle:r,seed:o,flame:y,count:x,palms:g}){let v=(0,l.useRef)(null),w=(0,l.useRef)(null),S=(0,l.useRef)(null),b=(0,l.useRef)(null),A=(0,l.useRef)(null),I=(0,l.useContext)(f.ClearingContext),P=(0,l.useRef)(-1),ei=(0,h.useWorld)(e=>e.quality),ec="low"===ei?Math.max(1,x-1):x,eh=g??Math.min(3,Math.max(1,Math.round(t/7))),eu="low"===ei?Math.min(1,eh):eh,ef="low"===ei?.62:"medium"===ei?.85:1,ed="high"===ei?6:4*("medium"===ei),em="low"===ei?0:"medium"===ei?4:6,ep=(0,l.useMemo)(()=>{let e=new i.Color(y);return[...Array.from({length:ec},(t,a)=>(function(e,t,a){let r=(0,u.hash)(1.9*e)>=.3,o=.85+.35*(0,u.hash)(8.3*e),n=F.clone().multiplyScalar(.9+.2*(0,u.hash)(9.1*e)),l=n.clone().multiplyScalar(1.08),s=r?2.5+1.2*(0,u.hash)(2.3*e):2.3+1.1*(0,u.hash)(2.3*e),c=r?2+.7*(0,u.hash)(3.1*e):1.55+.5*(0,u.hash)(3.1*e),h=((0,u.hash)(4.7*e)-.5)*.24,f=(0,u.hash)(5.3*e)*Math.PI*2,d=new i.Vector3(Math.cos(f)*h,0,Math.sin(f)*h),m=new i.Vector3(d.x*s*.5+((0,u.hash)(6.7*e)-.5)*.18,.52*s,d.z*s*.5+((0,u.hash)(7.3*e)-.5)*.18),p=new i.Vector3(d.x*s,s,d.z*s),M=[{from:new i.Vector3(0,-.15,0),to:m,radius:.24*o,flare:1,color:n},{from:m,to:p,radius:.19*o,flare:0,color:n}],y=p.clone().add(new i.Vector3(0,c*(r?.3:.45),0)),x=[];if(r){x.push({center:y.clone().add(new i.Vector3(0,.12*c,0)),radius:.6*c,top:.62,bottom:.38});let t=4+Math.floor(3*(0,u.hash)(6.1*e)),a=(0,u.hash)(11.9*e)>.6;for(let a=0;a<t;a++){let r=a/t*Math.PI*2+2*(0,u.hash)(7.7*e)+((0,u.hash)(e+2.9*a)-.5)*.5,o=c*(.62+.22*(0,u.hash)(e+3.3*a));x.push({center:y.clone().add(new i.Vector3(Math.cos(r)*o,c*(-.04+.18*(0,u.hash)(e+5.1*a)),Math.sin(r)*o)),radius:c*(.42+.15*(0,u.hash)(e+4.1*a)),top:.6,bottom:.34})}let r=a?[p.clone().add(new i.Vector3(.28*c,.18*c,0)),p.clone().add(new i.Vector3(-(.28*c),.18*c,.1*c))]:[p];a&&r.forEach((e,t)=>M.push({from:p.clone().multiplyScalar(.96),to:e,radius:.15*o,flare:0,color:t?l:n})),x.slice(1).forEach((t,a)=>{let n=r.reduce((e,a)=>a.distanceTo(t.center)<e.distanceTo(t.center)?a:e,r[0]),s=t.center.clone().lerp(y,.2).setY(t.center.y-.28*t.radius);j(M,n.clone().lerp(p,.1),s,.1*o,e+7.1*a,l)})}else{for(let t of(x.push({center:y.clone(),radius:.86*c,top:.86,bottom:.62}),x.push({center:y.clone().add(new i.Vector3(.12*c,.78*c,-(.08*c))),radius:.64*c,top:.9,bottom:.7}),[-1,1])){let a=(0,u.hash)(3.9*e)*Math.PI*2+(t>0?0:Math.PI);x.push({center:y.clone().add(new i.Vector3(Math.cos(a)*c*.55,.18*c,Math.sin(a)*c*.55)),radius:.52*c,top:.86,bottom:.6})}x.slice(2).forEach((t,a)=>j(M,p.clone().multiplyScalar(.92),t.center.clone().lerp(y,.35),.085*o,e+5.3*a,l))}let g=Math.max(...x.map(e=>e.center.y+e.radius*e.top)),v=Math.round(x.reduce((e,t)=>e+t.radius**2,0)*(r?112:125)*a),w=1/Math.sqrt(Math.max(.35,a)),S=t.clone().lerp(D,.45),b=function(e,t,a,r,o,n,l){let s=[],c=e.reduce((e,t)=>e+t.radius**2,0);for(let h=0;h<t;h++){let t=13.1*a+1.618*h,f=(0,u.hash)(t)*c,d=e[0];for(let t of e)if((f-=t.radius**2)<=0){d=t;break}let m=2*(0,u.hash)(t+.37)-1,p=(0,u.hash)(t+.71)*Math.PI*2,M=Math.sqrt(1-m*m),y=new i.Vector3(M*Math.cos(p),m,M*Math.sin(p)),x=d.radius*(.62+.38*Math.cbrt((0,u.hash)(t+1.13))),g=d.center.clone().addScaledVector(y,x);g.y=d.center.y+y.y*x*(y.y<0?d.bottom:d.top);let v=y.clone().multiplyScalar(.62).add(g.clone().sub(r).normalize().multiplyScalar(.38)).normalize(),w=y.clone().add(new i.Vector3((0,u.hash)(t+3.1)-.5,(0,u.hash)(t+3.7)-.5,(0,u.hash)(t+4.3)-.5).multiplyScalar(.9)).normalize(),S=new i.Quaternion().setFromUnitVectors(k,w).multiply(new i.Quaternion().setFromAxisAngle(k,(0,u.hash)(t+4.9)*Math.PI*2));s.push({offset:g,normal:v,rotation:S,size:(.24+.17*(0,u.hash)(t+5.9))*l,stretch:1,sway:Math.min(1,Math.max(.15,g.y/o)),color:n(y,t).multiplyScalar(.84+.22*Math.min(1,(x/d.radius-.62)/.38))})}return s}(x,v,e,y,g,(e,a)=>{let o=.88+((0,u.hash)(a+2.3)-.5)*.16;if(!r)return N.clone().lerp(O,.6*Math.max(0,e.y)+.2*(0,u.hash)(a+6.7)).multiplyScalar(o+.04);let n=e.y<-.15?Math.min(1,(-.15-e.y)*2.4):0;return(0,u.hash)(a+8.1)<.12+.75*n?_.clone().lerp(N,.6*(0,u.hash)(a+9.3)).multiplyScalar(o):t.clone().lerp(S,.55*Math.max(0,e.y)+.2*(0,u.hash)(a+6.7)).multiplyScalar(o+.06)},w),A=r?Array.from({length:6},(t,a)=>{let r=x[1+a%(x.length-1)],o=(0,u.hash)(e+3.7*a)*Math.PI*2;return r.center.clone().add(new i.Vector3(Math.cos(o)*r.radius*.7,-(.25*r.radius),Math.sin(o)*r.radius*.7))}):[];return{flame:r,crownTop:g,leaves:b,wood:M,petals:A,flies:Array.from({length:6},(t,a)=>{let r=a/6*Math.PI*2+(0,u.hash)(e+1.9*a),o=c*(.45+.6*(0,u.hash)(e+2.7*a));return new i.Vector3(Math.cos(r)*o,.7+(0,u.hash)(e+4.4*a)*(.7*s),Math.sin(r)*o)}),petalColor:S.clone()}})(7.3*o+19.1*a,e,ef)),...Array.from({length:eu},(e,t)=>(function(e,t){let a=3+1.2*(0,u.hash)(2.3*e),r=.42+.2*(0,u.hash)(4.7*e),o=((0,u.hash)(5.9*e)-.5)*.5,n=Array.from({length:10},(e,t)=>{let n=t/9;return new i.Vector3(a*r*(2*n-n*n)*.8,a*n,Math.sin(n*Math.PI)*o)});n[0].y=-.15;let l=[];for(let t=0;t<9;t++){let a=t/9,r=(t%2?V:U).clone().multiplyScalar(.94+.12*(0,u.hash)(e+1.3*t));l.push({from:n[t],to:n[t+1],radius:.2-.065*a,flare:.32*(0===t),color:r})}let s=n[9].clone().add(new i.Vector3(0,.04,0));for(let t=0;t<3;t++){let a=6.28*(0,u.hash)(3.7*e)+2.2*t,r=s.clone().add(new i.Vector3(.16*Math.cos(a),-.06,.16*Math.sin(a)));l.push({from:r,to:r.clone().add(new i.Vector3(.05*Math.cos(a),-.2,.05*Math.sin(a))),radius:.11,flare:0,color:K.clone().multiplyScalar(.9+.08*t)})}let c=[],h=Math.max(7,Math.round(10*Math.min(1,t+.15))),f=t<.7?6:8,d=new i.Vector3(0,1,0),m=new i.Vector3,p=new i.Vector3;for(let t=0;t<h;t++){let a=3.1*e+7.7*t,r=t<2,o=t/h*Math.PI*2+.55*(0,u.hash)(a),n=r?1+.3*(0,u.hash)(a+1.7):1.75+.65*(0,u.hash)(a+1.7),l=r?1.05+.2*(0,u.hash)(a+2.9):-.12+.6*(0,u.hash)(a+2.9),M=r?.3:.8+.45*(0,u.hash)(a+4.1),y=!r&&l<.12&&.5>(0,u.hash)(a+6.1);m.set(Math.cos(o),0,Math.sin(o));for(let e=0;e<f;e++){let t=.14+.86*e/(f-1),o=s.clone().addScaledVector(m,n*t*Math.cos(l)).addScaledVector(d,n*(t*Math.sin(l)-M*t*t));p.copy(m).multiplyScalar(Math.cos(l)).addScaledVector(d,Math.sin(l)-2*M*t).normalize(),q.crossVectors(p,d).normalize();let h=(r?.36:.6)*(.5+.5*Math.sin(Math.PI*(.18+.82*t)));for(let n of[-1,1]){let l=q.clone().multiplyScalar(.8*n).addScaledVector(d,r?-.15:-.55).addScaledVector(p,.4).normalize(),f=o.clone().addScaledVector(l,.5*h);Q.crossVectors(l,p).normalize(),Q.y<0&&Q.negate();let m=new i.Vector3().crossVectors(l,Q).normalize();Q.crossVectors(m,l).normalize(),Y.makeBasis(m,l,Q);let M=(r?.12:.15)/.73,x=.86+.18*(0,u.hash)(a+1.9*e+n),g=r?W.clone():B.clone().lerp(W,.5*t+.12*(0,u.hash)(a+e));y&&g.lerp(L,.45+.35*t),c.push({offset:f,normal:f.clone().sub(s).normalize().multiplyScalar(.55).add(new i.Vector3(0,.75,0)).normalize(),rotation:new i.Quaternion().setFromRotationMatrix(Y),size:M,stretch:h/M,sway:.5+.5*t,color:g.multiplyScalar(x)})}}}return{flame:!1,crownTop:Math.max(...c.map(e=>e.offset.y))+.2,leaves:c,wood:l,petals:[],flies:Array.from({length:3},(t,r)=>{let o=r/3*Math.PI*2+(0,u.hash)(e+1.9*r);return new i.Vector3(.6*s.x+1.2*Math.cos(o),.8+(0,u.hash)(e+4.4*r)*a*.6,1.2*Math.sin(o))}),petalColor:L.clone()}})(5.1*o+23.7*t,ef))]},[ef,y,o,ec,eu]),eM=(0,l.useMemo)(()=>(function(e,t,a,r,o){let n=[];for(let l=1;n.length<14&&l<260;l++){let s=(0,u.hash)(o+2.17*l)*Math.PI*2;if(void 0!==r&&.6>X(s,r))continue;let i=t*(.34+.42*(0,u.hash)(o+3.43*l)),c=Math.cos(s)*i,h=Math.sin(s)*i,f=e(c,h);f<a-.2||$(e,c,h)>.3||n.push({x:c,y:f-.1,z:h,yaw:0})}return n})(e,t,a,r,o),[r,a,t,e,o]),ey=(0,l.useMemo)(()=>(function(e,t,a,r){let o=[];for(let n=1;o.length<10&&n<120;n++){let l=(0,u.hash)(1.31*r+2.71*n)*Math.PI*2;if(void 0!==a&&1>X(l,a))continue;let s=Math.cos(l),i=Math.sin(l),c=-1;for(let a=1.06*t;a>.6*t;a-=.12)if(e(s*a,i*a)>.5){c=a;break}if(c<0)continue;let h=s*c,f=i*c,d=e(h,f);d>.9||$(e,h,f)>.4||o.push({x:h,y:d-.12,z:f,yaw:-l+((0,u.hash)(r+5.3*n)-.5)*.7})}return o})(e,t,r,o),[r,t,e,o]),ex=ep.reduce((e,t)=>e+t.leaves.length,0),eg=ep.reduce((e,t)=>e+t.wood.length,0),ev=ep.reduce((e,t)=>e+Math.min(ed,t.petals.length),0),ew=ep.length*em,eS=(0,l.useMemo)(()=>{let e=m.clone(),t=new Float32Array(3*ex),a=new Float32Array(ex),r=0;for(let e of ep)for(let o of e.leaves)o.normal.toArray(t,3*r),a[r]=o.sway,r+=1;e.setAttribute("aSphereNormal",new i.InstancedBufferAttribute(t,3)),e.setAttribute("aSway",new i.InstancedBufferAttribute(a,1)),e.setAttribute("aTree",new i.InstancedBufferAttribute(new Float32Array(4*ex),4));let n=p.clone(),l=new Float32Array(Math.max(1,eg));for(let e of(r=0,ep))for(let t of e.wood)l[r++]=t.flare;n.setAttribute("aFlare",new i.InstancedBufferAttribute(l,1)),n.setAttribute("aTree",new i.InstancedBufferAttribute(new Float32Array(4*Math.max(1,eg)),4));let s=M.clone(),c=new Float32Array(4*Math.max(1,ev)),h=new Float32Array(4*Math.max(1,ev));r=0,ep.forEach((e,t)=>{e.petals.slice(0,ed).forEach((e,a)=>{let n=o+17.3*t+3.1*a;c.set([e.x,e.y,e.z,(0,u.hash)(n)],4*r),eo.set((0,u.hash)(n+1.1)-.5,(0,u.hash)(n+2.2)-.5,(0,u.hash)(n+3.3)-.5).normalize(),h.set([eo.x,eo.y,eo.z,(0,u.hash)(n+4.4)],4*r),r+=1})}),s.setAttribute("aPetal",new i.InstancedBufferAttribute(c,4)),s.setAttribute("aSpin",new i.InstancedBufferAttribute(h,4)),s.setAttribute("aTree",new i.InstancedBufferAttribute(new Float32Array(4*Math.max(1,ev)),4));let f=new i.BufferGeometry;f.setAttribute("position",new i.BufferAttribute(new Float32Array(3*Math.max(1,ew)),3));let d=new Float32Array(4*Math.max(1,ew));for(let e=0;e<ew;e++)d[4*e+3]=(0,u.hash)(o+7.9*e);return f.setAttribute("aFly",new i.BufferAttribute(d,4)),{leaf:e,wood:n,petal:s,fly:f}},[ep,ew,ex,ev,ed,o,eg]);(0,l.useLayoutEffect)(()=>()=>{eS.leaf.dispose(),eS.wood.dispose(),eS.petal.dispose(),eS.fly.dispose()},[eS]);let eb=(0,l.useMemo)(()=>({uTime:{value:0},uNight:{value:0}}),[]);return((0,l.useLayoutEffect)(()=>{let e=v.current,t=w.current;if(!e||!t)return;let a=0;for(let t of ep)for(let r of t.leaves)e.setColorAt(a++,r.color);for(let r of(e.instanceColor&&(e.instanceColor.needsUpdate=!0),a=0,ep))for(let e of r.wood)t.setColorAt(a++,e.color);t.instanceColor&&(t.instanceColor.needsUpdate=!0);let r=S.current;if(r){for(let e of(a=0,ep))for(let t=0;t<Math.min(ed,e.petals.length);t++)r.setColorAt(a++,e.petalColor.clone().multiplyScalar(.92+.16*(0,u.hash)(o+1.7*a)));r.instanceColor&&(r.instanceColor.needsUpdate=!0)}P.current=-1},[ep,ed,o]),(0,s.useFrame)(e=>{let t=e.clock.elapsedTime;(0,d.tickWind)(t);let a=c.skyState.dayNight,r=b.current;r&&(r.visible=a>.2);let o=A.current;o&&(o.uniforms.uTime.value=t,o.uniforms.uNight.value=Math.min(1,(a-.2)*1.6));let n=I?.version??0;n!==P.current&&(P.current=n,(e=>{let t=v.current,a=w.current,r=S.current,o=b.current;if(!t||!a)return;let n=Z(eM,ec,e),l=Z(ey,eu,e,4.5,n,.9),s=t.geometry.getAttribute("aTree"),i=t.geometry.getAttribute("aSphereNormal"),c=a.geometry.getAttribute("aTree"),h=r?.geometry.getAttribute("aTree"),u=o?.geometry.getAttribute("position"),f=0,d=0,m=0,p=0;ep.forEach((e,o)=>{let M=o<ec?n[o]:l[o-ec],y=+!!M,x=M??{x:0,y:-50,z:0,yaw:0},g=[x.x,x.y,x.z,e.crownTop];for(let t of(et.setFromAxisAngle(es,x.yaw),e.wood)){en.copy(t.from).applyQuaternion(et),el.copy(t.to).applyQuaternion(et),eo.subVectors(el,en);let e=eo.length();ee.setFromUnitVectors(es,eo.normalize()),J.compose(ea.set(x.x+en.x,x.y+en.y,x.z+en.z),ee,er.set(t.radius*y,e*y,t.radius*y)),a.setMatrixAt(d,J),c.setXYZW(d,...g),d+=1}for(let a of e.leaves)en.copy(a.offset).applyQuaternion(et),ee.copy(et).multiply(a.rotation),J.compose(ea.set(x.x+en.x,x.y+en.y,x.z+en.z),ee,er.set(a.size*y,a.size*a.stretch*y,a.size*y)),t.setMatrixAt(f,J),s.setXYZW(f,...g),el.copy(a.normal).applyQuaternion(et),i.setXYZ(f,el.x,el.y,el.z),f+=1;for(let t=0;t<Math.min(ed,e.petals.length);t++)r&&h&&(J.makeScale(y,y,y),r.setMatrixAt(m,J),h.setXYZW(m,...g)),m+=1;for(let t=0;t<em;t++)en.copy(e.flies[t%e.flies.length]).applyQuaternion(et),u?.setXYZ(p,x.x+en.x,x.y+en.y-100*!y,x.z+en.z),p+=1}),a.instanceMatrix.needsUpdate=!0,t.instanceMatrix.needsUpdate=!0,s.needsUpdate=!0,i.needsUpdate=!0,c.needsUpdate=!0,a.computeBoundingSphere(),t.computeBoundingSphere(),t.boundingSphere&&(t.boundingSphere.radius+=.6),r&&h&&(r.instanceMatrix.needsUpdate=!0,h.needsUpdate=!0),u&&o&&(u.needsUpdate=!0,o.geometry.computeBoundingSphere())})(I?.list()??[]))}),0===ep.length)?null:(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)("instancedMesh",{ref:v,args:[eS.leaf,C,ex],customDepthMaterial:R,castShadow:!0,receiveShadow:!1,raycast:()=>null}),(0,n.jsx)("instancedMesh",{ref:w,args:[eS.wood,G,eg],customDepthMaterial:E,castShadow:!0,receiveShadow:!0,raycast:()=>null}),ev>0&&(0,n.jsx)("instancedMesh",{ref:S,args:[eS.petal,H,ev],frustumCulled:!1,castShadow:!1,receiveShadow:!1,raycast:()=>null}),ew>0&&(0,n.jsx)("points",{ref:b,geometry:eS.fly,visible:!1,frustumCulled:!1,renderOrder:9,raycast:()=>null,children:(0,n.jsx)("shaderMaterial",{ref:A,uniforms:eb,vertexShader:z,fragmentShader:T,transparent:!0,depthWrite:!1,blending:i.AdditiveBlending})})]})}])},63026,83701,e=>{"use strict";var t=e.i(43476),a=e.i(71645),r=e.i(94800),o=e.i(90072),n=e.i(88316),l=e.i(60284),s=e.i(27225),i=e.i(95657),c=e.i(82530),h=e.i(75640);let u=c.DOCK_HALF;function f(e){return[e-.18,h.DECK+1.62,-(u+.03)]}let d=null,m=new o.Vector3;e.s([],63026),e.s(["Dock",0,function({angle:e,reach:p,end:M=p+c.DOCK_END_OFFSET,gangway:y=!0}){let x=.74*p,g=(0,a.useMemo)(()=>(function(e,t,a){let r=3.17*e+1.31*t,n=(0,h.seeded)(r),l=t-e,s=new i.Pieces;(0,h.addDeck)(s,{start:e,end:t,half:u,seed:r});let d=Math.max(2,Math.round(l/1.75)+1),m=[];for(let t=0;t<d;t++){let a=e+.5+t/(d-1)*(l-.68);for(let e of(m.push(a),[-1,1])){if(t===d-1&&e<0)continue;let o=2*t+ +(e>0);(0,h.addPile)(s,{x:a,z:e*(u+.03),top:h.DECK+.2+.32*n(o+5.7),radius:.15+.045*n(o+5.1),rope:n(o+8.2)>.4,seed:r+7.7*o})}s.add(new o.BoxGeometry(.17,.13,2*u+.36),h.BEAM,(0,i.pose)([a,h.DECK-h.THICK-.2,0]),.18);let c=t%2==0?1:-1;s.add(new o.BoxGeometry(.06,.1,Math.hypot(2*u,.95)),"#6a442d",(0,i.pose)([a+.12,h.DECK-h.THICK-.75,0],[Math.atan2(.95,2*u)*c,0,0]),.15)}let p=m[Math.min(m.length-1,Math.floor(m.length/2))],M=[p-.02,h.DECK+.02,u+.32];s.addLocal(new o.TorusGeometry(.3,.085,6,16),(e,t,a,r,o)=>{let n=Math.atan2(t,e)+Math.PI;o.set(Math.floor(n/(Math.PI/4))%2==0?"#e0533d":"#f5efe3")},(0,i.pose)(M,[.12,0,.18])),s.add(new o.CylinderGeometry(.014,.014,.36,4),h.ROPE,(0,i.pose)([p,h.DECK+.38,u+.3],[.5,0,0]));let y=t-.85,x=u-.32;for(let e of(s.add(new o.CylinderGeometry(.13,.15,.27,10),h.IRON,(0,i.pose)([y,h.DECK+.135,x]),.15),s.add(new o.CylinderGeometry(.2,.17,.07,10),h.IRON,(0,i.pose)([y,h.DECK+.3,x]),.15),s.add(new o.SphereGeometry(.12,10,3,0,2*Math.PI,0,Math.PI/2),"#4b5a64",(0,i.pose)([y,h.DECK+.335,x])),s.add(new o.TorusGeometry(.165,.036,5,14),h.ROPE,(0,i.pose)([y,h.DECK+.17,x],[Math.PI/2,0,.12])),s.add(new o.TorusGeometry(.21,.045,5,16),h.ROPE,(0,i.pose)([y-.62,h.DECK+.045,x-.06],[Math.PI/2,0,0])),s.add(new o.TorusGeometry(.12,.045,5,12),h.ROPE,(0,i.pose)([y-.62,h.DECK+.1,x-.06],[Math.PI/2,0,0])),[-1,1])){var g,v;g=t-c.BOLLARD_INSET,v=e*c.BOLLARD_SPREAD,s.add(new o.CylinderGeometry(.1,.13,.16,10),h.IRON,(0,i.pose)([g,h.DECK+.08,v]),.15),s.add(new o.CylinderGeometry(.072,.08,.1,10),h.IRON,(0,i.pose)([g,h.DECK+.21,v]),.12),s.add(new o.CylinderGeometry(.125,.09,.06,10),h.IRON,(0,i.pose)([g,h.DECK+.28,v]),.15),s.add(new o.SphereGeometry(.11,10,3,0,2*Math.PI,0,Math.PI/2),"#4b5a64",(0,i.pose)([g,h.DECK+.3,v]))}if(a)for(let e of[-1,1])s.add(new o.BoxGeometry(.1,.06,.05),h.IRON,(0,i.pose)([t-.02,h.DECK+.03,e*(c.GANGWAY_WIDTH/2+.03)]),.1);else{for(let e of[-1,1])s.add(new o.BoxGeometry(.06,2.05,.06),"#6b4a33",(0,i.pose)([t+.07,h.DECK+.35-1.02,.27*e]),.12);for(let e=0;e<5;e++)s.add(new o.BoxGeometry(.05,.04,.54),"#7c5639",(0,i.pose)([t+.07,h.DECK-.22-.3*e,0]),.12)}for(let e of[-1,1]){let a=.66*e;for(let r of(s.add(new o.CylinderGeometry(.012,.012,.3,4),h.ROPE,(0,i.pose)([t+.1,h.DECK-.12,a])),s.addLocal(new o.CylinderGeometry(.11,.11,.34,10,3),(e,t,a,r,o)=>{o.set(.06>Math.abs(t)?"#3b7fc4":"#f5efe3")},(0,i.pose)([t+.13,h.DECK-.45,a],[0,0,.08*e]),.08),[-1,1]))s.add(new o.SphereGeometry(.11,10,4,0,2*Math.PI,r>0?0:Math.PI/2,Math.PI/2),"#f5efe3",(0,i.pose)([t+.13-.08*e*r*.17,h.DECK-.45+.17*r,a]))}let[w,S,b]=f(t);return(0,h.addLanternPost)(s,{x:w,y:S,z:b,seed:r}),s.build()})(x,M,y),[x,M,y]),v=(0,a.useMemo)(()=>(function(){if(d)return d;let e=new i.Pieces,t=c.GANGWAY_THICK/2;for(let t of(e.add((0,i.bevelBox)(c.GANGWAY_LENGTH,.6*c.GANGWAY_THICK,c.GANGWAY_WIDTH-.08,.015),"#d9a86c",(0,i.pose)([c.GANGWAY_LENGTH/2,0,0]),.2),[-1,1]))e.add(new o.BoxGeometry(c.GANGWAY_LENGTH,c.GANGWAY_THICK,.05),"#8a5a36",(0,i.pose)([c.GANGWAY_LENGTH/2,0,t*(c.GANGWAY_WIDTH/2-.025)]),.18);for(let a=0;a<8;a++){let r=.25+a*((c.GANGWAY_LENGTH-.45)/7);e.add(new o.BoxGeometry(.035,.022,c.GANGWAY_WIDTH-.1),"#b9874f",(0,i.pose)([r,.6*t+.011,0]),.15)}return e.add(new o.CylinderGeometry(.04,.04,c.GANGWAY_WIDTH+.02,8),h.IRON,(0,i.pose)([c.GANGWAY_LENGTH-.04,-t,0],[Math.PI/2,0,0])),e.add(new o.TorusGeometry(.07,.016,4,10,Math.PI),h.ROPE,(0,i.pose)([c.GANGWAY_LENGTH-.12,.6*t,0],[Math.PI/2,0,Math.PI/2])),d=e.build()})(),[]),w=(0,a.useRef)(null),S=(0,a.useRef)(null),b=(0,a.useRef)(null),A=(0,a.useRef)(null),I=(0,a.useRef)({dip:0,velocity:0,landed:!1,touched:-1}),P=(0,s.useWorld)(e=>e.quality),[z,T,C]=f(M);return(0,a.useEffect)(()=>()=>g.dispose(),[g]),(0,r.useFrame)((t,a)=>{let r=l.skyState.dayNight,o=t.clock.elapsedTime,s=Math.min(a,1/30);(0,h.updateHarborLights)(o,r);let i=r>.04;b.current&&(b.current.visible=i),A.current&&(A.current.visible=i);let u=n.mooring.berth,f=null!==u&&1e-6>Math.abs(u.dockAngle-e)&&"free"!==n.mooring.phase,d=I.current,p=S.current;if(p&&y){let e=f?(0,n.gangwayDeploy)(o):0,t=.04,a=0;if(e>0&&w.current){w.current.worldToLocal(m.copy(n.mooring.landing));let r=m.x-(M+c.GANGWAY_HINGE_X);t=Math.atan2(m.y+.04-c.GANGWAY_HINGE_Y,Math.max(r,.5)),a=Math.atan2(-m.z,Math.max(r,.5))*Math.min(1.5*e,1)}let r=n.mooring.castOffAt>=0&&o>=n.mooring.castOffAt;p.rotation.set(0,a,function(e,t,a){if(e<=0)return Math.PI;if(a){let a=1-e;return t+a*a*(3-2*a)*(Math.PI-t)}if(e<.45)return Math.PI-Math.PI/2*Math.sin(e/.45*(Math.PI/2));if(e<.86)return Math.PI/2-(Math.PI/2-t)*(1-Math.cos(Math.PI/2*((e-.45)/.41)));let r=(e-.86)/.14;return t+.06*Math.sin(Math.min(r,1)*Math.PI)*(1-.5*r)}(e,t,r));let l=e>.86&&!r;!l||d.landed||n.mooring.calm||(d.velocity-=.2),d.landed=l}f&&u&&!u.gangway&&n.mooring.stopAt!==d.touched&&o>=n.mooring.stopAt&&o<n.mooring.stopAt+.5&&(d.touched=n.mooring.stopAt,n.mooring.calm||(d.velocity-=.16)),d.velocity+=(-(70*d.dip)-6*d.velocity)*s,d.dip+=d.velocity*s,w.current&&(w.current.position.y=d.dip)}),(0,t.jsxs)("group",{ref:w,"rotation-y":-e,children:[(0,t.jsx)("mesh",{geometry:g,material:h.PAINTED,castShadow:!0,receiveShadow:!0}),y&&(0,t.jsx)("group",{ref:S,position:[M+c.GANGWAY_HINGE_X,c.GANGWAY_HINGE_Y,0],"rotation-z":Math.PI,children:(0,t.jsx)("mesh",{geometry:v,material:h.PAINTED,castShadow:"low"!==P,receiveShadow:!0,raycast:()=>null})}),(0,t.jsx)("mesh",{geometry:h.LANTERN_GLASS_GEOMETRY,material:h.LANTERN_GLASS,position:[z,T+.005,C],raycast:()=>null}),(0,t.jsx)("mesh",{ref:b,geometry:h.LIGHT_POOL_GEOMETRY,material:h.LIGHT_POOL,position:[z-.55,h.DECK+.03,C+.7],visible:!1,renderOrder:4,raycast:()=>null}),(0,t.jsx)("sprite",{ref:A,material:h.LANTERN_HALO,position:[z,T,C],scale:1.5,visible:!1,raycast:()=>null})]})}],83701)},38971,75155,67639,e=>{"use strict";let t,a,r;var o=e.i(43476),n=e.i(71645),l=e.i(90072),s=e.i(55479),i=e.i(27225),c=e.i(49184),h=e.i(46671),u=e.i(617);let f=function(){let e=new u.MeshBuilder,t=[0,.3,0],a=e=>{let t=e/5*Math.PI*2;return[+Math.cos(t),.07,+Math.sin(t)]},r=e=>{let t=(e+.5)/5*Math.PI*2;return[.34*Math.cos(t),.1,.34*Math.sin(t)]},o=e=>{let t=e/5*Math.PI*2;return[.56*Math.cos(t),.22,.56*Math.sin(t)]},n=(e,t)=>{let a=e/5*Math.PI*2,r=-Math.sin(a)*t,o=Math.cos(a)*t;return[.56*Math.cos(a)+.17*r,.08,.56*Math.sin(a)+.17*o]},l=(e,t,a,r,o)=>{o.setScalar(.8+.38*Math.min(1,t/.3))};for(let s=0;s<5;s++){let i=r((s+5-1)%5),c=r(s),h=n(s,-1),u=n(s,1),f=o(s),d=a(s);e.triangleUp(t,i,h,l),e.triangleUp(t,h,f,l),e.triangleUp(t,f,u,l),e.triangleUp(t,u,c,l),e.triangleUp(h,d,f,l),e.triangleUp(f,d,u,l);let m=[i,h,d,u,c];for(let t=0;t<m.length-1;t++){let a=m[t],r=m[t+1];e.quad(a,[a[0],-.02,a[2]],[r[0],-.02,r[2]],r,(e,t,a,r,o)=>o.setScalar(.72))}}return e.build()}(),d=function(){let e=new u.MeshBuilder,t=[.08,.45,.78,1],a=(e,a)=>{let r=t[a],o=-1.25+e/18*2.5;return[Math.sin(o)*r,.26*(1-r*r)+.03+(e%2==1?.07*r:0),Math.cos(o)*r-.45]},r=(e,t,a,r,o)=>{o.setScalar(.78+.18*Math.min(1,t/.3)+.1*(Math.hypot(e,a+.45)>.9))};for(let o=0;o<t.length-1;o++)for(let t=0;t<18;t++)e.triangleUp(a(t,o),a(t+1,o),a(t+1,o+1),r),e.triangleUp(a(t,o),a(t+1,o+1),a(t,o+1),r);let o=[0,.04,-.52];for(let t=0;t<18;t++)e.triangleUp(o,a(t,0),a(t+1,0),r);for(let t of[-1,1])e.triangleUp([.06*t,.05,-.5],[.3*t,.03,-.56],[.26*t,.05,-.36],r);for(let r=0;r<18;r++){let o=a(r,t.length-1),n=a(r+1,t.length-1);e.quad(o,n,[n[0],-.02,n[2]],[o[0],-.02,o[2]],(e,t,a,r,o)=>o.setScalar(.7))}return e.build()}(),m=new l.MeshStandardMaterial({color:"#ffffff",vertexColors:!0,roughness:.78,metalness:0,flatShading:!0});m.name="beach-treasures";let p=["#e8774f","#e05a48","#f2a04d","#b9577e","#e98a5e"],M=["#f3e3cc","#f0c9b8","#f5d7a8","#e9b6a7","#f7eee0"],y=new l.Vector3,x=new l.Quaternion,g=new l.Quaternion,v=new l.Vector3,w=new l.Vector3(0,1,0),S=new l.Vector3;function b({geometry:e,sampler:t,zone:a,count:r,seed:s,minSize:i,maxSize:u,colors:f}){let d=(0,n.useRef)(null),p=JSON.stringify(a),M=(0,n.useMemo)(()=>(0,h.scatterSpots)(t,JSON.parse(p),r,s,{size:[i,u],spacing:3}),[r,u,i,t,s,p]);return((0,n.useLayoutEffect)(()=>{let e=d.current;if(!e)return;let a=new l.Matrix4,r=new l.Color;M.forEach((o,n)=>{S.set(t(o.x-.3,o.z)-t(o.x+.3,o.z),.6,t(o.x,o.z-.3)-t(o.x,o.z+.3)).normalize(),g.setFromUnitVectors(w,S),x.setFromAxisAngle(w,o.yaw),g.multiply(x);let l=o.size/2;y.set(o.x,o.y-.01,o.z),v.set(l,l*(.8+.4*(0,c.hash)(3.1*o.key)),l),a.compose(y,g,v),e.setMatrixAt(n,a),e.setColorAt(n,r.set(f[Math.floor((0,c.hash)(7.3*o.key)*f.length)%f.length]))}),e.instanceMatrix.needsUpdate=!0,e.instanceColor&&(e.instanceColor.needsUpdate=!0),e.computeBoundingSphere()},[f,t,M]),0===M.length)?null:(0,o.jsx)("instancedMesh",{ref:d,args:[e,m,M.length],castShadow:!1,receiveShadow:!0,raycast:()=>null},M.length)}e.s(["BeachTreasures",0,function({sampler:e,zone:t,starfish:a=5,shells:r=7,seed:n}){let l=(0,i.useWorld)(e=>e.quality),c=s.QUALITY_LEVELS[l].vegetationDensity;return(0,o.jsxs)(o.Fragment,{children:[a>0&&(0,o.jsx)(b,{geometry:f,sampler:e,zone:t,count:Math.max(1,Math.round(a*c)),seed:n,minSize:.42,maxSize:.62,colors:p}),r>0&&"low"!==l&&(0,o.jsx)(b,{geometry:d,sampler:e,zone:t,count:Math.round(r*c),seed:n+17,minSize:.24,maxSize:.36,colors:M})]})}],38971);var A=e.i(94800),I=e.i(60284);let P=`
attribute float aWing;
attribute vec4 aPath;
attribute vec4 aMotion;
attribute vec3 aTint;
uniform float uTime;
uniform float uPresence;
`,z=`
vec3 transformed = vec3( position );
{
  float t = uTime * aMotion.x + aMotion.y;
  // Boucle irr\xe9guli\xe8re autour du massif de fleurs, mont\xe9es et descentes.
  vec2 loop = vec2( cos( t ) + 0.35 * cos( t * 2.3 + 1.0 ), sin( t * 1.1 ) + 0.3 * sin( t * 2.9 ) ) * aPath.z;
  float height = aPath.w + sin( t * 3.1 ) * 0.25 + sin( t * 7.3 ) * 0.06;
  vec2 ahead = vec2( - sin( t ) - 0.8 * sin( t * 2.3 + 1.0 ), 1.1 * cos( t * 1.1 ) + 0.87 * cos( t * 2.9 ) );
  float yaw = atan( ahead.y, ahead.x );
  // Battements rapides, entrecoup\xe9s de courts plan\xe9s.
  float glide = smoothstep( 0.6, 0.95, sin( uTime * 0.9 + aMotion.y * 3.0 ) );
  float flap = mix( sin( uTime * aMotion.z + aMotion.y * 5.0 ) * 1.05, 0.35, glide );
  if ( aWing != 0.0 ) {
    float reach = abs( transformed.z );
    transformed.y = sin( flap ) * reach;
    transformed.z = aWing * cos( flap ) * reach;
  }
  transformed *= aMotion.w * uPresence;
  float c = cos( yaw );
  float s = sin( yaw );
  transformed = vec3( transformed.x * c - transformed.z * s, transformed.y, transformed.x * s + transformed.z * c );
  transformed += vec3( aPath.x + loop.x, height, aPath.y + loop.y );
}
`,T=`
float faceDirection = 1.0;
vec3 normal = normalize( vNormal );
vec3 nonPerturbedNormal = normal;
`,C={uTime:{value:0},uPresence:{value:1}},R=function(){let e=[],t=[],a=[],r=(r,o,n)=>{for(let l of r)e.push(...l),t.push(o),a.push(n)};for(let e of[1,-1])r([[.02,0,.01*e],[.13,0,.17*e],[-.03,0,.2*e]],e,1),r([[.02,0,.01*e],[-.03,0,.2*e],[-.06,0,.03*e]],e,.85),r([[-.02,0,.01*e],[-.06,0,.13*e],[-.14,0,.08*e]],e,.75);r([[.07,.008,0],[-.09,.008,.012],[-.09,.008,-.012]],0,.25);let o=new l.BufferGeometry;return o.setAttribute("position",new l.BufferAttribute(new Float32Array(e),3)),o.setAttribute("normal",new l.BufferAttribute(new Float32Array(e.length).map((e,t)=>+(t%3==1)),3)),o.setAttribute("aWing",new l.BufferAttribute(new Float32Array(t),1)),o.setAttribute("color",new l.BufferAttribute(new Float32Array(a.flatMap(e=>[e,e,e])),3)),o}(),G=((t=new l.MeshStandardMaterial({color:"#ffffff",vertexColors:!0,roughness:.8,metalness:0,side:l.DoubleSide})).name="butterflies",t.onBeforeCompile=e=>{Object.assign(e.uniforms,C),e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
${P}`).replace("#include <begin_vertex>",z).replace("#include <color_vertex>","#include <color_vertex>\nvColor.rgb *= aTint;"),e.fragmentShader=e.fragmentShader.replace("#include <normal_fragment_begin>",T)},t.customProgramCacheKey=()=>"butterflies-v1",t),E=["#f29a3c","#f7f1e3","#f2d24f","#86bbe8","#e8789a"];e.s(["Butterflies",0,function({spots:e,seed:t=1}){let a=(0,n.useRef)(null),r=(0,i.useWorld)(e=>e.quality),s=JSON.stringify(e),h=(0,n.useMemo)(()=>{let e=JSON.parse(s),a=R.clone(),r=new Float32Array(4*Math.max(1,e.length)),o=new Float32Array(4*Math.max(1,e.length)),n=new Float32Array(3*Math.max(1,e.length)),i=new l.Color;return e.forEach(([e,a,l],s)=>{let h=t+7.31*s;r.set([e,l,.9+1.1*(0,c.hash)(h),a+.7+.7*(0,c.hash)(h+1.3)],4*s),o.set([(.35+.25*(0,c.hash)(h+2.1))*((0,c.hash)(h+2.9)>.5?1:-1),6.28*(0,c.hash)(h+3.7),15+7*(0,c.hash)(h+4.3),.85+.4*(0,c.hash)(h+5.9)],4*s),i.set(E[Math.floor((0,c.hash)(h+6.6)*E.length)%E.length]),n.set([i.r,i.g,i.b],3*s)}),a.setAttribute("aPath",new l.InstancedBufferAttribute(r,4)),a.setAttribute("aMotion",new l.InstancedBufferAttribute(o,4)),a.setAttribute("aTint",new l.InstancedBufferAttribute(n,3)),a},[s,t]),u="low"===r?0:JSON.parse(s).length;return((0,A.useFrame)(e=>{C.uTime.value=e.clock.elapsedTime,C.uPresence.value=1-Math.min(1,Math.max(0,(I.skyState.dayNight-.15)*3)),a.current&&(a.current.visible=C.uPresence.value>.02)}),0===u)?null:(0,o.jsx)("instancedMesh",{ref:a,args:[h,G,u],frustumCulled:!1,castShadow:!1,receiveShadow:!1,raycast:()=>null})}],75155);var H=e.i(61287);let k={pebble:["#b9ab98","#a79a8d","#c7b59a","#9d948f","#b49d86"],boulder:["#a39486","#958a8f","#b08b72","#8f8478","#a99a8a"],stone:["#a8a195","#9b958d","#b3a48f"]},N=`
attribute vec4 aRock;
varying vec3 vRockLocal;
varying vec3 vRockWorld;
varying vec4 vRockData;

float rockHash( float n ) {
  return fract( sin( n ) * 43758.5453123 );
}

vec3 rockAxis( float n ) {
  float u = rockHash( n ) * 2.0 - 1.0;
  float a = rockHash( n + 0.618 ) * 6.2831853;
  float s = sqrt( max( 0.0, 1.0 - u * u ) );
  return vec3( s * cos( a ), u, s * sin( a ) );
}

// La pierre : une sph\xe8re bossel\xe9e, recoup\xe9e par des plans (reste convexe, faces franches).
vec3 rockShape( vec3 p, vec4 data ) {
  vec3 dir = normalize( p );
  float seed = data.x;
  float r = 1.0
    + 0.13 * sin( dot( dir, rockAxis( seed + 1.1 ) ) * 3.0 + seed * 2.7 )
    + 0.07 * sin( dot( dir, rockAxis( seed + 2.3 ) ) * 5.0 + seed * 1.3 );
  float depth = mix( 0.9, 0.52, data.z );
  for ( int k = 0; k < 9; k ++ ) {
    float fk = float( k );
    vec3 n = rockAxis( seed * 1.37 + fk * 3.17 );
    float c = dot( dir, n );
    if ( c > 0.08 ) r = min( r, ( depth + rockHash( seed + fk * 7.7 ) * 0.2 ) / c );
  }
  vec3 q = dir * r;
  q.y = max( q.y, - 0.5 );
  return q;
}
`,O=`
#include <begin_vertex>
transformed = rockShape( transformed, aRock );
`,_=`
#include <project_vertex>
vRockLocal = transformed;
vRockData = aRock;
vRockWorld = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;
`,D=`
varying vec3 vRockLocal;
varying vec3 vRockWorld;
varying vec4 vRockData;

float rockHashF( float n ) {
  return fract( sin( n ) * 43758.5453123 );
}

float rockNoise( vec3 p ) {
  vec3 i = floor( p );
  vec3 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  float n = dot( i, vec3( 1.0, 57.0, 113.0 ) );
  return mix(
    mix( mix( rockHashF( n ), rockHashF( n + 1.0 ), f.x ), mix( rockHashF( n + 57.0 ), rockHashF( n + 58.0 ), f.x ), f.y ),
    mix( mix( rockHashF( n + 113.0 ), rockHashF( n + 114.0 ), f.x ), mix( rockHashF( n + 170.0 ), rockHashF( n + 171.0 ), f.x ), f.y ),
    f.z );
}
`,F=`
#include <color_fragment>
{
  vec3 rockN = normalize( cross( dFdx( vRockWorld ), dFdy( vRockWorld ) ) );
  // Chaque facette a son ton : la pierre se lit taill\xe9e m\xeame dans l'ombre.
  float facet = rockHashF( dot( floor( rockN * 3.0 + 0.5 ), vec3( 1.0, 7.0, 49.0 ) ) + vRockData.x * 3.7 );
  diffuseColor.rgb *= 0.88 + facet * 0.2;
  // Pied plus sombre : la pierre est pos\xe9e, pas coll\xe9e.
  diffuseColor.rgb *= mix( 0.74, 1.0, smoothstep( - 0.5, 0.25, vRockLocal.y ) );
  // Mousse sur les faces tourn\xe9es vers le ciel, en plaques irr\xe9guli\xe8res.
  float mossNoise = rockNoise( vRockLocal * 2.6 + vRockData.x );
  float moss = smoothstep( 0.42, 0.72, rockN.y + ( mossNoise - 0.5 ) * 0.7 ) * vRockData.y;
  vec3 mossColor = mix( vec3( 0.27, 0.42, 0.17 ), vec3( 0.47, 0.6, 0.24 ), mossNoise );
  diffuseColor.rgb = mix( diffuseColor.rgb, mossColor, moss );
  // Lichen : petites taches claires, jaunes ou cendr\xe9es.
  float lichenNoise = rockNoise( vRockLocal * 6.5 + vRockData.x * 1.9 + 3.1 );
  float lichen = smoothstep( 0.7, 0.76, lichenNoise ) * vRockData.w * ( 1.0 - moss );
  vec3 lichenColor = mix( vec3( 0.86, 0.78, 0.42 ), vec3( 0.84, 0.85, 0.74 ), step( 0.5, rockHashF( vRockData.x * 5.1 ) ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, lichenColor, lichen * 0.9 );
  // Ligne d'eau : pierre mouill\xe9e, sombre et bleut\xe9e ; balanes blanches juste au-dessus.
  float wetEdge = vRockWorld.y + ( mossNoise - 0.5 ) * 0.16;
  float wet = 1.0 - smoothstep( 0.12, 0.5, wetEdge );
  diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.52, 0.58, 0.6 ), wet * 0.85 );
  float barnacle = step( 0.88, rockHashF( dot( floor( vRockLocal * 9.0 ), vec3( 1.0, 57.0, 113.0 ) ) + vRockData.x ) )
    * smoothstep( - 0.05, 0.15, wetEdge ) * ( 1.0 - smoothstep( 0.32, 0.55, wetEdge ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.93, 0.9, 0.83 ), barnacle * 0.85 );
}
`,B=new l.IcosahedronGeometry(1,1),W=((a=new l.MeshStandardMaterial({color:"#ffffff",roughness:.93,metalness:0,flatShading:!0})).name="procedural-rocks",a.onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
${N}`).replace("#include <begin_vertex>",O).replace("#include <project_vertex>",_),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
${D}`).replace("#include <color_fragment>",F)},a.customProgramCacheKey=()=>"procedural-rocks-v2",a),L=((r=new l.MeshDepthMaterial).onBeforeCompile=e=>{e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
${N}`).replace("#include <begin_vertex>",O)},r.customProgramCacheKey=()=>"procedural-rocks-depth-v2",r),V=new l.Vector3(0,1,0),U=new l.Quaternion,K=new l.Quaternion,j=new l.Vector3,Y=new l.Vector3,q=new l.Vector3,Q=new l.Matrix4().makeScale(0,0,0);e.s(["RockScatter",0,function({sampler:e,groups:t,shadows:a=!0}){let r=(0,n.useRef)(null),s="low"===(0,i.useWorld)(e=>e.quality),u=JSON.stringify(t),f=(0,n.useMemo)(()=>{let t=[];return JSON.parse(u).forEach(a=>{let r=a.satellites??("pebble"===a.kind?[1,3]:[1,2]);(0,h.clusterSpots)(e,a.zone,s?Math.ceil(.7*a.groups):a.groups,a.seed,{size:a.size,bias:1.4,satellites:s?[0,Math.max(0,r[1]-1)]:r,satelliteScale:"pebble"===a.kind?[.35,.7]:[.3,.55]}).forEach(r=>{let o,n,s,i,h,u,f,d,m,p;return t.push((o=r.key,n=a.palette??k[a.kind],s=new l.Color(n[Math.floor((0,c.hash)(31.7*o)*n.length)%n.length]).multiplyScalar(.92+.14*(0,c.hash)(17.3*o)),i=r.size/2,h="pebble"===a.kind?.42+.22*(0,c.hash)(5.3*o):"boulder"===a.kind?.68+.3*(0,c.hash)(5.3*o):.5+.25*(0,c.hash)(5.3*o),u=.78+.3*(0,c.hash)(7.1*o),Y.set(i,i*h,i*u),j.set(e(r.x-.4,r.z)-e(r.x+.4,r.z),.8,e(r.x,r.z-.4)-e(r.x,r.z+.4)).normalize(),j.lerp(V,.55).normalize(),U.setFromUnitVectors(V,j),K.setFromAxisAngle(V,r.yaw),U.multiply(K),f="stone"===a.kind?.45:"pebble"===a.kind?.32:.3,q.set(r.x,r.y-i*h*f,r.z),d="pebble"===a.kind?.2+.25*(0,c.hash)(3.9*o):.65+.35*(0,c.hash)(3.9*o),m=a.moss??.5*("pebble"!==a.kind),p=a.lichen??("pebble"===a.kind?.25:.6),{matrix:new l.Matrix4().compose(q,U,Y),color:s,data:[1+60*(0,c.hash)(11.3*o),m*(.55+.45*(0,c.hash)(13.7*o)),d,p*(0,c.hash)(19.1*o)],x:r.x,z:r.z,radius:i}))})}),t},[u,s,e]),d=(0,n.useMemo)(()=>{let e=B.clone(),t=new Float32Array(4*Math.max(1,f.length));return f.forEach((e,a)=>t.set(e.data,4*a)),e.setAttribute("aRock",new l.InstancedBufferAttribute(t,4)),e},[f]);return((0,n.useLayoutEffect)(()=>{let e=r.current;e&&(f.forEach((t,a)=>e.setColorAt(a,t.color)),e.instanceColor&&(e.instanceColor.needsUpdate=!0))},[f]),(0,H.useClearingLayout)(e=>{let t=r.current;t&&(f.forEach((a,r)=>{t.setMatrixAt(r,(0,H.inClearing)(e,a.x,a.z,.5*a.radius)?Q:a.matrix)}),t.instanceMatrix.needsUpdate=!0,t.computeBoundingSphere())},f),0===f.length)?null:(0,o.jsx)("instancedMesh",{ref:r,args:[d,W,f.length],customDepthMaterial:L,castShadow:a&&!s,receiveShadow:!0,raycast:()=>null},f.length)}],67639)},30672,e=>{"use strict";var t=e.i(71645),a=e.i(49184),r=e.i(20717);let o=Math.cos(r.LIGHTHOUSE.angle),n=Math.sin(r.LIGHTHOUSE.angle),[l,s]=(0,r.polar)(r.WORKSHOP.angle,r.WORKSHOP.radius),i=(0,r.facing)(r.WORKSHOP.angle+r.WORKSHOP.turn),c=Math.cos(i),h=Math.sin(i);function u(e,t,o,n){let l=n.to[0]-n.from[0],s=n.to[1]-n.from[1],i=((e-n.from[0])*l+(t-n.from[1])*s)/(l*l+s*s);if(i<-.2||i>1.2)return o;let c=(0,a.clamp)(i,0,1),h=Math.hypot(e-(n.from[0]+l*c),t-(n.from[1]+s*c));if(h>n.half+1)return o;let u=1-(0,a.smoothstep)(n.half,n.half+1,h),f=(0,a.smoothstep)(-.2,.02,i)*(1-(0,a.smoothstep)(.98,1.2,i));return(0,a.lerp)(o,(0,r.rampHeight)(n,c),u*f)}var f=e.i(10992),d=e.i(94050),m=e.i(82401),p=e.i(75950);function M(e,t,a){let r=Math.min(1,Math.max(0,(a-e)/(t-e)));return r*r*(3-2*r)}var y=e.i(75847);let x={about:{camera:{zoom:1.55},trees:0,grass:.85,grassPalette:["#6c9a45","#4f7f3a","#8ea94c","#bba556"],dressing:!1,sculpt:function(e,t,i){var f,d;let m,p,M,y,x,g=i,v=(f=Math.atan2(t,e),(0,a.smoothstep)(-1.6,-1,f)*(1-(0,a.smoothstep)(1.95,2.55,f))),w=(0,a.smoothstep)(2.4,3.05,g)*(1-(0,a.smoothstep)(3.9,4.4,g));g=(0,a.lerp)(g,r.VILLAGE_Y,v*w);let[S,b]=(0,r.toDock)(e,t),A=Math.abs(b);if(S>r.HARBOR.cliffTop-1&&A<r.HARBOR.quayHalf+2){let e=1-(0,a.smoothstep)(r.HARBOR.quayHalf-.5,r.HARBOR.quayHalf+.7,A),t=(0,a.smoothstep)(r.HARBOR.cliffTop,r.HARBOR.quayBack,S)*e;g=(0,a.lerp)(g,Math.min(g,r.QUAY_Y-.22),t);let o=1-(0,a.smoothstep)(r.HARBOR.basinHalf-.3,r.HARBOR.basinHalf+.45,A),n=(0,a.smoothstep)(r.HARBOR.quayFront-.25,r.HARBOR.quayFront+.35,S)*o;g=Math.min(g,(0,a.lerp)(g,r.BASIN_FLOOR,n))}g=u(e,t,g,r.HARBOR_STAIR),d=g=u(e,t,g,r.HILL_PATH),M=Math.abs((m=e-l)*c-(p=t-s)*h)-(r.WORKSHOP.width/2+.3),g=(x=Math.max(M,(y=m*h+p*c)>0?(y-r.WORKSHOP.depth/2)*(.8/.35):-y-(r.WORKSHOP.depth/2+.3)))>.8?d:(0,a.lerp)(d,r.VILLAGE_Y,1-(0,a.smoothstep)(0,.8,x));let I=e*o+t*n;if(I>r.LIGHTHOUSE.spurFrom-1&&I<r.LIGHTHOUSE.radius+3){let l=Math.abs(-e*n+t*o),s=1-(0,a.smoothstep)(r.LIGHTHOUSE.spurHalf,r.LIGHTHOUSE.spurHalf+1.3,l),i=(0,a.smoothstep)(r.LIGHTHOUSE.spurFrom-.8,r.LIGHTHOUSE.spurFrom,I)*(1-(0,a.smoothstep)(r.LIGHTHOUSE.radius+.6,r.LIGHTHOUSE.radius+2.4,I)),c=(0,a.lerp)(r.VILLAGE_Y,r.LIGHTHOUSE.spurY,(0,a.smoothstep)(r.LIGHTHOUSE.spurFrom,r.LIGHTHOUSE.spurFrom+2.6,I));g=Math.max(g,(0,a.lerp)(g,c,s*i))}return g}},contact:{trees:2,grass:1,grassPalette:["#6f9a3c","#5f8f3a","#8aa84a","#b08fc8"],dressing:!1,cliffTint:"#d9c9c0",sculpt:(e,t,r,o)=>{let n=r,{hillX:l,hillZ:s,plateau:i,summit:c}=o,h=i+.04,u=c+.36,d=Math.hypot(e-l,t-s);n=(0,a.lerp)(n,u,(0,a.smoothstep)(2.75,2.05,d));let m=Math.hypot(e-f.COTTAGE.x,t-f.COTTAGE.z);n=(0,a.lerp)(n,h,(0,a.smoothstep)(2.95,2.25,m));let p=e*f.DOCK_DIR.x+t*f.DOCK_DIR.z,M=Math.abs(e*f.DOCK_SIDE.x+t*f.DOCK_SIDE.z),y=(0,a.smoothstep)(1.75,1.2,M)*(0,a.smoothstep)(7,7.6,p)*(1-(0,a.smoothstep)(10.5,11.1,p)),x=h-(0,a.smoothstep)(f.DOCK_STAIRS.top,f.DOCK_STAIRS.bottom,p)*(h-.7);n=(0,a.lerp)(n,x,y);let g=(0,f.hillStairs)(l,s),v=e-l,w=t-s,S=v*g.dirX+w*g.dirZ,b=Math.abs(-v*g.dirZ+w*g.dirX),A=(0,a.smoothstep)(1.45,.95,b)*(0,a.smoothstep)(2.1,2.6,S)*(1-(0,a.smoothstep)(5.4,6,S)),I=(0,a.lerp)(u,h,(0,a.smoothstep)(g.from,g.to,S));return(0,a.lerp)(n,I,A)}},experience:d.default,journey:{camera:{zoom:1.1,lift:-.4},trees:0,grass:.85,grassPalette:["#5d9a3f","#3f7b36","#82ab47","#9a6aae"],dressing:!1,cliffTint:"#e4e4ec",sculpt:(e,t)=>(0,m.journeyHeight)(e,t)},projects:{trees:0,grass:.55,grassPalette:["#79ad4b","#94c257","#5d9440","#b9cf63"],dressing:!1,camera:{zoom:1.18,lift:-1},sculpt:(e,t,a)=>{let r=Math.hypot(e,t),o=Math.atan2(t,e),n=a,l=M(p.TOWN.radius+p.TOWN.blend,p.TOWN.radius,r);l>0&&(n+=(p.TOWN.level-n)*l);let s=M(p.SHIPYARD.halfAngle+.12,p.SHIPYARD.halfAngle,Math.abs(((o-p.SHIPYARD.angle)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI));if(s>0){let e=M(p.SHIPYARD.inner-.9,p.SHIPYARD.inner,r)*M(p.SHIPYARD.outer+1.4,p.SHIPYARD.outer,r)*s;e>0&&(n+=(p.SHIPYARD.level-n)*e)}let i=e*Math.cos(p.STAIRS.angle)+t*Math.sin(p.STAIRS.angle),c=Math.abs(-e*Math.sin(p.STAIRS.angle)+t*Math.cos(p.STAIRS.angle));if(i>p.STAIRS.top-.6&&i<p.STAIRS.bottom+1.2&&c<p.STAIRS.halfWidth+.7){let e=Math.min(1,Math.max(0,(i-p.STAIRS.top)/(p.STAIRS.bottom-p.STAIRS.top))),t=p.TOWN.level+(p.STAIRS.foot-p.TOWN.level)*e-.35,a=M(p.STAIRS.halfWidth+.7,p.STAIRS.halfWidth,c)*M(p.STAIRS.top-.6,p.STAIRS.top,i);t<n&&(n+=(t-n)*a)}return n}},skills:{trees:2,grass:.7,dressing:!1,sculpt:(e,t,a,r)=>(0,y.sculptLab)(e,t,a,r.plateau),camera:{zoom:.86,lift:.5}}},g={about:(0,t.lazy)(()=>e.A(27093)),contact:(0,t.lazy)(()=>e.A(72088)),experience:(0,t.lazy)(()=>e.A(20639)),journey:(0,t.lazy)(()=>e.A(59945)),projects:(0,t.lazy)(()=>e.A(63405)),skills:(0,t.lazy)(()=>e.A(69166))};e.s(["sceneComponents",0,g,"sceneConfigs",0,x],30672)}]);