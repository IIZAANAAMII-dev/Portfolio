(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,32807,e=>{"use strict";var t=e.i(43476),a=e.i(71645),r=e.i(94800),o=e.i(55448),i=e.i(58158),n=e.i(74698),l=e.i(36015),s=e.i(64803),u=e.i(87269),c=e.i(27225),d=e.i(49184),f=e.i(90072),h=e.i(17448),m=e.i(52260);let p=new f.Color,x=new f.Matrix4,y=new f.Quaternion,v=new f.Euler,g=new f.Vector3,w=new f.Vector3;function M(e,t,a={},r=1){let{at:o=[0,0,0],rot:i=[0,0,0],scale:n=1}=a;return v.set(i[0],i[1],i[2],"XYZ"),y.setFromEuler(v),g.set(o[0],o[1],o[2]),"number"==typeof n?w.setScalar(n):w.set(n[0],n[1],n[2]),x.compose(g,y,w),e.applyMatrix4(x),function(e,t,a=1){let r=e.index?e.toNonIndexed():e;for(let t of(r!==e&&e.dispose(),Object.keys(r.attributes)))"position"!==t&&"normal"!==t&&"uv"!==t&&r.deleteAttribute(t);r.attributes.uv||r.setAttribute("uv",new f.BufferAttribute(new Float32Array(2*r.attributes.position.count),2)),r.attributes.normal||r.computeVertexNormals(),p.set(t).multiplyScalar(a);let o=r.attributes.position.count,i=new Float32Array(3*o);for(let e=0;e<o;e++)p.toArray(i,3*e);return r.setAttribute("color",new f.BufferAttribute(i,3)),r}(e,t,r)}function S(e){let t=(0,m.mergeGeometries)(e,!1);if(e.forEach(e=>e.dispose()),!t)throw Error("fusion de géométries impossible");return t.computeBoundingSphere(),t.computeBoundingBox(),t}function b(e,t){let{at:a=[0,0,0],rot:r=[0,0,0],scale:o=1}=t;return v.set(r[0],r[1],r[2],"XYZ"),y.setFromEuler(v),g.set(a[0],a[1],a[2]),"number"==typeof o?w.setScalar(o):w.set(o[0],o[1],o[2]),x.compose(g,y,w),e.clone().applyMatrix4(x)}function C(e,t,a=[1,1,1,1]){let[r,o,i,n]=e,l=new Float32Array([...r,...o,...i,...r,...i,...n]),s=new Float32Array([...t[0],...t[1],...t[2],...t[0],...t[2],...t[3]]),u=new Float32Array(18);[0,1,2,0,2,3].forEach((e,t)=>u.set([a[e],a[e],a[e]],3*t));let c=new f.BufferGeometry;return c.setAttribute("position",new f.BufferAttribute(l,3)),c.setAttribute("uv",new f.BufferAttribute(s,2)),c.setAttribute("color",new f.BufferAttribute(u,3)),c.computeVertexNormals(),c}var G=e.i(60284);let A=Array.from({length:16},()=>({x:0,y:0,z:0,size:0,color:new f.Color,power:0,day:.35}));function T(e,t,a,r,o,i,n,l=.35){let s=A[e];s.x=t,s.y=a,s.z=r,s.size=o,s.color.copy(i),s.power=n,s.day=l}let N=`
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vUv = uv;
  vColor = instanceColor;
  vec4 center = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float size = length(instanceMatrix[0].xyz) * length(modelMatrix[0].xyz);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 world = center.xyz + (right * position.x + up * position.y) * size;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`,R=`
varying vec2 vUv;
varying vec3 vColor;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float core = pow(max(0.0, 1.0 - d), 2.4);
  float spark = pow(max(0.0, 1.0 - d * 3.2), 2.0) * 1.6;
  gl_FragColor = vec4(vColor * (core + spark), 1.0);
}
`,E=null,k=new f.Matrix4,z=new f.Color;function P(){let e=(0,a.useRef)(null),o=(0,a.useMemo)(()=>new f.PlaneGeometry(1,1),[]),i=(0,a.useMemo)(()=>E??=new f.ShaderMaterial({vertexShader:N,fragmentShader:R,transparent:!0,depthWrite:!1,blending:f.AdditiveBlending,toneMapped:!1}),[]);return(0,a.useLayoutEffect)(()=>{let t=e.current;t&&(t.instanceColor=new f.InstancedBufferAttribute(new Float32Array(48),3),t.frustumCulled=!1)},[]),(0,r.useFrame)(()=>{let t=e.current;if(!t?.instanceColor)return;let a=G.skyState.dayNight;for(let e=0;e<16;e++){let r=A[e],o=r.power*(r.day+(1-r.day)*a),i=o>.003?r.size:0;k.makeScale(i,i,i).setPosition(r.x,r.y,r.z),t.setMatrixAt(e,k),t.setColorAt(e,z.copy(r.color).multiplyScalar(o))}t.instanceMatrix.needsUpdate=!0,t.instanceColor.needsUpdate=!0}),(0,t.jsx)("instancedMesh",{ref:e,args:[o,i,16],renderOrder:9,raycast:()=>null})}var I=e.i(34780),L=e.i(26819);let B="#8a8e90",j=new f.Color("#ff2a22"),O=new f.Vector3;function D({index:e}){let i=I.CAMERAS[e],n=(0,a.useRef)(null),l=(0,a.useMemo)(()=>(0,I.restSite)(i.x,i.z,.25)+i.height+.04,[i]),s=(0,L.useStaticDossier)(e=>e.reveal);return(0,r.useFrame)(t=>{let a=n.current;if(!a)return;let r=t.clock.elapsedTime,o=Math.sin(.32*r+2.1*i.seed),s=i.base+Math.sign(o)*Math.pow(Math.abs(o),.55)*.75;a.rotation.set(0,s,0),O.set(.075,.3,.26).applyAxisAngle(F,s);let u=Math.sin(2.4*r+5*i.seed)>.1?1:.1;T(2+e,i.x+O.x,l+O.y,i.z+O.z,.3,j,1.4*u,.6)}),(0,t.jsxs)(o.Hotspot,{position:[i.x,l,i.z],hoverScale:1.18,onActivate:()=>{h.ambience.cue(1320,.08),s("camera")},children:[(0,t.jsx)("group",{ref:n,children:(0,t.jsx)("group",{"rotation-x":-.32,children:(0,t.jsx)(_,{})})}),(0,t.jsx)("mesh",{visible:!1,position:[0,.25,0],children:(0,t.jsx)("sphereGeometry",{args:[.85,8,6]})})]})}let F=new f.Vector3(0,1,0),U=null;function _(){let e=(0,a.useMemo)(()=>U??={geometry:S([M(new f.CylinderGeometry(.035,.035,.16,6),B,{at:[0,.08,0]}),M(new f.BoxGeometry(.2,.19,.46),"#d7d8d0",{at:[0,.24,.06]}),M(new f.BoxGeometry(.25,.03,.56),"#bdbeb5",{at:[0,.35,.09]}),M(new f.CylinderGeometry(.07,.07,.04,12),"#1a1c1d",{at:[0,.24,.3],rot:[Math.PI/2,0,0]}),M(new f.SphereGeometry(.05,10,6),"#30484e",{at:[0,.24,.31],scale:[1,1,.5]}),M(new f.BoxGeometry(.12,.08,.06),"#55585a",{at:[0,.22,-.2]})]),material:new f.MeshStandardMaterial({vertexColors:!0,roughness:.55,flatShading:!0})},[]);return(0,t.jsx)("mesh",{geometry:e.geometry,material:e.material,castShadow:!0})}function W(){let e=(0,a.useMemo)(()=>S(I.CAMERAS.flatMap(e=>{let t=(0,I.restSite)(e.x,e.z,.25);return[M(new f.CylinderGeometry(.055,.075,e.height,7),B,{at:[e.x,t+e.height/2,e.z]}),M(new f.BoxGeometry(.2,.26,.12),"#bfc0b8",{at:[e.x,t+1.25,e.z+.08]}),M(new f.CylinderGeometry(.11,.11,.05,8),B,{at:[e.x,t+e.height+.02,e.z]})]})),[]),r=(0,a.useMemo)(()=>new f.MeshStandardMaterial({vertexColors:!0,roughness:.7,flatShading:!0}),[]);return(0,a.useEffect)(()=>()=>e.dispose(),[e]),(0,t.jsxs)("group",{children:[(0,t.jsx)("mesh",{geometry:e,material:r,castShadow:!0,receiveShadow:!0}),I.CAMERAS.map((e,a)=>(0,t.jsx)(D,{index:a},a))]})}let H="#e2bd2c",V="#25282b",q="#3b5a60",X="#9a9fa1",$="#d8dbcf",Z=`
varying float vAlong;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  vAlong = position.z / 3.6;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalView = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`,Y=`
uniform float uNight;
varying float vAlong;
varying vec3 vNormalView;
varying vec3 vViewDir;
void main() {
  float facing = abs(dot(normalize(vNormalView), normalize(vViewDir)));
  float fade = pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.6) * smoothstep(0.0, 0.08, vAlong);
  float strength = fade * pow(facing, 1.4) * (0.06 + uNight * 0.42);
  gl_FragColor = vec4(vec3(1.0, 0.94, 0.74) * strength, 1.0);
}
`,K=null,Q={uNight:{value:0}},J=new f.Euler,ee=new f.Quaternion,et=new f.Vector3,ea=new f.Vector3(1,1,1),er=new f.Matrix4,eo=new f.Matrix4,ei=new f.Matrix4,en=new f.Matrix4,el=new f.Matrix4,es=new f.Vector3,eu=new f.Color("#ff2a1f"),ec=new f.Color("#7dff9e"),ed=new f.Color("#fff1c4");function ef(e,t,a,r,o,i=0,n=0,l=0){return J.set(i,n,l,"YXZ"),ee.setFromEuler(J),et.set(a,r,o),er.compose(et,ee,ea),e.multiplyMatrices(t,er)}let eh=Array.from({length:4},()=>({x:0,z:0,yaw:0,bob:0,sway:0,stride:0,head:[0,0],right:[0,0,0],left:[0,0,0]})),em={x:I.CONSOLE.x,z:I.CONSOLE.z+.8},ep={x:3.2,z:1.45},ex={x:3.2,z:-2.15};function ey(e,t,a,r){return Math.atan2(a-e,r-t)}let ev=ey(-.95,3.85,I.RIFT.x,I.RIFT.z),eg=ey(-2.85,2.2,-1.3,.95),ew=ey(ex.x,ex.z,2.1,-1.4),eM=ey(ep.x,ep.z,I.RIFT.x+.4,I.RIFT.z+.6);function eS(){let e=(0,a.useRef)(null),o=(0,a.useRef)(null),i=(0,a.useRef)(null),n=(0,a.useRef)(null),l=(0,a.useRef)(null),s=(0,a.useRef)(null),u=(0,a.useRef)(null),c=(0,a.useRef)(null),h=(0,a.useRef)(Math.PI),m=(0,a.useMemo)(()=>{let e;return K??={body:S([M(new f.SphereGeometry(.2,10,8),H,{at:[0,.9,0],scale:[1,.62,.78]}),M(new f.CylinderGeometry(.205,.18,.58,10),H,{at:[0,1.16,0],scale:[1,1,.76]}),M(new f.SphereGeometry(.205,10,6,0,2*Math.PI,0,Math.PI/2),H,{at:[0,1.44,0],scale:[1,.5,.76]}),M(new f.CylinderGeometry(.194,.194,.07,10),V,{at:[0,.95,0],scale:[1,1,.8]}),M(new f.CylinderGeometry(.203,.203,.05,10),$,{at:[0,1.26,0],scale:[1,1,.78]}),M(new f.CylinderGeometry(.085,.085,.5,8),"#d2d4cd",{at:[0,1.16,-.2]}),M(new f.CylinderGeometry(.03,.03,.09,6),V,{at:[0,1.45,-.2]}),M(new f.BoxGeometry(.05,.42,.03),V,{at:[-.1,1.2,-.13]}),M(new f.BoxGeometry(.05,.42,.03),V,{at:[.1,1.2,-.13]}),M(new f.CylinderGeometry(.1,.12,.08,8),V,{at:[0,1.5,0]})]),leg:S([M(new f.CylinderGeometry(.09,.078,.72,8),H,{at:[0,-.36,0]}),M(new f.CylinderGeometry(.084,.084,.045,8),$,{at:[0,-.5,0]}),M(new f.CylinderGeometry(.083,.083,.2,8),V,{at:[0,-.7,0]}),M(new f.BoxGeometry(.15,.12,.27),V,{at:[0,-.8,.045]})]),head:S([M(new f.SphereGeometry(.172,12,10),H,{at:[0,.17,-.015],scale:[1,1.1,1]}),M(new f.SphereGeometry(.128,12,8),V,{at:[0,.14,.085],scale:[1.02,1.05,.72]}),M(new f.CylinderGeometry(.046,.046,.03,12),q,{at:[-.056,.185,.168],rot:[Math.PI/2,0,0]}),M(new f.CylinderGeometry(.046,.046,.03,12),q,{at:[.056,.185,.168],rot:[Math.PI/2,0,0]}),M(new f.CylinderGeometry(.06,.052,.1,10),X,{at:[0,.07,.19],rot:[Math.PI/2-.35,0,0]}),M(new f.CylinderGeometry(.062,.062,.022,10),"#b8961f",{at:[0,.052,.24],rot:[Math.PI/2-.35,0,0]})]),arm:S([M(new f.SphereGeometry(.078,8,6),H,{at:[0,-.02,0]}),M(new f.CylinderGeometry(.07,.058,.48,8),H,{at:[0,-.26,0]}),M(new f.CylinderGeometry(.063,.063,.05,8),V,{at:[0,-.49,0]}),M(new f.SphereGeometry(.064,8,6),V,{at:[0,-.56,.005],scale:[.9,1.1,.8]})]),camcorder:S([M(new f.BoxGeometry(.13,.14,.32),"#2f3134",{at:[0,.07,.06]}),M(new f.CylinderGeometry(.058,.062,.11,12),"#18191b",{at:[0,.08,.27],rot:[Math.PI/2,0,0]}),M(new f.CylinderGeometry(.046,.046,.012,12),"#6c8f96",{at:[0,.08,.33],rot:[Math.PI/2,0,0]}),M(new f.BoxGeometry(.05,.05,.1),"#18191b",{at:[-.075,.12,-.08]}),M(new f.BoxGeometry(.03,.03,.2),"#3a3c40",{at:[0,.165,.05]}),M(new f.BoxGeometry(.035,.08,.1),"#43464a",{at:[.085,.07,.02]})]),scanner:S([M(new f.BoxGeometry(.1,.07,.18),"#34393c",{at:[0,.02,.02]}),M(new f.BoxGeometry(.075,.012,.09),"#7fd0a0",{at:[0,.058,.04]},.7),M(new f.CylinderGeometry(.012,.012,.36,6),X,{at:[0,0,.28],rot:[Math.PI/2,0,0]}),M(new f.CylinderGeometry(.045,.03,.05,10),H,{at:[0,0,.47],rot:[Math.PI/2,0,0]})]),flashlight:S([M(new f.CylinderGeometry(.034,.034,.22,10),"#2b2e30",{at:[0,0,.04],rot:[Math.PI/2,0,0]}),M(new f.CylinderGeometry(.055,.04,.07,12),"#3a3d40",{at:[0,0,.18],rot:[Math.PI/2,0,0]}),M(new f.CylinderGeometry(.048,.048,.01,12),"#fff6d8",{at:[0,0,.217],rot:[Math.PI/2,0,0]})]),beam:((e=new f.ConeGeometry(.85,3.6,18,1,!0)).translate(0,-1.8,0),e.rotateX(-Math.PI/2),e),suit:new f.MeshStandardMaterial({vertexColors:!0,roughness:.58,metalness:0}),beamMaterial:new f.ShaderMaterial({uniforms:Q,vertexShader:Z,fragmentShader:Y,transparent:!0,depthWrite:!1,blending:f.AdditiveBlending,side:f.DoubleSide})}},[]);return(0,a.useLayoutEffect)(()=>{for(let t of[e.current,o.current,i.current,n.current])t&&(t.frustumCulled=!1)},[]),(0,r.useFrame)((t,a)=>{var r,f;let m=Math.min(a,1/30),p=t.clock.elapsedTime,x=G.skyState.dayNight;Q.uNight.value=x;let y=eh[0];y.x=-.95,y.z=3.85,y.yaw=ev+.07*Math.sin(.45*p),y.bob=.008*Math.sin(1.6*p),y.sway=.02*Math.sin(.7*p),y.stride=0,y.head=[.12,-.12],y.right=[-1.86,.34,0],y.left=[-1.78,-.58,0];let v=eh[1];v.x=em.x,v.z=em.z,v.yaw=Math.PI,v.bob=.006*Math.sin(1.4*p+1),v.sway=0,v.stride=0;let g=Math.sin(.55*p)+.4*Math.sin(1.3*p);v.head=[.28,.7*(0,d.smoothstep)(-.6,.6,g)-.35];let w=+!!(Math.sin(8*p)>.2&&Math.sin(.9*p)>-.3);v.right=[-.86+w*Math.sin(15*p)*.05,.22,0],v.left=[-.86+w*Math.sin(15*p+2)*.05,-.22,0];let M=eh[2],S=Math.sin(1.9*p);M.x=-2.85,M.z=2.2,M.yaw=eg+.14*S,M.bob=.006*Math.sin(1.3*p),M.sway=0,M.stride=0,M.head=[.42,.2*S],M.right=[-1+.04*Math.sin(3.8*p),.12+.38*S,0],M.left=[-.22,0,.1];let b=eh[3],C=(p+3)%20,A=C<10,N=A?C:C-10,R=N<6.6,E=R?N/6.6:1,k=E*E*(3-2*E),z=A?ep:ex,P=A?ex:ep;b.x=z.x+(P.x-z.x)*k,b.z=z.z+(P.z-z.z)*k;let L=ey(z.x,z.z,P.x,P.z);h.current+=(r=h.current,Math.atan2(Math.sin((f=R?L:A?ew:eM)-r),Math.cos(f-r))*(1-Math.exp(-4*m))),b.yaw=h.current;let B=R?Math.sin(E*Math.PI):0,j=N/6.6*Math.PI*11;b.stride=.42*Math.sin(j)*Math.min(1,3*B),b.bob=.035*Math.abs(Math.cos(j))*Math.min(1,3*B),b.sway=.025*Math.sin(j)*Math.min(1,3*B);let O=R?0:(0,d.smoothstep)(0,.8,N-6.6)*(1-(0,d.smoothstep)(2.7,3.4,N-6.6));b.head=[.1-.25*O,.15*Math.sin(.8*p)*(1-O)],b.right=[-1.05-.62*O+.05*Math.sin(1.1*p),.12,0],b.left=[-(.8*b.stride),0,.08];let D=e.current,F=o.current,U=i.current,_=n.current;if(D&&F&&U&&_){for(let e=0;e<4;e++){let t=eh[e],a=(0,I.groundSite)(t.x,t.z);if(J.set(0,t.yaw,t.sway,"YXZ"),ee.setFromEuler(J),et.set(t.x,a+t.bob,t.z),eo.compose(et,ee,ea),D.setMatrixAt(e,eo),F.setMatrixAt(2*e,ef(ei,eo,-.1,.88,0,t.stride)),F.setMatrixAt(2*e+1,ef(ei,eo,.1,.88,0,-t.stride)),U.setMatrixAt(e,ef(ei,eo,0,1.52,0,t.head[0],t.head[1])),ef(en,eo,-.265,1.38,0,t.right[0],t.right[1],-.06+t.right[2]),ef(el,eo,.265,1.38,0,t.left[0],t.left[1],.06-t.left[2]),_.setMatrixAt(2*e,en),_.setMatrixAt(2*e+1,el),0===e&&l.current){let e=l.current;ef(e.matrix,en,0,-.6,.02,Math.PI/2-.28,0,0),e.matrixWorldNeedsUpdate=!0,es.set(.045,.16,.2).applyMatrix4(e.matrix);let t=+(Math.sin(p*Math.PI*1.8)>-.2);T(0,es.x,es.y,es.z,.32,eu,1.6*t,.55)}else if(2===e&&s.current){let e=s.current;ef(e.matrix,en,0,-.6,.03,Math.PI/2+.25,0,0),e.matrixWorldNeedsUpdate=!0,es.set(0,.07,-.05).applyMatrix4(e.matrix);let t=Math.sin(p*Math.PI*2*(1.2+2.5*Math.max(0,S)))>.4?1:.15;T(1,es.x,es.y,es.z,.26,ec,1.2*t,.5)}else if(3===e&&u.current&&c.current){let e=u.current;ef(e.matrix,en,0,-.6,.02,Math.PI/2,0,0),e.matrixWorldNeedsUpdate=!0,ef(c.current.matrix,e.matrix,0,0,.22),c.current.matrixWorldNeedsUpdate=!0,es.set(0,0,.24).applyMatrix4(e.matrix),T(12,es.x,es.y,es.z,.55,ed,1,.3)}}D.instanceMatrix.needsUpdate=!0,F.instanceMatrix.needsUpdate=!0,U.instanceMatrix.needsUpdate=!0,_.instanceMatrix.needsUpdate=!0}}),(0,t.jsxs)("group",{children:[(0,t.jsx)("instancedMesh",{ref:e,args:[m.body,m.suit,4],castShadow:!0,receiveShadow:!0}),(0,t.jsx)("instancedMesh",{ref:o,args:[m.leg,m.suit,8],castShadow:!0,receiveShadow:!0}),(0,t.jsx)("instancedMesh",{ref:i,args:[m.head,m.suit,4],castShadow:!0,receiveShadow:!0}),(0,t.jsx)("instancedMesh",{ref:n,args:[m.arm,m.suit,8],castShadow:!0,receiveShadow:!0}),(0,t.jsx)("mesh",{ref:l,geometry:m.camcorder,material:m.suit,matrixAutoUpdate:!1,castShadow:!0}),(0,t.jsx)("mesh",{ref:s,geometry:m.scanner,material:m.suit,matrixAutoUpdate:!1,castShadow:!0}),(0,t.jsx)("mesh",{ref:u,geometry:m.flashlight,material:m.suit,matrixAutoUpdate:!1,castShadow:!0}),(0,t.jsx)("mesh",{ref:c,geometry:m.beam,material:m.beamMaterial,matrixAutoUpdate:!1,renderOrder:6,raycast:()=>null})]})}var eb=e.i(67520);let eC=new Map;function eG(e,t){let a=eC.get(e);return a||(a=t(),eC.set(e,a)),a}function eA(e,t){let a=document.createElement("canvas");a.width=e,a.height=t;let r=a.getContext("2d");if(!r)throw Error("canvas 2d indisponible");return{canvas:a,ctx:r}}function eT(e,t=!0){let a=new f.CanvasTexture(e);return a.colorSpace=f.SRGBColorSpace,t&&(a.wrapS=a.wrapT=f.RepeatWrapping),a.anisotropy=4,a}function eN(e,t,a,r,o){for(let i of[-e,0,e])for(let n of[-e,0,e]){let l=t+i,s=a+n;l+r<0||l-r>e||s+r<0||s-r>e||o(l,s)}}function eR(e,t,a,r,o,i){e.beginPath();for(let n=0;n<=14;n++){let l=n/14*Math.PI*2,s=.62+.55*(0,d.hash)(13.1*i+n%14*1.7),u=t+Math.cos(l)*r*.5*s,c=a+Math.sin(l)*o*.5*s;0===n?e.moveTo(u,c):e.lineTo(u,c)}e.closePath()}function eE(){return eG("tape",()=>{let{canvas:e,ctx:t}=eA(128,32);t.fillStyle="#f2cb22",t.fillRect(0,0,128,32),t.fillStyle="#17181a";for(let e=-1;e<5;e++){let a=32*e;t.beginPath(),t.moveTo(a,32),t.lineTo(a+14,32),t.lineTo(a+46,0),t.lineTo(a+32,0),t.closePath(),t.fill()}return t.fillStyle="rgba(0, 0, 0, 0.25)",t.fillRect(0,0,128,2),t.fillRect(0,30,128,2),eT(e)})}let ek=["#8a8578","#7d786b","#959081","#6f6a5e"],ez="#8d9193",eP="#2a2c2e";function eI(e,t,a,r){return Math.atan2(a-e,r-t)}function eL(e,t,a,r,o){let i=(0,I.restSite)(t,a,.4);for(let n=0;n<3;n++){let l=o+n/3*Math.PI*2,s=t+.42*Math.sin(l)*.5,u=a+.42*Math.cos(l)*.5,c=Math.atan2(.42,.55*r);e.push(M(new f.CylinderGeometry(.022,.022,.58*r,5),ez,{at:[s,i+.27*r,u],rot:[Math.cos(l)*c,0,-Math.sin(l)*c]}))}return e.push(M(new f.CylinderGeometry(.028,.028,r,6),ez,{at:[t,i+r/2,a]})),i}let eB=[[[I.GENERATOR.x+.2,I.GENERATOR.z+.3],[-3,.7],[-2.5,1],[-2,1.45],[I.STANDS[0].x-.05,I.STANDS[0].z-.05]],[[I.GENERATOR.x+.25,I.GENERATOR.z+.35],[-2.75,1.5],[-2.05,2.55],[-.8,2.9],[.25,2.55],[I.STANDS[1].x-.05,I.STANDS[1].z-.05]],[[I.GENERATOR.x+.1,I.GENERATOR.z+.4],[-3.15,1.6],[-2.6,3.25],[-1.5,4.45],[.15,4.75],[1.35,4.2],[I.CONSOLE.x-.4,I.CONSOLE.z+.15]],[[I.CONSOLE.x-.3,I.CONSOLE.z-.1],[1.6,2.65],[1.15,2.25],[I.SENSOR.x+.08,I.SENSOR.z+.1]],[[I.CONSOLE.x+.4,I.CONSOLE.z-.1],[3.2,2.5],[3.65,1.5],[3.82,.75]],[[I.CONSOLE.x-.5,I.CONSOLE.z-.05],[1.2,2.95],[.45,2.45],[.05,1.7],[I.RIFT.x+.1,I.FACADE_Z+.32,.06],[I.RIFT.x+.05,I.FACADE_Z+.02,.2]]],ej={value:0},eO=null;function eD(){if(!eO){let e=document.createElement("canvas");e.width=384,e.height=96;let t=new f.CanvasTexture(e);t.colorSpace=f.SRGBColorSpace,eO={canvas:e,texture:t,last:-1}}return eO}let eF=new f.Color("#eaffd6"),eU=new f.Color("#ffd98a"),e_=new f.Color("#7dff8a"),eW=new f.Color("#9fe8c0"),eH=new f.Color("#ffcf3a"),eV=new f.Object3D,eq=new f.Vector3;function eX({tops:e}){let o=(0,a.useMemo)(()=>S([M(new f.BoxGeometry(1,.16,.2),"#d9dccf"),M(new f.BoxGeometry(1.02,.04,.24),"#9ea197",{at:[0,.09,0]}),M(new f.BoxGeometry(.94,.1,.02),"#f4f6ea",{at:[0,-.01,.1]})]),[]),i=(0,a.useMemo)(()=>S([M(new f.CylinderGeometry(.028,.028,.9,8),"#ffffff",{at:[0,.035,.12],rot:[0,0,Math.PI/2]}),M(new f.CylinderGeometry(.028,.028,.9,8),"#ffffff",{at:[0,-.04,.12],rot:[0,0,Math.PI/2]})]),[]),n=(0,a.useMemo)(()=>new f.MeshStandardMaterial({vertexColors:!0,roughness:.7}),[]),l=(0,a.useRef)(null),s=(0,a.useRef)(null),u=(0,a.useRef)(null),c=(0,a.useMemo)(()=>new f.PlaneGeometry(2.6,2.6).rotateX(-Math.PI/2),[]);return(0,a.useLayoutEffect)(()=>{let t=u.current;t&&(t.instanceColor=new f.InstancedBufferAttribute(new Float32Array(6),3),e.forEach((e,a)=>{let r=e.x+.9*Math.sin(e.yaw),o=e.z+.9*Math.cos(e.yaw);eV.position.set(r,(0,I.groundSite)(r,o)+.04,o),eV.rotation.set(0,e.yaw,0),eV.scale.set(1,1,1.25),eV.updateMatrix(),t.setMatrixAt(a,eV.matrix)}),t.instanceMatrix.needsUpdate=!0)},[e]),(0,r.useFrame)(()=>{let t=G.skyState.dayNight,a=u.current;for(let r=0;r<2;r++){let o=0===r?eb.flicker.standA:eb.flicker.standB,i=0===r?l.current:s.current;i?.color.copy(eF).multiplyScalar(.35+o*(1.1+.9*t)),a?.instanceColor&&(eq.set(.85,.95,.7).multiplyScalar(o*(.12+.55*t)),a.instanceColor.setXYZ(r,eq.x,eq.y,eq.z));let n=e[r];n&&T(8+r,n.x+.12*Math.sin(n.yaw),n.y,n.z+.12*Math.cos(n.yaw),1.9,eF,.6*o,.08)}a?.instanceColor&&(a.instanceColor.needsUpdate=!0)}),(0,t.jsxs)("group",{children:[e.map((e,a)=>(0,t.jsx)("group",{position:[e.x,e.y,e.z],rotation:[0,e.yaw,0],children:(0,t.jsxs)("group",{"rotation-x":.38,children:[(0,t.jsx)("mesh",{geometry:o,material:n,castShadow:!0}),(0,t.jsx)("mesh",{geometry:i,raycast:()=>null,children:(0,t.jsx)("meshBasicMaterial",{ref:0===a?l:s,color:"#eaffd6",toneMapped:!1})})]})},a)),(0,t.jsx)("instancedMesh",{ref:u,args:[c,void 0,2],renderOrder:2,raycast:()=>null,children:(0,t.jsx)("meshBasicMaterial",{map:eG("pool",()=>{let{canvas:e,ctx:t}=eA(64,64),a=t.createRadialGradient(32,32,0,32,32,32);a.addColorStop(0,"rgba(255, 255, 255, 1)"),a.addColorStop(.35,"rgba(255, 255, 255, 0.55)"),a.addColorStop(1,"rgba(255, 255, 255, 0)"),t.fillStyle=a,t.fillRect(0,0,64,64);let r=new f.CanvasTexture(e);return r.colorSpace=f.NoColorSpace,r}),transparent:!0,depthWrite:!1,blending:f.AdditiveBlending,polygonOffset:!0,polygonOffsetFactor:-2})})]})}function e$(){let e=(0,a.useRef)(null),o=(0,a.useRef)(null),i=(0,a.useMemo)(()=>S([M(new f.BoxGeometry(.78,.05,.52),eP,{at:[0,.03,0]}),M(new f.BoxGeometry(.62,.38,.42),"#5d6547",{at:[0,.26,0]}),M(new f.BoxGeometry(.5,.16,.36),"#a3452f",{at:[0,.53,0]}),M(new f.CylinderGeometry(.05,.05,.04,8),"#d8d2bd",{at:[.12,.63,0]}),M(new f.BoxGeometry(.03,.18,.12),"#2d3031",{at:[.32,.3,.08]}),M(new f.CylinderGeometry(.035,.035,.32,6),"#55585a",{at:[-.34,.42,-.12]}),...[-1,1].flatMap(e=>[M(new f.CylinderGeometry(.02,.02,.62,5),ez,{at:[.38*e,.33,.24]}),M(new f.CylinderGeometry(.02,.02,.62,5),ez,{at:[.38*e,.33,-.24]}),M(new f.CylinderGeometry(.02,.02,.5,5),ez,{at:[.38*e,.64,0],rot:[Math.PI/2,0,0]})])]),[]),n=(0,a.useMemo)(()=>new f.MeshStandardMaterial({vertexColors:!0,roughness:.8,flatShading:!0}),[]),l=(0,a.useMemo)(()=>{let e=(0,I.restSite)(I.GENERATOR.x,I.GENERATOR.z,.35);return{x:I.GENERATOR.x,y:e,z:I.GENERATOR.z,yaw:eI(I.GENERATOR.x,I.GENERATOR.z,0,2)}},[]);return(0,r.useFrame)(t=>{let a=t.clock.elapsedTime,r=eb.flicker.motion;e.current&&e.current.position.set(l.x+.006*Math.sin(61*a)*r,l.y+.008*Math.abs(Math.sin(47*a))*r,l.z+.005*Math.sin(53*a+1)*r);let i=o.current;if(i){let e=l.x-.34*Math.cos(l.yaw)-.12*Math.sin(l.yaw),t=l.z+.34*Math.sin(l.yaw)-.12*Math.cos(l.yaw);for(let o=0;o<4;o++){let n=(.5*a+o/4)%1;eV.position.set(e+.5*n,l.y+.62+1.3*n,t+.3*n),eV.scale.setScalar((.06+.22*n)*(n>.7?(1-n)/.3:1)*r),eV.rotation.set(o,.4*a,0),eV.updateMatrix(),i.setMatrixAt(o,eV.matrix)}i.instanceMatrix.needsUpdate=!0}let n=Math.sin(2.2*a)>-.6?.9:.2;T(6,l.x+.33*Math.cos(l.yaw),l.y+.36,l.z-.33*Math.sin(l.yaw),.24,e_,n,.4)}),(0,t.jsxs)("group",{children:[(0,t.jsx)("mesh",{ref:e,geometry:i,material:n,"rotation-y":l.yaw,castShadow:!0,receiveShadow:!0}),(0,t.jsxs)("instancedMesh",{ref:o,args:[void 0,void 0,4],frustumCulled:!1,raycast:()=>null,children:[(0,t.jsx)("icosahedronGeometry",{args:[1,0]}),(0,t.jsx)("meshStandardMaterial",{color:"#8d8f88",roughness:1,flatShading:!0,transparent:!0,opacity:.55,depthWrite:!1})]})]})}function eZ(){let e=(0,a.useMemo)(()=>eD().texture,[]),o=(0,a.useMemo)(()=>{let e,t,a;return e=[-.46,0,.46].map((e,t)=>{let a=new f.PlaneGeometry(.33,.25),r=a.attributes.uv;for(let e=0;e<r.count;e++)r.setX(e,(t+r.getX(e))/3);let o=new f.Matrix4().makeRotationY(-(.55*e)),i=new f.Vector3(0,.19,.172).applyMatrix4(o);return a.applyMatrix4(o),a.translate(e+i.x,.785+i.y,-.1+.12*Math.abs(e)+i.z),a}),t=new f.BufferGeometry,a=e.reduce((e,t)=>{let a=e.positions.length/3;return e.positions.push(...t.attributes.position.array),e.uvs.push(...t.attributes.uv.array),e.indices.push(...Array.from(t.index?.array??[]).map(e=>e+a)),t.dispose(),e},{positions:[],uvs:[],indices:[]}),t.setAttribute("position",new f.BufferAttribute(new Float32Array(a.positions),3)),t.setAttribute("uv",new f.BufferAttribute(new Float32Array(a.uvs),2)),t.setIndex(a.indices),t.computeVertexNormals(),t},[]),i=(0,a.useMemo)(()=>[I.CONSOLE.x,(0,I.restSite)(I.CONSOLE.x,I.CONSOLE.z,.6),I.CONSOLE.z],[]);return(0,r.useFrame)(e=>{let t=e.clock.elapsedTime,a=e.camera.position,[r,o]=(0,I.siteToIsland)(I.CONSOLE.x,I.CONSOLE.z),n=Math.hypot(a.x-I.ISLAND.position[0]-r,a.z-I.ISLAND.position[1]-o),l=Math.floor(10*t),s=eD();n<95&&l!==s.last&&(s.last=l,function(e,t){let a=e.getContext("2d");if(!a)return;a.fillStyle="#071a10",a.fillRect(0,0,128,96),a.strokeStyle="rgba(80, 200, 120, 0.25)",a.lineWidth=1;for(let e=16;e<128;e+=16)a.beginPath(),a.moveTo(e,0),a.lineTo(e,96),a.stroke();for(let e=16;e<96;e+=16)a.beginPath(),a.moveTo(0,e),a.lineTo(128,e),a.stroke();a.strokeStyle="#8dffb0",a.lineWidth=2,a.beginPath();for(let e=0;e<=128;e+=2){let r=Math.sin(1.7*t)>.85?18*Math.sin(1.3*e+40*t):0,o=48+16*Math.sin(.12*e+5*t)*Math.sin(.7*t+.01*e)+r;0===e?a.moveTo(e,o):a.lineTo(e,o)}a.stroke(),a.fillStyle="#1a1d22",a.fillRect(128,0,128,96);for(let e=0;e<220;e++){let r=Math.floor(90*(0,d.hash)(7.3*e+1.1*Math.floor(12*t)))+40;a.fillStyle=`rgb(${r}, ${r}, ${r+6})`,a.fillRect(128+128*(0,d.hash)(3.1*e+t),96*(0,d.hash)(5.7*e+2*t),2,1)}let r=192+6*Math.sin(.45*t),o=a.createLinearGradient(r-22,0,r+22,0);o.addColorStop(0,"rgba(255, 210, 80, 0)"),o.addColorStop(.5,"rgba(255, 236, 160, 0.95)"),o.addColorStop(1,"rgba(255, 210, 80, 0)"),a.fillStyle=o,a.beginPath(),a.moveTo(r,14),a.lineTo(r+9,40),a.lineTo(r+4,60),a.lineTo(r+8,86),a.lineTo(r-8,86),a.lineTo(r-5,58),a.lineTo(r-10,38),a.closePath(),a.fill(),a.fillStyle=Math.sin(t*Math.PI*1.8)>0?"#ff3b2f":"rgba(255, 59, 47, 0.25)",a.beginPath(),a.arc(140,12,4,0,2*Math.PI),a.fill(),a.fillStyle="#f2f2ea",a.font="bold 11px monospace",a.fillText("REC",148,16);let i=Math.floor(t),n=`${String(Math.floor(i/60)%60).padStart(2,"0")}:${String(i%60).padStart(2,"0")}:${String(Math.floor(t%1*25)).padStart(2,"0")}`;a.fillText(n,196,90),a.fillStyle="rgba(0, 0, 0, 0.18)";for(let e=0;e<96;e+=3)a.fillRect(128,e,128,1);a.fillStyle="#1b1306",a.fillRect(256,0,128,96);for(let e=0;e<14;e++){let r=Math.round(80*(.25+.6*Math.abs(Math.sin(t*(1.3+.37*e)+1.7*e))*(e<4?1:.7)));for(let t=0;t<r;t+=5)a.fillStyle=t>60?"#ff6a3a":t>40?"#ffc04a":"#e7b13a",a.fillRect(262+8.6*e,90-t-4,6.5,4)}}(s.canvas,t),s.texture.needsUpdate=!0),T(11,i[0],i[1]+1,i[2]-.05,1.5,eW,.32,.05)}),(0,t.jsx)("mesh",{geometry:o,position:i,raycast:()=>null,children:(0,t.jsx)("meshBasicMaterial",{map:e,toneMapped:!1})})}function eY(){let e=(0,a.useRef)(null),o=[.4,I.LANDING.deck+1.32,I.LANDING.to-.25];return(0,r.useFrame)(()=>{let t=eb.flicker.lamp*(.4+1.4*G.skyState.dayNight);e.current?.color.copy(eU).multiplyScalar(.5+t),T(7,o[0],o[1],o[2],1.1,eU,eb.flicker.lamp,.15)}),(0,t.jsxs)("group",{position:o,children:[(0,t.jsxs)("mesh",{raycast:()=>null,children:[(0,t.jsx)("sphereGeometry",{args:[.07,10,8]}),(0,t.jsx)("meshBasicMaterial",{ref:e,color:"#ffd98a",toneMapped:!1})]}),(0,t.jsxs)("mesh",{raycast:()=>null,children:[(0,t.jsx)("cylinderGeometry",{args:[.1,.1,.2,6,1,!0]}),(0,t.jsx)("meshStandardMaterial",{color:"#3b3a36",wireframe:!0,roughness:1})]})]})}function eK(){let e=(0,a.useMemo)(()=>(function(){let e=[],t=[],a=[],r=[],o=[],i=0,n=(n,l,s,u,c,d,f,h)=>{let m=Math.hypot(u-n,d-s),p=-(d-s)/m,x=(u-n)/m,y=0;for(let v=0;v<=12;v++){let g=v/12,w=n+(u-n)*g,M=s+(d-s)*g,S=l+(c-l)*g-4*f*g*(1-g);v>0&&(y+=m/12);let b=.6*Math.sin(g*Math.PI*2+h),C=.065*Math.cos(b),G=.065*Math.sin(b);e.push(w+p*G,S+C,M+x*G,w-p*G,S-C,M-x*G),t.push(y/.5,1,y/.5,0);let A=4*g*(1-g);a.push(A,A),r.push(p,x,p,x),v>0&&o.push(i-2,i-1,i,i-1,i+1,i),i+=2}};for(let e=0;e<I.TAPE_STAKES.length-1;e++){let[t,a]=I.TAPE_STAKES[e],[r,o]=I.TAPE_STAKES[e+1];n(t,(0,I.restSite)(t,a,.1)+.9,a,r,(0,I.restSite)(r,o,.1)+.9,o,.12,1.3*e)}let[l,s]=I.TAPE_STAKES[I.TAPE_STAKES.length-1],u=(0,I.restSite)(l,s,.1)+.9;n(l,u,s,l+.25,u-.55,s+.18,-.06,2);let c=new f.BufferGeometry;return c.setAttribute("position",new f.BufferAttribute(new Float32Array(e),3)),c.setAttribute("uv",new f.BufferAttribute(new Float32Array(t),2)),c.setAttribute("aFlutter",new f.BufferAttribute(new Float32Array(a),1)),c.setAttribute("aSide",new f.BufferAttribute(new Float32Array(r),2)),c.setIndex(o),c.computeVertexNormals(),c})(),[]),o=(0,a.useMemo)(()=>{let e;return(e=new f.MeshStandardMaterial({map:eE(),side:f.DoubleSide,roughness:.55})).onBeforeCompile=e=>{e.uniforms.uTapeTime=ej,e.vertexShader=e.vertexShader.replace("#include <common>","#include <common>\nuniform float uTapeTime;\nattribute float aFlutter;\nattribute vec2 aSide;").replace("#include <begin_vertex>",`#include <begin_vertex>
        float tapeWave = sin(uTapeTime * 5.3 + position.x * 3.1 + position.z * 2.3) + sin(uTapeTime * 8.1 + position.x * 5.0) * 0.4;
        transformed.xz += aSide * tapeWave * 0.035 * aFlutter;
        transformed.y += cos(uTapeTime * 4.2 + position.z * 2.0) * 0.012 * aFlutter;`)},e.customProgramCacheKey=()=>"yellow-static-tape",e},[]);return(0,r.useFrame)(e=>{ej.value=e.clock.elapsedTime*eb.flicker.motion}),(0,t.jsx)("mesh",{geometry:e,material:o,castShadow:!1,receiveShadow:!0,raycast:()=>null})}function eQ(){let e=(0,a.useRef)(null),r=(0,a.useMemo)(()=>(function(){let e=new f.IcosahedronGeometry(1,1),t=e.attributes.position;for(let e=0;e<t.count;e++){let a=Math.round(7*t.getX(e)+13*t.getY(e)+17*t.getZ(e)),r=.8+.32*(0,d.hash)(a);t.setXYZ(e,t.getX(e)*r,t.getY(e)*r*.7,t.getZ(e)*r)}return e.computeVertexNormals(),e})(),[]);return(0,a.useLayoutEffect)(()=>{let t=e.current;if(!t)return;let a=new f.Color;for(let e=0;e<15;e++){let r=e/15*Math.PI*2+.35*(0,d.hash)(3.1*e);.35>Math.abs(Math.atan2(Math.sin(r-I.ISLAND.dockAngle),Math.cos(r-I.ISLAND.dockAngle)))&&(r+=.6);let o=I.ISLAND.radius*(.86+.2*(0,d.hash)(2.7*e)),i=Math.cos(r)*o,n=Math.sin(r)*o,l=.32+.55*(0,d.hash)(5.9*e);eV.position.set(i,(0,I.sampler)(i,n)-.3*l,n),eV.rotation.set(((0,d.hash)(e)-.5)*.5,(0,d.hash)(7.3*e)*Math.PI*2,((0,d.hash)(1.9*e)-.5)*.4),eV.scale.set(1.3*l,l,l),eV.updateMatrix(),t.setMatrixAt(e,eV.matrix),t.setColorAt(e,a.set("#ffffff").multiplyScalar(.82+.25*(0,d.hash)(4.4*e)))}t.instanceMatrix.needsUpdate=!0,t.instanceColor&&(t.instanceColor.needsUpdate=!0),t.computeBoundingSphere()},[r]),(0,t.jsx)("instancedMesh",{ref:e,args:[r,void 0,15],castShadow:!0,receiveShadow:!0,raycast:()=>null,children:(0,t.jsx)("meshStandardMaterial",{color:"#8f918a",roughness:.95,flatShading:!0})})}function eJ(){let e=(0,a.useMemo)(()=>(function(){let e=[],t=I.STANDS.map(t=>{let a=eI(t.x,t.z,I.RIFT.x,I.RIFT.z),r=eL(e,t.x,t.z,1.85,a);return{x:t.x,y:r+1.97,z:t.z,yaw:a}});{let{x:t,z:a}=I.CONSOLE,r=(0,I.restSite)(t,a,.6);for(let[o,i]of(e.push(M(new f.BoxGeometry(1.45,.05,.66),"#77736a",{at:[t,r+.76,a]})),[[-.66,-.28],[.66,-.28],[-.66,.28],[.66,.28]]))e.push(M(new f.CylinderGeometry(.022,.022,.76,5),ez,{at:[t+o,r+.38,a+i]}));[-.46,0,.46].forEach((o,i)=>{let n=S([M(new f.BoxGeometry(.42,.36,.36),"#bdb8a6",{at:[0,.18,-.02]}),M(new f.BoxGeometry(.3,.26,.2),"#a9a492",{at:[0,.17,-.27]}),M(new f.BoxGeometry(.36,.29,.02),"#1c1f1f",{at:[0,.19,.16]}),M(new f.BoxGeometry(.06,.02,.02),1===i?"#c94a3a":"#5b5d55",{at:[.13,.03,.165]})]);e.push(b(n,{at:[t+o,r+.785,a-.1+.12*Math.abs(o)],rot:[0,-(.55*o),0]})),n.dispose()}),e.push(M(new f.BoxGeometry(.5,.03,.16),"#cfcab8",{at:[t+.05,r+.8,a+.2]}));for(let o=0;o<3;o++)e.push(M(new f.BoxGeometry(.2,.026,.11),1===o?"#efe8d4":"#1b1b1d",{at:[t-.55,r+.8+.028*o,a+.18],rot:[0,((0,d.hash)(3.3*o)-.5)*.4,0]}));for(let[o,i,n]of(e.push(M(new f.CylinderGeometry(.04,.035,.09,8),"#d8d2c2",{at:[t+.48,r+.83,a+.2]})),[[t+.95,a+.55,.3],[t+1.05,a+0,-.2]])){let t=(0,I.restSite)(o,i,.3),a=S([M(new f.BoxGeometry(.62,.36,.42),"#26292b",{at:[0,.18,0]}),M(new f.BoxGeometry(.64,.05,.44),"#d8b22a",{at:[0,.36,0]}),M(new f.BoxGeometry(.12,.04,.04),ez,{at:[0,.4,0]})]);e.push(b(a,{at:[o,t,i],rot:[0,n,0]})),a.dispose()}}{let t=eI(I.SENSOR.x,I.SENSOR.z,I.RIFT.x,I.RIFT.z),a=eL(e,I.SENSOR.x,I.SENSOR.z,.95,t),r=S([M(new f.BoxGeometry(.22,.16,.18),"#d8b22a",{at:[0,.08,0]}),M(new f.CylinderGeometry(.05,.05,.06,10),eP,{at:[0,.08,.12],rot:[Math.PI/2,0,0]}),M(new f.CylinderGeometry(.008,.008,.4,4),ez,{at:[.08,.36,-.04]})]);e.push(b(r,{at:[I.SENSOR.x,a+.95,I.SENSOR.z],rot:[0,t,0]})),r.dispose()}I.TAPE_STAKES.forEach(([t,a],r)=>{let o=(0,I.restSite)(t,a,.1);e.push(M(new f.CylinderGeometry(.03,.035,1.02,5),r%2?"#c9c4b4":"#d77a3a",{at:[t,o+.48,a],rot:[((0,d.hash)(r)-.5)*.08,0,((0,d.hash)(r+4)-.5)*.08]}))});{let t=I.LANDING.to-I.LANDING.from;for(let a=0;a<9;a++){if(6===a)continue;let r=I.LANDING.from+(a+.5)/9*t,o=3===a,i=o?.9:I.LANDING.width+((0,d.hash)(2.1*a)-.5)*.12;e.push(M(new f.BoxGeometry(i,.065,t/9-.045),ek[a%ek.length],{at:[o?-.28:((0,d.hash)(5.3*a)-.5)*.06,I.LANDING.deck+((0,d.hash)(a)-.5)*.02,r],rot:[((0,d.hash)(1.7*a)-.5)*.04,((0,d.hash)(3.9*a)-.5)*.05,o?.08:((0,d.hash)(7.1*a)-.5)*.03]}))}for(let a of[-1,1])for(let r of(e.push(M(new f.BoxGeometry(.1,.12,t+.2),"#5f5a50",{at:[.58*a,I.LANDING.deck-.09,(I.LANDING.from+I.LANDING.to)/2]})),[I.LANDING.from+.15,(I.LANDING.from+I.LANDING.to)/2,I.LANDING.to-.1])){let t=Math.min((0,I.groundSite)(.7*a,r),.2)-1.2,o=I.LANDING.deck+(r>I.LANDING.to-.5?.38:.02);e.push(M(new f.CylinderGeometry(.075,.085,o-t,6),"#5c564b",{at:[.7*a,(o+t)/2,r]}))}{let{top:t,bottom:a,steps:r,width:o}=I.STAIRS,i=I.YARD_HEIGHT,n=(a-t)/r,l=(i-I.LANDING.deck)/r;for(let a=0;a<r;a++){let r=t+(a+.5)*n,s=i-(a+1)*l+.02;e.push(M(new f.BoxGeometry(o+((0,d.hash)(3.3*a)-.5)*.08,.06,n+.05),ek[(a+1)%ek.length],{at:[((0,d.hash)(7.7*a)-.5)*.04,s,r],rot:[0,((0,d.hash)(5.5*a)-.5)*.06,((0,d.hash)(2.2*a)-.5)*.04]}))}let s=Math.hypot(a-t,i-I.LANDING.deck),u=Math.atan2(i-I.LANDING.deck,a-t);for(let r of[-1,1])if(e.push(M(new f.BoxGeometry(.07,.2,s+.2),"#5f5a50",{at:[r*(o/2+.04),(i+I.LANDING.deck)/2-.08,(t+a)/2],rot:[u,0,0]})),r>0){for(let n of[t+.1,a-.05]){let l=n<(t+a)/2?i:I.LANDING.deck;e.push(M(new f.CylinderGeometry(.035,.04,.95,5),"#5c564b",{at:[r*(o/2+.1),l+.45,n]}))}e.push(M(new f.CylinderGeometry(.025,.025,s,5),"#6c665a",{at:[r*(o/2+.1),(i+I.LANDING.deck)/2+.88,(t+a)/2],rot:[u-Math.PI/2,0,0]}))}}e.push(M(new f.CylinderGeometry(.045,.05,1.5,6),"#4f4b44",{at:[.66,I.LANDING.deck+.72,I.LANDING.to-.25]})),e.push(M(new f.BoxGeometry(.3,.04,.04),"#4f4b44",{at:[.55,I.LANDING.deck+1.44,I.LANDING.to-.25]})),e.push(M(new f.TorusGeometry(.17,.045,5,14),"#b7a78a",{at:[-.4,I.LANDING.deck+.05,I.LANDING.to-.55],rot:[Math.PI/2,0,0]})),e.push(M(new f.TorusGeometry(.12,.04,5,12),"#a99a7e",{at:[-.4,I.LANDING.deck+.1,I.LANDING.to-.55],rot:[Math.PI/2,0,.3]}))}{let{x:t,z:a}=I.DEAD_TREE,r=(0,I.restSite)(t,a,.3)-.1,o=(t,a,r,i,n,l,s,u)=>{let c=new f.Vector3(Math.sin(l)*Math.sin(s),Math.cos(l),Math.sin(l)*Math.cos(s)),h=new f.CylinderGeometry(.62*n,n,i,6);h.translate(0,i/2,0);let m=new f.Matrix4().lookAt(new f.Vector3,c,new f.Vector3(0,0,1)),p=new f.Matrix4().makeRotationX(Math.PI/2);if(h.applyMatrix4(p).applyMatrix4(m),e.push(M(h,"#5d5852",{at:[t,a,r]})),u<=0)return;let x=t+c.x*i,y=a+c.y*i,v=r+c.z*i,g=2===u?3:2;for(let e=0;e<g;e++){let a=13.1*u+3.7*e+t;o(x,y,v,i*(.55+.15*(0,d.hash)(a)),.6*n,.6*l+.45+.35*(0,d.hash)(a+1),s+(e-(g-1)/2)*1.9+.6*(0,d.hash)(a+2),u-1)}};o(t,r,a,1.9,.17,.12,.6,2)}return{geometry:S(e),standTops:t}})(),[]),i=(0,a.useMemo)(()=>S(eB.map(e=>{let t=e.map(([e,t,a=0])=>new f.Vector3(e,(0,I.groundSite)(e,t)+.035+a,t)),a=new f.CatmullRomCurve3(t,!1,"catmullrom",.35),r=Math.max(12,Math.round(a.getLength()/.12));return M(new f.TubeGeometry(a,r,.03,4,!1),"#1f2123")})),[]),n=(0,a.useMemo)(()=>new f.MeshStandardMaterial({vertexColors:!0,roughness:.82,flatShading:!0}),[]),l=(0,a.useMemo)(()=>new f.MeshStandardMaterial({vertexColors:!0,roughness:.5}),[]);return(0,a.useEffect)(()=>()=>{e.geometry.dispose(),i.dispose()},[i,e]),(0,r.useFrame)(e=>{let t=Math.sin(3.1*e.clock.elapsedTime)>.3?1:.25;T(14,I.SENSOR.x,(0,I.restSite)(I.SENSOR.x,I.SENSOR.z,.4)+1.12,I.SENSOR.z,.22,eH,t,.5)}),(0,t.jsxs)("group",{children:[(0,t.jsx)("mesh",{geometry:e.geometry,material:n,castShadow:!0,receiveShadow:!0}),(0,t.jsx)("mesh",{geometry:i,material:l,receiveShadow:!0,raycast:()=>null}),(0,t.jsx)(eX,{tops:e.standTops}),(0,t.jsx)(e$,{}),(0,t.jsx)(eZ,{}),(0,t.jsx)(eY,{}),(0,t.jsx)(eK,{}),(0,t.jsx)(o.PaintedSign,{lines:["Accès interdit"],position:[1.05,(0,I.restSite)(1.05,6.45,.3),6.45],rotation:.2,accent:"#d8b22a",width:1.4,post:1})]})}let e0=I.HOUSE.width/2,e2=I.HOUSE.depth/2,e1=I.HOUSE.plinth,e5=I.HOUSE.plinth+I.HOUSE.ground+I.HOUSE.upper,e3=e5+I.HOUSE.roof,e4=I.HOUSE.roof/e2,e6=[{side:"front",x:-1.55,y:1.6,w:.84,h:1.12,kind:"boarded"},{side:"front",x:1.5,y:1.6,w:.84,h:1.12,kind:"pane"},{side:"front",x:-1.5,y:3.95,w:.74,h:.98,kind:"crossed"},{side:"front",x:.05,y:3.95,w:.74,h:.98,kind:"dark"},{side:"front",x:1.5,y:3.95,w:.74,h:.98,kind:"flicker"},{side:"left",x:.35,y:1.6,w:.8,h:1.08,kind:"dark"},{side:"left",x:-.5,y:3.95,w:.7,h:.95,kind:"boarded"},{side:"right",x:-.4,y:1.6,w:.8,h:1.08,kind:"pane"},{side:"right",x:.45,y:3.95,w:.7,h:.95,kind:"dark"},{side:"back",x:-1,y:1.6,w:.8,h:1.08,kind:"crossed"},{side:"back",x:1.1,y:3.95,w:.7,h:.95,kind:"boarded"}];function e8(e){let t=new f.Matrix4;return"front"===e?t.makeTranslation(0,0,e2):"back"===e?t.makeRotationY(Math.PI).setPosition(0,0,-e2):"left"===e?t.makeRotationY(-Math.PI/2).setPosition(-e0,0,0):t.makeRotationY(Math.PI/2).setPosition(e0,0,0),t}let e7="#aeae9c",e9=["#7b6b55","#6a5d4b","#887760"],te="#8b8a82",tt="#8c9194";function ta({spec:e}){let o=(0,a.useRef)(null),i=(0,a.useMemo)(()=>e8(e.side),[e.side]);return(0,r.useFrame)(()=>{let e=o.current;e&&(e.emissiveIntensity=(.35+2.1*G.skyState.dayNight)*eb.flicker.window)}),(0,t.jsx)("group",{matrixAutoUpdate:!1,matrix:i,children:(0,t.jsxs)("mesh",{position:[e.x,e.y,.012],raycast:()=>null,children:[(0,t.jsx)("planeGeometry",{args:[e.w,e.h]}),(0,t.jsx)("meshStandardMaterial",{ref:o,color:"#3a4440",emissive:"#dce9a6",emissiveIntensity:.4,roughness:.4})]})})}function tr({spec:e,seed:r}){let i=(0,a.useMemo)(()=>e8(e.side),[e.side]);return(0,t.jsx)("group",{matrixAutoUpdate:!1,matrix:i,children:(0,t.jsx)(o.WindowPane,{seed:r,width:e.w,height:e.h,lit:"#e8d98a",glass:"#2a353a",position:[e.x,e.y,.012]})})}let to=new f.Color("#ffffff");function ti({position:e,rotation:r}){let o=(0,a.useMemo)(()=>{let e,t,a;return e=[],t=[e1,.95,e5-.5,e5],a=e=>e<=e1+.01?.6:e<1?.92:e<e5-.1?1:.84,[{side:"front",half:e0},{side:"back",half:e0},{side:"left",half:e2},{side:"right",half:e2}].forEach(({side:r,half:o},i)=>{let n=e8(r),l=.37*i;for(let r=0;r<t.length-1;r++){let i=t[r],s=t[r+1],u=C([[-o,i,0],[o,i,0],[o,s,0],[-o,s,0]],[[l+-o/4,i/4],[l+o/4,i/4],[l+o/4,s/4],[l+-o/4,s/4]],[a(i),a(i),a(s),a(s)]);u.applyMatrix4(n),e.push(u)}if("left"===r||"right"===r){let t=C([[-o,e5,0],[o,e5,0],[1e-4,e3,0],[-1e-4,e3,0]],[[l-o/4,e5/4],[l+o/4,e5/4],[l,e3/4],[l,e3/4]],[.86,.86,.95,.95]);t.applyMatrix4(n),e.push(t)}}),S(e)},[]),i=(0,a.useMemo)(()=>{let e,t,a,r,o;return e=-e0-.24,t=e0+.24,a=e5-.36*e4,o=Math.hypot(r=e2+.36,e3-a),S([C([[e,a,r],[t,a,r],[t,e3,0],[e,e3,0]],[[e/2,0],[t/2,0],[t/2,o/2],[e/2,o/2]],[.82,.82,1,1]),C([[t,a,-r],[e,a,-r],[e,e3,0],[t,e3,0]],[[t/2+.3,0],[e/2+.3,0],[e/2+.3,o/2],[t/2+.3,o/2]],[.82,.82,1,1])])},[]),n=(0,a.useMemo)(()=>(function(){let e=[];for(let[t,a]of(e.push(M(new f.BoxGeometry(I.HOUSE.width+.16,e1+.3,I.HOUSE.depth+.16),te,{at:[0,(e1-.3)/2,0]})),[[-1,-1],[1,-1],[-1,1],[1,1]]))e.push(M(new f.BoxGeometry(.15,e5-e1,.15),e7,{at:[t*e0,(e5+e1)/2,a*e2]}));let t=e1+I.HOUSE.ground;e.push(M(new f.BoxGeometry(I.HOUSE.width+.12,.11,.08),e7,{at:[0,t,e2+.02]})),e.push(M(new f.BoxGeometry(I.HOUSE.width+.12,.11,.08),e7,{at:[0,t,-e2-.02]})),e.push(M(new f.BoxGeometry(.08,.11,I.HOUSE.depth+.12),e7,{at:[-e0-.02,t,0]})),e.push(M(new f.BoxGeometry(.08,.11,I.HOUSE.depth+.12),e7,{at:[e0+.02,t,0]})),e6.forEach((t,a)=>{let r=e8(t.side);(function(e,t){let a=[],{x:r,y:o,w:i,h:n,kind:l}=e,s=t%3==0?e7:"#d2d3c1";if("pane"!==l&&"flicker"!==l&&a.push(M(new f.BoxGeometry(i,n,.02),"#252e33",{at:[r,o,.012]})),a.push(M(new f.BoxGeometry(i+.17,.085,.07),s,{at:[r,o+n/2+.0425,.02]})),a.push(M(new f.BoxGeometry(.085,n,.07),s,{at:[r-i/2-.0425,o,.02]})),a.push(M(new f.BoxGeometry(.085,n,.07),s,{at:[r+i/2+.0425,o,.02]})),a.push(M(new f.BoxGeometry(i+.26,.07,.15),s,{at:[r,o-n/2-.035,.06]},.92)),("dark"===l||"pane"===l)&&(a.push(M(new f.BoxGeometry(.035,n,.03),s,{at:[r,o,.03]})),a.push(M(new f.BoxGeometry(i,.035,.03),s,{at:[r,o+.08*n,.03]}))),"boarded"===l)for(let e=0;e<3;e++){let l=7.1*t+2.3*e,s=o-.33*n+e/2*n*.66+((0,d.hash)(l)-.5)*.08;a.push(M(new f.BoxGeometry(i+.3,.17,.035),e9[e%3],{at:[r+((0,d.hash)(l+1)-.5)*.08,s,.07],rot:[0,0,((0,d.hash)(l+2)-.5)*.3]}))}else if("crossed"===l)for(let e of[1,-1])a.push(M(new f.BoxGeometry(Math.hypot(i,n)+.12,.16,.035),e9[e>0?0:2],{at:[r,o,e>0?.07:.1],rot:[0,0,e*Math.atan2(n,i)]}));return a})(t,a).forEach(t=>e.push(t.applyMatrix4(r)))}),e.push(M(new f.BoxGeometry(.1,2.1,.09),e7,{at:[-.86,e1+1.05,e2+.03],rot:[0,0,.04]})),e.push(M(new f.BoxGeometry(.1,1.5,.09),e7,{at:[.72,e1+.75,e2+.1],rot:[.18,0,-.22]})),e.push(M(new f.BoxGeometry(1.5,.16,.42),te,{at:[-.15,.04,e2+.24]},.95));let a=e5-.36*e4,r=e2+.36,o=Math.hypot(r,e3-a),i=Math.atan2(e3-a,r);for(let t of[1,-1]){for(let n of(e.push(M(new f.BoxGeometry(I.HOUSE.width+.48,.12,o),"#3a3e3b",{at:[0,(a+e3)/2-.13,t*r/2],rot:[t*i,0,0]})),[-1,1]))e.push(M(new f.BoxGeometry(.07,.2,o+.05),e7,{at:[n*(e0+.24),(a+e3)/2-.02,t*r/2],rot:[t*i,0,0]}));e.push(M(new f.BoxGeometry(I.HOUSE.width+.48,.17,.06),e7,{at:[0,a-.06,t*(r+.01)]}))}for(let[t,o]of(e.push(M(new f.CylinderGeometry(.06,.06,I.HOUSE.width+.3,8),tt,{at:[0,a-.14,r+.08],rot:[0,0,Math.PI/2]},.8)),e.push(M(new f.CylinderGeometry(.045,.045,a-.25,8),tt,{at:[e0-.16,(a-.25)/2,e2+.1]},.8)),e.push(M(new f.BoxGeometry(.08,.08,r-e2+.02),tt,{at:[e0-.16,a-.24,(r+e2)/2+.05]},.8)),e.push(M(new f.BoxGeometry(I.HOUSE.width+.48+.05,.13,.26),"#3d4440",{at:[0,e3+.02,0]})),e.push(M(new f.BoxGeometry(.56,2.3,.56),"#5f5853",{at:[1.45,e3-.45,-.85]})),e.push(M(new f.BoxGeometry(.7,.14,.7),"#7b7671",{at:[1.45,e3+.76,-.85]})),e.push(M(new f.CylinderGeometry(.035,.04,2.6,6),tt,{at:[-1.75,e3+1.2,-.05]})),[[e3+1.6,1.2],[e3+2.05,.95],[e3+2.42,.7]]))e.push(M(new f.CylinderGeometry(.018,.018,o,5),tt,{at:[-1.75,t,-.05],rot:[0,.5,Math.PI/2]}));return e.push(M(new f.SphereGeometry(.36,12,6,0,2*Math.PI,0,Math.PI/2.6),"#c9cbc6",{at:[.55,e3-.55,-1.15],rot:[-1,.4,0],scale:[1,.45,1]})),e.push(M(new f.CylinderGeometry(.03,.03,.5,5),tt,{at:[.55,e3-.75,-1.2]})),S(e)})(),[]),l=(0,a.useMemo)(()=>new f.MeshStandardMaterial({map:eG("siding",()=>{let{canvas:e,ctx:t}=eA(512,512);for(let e=0;e<20;e++){let a=.9+.1*(0,d.hash)(3.7*e+1);t.fillStyle=`rgb(${Math.round(186*a)}, ${Math.round(192*a)}, ${Math.round(166*a)})`,t.fillRect(0,25.6*e,512,25.6)}for(let e=0;e<38;e++){let a=512*(0,d.hash)(7.31*e),r=(Math.floor(20*(0,d.hash)(3.17*e+2))+.5)*25.6,o=16+70*(0,d.hash)(1.93*e),i=25.6*(.55+1.3*(0,d.hash)(5.11*e));eN(512,a,r,o,(a,r)=>{eR(t,a,r,o,i,e),t.fillStyle=(0,d.hash)(9.7*e)>.5?"#7c7668":"#8a8273",t.fill(),t.save(),t.clip(),t.strokeStyle="rgba(58, 52, 42, 0.45)",t.lineWidth=1;for(let n=0;n<5;n++){let l=r-i/2+(n+.5)/5*i;t.beginPath(),t.moveTo(a-o,l),t.lineTo(a+o,l+((0,d.hash)(e+2.3*n)-.5)*3),t.stroke()}t.restore(),eR(t,a,r,o,i,e),t.lineWidth=1.6,t.strokeStyle="rgba(236, 240, 224, 0.8)",t.stroke()})}for(let e=0;e<20;e++){let a=25.6*e,r=t.createLinearGradient(0,a,0,a+6);r.addColorStop(0,"rgba(28, 32, 26, 0.6)"),r.addColorStop(1,"rgba(28, 32, 26, 0)"),t.fillStyle=r,t.fillRect(0,a,512,6),t.fillStyle="rgba(255, 255, 238, 0.15)",t.fillRect(0,a+25.6-2,512,1.5)}for(let e=0;e<16;e++){let a=512*(0,d.hash)(4.13*e+.5),r=512*(0,d.hash)(6.71*e+.2),o=50+130*(0,d.hash)(2.9*e),i=2+5*(0,d.hash)(8.3*e),n=t.createLinearGradient(0,r,0,r+o);n.addColorStop(0,`rgba(${(0,d.hash)(e)>.5?"96, 70, 40":"50, 54, 44"}, 0.28)`),n.addColorStop(1,"rgba(50, 54, 44, 0)"),t.fillStyle=n,eN(512,a,r+o/2,o,(e,a)=>t.fillRect(e-i/2,a-o/2,i,o))}return eT(e)}),vertexColors:!0,roughness:.94,color:to}),[]),s=(0,a.useMemo)(()=>new f.MeshStandardMaterial({map:eG("shingles",()=>{let{canvas:e,ctx:t}=eA(256,256);t.fillStyle="#2c302e",t.fillRect(0,0,256,256);let a=256/6,r=["#56605b","#4c5551","#5f6762","#474f4b","#646a5f"];for(let e=0;e<8;e++){let o=e%2==0?0:a/2;for(let i=-1;i<=6;i++){let n=17.3*e+3.1*i;if((0,d.hash)(n+.7)>.95)continue;let l=i*a+o+1,s=3*(0,d.hash)(n);t.fillStyle=r[Math.floor((0,d.hash)(n+2.2)*r.length)],t.fillRect(l,32*e+s,a-2,30),t.fillStyle="rgba(20, 22, 20, 0.55)",t.fillRect(l,32*e+32-4+s,a-2,3),t.fillStyle="rgba(255, 255, 255, 0.06)",t.fillRect(l,32*e+s,a-2,2)}}for(let e=0;e<9;e++){let a=256*(0,d.hash)(5.7*e),r=256*(0,d.hash)(9.1*e),o=18+40*(0,d.hash)(3.3*e);eN(256,a,r,o,(a,r)=>{eR(t,a,r,o,.6*o,e+40),t.fillStyle="rgba(112, 121, 76, 0.45)",t.fill()})}return eT(e)}),vertexColors:!0,roughness:.9}),[]),u=(0,a.useMemo)(()=>new f.MeshStandardMaterial({vertexColors:!0,roughness:.86,flatShading:!0}),[]);return(0,a.useEffect)(()=>()=>{o.dispose(),i.dispose(),n.dispose(),l.dispose(),s.dispose(),u.dispose()},[n,u,i,s,l,o]),(0,t.jsxs)("group",{position:e,"rotation-y":r,children:[(0,t.jsx)("mesh",{geometry:o,material:l,castShadow:!0,receiveShadow:!0}),(0,t.jsx)("mesh",{geometry:i,material:s,castShadow:!0,receiveShadow:!0}),(0,t.jsx)("mesh",{geometry:n,material:u,castShadow:!0,receiveShadow:!0}),e6.map((e,a)=>"flicker"===e.kind?(0,t.jsx)(ta,{spec:e},a):"pane"===e.kind?(0,t.jsx)(tr,{spec:e,seed:3.7*a+11},a):null)]})}let tn=I.YARD_HEIGHT-.03;var tl=e.i(8560);let ts=`
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,tu=`
uniform sampler2D uNoise;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uGlow;
uniform vec2 uCenter;
uniform vec2 uRift;
uniform vec2 uBoat;
uniform float uDensity;
uniform float uInner;
uniform float uLayer;
uniform float uHeight;
varying vec3 vWorld;
#include <common>
#include <fog_pars_fragment>

// Relief approch\xe9 de l'\xeele (m\xeame c\xf4te d\xe9coup\xe9e que le maillage) : la nappe s'amincit en
// approchant du sol au lieu de s'y couper net.
float islandGround(vec2 d) {
  float angle = atan(d.y, d.x);
  float edge = 9.0 * (1.0 + sin(angle * 3.0 + 97.0 * 1.7) * 0.07 + sin(angle * 7.0 - 97.0 * 0.9) * 0.04 + sin(angle * 13.0 + 97.0 * 0.31) * 0.015);
  float r = length(d);
  return mix(2.25, 0.95, smoothstep(edge * 0.74, edge * 0.82, r)) - smoothstep(edge * 0.82, edge * 1.05, r) * 1.2;
}

void main() {
  vec2 p = vWorld.xz;
  float r = distance(p, uCenter);
  // Couronne : l\xe9g\xe8re sur l'\xeele, dense le long de la c\xf4te, s'efface vers 46 m.
  float ring = mix(0.25, 1.0, smoothstep(uInner, uInner + 3.0, r)) * (1.0 - smoothstep(14.0, 46.0, r));
  ring *= smoothstep(0.05, 0.75, uHeight - islandGround(p - uCenter));
  vec2 drift = vec2(uTime * 0.011, uTime * 0.006);
  vec2 q = p * 0.034 + drift + uLayer * 0.37;
  float n = texture2D(uNoise, q).r * 0.62 + texture2D(uNoise, q * 2.3 - drift * 1.7 + 0.5).r * 0.38;
  float density = smoothstep(0.3, 0.74, n) * ring * uDensity;
  // Le bateau \xe9carte la brume.
  density *= smoothstep(2.2, 7.5, distance(p, uBoat));
  vec3 color = uColor + uGlow * exp(-distance(p, uRift) * 0.16);
  gl_FragColor = vec4(color, density);
  #include <fog_fragment>
}
`,tc=`
attribute vec4 aPuff;
attribute vec2 aDrift;
uniform float uTime;
uniform vec2 uCenter;
varying vec2 vUv;
varying float vFade;
varying vec2 vWorldXZ;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  float angle = aPuff.x + uTime * aDrift.x;
  vec3 center = vec3(uCenter.x + cos(angle) * aPuff.y, aPuff.z + sin(uTime * 0.21 + aDrift.y) * 0.35, uCenter.y + sin(angle) * aPuff.y);
  vec3 toCamera = cameraPosition - center;
  vec3 right = normalize(vec3(toCamera.z, 0.0, -toCamera.x));
  float size = aPuff.w * (0.9 + 0.1 * sin(uTime * 0.3 + aDrift.y * 2.0));
  vec3 world = center + right * position.x * size + vec3(0.0, 1.0, 0.0) * position.y * size * 0.55;
  vFade = smoothstep(5.0, 16.0, length(toCamera));
  vWorldXZ = world.xz;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,td=`
uniform sampler2D uNoise;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uGlow;
uniform vec2 uRift;
uniform vec2 uBoat;
uniform float uDensity;
varying vec2 vUv;
varying float vFade;
varying vec2 vWorldXZ;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float blob = 1.0 - smoothstep(0.25, 1.0, length(c));
  float n = texture2D(uNoise, vUv * 0.7 + vec2(uTime * 0.01, 0.0)).r;
  float bottom = smoothstep(0.0, 0.35, vUv.y);
  float density = blob * smoothstep(0.25, 0.7, n * 0.6 + blob * 0.5) * bottom * vFade * uDensity * 0.8;
  density *= smoothstep(2.0, 7.0, distance(vWorldXZ, uBoat));
  vec3 color = uColor + uGlow * exp(-distance(vWorldXZ, uRift) * 0.14);
  gl_FragColor = vec4(color, density);
  #include <fog_fragment>
}
`,tf={uNoise:{value:null},uTime:{value:0},uColor:{value:new f.Color("#c8cbb2")},uGlow:{value:new f.Color("#000000")},uCenter:{value:new f.Vector2(I.CENTER_X,I.CENTER_Z)},uRift:{value:new f.Vector2(I.RIFT_WORLD[0],I.RIFT_WORLD[1])},uBoat:{value:new f.Vector2(0,0)},uDensity:{value:1}},th=[{y:.7,inner:7.6,density:.78},{y:1.65,inner:6.6,density:.62},{y:2.85,inner:5.4,density:.42}],tm=null,tp=new f.Color("#c9ccb3"),tx=new f.Color("#d9bc98"),ty=new f.Color("#44535b"),tv=new f.Color("#6f5d18");function tg(){let e=(0,a.useRef)(null),o=(0,c.useWorld)(e=>e.quality),i=(0,a.useMemo)(()=>(function(){if(tm)return tm;tf.uNoise.value=eG("noise",()=>{let{canvas:e,ctx:t}=eA(128,128),a=t.createImageData(128,128),r=[{period:4,weight:.5},{period:8,weight:.28},{period:16,weight:.14},{period:32,weight:.08}],o=(e,t,a)=>(0,d.hash)((t%e+e)%e*57.13+(a%e+e)%e*13.77+3.31*e);for(let e=0;e<128;e++)for(let t=0;t<128;t++){let i=0;for(let{period:a,weight:n}of r){let r=t/128*a,l=e/128*a,s=Math.floor(r),u=Math.floor(l),c=r-s,d=l-u;c=c*c*(3-2*c),d=d*d*(3-2*d);let f=o(a,s,u),h=o(a,s+1,u),m=o(a,s,u+1);i+=((f+(h-f)*c)*(1-d)+(m+(o(a,s+1,u+1)-m)*c)*d)*n}let n=(128*e+t)*4,l=Math.round(255*Math.min(1,Math.max(0,i)));a.data[n]=l,a.data[n+1]=l,a.data[n+2]=l,a.data[n+3]=255}t.putImageData(a,0,0);let i=new f.CanvasTexture(e);return i.colorSpace=f.NoColorSpace,i.wrapS=i.wrapT=f.RepeatWrapping,i.minFilter=f.LinearFilter,i.generateMipmaps=!1,i});let e=th.map((e,t)=>new f.ShaderMaterial({uniforms:f.UniformsUtils.merge([tl.UniformsLib.fog,{uInner:{value:e.inner},uLayer:{value:t},uHeight:{value:e.y}}]),vertexShader:ts,fragmentShader:tu,transparent:!0,depthWrite:!1,fog:!0}));e.forEach((e,t)=>{Object.assign(e.uniforms,tf,{uDensity:{value:th[t].density}})});let t=new f.ShaderMaterial({uniforms:f.UniformsUtils.merge([tl.UniformsLib.fog]),vertexShader:tc,fragmentShader:td,transparent:!0,depthWrite:!1,fog:!0});return Object.assign(t.uniforms,tf),tm={sheets:e,puffs:t}})(),[]),n=(0,a.useMemo)(()=>new f.CircleGeometry(46,72).rotateX(-Math.PI/2),[]),l="high"===o?18:10*("medium"===o),s=(0,a.useMemo)(()=>l>0?function(e){let t=new f.PlaneGeometry(1,1).translate(0,.5,0),a=new Float32Array(4*e),r=new Float32Array(2*e);for(let t=0;t<e;t++){let e=9.8+11*(0,d.hash)(3.7*t);a.set([(0,d.hash)(1.3*t)*Math.PI*2,e,.2+.9*(0,d.hash)(5.1*t),8+7*(0,d.hash)(2.2*t)],4*t),r.set([(.012+.02*(0,d.hash)(4.4*t))*((0,d.hash)(6.6*t)>.5?1:-1),6.28*(0,d.hash)(8.8*t)],2*t)}return t.setAttribute("aPuff",new f.InstancedBufferAttribute(a,4)),t.setAttribute("aDrift",new f.InstancedBufferAttribute(r,2)),t}(l):null,[l]),h="low"===o?th.slice(0,2):th;return(0,r.useFrame)(t=>{e.current&&(e.current.visible=eb.staticSignal.scale>.5),tf.uTime.value=t.clock.elapsedTime*(eb.flicker.motion?1:.2);let a=G.skyState.dayNight;tf.uColor.value.copy(tp).lerp(tx,.75*G.skyState.golden).lerp(ty,a),tf.uGlow.value.copy(tv).multiplyScalar((.18+.95*a)*eb.flicker.rift),tf.uBoat.value.set(u.boatState.position.x,u.boatState.position.z)}),(0,t.jsxs)("group",{ref:e,visible:!1,children:[h.map((e,a)=>(0,t.jsx)("mesh",{geometry:n,material:i.sheets[a],position:[I.CENTER_X,e.y,I.CENTER_Z],renderOrder:5+a,raycast:()=>null,frustumCulled:!1},a)),s&&(0,t.jsx)("instancedMesh",{args:[s,i.puffs,l],renderOrder:8,frustumCulled:!1,raycast:()=>null})]})}let tw=`
varying vec3 vLocal;
varying vec3 vCamLocal;
#include <fog_pars_vertex>
void main() {
  vLocal = position;
  vCamLocal = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,tM=`
uniform float uTime;
uniform float uLight;
uniform float uGlitch;
uniform float uFigure;
uniform float uMotion;
uniform float uNight;
uniform sampler2D uPaper;
varying vec3 vLocal;
varying vec3 vCamLocal;
#include <common>
#include <fog_pars_fragment>

// D\xe9chirure : 2,5 m de haut. Couloir : largeur, hauteur sous plafond, longueur jusqu'au
// virage ; puis le couloir de droite (largeur, longueur) ; une pi\xe8ce derri\xe8re une porte.
#define TEAR_H 2.5
#define CW 2.3
#define CH 2.65
#define CL 8.6
#define TW 2.0
#define TL 7.5

float rh(float n) { return fract(sin(n * 91.345) * 47453.5453); }
float rh2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rh2(i), rh2(i + vec2(1.0, 0.0)), f.x), mix(rh2(i + vec2(0.0, 1.0)), rh2(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Axe de la d\xe9chirure : un \xe9clair, segments bris\xe9s tous les 32 cm (droit au pied).
float tearAxis(float y) {
  float k = y / 0.32;
  float i = floor(k);
  float a = (rh(i + 3.0) - 0.5) * 0.24;
  float b = (rh(i + 4.0) - 0.5) * 0.24;
  return mix(a, b, fract(k)) * smoothstep(0.0, 0.5, y);
}

// Distance sign\xe9e au bord (m\xe8tres, > 0 dedans), mesur\xe9e \xe0 l'horizontale.
float tearDist(vec2 p, float wobble) {
  if (p.y < -0.03) return -1.0;
  float h = clamp(p.y / TEAR_H, 0.0, 1.0);
  float body = max(0.0, 0.6 * (1.0 - pow(abs(h - 0.36) / 0.64, 2.0)));
  float axis = tearAxis(p.y);
  float row = p.y * 9.0 + wobble;
  float jl = (rh(floor(row) + 11.0) - 0.5) * 0.13 + (fract(row) - 0.5) * 0.06;
  float jr = (rh(floor(row) + 37.0) - 0.5) * 0.13 - (fract(row) - 0.5) * 0.06;
  float scale = 0.35 + 0.65 * body / 0.6;
  float left = axis - body - jl * scale;
  float right = axis + body + jr * scale;
  return min(p.x - left, right - p.x);
}

// Sortie d'une bo\xeete depuis l'int\xe9rieur : distance, et normale (tourn\xe9e vers le rayon).
float boxExit(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax, out vec3 n) {
  vec3 t1 = (bmin - ro) / rd;
  vec3 t2 = (bmax - ro) / rd;
  vec3 tf = max(t1, t2);
  float t = min(min(tf.x, tf.y), tf.z);
  if (t == tf.x) n = vec3(-sign(rd.x), 0.0, 0.0);
  else if (t == tf.y) n = vec3(0.0, -sign(rd.y), 0.0);
  else n = vec3(0.0, 0.0, -sign(rd.z));
  return max(t, 0.0);
}

vec3 paper(vec2 uv, float y) {
  vec3 c = texture2D(uPaper, uv / 0.8).rgb;
  // Plinthe brune, pied du mur sali, aur\xe9oles d'humidit\xe9 qui montent du sol.
  c = mix(c, vec3(0.2, 0.15, 0.07), 1.0 - step(0.11, y));
  c *= 0.8 + 0.2 * smoothstep(0.0, 0.7, y);
  float damp = smoothstep(0.6, 0.78, vnoise(uv * vec2(1.4, 0.8) + 4.0)) * (1.0 - smoothstep(0.3, 1.5, y));
  c = mix(c, c * vec3(0.62, 0.54, 0.36), damp * 0.75);
  return c;
}

vec3 carpet(vec2 xz) {
  vec3 c = vec3(0.47, 0.4, 0.24);
  float n = vnoise(xz * 6.0) * 0.55 + vnoise(xz * 21.0) * 0.45;
  c *= 0.84 + n * 0.24;
  float stain = smoothstep(0.56, 0.74, vnoise(xz * 0.85 + 9.0));
  return mix(c, c * vec3(0.55, 0.5, 0.36), stain * 0.85);
}

// Une dalle de n\xe9on : quelques-unes vacillent, une est morte (le noir au fond).
float panel(float k, float region) {
  float id = k + region * 13.0;
  float dead = step(0.5, abs(id - 2.0)) ;
  float shaky = step(0.93, rh(id * 7.3 + floor(uTime * 3.0))) * uMotion;
  return dead * mix(1.0, 0.3, shaky);
}

// Lumi\xe8re re\xe7ue en un point : dalle la plus proche le long de l'axe du couloir.
float lighting(float along, float region, out float k) {
  k = floor(along / 2.4 + 0.5);
  float d = along - k * 2.4;
  return 0.3 + 0.7 * exp(-d * d * 0.5) * panel(k, region);
}

// Silhouette \xe9lanc\xe9e (t\xeate, buste, jambes), pieds en (0, 0).
float figure(vec2 q) {
  float head = length(q - vec2(0.0, 1.95)) - 0.13;
  vec2 pa = q - vec2(0.0, 0.98);
  vec2 ba = vec2(0.0, 0.66);
  float body = length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - 0.19;
  float legs = max(max(abs(q.x) - 0.14, q.y - 1.0), -q.y);
  return min(min(head, body), legs);
}

vec3 corridor(vec3 ro, vec3 rd) {
  vec3 n;
  float t = boxExit(ro, rd, vec3(-CW * 0.5, 0.0, -CL), vec3(CW * 0.5, CH, 0.0), n);
  vec3 p = ro + rd * t;
  float region = 0.0;
  if (n.x < -0.5 && p.z < -CL + TW) {
    // Le virage : le couloir continue vers la droite, au bout.
    float t2 = boxExit(p, rd, vec3(CW * 0.5, 0.0, -CL), vec3(CW * 0.5 + TL, CH, -CL + TW), n);
    p += rd * t2;
    t += t2;
    region = 1.0;
  } else if (n.x > 0.5 && p.z < -3.9 && p.z > -4.9 && p.y < 2.05) {
    // Une porte \xe0 gauche, sur une pi\xe8ce sans fen\xeatre.
    float t3 = boxExit(p, rd, vec3(-CW * 0.5 - 2.6, 0.0, -5.9), vec3(-CW * 0.5, CH, -2.9), n);
    p += rd * t3;
    t += t3;
    region = 2.0;
  }

  // Position le long de l'axe du couloir (pour l'\xe9clairage) et coordonn\xe9e transverse.
  float along = region == 1.0 ? p.x - CW * 0.5 - 1.0 : region == 2.0 ? 0.0 : -p.z - 1.2;
  float across = region == 1.0 ? p.z + CL - TW * 0.5 : region == 2.0 ? p.z + 4.4 : p.x;
  float k;
  float light = lighting(along, region, k);
  if (region == 2.0) light = 0.22 + 0.25 * step(0.4, rh(floor(uTime * 2.0) + 5.0) * uMotion + 0.5 * (1.0 - uMotion));

  vec3 c;
  if (n.y > 0.5) {
    c = carpet(p.xz);
    c *= 0.82 + 0.18 * smoothstep(0.0, 0.5, CW * 0.5 - abs(across));
  } else if (n.y < -0.5) {
    // Plafond : dalles de 60 cm, n\xe9ons tous les 2,4 m.
    vec2 g = abs(fract(p.xz / 0.6) - 0.5);
    c = mix(vec3(0.6, 0.57, 0.46), vec3(0.32, 0.3, 0.23), step(0.46, max(g.x, g.y)));
    float lamp = step(abs(across), 0.3) * step(abs(along - k * 2.4), 0.62) * step(region, 1.5);
    c = mix(c, vec3(1.0, 0.96, 0.8) * 3.2 * panel(k, region), lamp);
  } else {
    float u = abs(n.x) > 0.5 ? p.z : p.x;
    c = paper(vec2(u, p.y), p.y);
    c *= 0.82 + 0.18 * (p.y / CH);
    // Chambranle de la porte lat\xe9rale.
    float jamb = step(abs(abs(p.z + 4.4) - 0.53), 0.05) * step(p.y, 2.1) + step(abs(p.y - 2.09), 0.05) * step(abs(p.z + 4.4), 0.58);
    c = mix(c, vec3(0.3, 0.24, 0.12), clamp(jamb, 0.0, 1.0) * step(0.5, n.x) * step(region, 0.5));
  }
  c *= light;

  // Une silhouette, au coin, quand la lumi\xe8re flanche.
  if (uFigure > 0.01 && rd.z < -0.05) {
    float tf = (-CL + TW * 0.55 - ro.z) / rd.z;
    if (tf < t) {
      vec3 q = ro + rd * tf;
      if (q.x > CW * 0.5 && figure(vec2(q.x - CW * 0.5 - 1.2, q.y)) < 0.0) {
        c = mix(c, vec3(0.025, 0.02, 0.015), uFigure);
      }
    }
  }

  // Brume jaun\xe2tre au loin : la profondeur se lit d'un coup d'œil.
  vec3 haze = vec3(0.62, 0.48, 0.14) * (0.55 + 0.45 * uLight);
  c = mix(c, haze, 1.0 - exp(-t * 0.085));
  return c * (0.45 + 0.6 * uLight);
}

void main() {
  vec2 p = vLocal.xy;
  float burst = uGlitch * uMotion;

  // Bandes horizontales qui glissent pendant les bouff\xe9es de parasites.
  float band = floor(p.y * 16.0);
  float slide = step(0.7, rh(band * 1.7 + floor(uTime * 9.0))) * burst;
  p.x += (rh(band + floor(uTime * 18.0) * 3.7) - 0.5) * 0.32 * slide;
  float wobble = floor(uTime * 7.0) * 0.37 * burst;

  float d = tearDist(p, wobble);
  float fringe = 0.022 + 0.04 * burst;
  float dR = tearDist(p + vec2(fringe, 0.0), wobble);
  float dB = tearDist(p - vec2(fringe, 0.0), wobble);

  vec3 color;
  float alpha;
  vec3 warm = vec3(1.0, 0.82, 0.32);
  if (d > 0.0) {
    vec3 rd = normalize(vLocal - vCamLocal);
    rd = mix(rd, vec3(1e-4), step(abs(rd), vec3(1e-4)));
    color = rd.z < -0.01 ? corridor(vec3(p, 0.0), rd) : vec3(0.6, 0.5, 0.22);
    // Bord int\xe9rieur br\xfblant.
    color += vec3(1.0, 0.86, 0.45) * exp(-d * 26.0) * 1.5 * uLight;
    alpha = 1.0;
  } else {
    // Liser\xe9 \xe9blouissant, frang\xe9 de couleurs, et halo doux sur la fa\xe7ade.
    vec3 rim = vec3(
      smoothstep(-0.05, 0.0, dR),
      smoothstep(-0.05, 0.0, d),
      smoothstep(-0.05, 0.0, dB)
    );
    float edge = max(max(rim.r, rim.g), rim.b);
    float halo = exp(d * 4.2) * (0.32 + 0.4 * uNight) * uLight;
    color = mix(warm * 1.4, vec3(1.0, 0.95, 0.8) * 3.0, edge) * mix(vec3(1.0), rim * 1.2 + 0.2, 0.6 * edge);
    alpha = max(edge * (0.7 + 0.3 * uLight), halo);
  }

  // Blocs de parasites accroch\xe9s aux bords.
  vec2 cell = floor(vLocal.xy / vec2(0.14, 0.07));
  float near = 1.0 - smoothstep(0.0, 0.32, abs(d));
  float on = step(0.88, rh2(cell + floor(uTime * 11.0) * 1.37)) * near * (0.18 + burst) * uMotion;
  float pick = rh2(cell * 3.1 + floor(uTime * 11.0));
  vec3 block = pick < 0.3 ? vec3(1.0, 0.85, 0.2) : pick < 0.55 ? vec3(0.3, 1.0, 1.0) : pick < 0.75 ? vec3(1.0, 0.3, 0.85) : vec3(1.0);
  color = mix(color, block * 2.0, on);
  alpha = max(alpha, on * 0.92);

  // Lignes de balayage, grain de cassette.
  color *= 0.93 + 0.07 * sin(gl_FragCoord.y * 1.7 + uTime * 30.0 * uMotion);
  color += (rh2(gl_FragCoord.xy + floor(uTime * 24.0)) - 0.5) * 0.06 * alpha;

  if (alpha < 0.004) discard;
  gl_FragColor = vec4(color, alpha);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,tS=f.UniformsUtils.merge([tl.UniformsLib.fog,{uTime:{value:0},uLight:{value:1},uGlitch:{value:0},uFigure:{value:0},uMotion:{value:1},uNight:{value:0},uPaper:{value:null}}]),tb=[[[.02,2.46],[.13,2.72],[.03,2.94],[.16,3.18],[.1,3.42]],[[-.4,1.86],[-.62,2.02],[-.7,2.3],[-.96,2.42],[-1.06,2.7],[-1,2.86]],[[.5,1.3],[.74,1.4],[.84,1.7],[1.02,1.8],[1.1,2.02]],[[.42,.24],[.66,.17],[.82,.34],[1.02,.36]],[[-.46,.7],[-.7,.62],[-.84,.8]]],tC={uTime:tS.uTime,uLight:tS.uLight,uNight:tS.uNight},tG=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,tA=`
uniform float uTime;
uniform float uLight;
uniform float uNight;
varying vec2 vUv;
void main() {
  float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float core = pow(across, 3.0);
  float pulse = 0.65 + 0.35 * sin(vUv.x * 9.0 - uTime * 3.5);
  float strength = (0.9 + uNight * 1.6) * uLight * pulse;
  gl_FragColor = vec4(vec3(1.0, 0.86, 0.42) * core * strength * 1.6, 1.0);
}
`,tT=`
uniform float uLight;
uniform float uNight;
varying vec2 vUv;
void main() {
  // vUv : x en travers (-1 → 1), y en avant (0 au pied de la faille → 1 au loin).
  vec2 q = vec2(vUv.x * 2.0 - 1.0, vUv.y);
  float spread = 0.32 + q.y * 0.9;
  float wedge = 1.0 - smoothstep(spread * 0.55, spread, abs(q.x));
  float fall = exp(-q.y * 2.6);
  float glow = exp(-dot(q * vec2(1.6, 2.4), q * vec2(1.6, 2.4)));
  float strength = (wedge * fall * 0.85 + glow * 0.4) * (0.22 + uNight * 0.85) * uLight;
  gl_FragColor = vec4(vec3(1.0, 0.8, 0.34) * strength, 1.0);
}
`,tN=new f.Color("#ffd25a"),tR=null;function tE({position:e}){let o=(0,a.useRef)(null),i=(0,c.useWorld)(e=>e.quality),n=(0,a.useMemo)(()=>new f.PlaneGeometry(3.4,3.3).translate(0,1.65-.06,0),[]),l=(0,a.useMemo)(()=>(function(){let e=[],t=[],a=[],r=0;for(let o of tb){let i=0;for(let n=0;n<o.length;n++){let[l,s]=o[n],[u,c]=o[Math.max(0,n-1)],[d,f]=o[Math.min(o.length-1,n+1)];n>0&&(i+=Math.hypot(l-u,s-c));let h=d-u,m=f-c,p=Math.hypot(h,m)||1;h/=p,m/=p;let x=.075*(1-n/(o.length-1)*.65);e.push(l-m*x,s+h*x,0,l+m*x,s-h*x,0),t.push(i,0,i,1),n>0&&a.push(r-2,r-1,r,r-1,r+1,r),r+=2}}let o=new f.BufferGeometry;return o.setAttribute("position",new f.BufferAttribute(new Float32Array(e),3)),o.setAttribute("uv",new f.BufferAttribute(new Float32Array(t),2)),o.setIndex(a),o})(),[]),s=(0,a.useMemo)(()=>new f.PlaneGeometry(4.4,4.2).rotateX(-Math.PI/2).translate(0,0,2.1),[]),{rift:u,cracks:h,pool:m}=(0,a.useMemo)(()=>tR||(tS.uPaper.value=eG("wallpaper",()=>{let{canvas:e,ctx:t}=eA(256,256);t.fillStyle="#cdb862",t.fillRect(0,0,256,256);for(let e=0;e<30;e++){let a=256*(0,d.hash)(3.3*e),r=256*(0,d.hash)(7.7*e),o=20+50*(0,d.hash)(1.1*e);eN(256,a,r,o,(a,r)=>{let i=t.createRadialGradient(a,r,0,a,r,o);i.addColorStop(0,(0,d.hash)(2.2*e)>.5?"rgba(120, 100, 30, 0.07)":"rgba(255, 245, 190, 0.07)"),i.addColorStop(1,"rgba(0, 0, 0, 0)"),t.fillStyle=i,t.fillRect(a-o,r-o,2*o,2*o)})}t.fillStyle="#b39d47";for(let e=0;e<4;e++){let a=64*e;t.fillRect(a+2,0,2,256),t.fillRect(a+8,0,1.5,256);let r=a+32+3;for(let a=0;a<8;a++){let o=32*a+16*(e%2!=0)+8;t.beginPath(),t.moveTo(r,o-9),t.lineTo(r+6,o),t.lineTo(r,o+9),t.lineTo(r-6,o),t.closePath(),t.fill(),t.fillRect(r-1,o+13,2,2)}}return eT(e)}),tR={rift:new f.ShaderMaterial({uniforms:tS,vertexShader:tw,fragmentShader:tM,transparent:!0,fog:!0,depthWrite:!0}),cracks:new f.ShaderMaterial({uniforms:tC,vertexShader:tG,fragmentShader:tA,transparent:!0,depthWrite:!1,blending:f.AdditiveBlending,side:f.DoubleSide}),pool:new f.ShaderMaterial({uniforms:{uLight:tS.uLight,uNight:tS.uNight},vertexShader:tG,fragmentShader:tT,transparent:!0,depthWrite:!1,blending:f.AdditiveBlending,polygonOffset:!0,polygonOffsetFactor:-2})}),[]);return(0,r.useFrame)(e=>{tS.uTime.value=e.clock.elapsedTime,tS.uLight.value=eb.flicker.rift,tS.uGlitch.value=eb.flicker.glitch,tS.uFigure.value=eb.flicker.figure,tS.uMotion.value=eb.flicker.motion,tS.uNight.value=G.skyState.dayNight,o.current&&(o.current.intensity=(1.2+9*G.skyState.dayNight)*eb.flicker.rift)}),(0,t.jsxs)("group",{position:e,children:[(0,t.jsx)("mesh",{geometry:n,material:u,renderOrder:3}),(0,t.jsx)("mesh",{geometry:l,material:h,"position-z":.02,renderOrder:4,raycast:()=>null}),(0,t.jsx)("mesh",{geometry:s,material:m,"position-y":.03,renderOrder:2,raycast:()=>null}),"high"===i&&(0,t.jsx)("pointLight",{ref:o,color:tN,position:[0,1.3,1.1],distance:11,decay:1.6,intensity:2})]})}var tk=e.i(25219),tz=e.i(30781),tP=e.i(90601);function tI(e,t,a){return{x:e[0],z:e[1],dx:0,dz:0,vx:0,vz:0,yaw:(0,d.hash)(a)*Math.PI*2,radius:t,cooldown:0}}let tL={buoy:tI(I.TRAIL.buoy,.9,1),cassette:tI(I.TRAIL.cassette,.8,2),tapes:I.TRAIL.tapes.map((e,t)=>tI(e,1.1,t+3))},tB=[tL.buoy,tL.cassette,...tL.tapes],tj=new f.Vector3(0,1,0),tO=new f.Quaternion,tD=new f.Quaternion,tF=new f.Vector3,tU=new f.Object3D;function t_(e,t,a,r,o,i,n=1){let l=(0,tP.waveHeight)(t,a,r),s=(0,tP.waveHeight)(t+.7,a,r)-(0,tP.waveHeight)(t-.7,a,r),u=(0,tP.waveHeight)(t,a+.7,r)-(0,tP.waveHeight)(t,a-.7,r);tO.setFromUnitVectors(tj,tF.set(-s*n,1,-u*n).normalize()),e.quaternion.copy(tO).multiply(tD.setFromAxisAngle(tj,i)),e.position.set(t,l+o,a)}let tW=`
attribute vec4 aSpark;
uniform float uTime;
varying vec2 vUv;
varying float vOn;
varying float vSeed;
varying vec3 vTint;
float sh(float n) { return fract(sin(n * 78.233) * 43758.5453); }
void main() {
  vUv = uv;
  float seed = aSpark.w;
  vSeed = seed;
  float tick = floor(uTime * (6.0 + sh(seed) * 8.0) + seed * 13.0);
  vOn = step(0.62, sh(tick + seed * 3.1));
  vTint = sh(seed * 1.7) > 0.8 ? vec3(0.95, 0.97, 1.0) : sh(seed * 2.3) > 0.5 ? vec3(1.0, 0.82, 0.22) : vec3(0.95, 0.88, 0.5);
  vec3 center = aSpark.xyz + vec3(0.0, sin(uTime * 0.9 + seed * 6.0) * 0.12, 0.0);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float size = 0.14 + sh(seed * 4.9) * 0.2;
  vec3 world = center + (right * position.x * 1.6 + up * position.y) * size;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`,tH=`
uniform float uNight;
uniform float uTime;
varying vec2 vUv;
varying float vOn;
varying float vSeed;
varying vec3 vTint;
float sh2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  if (vOn < 0.5) discard;
  vec2 cell = floor(vUv * vec2(5.0, 3.0));
  float frame = floor(uTime * 12.0);
  float snow = sh2(cell + vec2(frame * 1.37, vSeed * 7.1));
  vec2 q = abs(vUv - 0.5) * 2.0;
  float edge = step(sh2(cell * 3.1 + vSeed), 0.85 - max(q.x, q.y) * 0.35);
  float scan = 0.7 + 0.3 * step(0.5, fract(vUv.y * 6.0 + uTime * 3.0));
  float level = mix(0.18, 1.0, step(0.48, snow)) * scan * edge;
  gl_FragColor = vec4(vTint * level * (0.75 + uNight * 1.5), 1.0);
}
`,tV={uTime:{value:0},uNight:{value:0}},tq=new f.Color("#ffd23a"),tX=null;function t$(){let e=(0,o.useHandFont)(),r=(0,a.useMemo)(()=>{var t;return e?(t=tz.yellowStatic.title,eG(`label:${t}:${e}`,()=>{let{canvas:a,ctx:r}=eA(512,160);for(let e of(r.fillStyle="#efe8d4",r.fillRect(0,0,512,160),r.fillStyle="#e4b51f",r.fillRect(0,0,30,160),r.strokeStyle="rgba(80, 110, 160, 0.35)",r.lineWidth=2,[54,98,142]))r.beginPath(),r.moveTo(44,e),r.lineTo(496,e),r.stroke();return r.fillStyle="#1e1d24",r.font=`500 76px ${e}`,r.textBaseline="alphabetic",r.fillText(t,52,92,430),r.font=`500 34px ${e}`,r.fillStyle="#b8352c",r.fillText("▶ ne pas effacer",300,136,190),eT(a,!1)})):null},[e]);return r?(0,t.jsxs)("mesh",{position:[.02,.175,.13],"rotation-x":-Math.PI/2,raycast:()=>null,children:[(0,t.jsx)("planeGeometry",{args:[.98,.31]}),(0,t.jsx)("meshStandardMaterial",{map:r,roughness:.8})]}):null}function tZ(){let e=(0,a.useRef)(null),o=(0,a.useRef)(null),i=(0,a.useRef)(null),n=(0,a.useRef)(null),l=(0,a.useRef)(null),s=(0,a.useRef)(null),h=(0,a.useMemo)(()=>{let e;return tX??={ribbon:function(){let e=[],t=[],a=[];for(let r=0;r<=18;r++){let o=r/18,i=(o-.5)*2.6,n=.32*Math.sin(o*Math.PI*2.2),l=.03*Math.sin(o*Math.PI*3.1),s=.5*Math.sin(o*Math.PI*1.6);if(e.push(i,l+.26*Math.sin(s)*.5,n+.26*Math.cos(s)*.5),e.push(i,l-.26*Math.sin(s)*.5,n-.26*Math.cos(s)*.5),t.push(2.6*o/.6,1,2.6*o/.6,0),r>0){let e=2*r;a.push(e-2,e-1,e,e-1,e+1,e)}}let r=new f.BufferGeometry;return r.setAttribute("position",new f.BufferAttribute(new Float32Array(e),3)),r.setAttribute("uv",new f.BufferAttribute(new Float32Array(t),2)),r.setIndex(a),r.computeVertexNormals(),r}(),buoy:(e="#f0c42a",S([M(new f.CylinderGeometry(.42,.66,1.25,14),e,{at:[0,.35,0]}),M(new f.CylinderGeometry(.7,.7,.14,14),"#d9ab1d",{at:[0,-.22,0]}),M(new f.CylinderGeometry(.05,.05,.7,6),"#5d5f60",{at:[0,1.3,0]}),M(new f.BoxGeometry(.62,.1,.1),e,{at:[0,1.62,0],rot:[0,0,Math.PI/4]}),M(new f.BoxGeometry(.62,.1,.1),e,{at:[0,1.62,0],rot:[0,0,-Math.PI/4]}),M(new f.CylinderGeometry(.43,.43,.06,14),"#2d2f30",{at:[0,.02,0]})])),cassette:S([M(new f.BoxGeometry(1.16,.16,.66),"#1c1c1f",{at:[0,.08,0]}),M(new f.BoxGeometry(.62,.02,.2),"#3d4044",{at:[0,.165,-.17]}),M(new f.CylinderGeometry(.1,.1,.022,12),"#cfcfc8",{at:[-.18,.168,-.17]}),M(new f.CylinderGeometry(.1,.1,.022,12),"#cfcfc8",{at:[.18,.168,-.17]})]),painted:new f.MeshStandardMaterial({vertexColors:!0,roughness:.6}),tape:new f.MeshStandardMaterial({map:eE(),side:f.DoubleSide,roughness:.55}),sparks:function(){let e=new f.PlaneGeometry(1,1),t=new Float32Array(120),a=I.TRAIL.path;for(let e=0;e<30;e++){let r=(0,d.hash)(3.3*e)*(a.length-1),o=Math.min(a.length-2,Math.floor(r)),i=r-o,[n,l]=a[o],[s,u]=a[o+1];t.set([n+(s-n)*i+((0,d.hash)(5.1*e)-.5)*3,.45+1.1*(0,d.hash)(7.7*e),l+(u-l)*i+((0,d.hash)(9.3*e)-.5)*3,e+.5],4*e)}return e.setAttribute("aSpark",new f.InstancedBufferAttribute(t,4)),{geometry:e,count:30}}(),sparkMaterial:new f.ShaderMaterial({uniforms:tV,vertexShader:tW,fragmentShader:tH,transparent:!0,depthWrite:!1,blending:f.AdditiveBlending,toneMapped:!1})}},[]);return(0,a.useLayoutEffect)(()=>{n.current&&(n.current.frustumCulled=!1)},[]),(0,a.useEffect)(()=>()=>{for(let e of tB)e.dx=e.dz=e.vx=e.vz=0},[]),(0,r.useFrame)((t,a)=>{let r=Math.min(a,1/30),f=t.clock.elapsedTime,{phase:h}=c.useWorld.getState(),m="playing"===h||"docked"===h;if(e.current&&(e.current.visible=m),!m)return;tV.uTime.value=f*(eb.flicker.motion?1:.05),tV.uNight.value=G.skyState.dayNight,tB.forEach((e,t)=>(function(e,t,a,r){let o=e.x+e.dx-u.boatState.position.x,i=e.z+e.dz-u.boatState.position.z,n=Math.hypot(o,i)||.001,l=2.1+e.radius;if(n<l){let a=(l-n)*6;e.vx+=o/n*a*t+Math.cos(u.boatState.heading)*u.boatState.speed*.08*t*10,e.vz+=i/n*a*t+Math.sin(u.boatState.heading)*u.boatState.speed*.08*t*10}n<7&&e.cooldown<=0&&u.boatState.speed>.5&&(e.cooldown=5+3*(0,d.hash)(a+r),(0,tk.crackle)(1-n/7)),e.cooldown=Math.max(0,e.cooldown-t),e.vx+=-(.6*e.dx)*t,e.vz+=-(.6*e.dz)*t;let s=Math.exp(-1.4*t);e.vx*=s,e.vz*=s,e.dx+=e.vx*t,e.dz+=e.vz*t})(e,r,f,t));let p=tL.buoy;o.current&&t_(o.current,p.x+p.dx,p.z+p.dz,f,-.28,p.yaw+.2*Math.sin(.3*f),1.4);let x=+(f%4<.55),y=G.skyState.dayNight;l.current&&l.current.color.copy(tq).multiplyScalar(.35+x*(.8+1.6*y)),s.current&&s.current.scale.setScalar(x*(.8+2.2*y)+.001);let v=tL.cassette;v.yaw+=.05*r,i.current&&t_(i.current,v.x+v.dx,v.z+v.dz,f,-.04,v.yaw,.8);let g=n.current;g&&(tL.tapes.forEach((e,t)=>{e.yaw+=r*(.03+t%3*.015)*(t%2?1:-1),t_(tU,e.x+e.dx,e.z+e.dz,f,.03,e.yaw,.6),tU.scale.setScalar(1),tU.updateMatrix(),g.setMatrixAt(t,tU.matrix)}),g.instanceMatrix.needsUpdate=!0)}),(0,t.jsxs)("group",{ref:e,visible:!1,children:[(0,t.jsxs)("group",{ref:o,children:[(0,t.jsx)("mesh",{geometry:h.buoy,material:h.painted,castShadow:!0,raycast:()=>null}),(0,t.jsxs)("mesh",{position:[0,1.95,0],raycast:()=>null,children:[(0,t.jsx)("sphereGeometry",{args:[.11,10,8]}),(0,t.jsx)("meshBasicMaterial",{ref:l,color:"#ffd23a",toneMapped:!1})]}),(0,t.jsxs)("mesh",{ref:s,position:[0,1.95,0],raycast:()=>null,renderOrder:9,children:[(0,t.jsx)("sphereGeometry",{args:[.5,12,8]}),(0,t.jsx)("meshBasicMaterial",{color:"#ffcf40",transparent:!0,opacity:.22,depthWrite:!1,blending:f.AdditiveBlending,toneMapped:!1})]})]}),(0,t.jsxs)("group",{ref:i,children:[(0,t.jsx)("mesh",{geometry:h.cassette,material:h.painted,castShadow:!0,raycast:()=>null}),(0,t.jsx)(t$,{})]}),(0,t.jsx)("instancedMesh",{ref:n,args:[h.ribbon,h.tape,tL.tapes.length],castShadow:!0,raycast:()=>null}),(0,t.jsx)("instancedMesh",{args:[h.sparks.geometry,h.sparkMaterial,h.sparks.count],frustumCulled:!1,renderOrder:9,raycast:()=>null})]})}var tY=e.i(15333);let tK=`
varying vec3 vTerrainPos;
varying vec3 vTerrainNormal;
varying vec2 vTerrainWorld;
`,tQ=`
#include <worldpos_vertex>
vTerrainPos = position;
vTerrainNormal = normal;
vTerrainWorld = (modelMatrix * vec4(position, 1.0)).xz;
`,tJ=`
varying vec3 vTerrainPos;
varying vec3 vTerrainNormal;
varying vec2 vTerrainWorld;
uniform float uCloudTime;
${tY.CLOUD_SHADOW_GLSL}
uniform vec3 uSandDry;
uniform vec3 uSandLight;
uniform vec3 uSandWet;
uniform vec3 uGrassA;
uniform vec3 uGrassB;
uniform vec3 uGrassC;
uniform vec3 uRockA;
uniform vec3 uRockB;
uniform vec3 uRockC;
uniform vec3 uRockD;
uniform vec3 uMoss;
uniform vec3 uDirt;
uniform vec2 uPathA;
uniform vec2 uPathB;

float ysHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float ysNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(ysHash(i), ysHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(ysHash(i + vec3(0.0, 1.0, 0.0)), ysHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(ysHash(i + vec3(0.0, 0.0, 1.0)), ysHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(ysHash(i + vec3(0.0, 1.0, 1.0)), ysHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

float ysFbm(vec3 p) {
  return ysNoise(p) * 0.62 + ysNoise(p * 2.07 + 3.1) * 0.26 + ysNoise(p * 4.3 + 7.7) * 0.12;
}

float ysSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
`,t0=`
vec3 tN = normalize(vTerrainNormal);
vec3 tP = vTerrainPos;
float tLarge = ysFbm(tP * 0.17);
float tSmall = ysNoise(tP * 1.6);

// Sable cendr\xe9, mouill\xe9 et sombre au bord de l'eau.
float tWet = 1.0 - smoothstep(${s.WATERLINE_HEIGHT.toFixed(2)} - 0.1, ${s.WATERLINE_HEIGHT.toFixed(2)} + 0.55, tP.y + (tSmall - 0.5) * 0.14);
vec3 tSand = mix(uSandDry, uSandLight, smoothstep(0.38, 0.72, tLarge));
tSand = mix(tSand, uSandWet, tWet * 0.9);
tSand *= 1.0 - step(0.968, ysHash(floor(tP * 8.0))) * 0.12;

// Falaise : strates grises, ar\xeates sup\xe9rieures \xe9claircies.
float tLayer = tP.y * 1.1 + tLarge * 0.85 + sin(atan(tP.z, tP.x) * 3.0 + tLarge * 2.0) * 0.14;
float tBand = fract(tLayer);
float tIndex = mod(floor(tLayer), 4.0);
vec3 tRock = tIndex < 0.5 ? uRockA : tIndex < 1.5 ? uRockB : tIndex < 2.5 ? uRockC : uRockD;
tRock *= 0.9 + smoothstep(0.0, 0.14, tBand) * 0.1 + (tSmall - 0.5) * 0.08;
tRock = mix(tRock, tRock * 1.18 + vec3(0.02), smoothstep(0.32, 0.7, tN.y) * 0.5);
// Coulures de mousse sombre sous le rebord du plateau.
float tDrip = smoothstep(0.55, 0.8, ysNoise(vec3(tP.x * 2.2, tP.y * 0.4, tP.z * 2.2)));
tRock = mix(tRock, uMoss, tDrip * smoothstep(1.2, 2.0, tP.y) * 0.55);

// Herbe maladive : trois verts jaunis, taches s\xe8ches.
vec3 tGrass = mix(uGrassA, uGrassB, smoothstep(0.32, 0.7, tLarge));
tGrass = mix(tGrass, uGrassC, smoothstep(0.6, 0.8, ysFbm(tP * 0.42 + 7.0)) * 0.65);
tGrass = mix(tGrass, uDirt * 1.08, smoothstep(0.66, 0.8, ysFbm(tP * 0.9 + 3.0)) * 0.4);

// Sentier pi\xe9tin\xe9 de la plage \xe0 la faille, et terre battue devant la fa\xe7ade.
float tPath = ysSegment(tP.xz, uPathA, uPathB);
float tWorn = 1.0 - smoothstep(0.55, 1.15, tPath + (tSmall - 0.5) * 0.5);
tWorn = max(tWorn, (1.0 - smoothstep(1.4, 2.6, length(tP.xz - uPathB) + (tLarge - 0.5) * 1.2)) * 0.85);
tGrass = mix(tGrass, uDirt * (0.85 + tSmall * 0.25), tWorn);

float tGrassMask = smoothstep(0.7, 0.8, tN.y + (tSmall - 0.5) * 0.1)
  * smoothstep(${s.BEACH_HEIGHT.toFixed(2)} + 0.12, ${s.BEACH_HEIGHT.toFixed(2)} + 0.42, tP.y);
float tSandMask = 1.0 - smoothstep(${s.BEACH_HEIGHT.toFixed(2)} - 0.12, ${s.BEACH_HEIGHT.toFixed(2)} + 0.2, tP.y + (tLarge - 0.5) * 0.3);
vec3 tColor = mix(tRock, tGrass, tGrassMask);
tColor = mix(tColor, tSand, tSandMask);
// Lisi\xe8re : mousse sombre qui d\xe9borde au-dessus de la falaise.
float tLip = tGrassMask * (1.0 - smoothstep(0.8, 0.9, tN.y)) * (1.0 - tSandMask);
tColor = mix(tColor, uMoss, tLip * 0.5);
diffuseColor.rgb *= tColor * (1.0 - cloudShadow(vTerrainWorld, uCloudTime) * 0.2);
float tCliff = (1.0 - tGrassMask) * (1.0 - tSandMask);
`,t2=`
#include <normal_fragment_maps>
vec3 tFacet = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
normal = normalize(mix(normal, tFacet, tCliff * 0.8));
`,t1=null,t5=["#a3a55c","#8c9550","#c2b974","#a8946a"],t3=[[I.HOUSE.x,I.HOUSE.z,3.15],[I.RIFT.x,I.RIFT.z+1.6,1.9],[0,6,1.2],[2.35,3.3,1.1],[-3.3,-.15,.8]].map(([e,t,a])=>{let[r,o]=(0,I.siteToIsland)(e,t);return[r,o,a]}),t4=tn+I.HOUSE.plinth,t6=new tk.StaticAmbience;e.s(["default",0,function(){let e=(0,a.useRef)(null),h=(0,a.useRef)(null),m=(0,a.useRef)((0,l.createDecorLod)()),p=(0,a.useMemo)(()=>new i.ClearingStore,[]),x=(0,a.useMemo)(()=>(0,s.buildTerrainGeometry)(I.SHAPE,I.sampler),[]),y=(0,a.useMemo)(()=>(function(){if(t1)return t1;let[e,t]=(0,I.siteToIsland)(0,8.2),[a,r]=(0,I.siteToIsland)(I.RIFT.x,I.RIFT.z+1.4),o={uSandDry:{value:new f.Color("#bdb9a3")},uSandLight:{value:new f.Color("#cfcdb9")},uSandWet:{value:new f.Color("#6d6c5d")},uGrassA:{value:new f.Color("#a2a35e")},uGrassB:{value:new f.Color("#b7b26e")},uGrassC:{value:new f.Color("#858c52")},uRockA:{value:new f.Color("#7c7e78")},uRockB:{value:new f.Color("#90908a")},uRockC:{value:new f.Color("#696d66")},uRockD:{value:new f.Color("#a3a196")},uMoss:{value:new f.Color("#5d6741")},uDirt:{value:new f.Color("#8d7f5f")},uPathA:{value:new f.Vector2(e,t)},uPathB:{value:new f.Vector2(a,r)},uCloudTime:tY.cloudClock},i=new f.MeshStandardMaterial({color:"#ffffff",roughness:.97,metalness:0});return i.name="yellow-static-terrain",i.onBeforeCompile=e=>{Object.assign(e.uniforms,o),e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
${tK}`).replace("#include <worldpos_vertex>",tQ),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
${tJ}`).replace("#include <map_fragment>",t0).replace("#include <normal_fragment_maps>",t2)},i.customProgramCacheKey=()=>"yellow-static-terrain-v1",t1=i,i})(),[]),v=(0,a.useRef)(!1),g=(0,a.useRef)(0);return(0,a.useEffect)(()=>()=>x.dispose(),[x]),(0,a.useEffect)(()=>()=>t6.dispose(),[]),(0,a.useEffect)(()=>{},[]),(0,r.useFrame)((t,a)=>{let r=Math.min(a,1/30),o=t.clock.elapsedTime,i=c.useWorld.getState(),n=e.current;if(n){let e=Math.hypot(I.CENTER_X-i.introCenter[0],I.CENTER_Z-i.introCenter[1]),a=(0,d.smoothstep)(e-4.5,e,i.introRadius),o=(0,d.damp)(n.scale.x,a*(1+.09*Math.sin(a*Math.PI)*(1-a)),7.5,r);n.scale.setScalar(o),n.visible=o>.006,eb.staticSignal.scale=o,h.current&&(0,l.updateDecorLod)(h.current,m.current,t.camera,{x:I.CENTER_X,z:I.CENTER_Z,radius:I.ISLAND.radius,depth:9},i.quality,eb.staticSignal.proximity>.05,null!==i.activeIsland,i.reducedMotion||!n.visible,r)}let s=+!i.reducedMotion;if(eb.flicker.motion=s,s){let e=(0,eb.tube)(o,9.1,.12);eb.flicker.rift=.75+.25*e+.04*Math.sin(2.3*o),eb.flicker.standA=(0,eb.tube)(o,1.7)*(.6+.4*e),eb.flicker.standB=(0,eb.tube)(o,4.3,.1)*(.6+.4*e),eb.flicker.window=(0,eb.tube)(1.3*o,6.6,.5),eb.flicker.lamp=(0,eb.tube)(o,2.9,.3);let t=Math.floor(o/6.5),a=o-6.5*t-3*(0,d.hash)(3.3*t);eb.flicker.glitch=a>0&&a<.45?1:.6*(e<.5);let r=Math.floor(o/23),i=o-23*r-8-8*(0,d.hash)(1.7*r),n=+((0,d.hash)(5.1*r+.3)>.35&&i>0&&i<1.6);eb.flicker.figure=n*(.55+.45*(0,eb.tube)(3*o,3.3,.6)),n&&(eb.flicker.rift*=.55+.25*Math.sin(40*o))}else eb.flicker.rift=.92,eb.flicker.standA=eb.flicker.standB=eb.flicker.window=eb.flicker.lamp=1,eb.flicker.glitch=0,eb.flicker.figure=0;let f=Math.hypot(u.boatState.position.x-I.CENTER_X,u.boatState.position.z-I.CENTER_Z);eb.staticSignal.proximity=1-(0,d.smoothstep)(I.ISLAND.radius+5,I.ISLAND.influence,f),g.current+=r,g.current>=.2&&(t6.update((0,eb.proximityNow)(),g.current),g.current=0);let p=Math.hypot(u.boatState.position.x-I.RIFT_WORLD[0],u.boatState.position.z-I.RIFT_WORLD[1]);("playing"===i.phase||"docked"===i.phase)&&p<13.8&&!v.current?(v.current=!0,L.useStaticDossier.getState().reveal("approach")):p>24&&(v.current=!1)},-1),(0,t.jsxs)("group",{children:[(0,t.jsx)("group",{ref:e,position:[I.CENTER_X,0,I.CENTER_Z],scale:0,userData:i.CLEARING_ROOT,onClick:e=>{e.stopPropagation(),c.useWorld.getState().sailToPoint(I.DOCK_POINT)},onPointerOver:e=>{e.stopPropagation(),document.body.style.cursor="pointer"},onPointerOut:()=>{document.body.style.cursor=""},children:(0,t.jsxs)(i.ClearingContext.Provider,{value:p,children:[(0,t.jsx)("mesh",{geometry:x,material:y,castShadow:!0,receiveShadow:!0}),t3.map(([e,a,r],i)=>(0,t.jsx)(o.ClearingAt,{x:e,z:a,radius:r},i)),(0,t.jsx)("group",{"rotation-y":I.FACE,children:(0,t.jsx)(ti,{position:[I.HOUSE.x,tn,I.HOUSE.z],rotation:0})}),(0,t.jsxs)("group",{ref:h,children:[(0,t.jsx)(n.Grass,{sampler:I.sampler,radius:I.ISLAND.radius,plateau:I.FEATURES.plateau,avoidAngle:I.ISLAND.dockAngle,seed:3984,amount:.9,palette:t5}),(0,t.jsx)(eQ,{}),(0,t.jsxs)("group",{"rotation-y":I.FACE,children:[(0,t.jsx)(tE,{position:[I.RIFT.x,t4,I.RIFT.z]}),(0,t.jsx)(eJ,{}),(0,t.jsx)(eS,{}),(0,t.jsx)(W,{}),(0,t.jsx)(P,{})]})]})]})}),(0,t.jsx)(tg,{}),(0,t.jsx)(tZ,{})]})}],32807)}]);