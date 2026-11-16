(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,2779,e=>{"use strict";var t=e.i(43476),a=e.i(71645),r=e.i(94800),i=e.i(90072),o=e.i(79043),u=e.i(87269),l=e.i(29236),n=e.i(60284),s=e.i(27225),c=e.i(49184),p=e.i(90601),d=e.i(15079);let m=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,v=`
uniform float uLit;
uniform float uFlash;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  // Nappe de lumi\xe8re sur le bateau : cœur doux, large frange.
  float wash = exp(-r2 * 3.2) * 0.75 + exp(-r2 * 9.0) * 0.45;
  // \xc9clat en croix sur les vitres de la timonerie (un peu au-dessus du centre).
  vec2 q = p - vec2(0.0, 0.16);
  float star = max(exp(-abs(q.x) * 70.0) * exp(-q.y * q.y * 9.0), exp(-abs(q.y) * 70.0) * exp(-q.x * q.x * 9.0));
  star += exp(-dot(q, q) * 160.0);
  float alpha = wash * uLit * 0.5 + star * uFlash;
  if (alpha < 0.004) discard;
  vec3 color = mix(vec3(1.0, 0.86, 0.6), vec3(1.0, 0.98, 0.92), clamp(star * uFlash, 0.0, 1.0));
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;function f(){let e=(0,a.useRef)(null),f=(0,a.useRef)(0),h=(0,a.useRef)(0),x=(0,a.useMemo)(()=>new i.PlaneGeometry(1,1),[]),g=(0,a.useMemo)(()=>new i.ShaderMaterial({uniforms:{uLit:{value:0},uFlash:{value:0}},vertexShader:m,fragmentShader:v,transparent:!0,depthWrite:!1,depthTest:!1,blending:i.AdditiveBlending,fog:!1}),[]);return(0,a.useEffect)(()=>()=>x.dispose(),[x]),(0,a.useEffect)(()=>()=>g.dispose(),[g]),(0,r.useFrame)((t,a)=>{let r=e.current;if(!r)return;let i=Math.min(a,1/30),{phase:m}=s.useWorld.getState(),v=n.skyState.dayNight,x="playing"===m||"docked"===m?(0,d.beamLight)(u.boatState.position.x,u.boatState.position.z,.8*o.BOAT_FRAME.bow)*Math.min(1,1.6*v):0;f.current=x>f.current?(0,c.damp)(f.current,x,16,i):(0,c.damp)(f.current,x,3.2,i);let g=Math.max(0,(x-.75)/.25);h.current=g>h.current?(0,c.damp)(h.current,g,22,i):(0,c.damp)(h.current,g,5,i);let b=f.current;if(r.visible=b>.01,!r.visible)return;let y=r.material.uniforms;y.uLit.value=b,y.uFlash.value=h.current;let{x:q,z:M}=u.boatState.position;r.position.set(q,(0,p.waveHeight)(q,M,t.clock.elapsedTime)+1.5,M),r.quaternion.copy(t.camera.quaternion),r.scale.setScalar(8.5),b>.6&&v>.5&&l.logbook.stamp("beam")}),(0,t.jsx)("mesh",{ref:e,geometry:x,material:g,renderOrder:9,visible:!1,frustumCulled:!1,raycast:()=>null})}e.s(["default",0,function(){return(0,t.jsx)(f,{})}],2779)},98531,function(e){e.n(e.i(2779))}]);