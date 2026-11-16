(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,55232,e=>{"use strict";var t=e.i(43476),a=e.i(71645),r=e.i(94800),o=e.i(90072),i=e.i(79043),l=e.i(87269),n=e.i(67078),s=e.i(27225),c=e.i(90601);e.i(96959);var u=e.i(8560),d=e.i(49184),h=e.i(49835);let m=Array.from({length:h.ARMS},function(){return{visible:0,rootX:0,rootZ:0,dirX:1,dirZ:0,length:30,thickness:1.4,rise:0,tilt:0,lean:0,curl:0,sway:1,phase:0,twist:0,wet:0,wrap:0,coil:0,hx:0,hy:0,hz:0,ax:1,ay:0,az:0,ux:0,uy:1,uz:0,vx:0,vy:0,vz:1,hLength:2.6,hRadiusUp:1.8,hRadiusSide:1.4,hTurns:1.4,hand:1}}),f=new Float32Array(4*(h.SPINE*h.ARMS*h.SPINE_ROWS)),p=new o.DataTexture(f,h.SPINE,h.ARMS*h.SPINE_ROWS,o.RGBAFormat,o.FloatType);p.magFilter=o.NearestFilter,p.minFilter=o.NearestFilter,p.generateMipmaps=!1,p.needsUpdate=!0;let v=new Float32Array(3*h.SPINE),k=new Float32Array(3*h.SPINE),g=new Float32Array(h.SPINE),y=new Float32Array(3),S=new Float32Array(3);function x(e,t,a,r,o){let i=t>.56?Math.pow((t-.56)/.44,2.3):0;return e.tilt+e.lean*t+a*i+e.sway*o*.2*Math.sin(.78*r+e.phase+2.3*t)*t}let w=`
float krHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float krNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(krHash(i), krHash(i + vec2(1.0, 0.0)), u.x),
    mix(krHash(i + vec2(0.0, 1.0)), krHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float krFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += krNoise(p) * a;
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
`,b=`
uniform sampler2D uSpine;
void krSpine(float arm, float s, out vec3 C, out float R, out vec3 N, out vec3 T, out float wet) {
  float fi = clamp(s, 0.0, 1.0) * ${(h.SPINE-1).toFixed(1)};
  int k1 = int(min(floor(fi), ${(h.SPINE-2).toFixed(1)}));
  float f = fi - float(k1);
  int row = int(arm + 0.5) * ${h.SPINE_ROWS};
  vec4 a1 = texelFetch(uSpine, ivec2(k1, row), 0);
  vec4 a2 = texelFetch(uSpine, ivec2(k1 + 1, row), 0);
  C = mix(a1.xyz, a2.xyz, f);
  R = mix(a1.w, a2.w, f);
  N = normalize(mix(texelFetch(uSpine, ivec2(k1, row + 1), 0).xyz, texelFetch(uSpine, ivec2(k1 + 1, row + 1), 0).xyz, f) + vec3(1e-5, 0.0, 0.0));
  vec4 t = mix(texelFetch(uSpine, ivec2(k1, row + 2), 0), texelFetch(uSpine, ivec2(k1 + 1, row + 2), 0), f);
  T = normalize(t.xyz + vec3(0.0, 1e-5, 0.0));
  wet = t.w;
}
`,z=()=>o.UniformsUtils.clone(u.UniformsLib.fog),M=h.ARMS+1,R={uSpine:{value:p},uTime:{value:0},uPointScale:{value:400},uHead:{value:new o.Vector4(0,-30,0,0)},uHeadYaw:{value:0},uNight:{value:0}},A={uBurst:{value:Array.from({length:h.BURSTS},()=>new o.Vector4(0,0,0,99))},uBurstFx:{value:Array.from({length:h.BURSTS},()=>new o.Vector4)},uPointScale:{value:400},uNight:{value:0}},F={...z(),uNight:{value:0},uAmount:{value:0},uFade:{value:0},uTime:{value:0},uSeed:{value:0}},C={uStrength:{value:0},uTime:{value:0},uSize:{value:new o.Vector2(52,25)}},T={uVeil:{value:0},uMode:{value:0},uOrigin:{value:new o.Vector2(.5,.5)},uAspect:{value:1.6},uTime:{value:0},uTint:{value:new o.Color("#b04cff")}};function X(e,t,a){let r=Math.floor(e),o=Math.floor(t),i=Math.floor(a),l=e-r,n=t-o,s=a-i,c=l*l*(3-2*l),u=n*n*(3-2*n),h=(e,t,a)=>(0,d.hash)(127.1*e+311.7*t+74.7*a),m=(e,t,a)=>e+(t-e)*a,f=m(h(r,o,i),h(r+1,o,i),c),p=m(h(r,o+1,i),h(r+1,o+1,i),c),v=m(h(r,o,i+1),h(r+1,o,i+1),c),k=m(h(r,o+1,i+1),h(r+1,o+1,i+1),c);return m(m(f,p,u),m(v,k,u),s*s*(3-2*s))}let P=new o.Vector3(.5,.44,.745).normalize();function Z(e){let t=P.clone();t.z*=e;let a=new o.Vector3(t.x*h.HEAD.rx,t.y*h.HEAD.ry,t.z*h.HEAD.rz),r=new o.Vector3(a.x/(h.HEAD.rx*h.HEAD.rx),a.y/(h.HEAD.ry*h.HEAD.ry),a.z/(h.HEAD.rz*h.HEAD.rz)).normalize();return{center:a.clone().addScaledVector(r,-(.42*h.HEAD.eyeRadius)),normal:r}}let I=null;function E(e){let t=e;return()=>(0,d.hash)(12.9898*t+++78.233)}function N([e,t,a],r){return`rgba(${e},${t},${a},${r})`}function D(e,t,a,r,o){for(let i=-e;i<=e;i+=e)for(let l=-e;l<=e;l+=e){let n=t+i,s=a+l;n+r<0||n-r>e||s+r<0||s-r>e||o(n,s)}}function W(e,t,a,r,o,i){let l=e.createRadialGradient(t,a,0,t,a,r);l.addColorStop(0,N(o,i)),l.addColorStop(.55,N(o,.6*i)),l.addColorStop(1,N(o,0)),e.fillStyle=l,e.beginPath(),e.arc(t,a,r,0,2*Math.PI),e.fill()}let _={uSpine:{value:p},uTime:{value:0},uWiggle:{value:1},uFlash:{value:0},uNight:{value:0},uRim:{value:new o.Color("#86a4b8")},uWet:{value:0},uLid:{value:1},uPupil:{value:.3},uEyeGlow:{value:0}},L=Z(1).center.normalize(),B=`
uniform sampler2D uSpine;
uniform float uTime;
uniform float uWiggle;
varying float vVentral;
varying float vS;
varying float vWet;

vec4 krTexel(int k, int row) {
  return texelFetch(uSpine, ivec2(k, row), 0);
}

// Rep\xe8re du bras \xab arm \xbb \xe0 l'abscisse s : centre (Catmull-Rom), rayon, face ventrale, tangente.
void krFrame(float arm, float s, out vec3 C, out float R, out vec3 N, out vec3 T, out float wet) {
  float fi = clamp(s, 0.0, 1.0) * ${(h.SPINE-1).toFixed(1)};
  int k1 = int(min(floor(fi), ${(h.SPINE-2).toFixed(1)}));
  float f = fi - float(k1);
  int k0 = max(k1 - 1, 0);
  int k2 = k1 + 1;
  int k3 = min(k1 + 2, ${h.SPINE-1});
  int row = int(arm + 0.5) * ${h.SPINE_ROWS};
  vec4 a0 = krTexel(k0, row);
  vec4 a1 = krTexel(k1, row);
  vec4 a2 = krTexel(k2, row);
  vec4 a3 = krTexel(k3, row);
  float f2 = f * f;
  float f3 = f2 * f;
  C = 0.5 * (2.0 * a1.xyz + (a2.xyz - a0.xyz) * f
    + (2.0 * a0.xyz - 5.0 * a1.xyz + 4.0 * a2.xyz - a3.xyz) * f2
    + (3.0 * a1.xyz - a0.xyz - 3.0 * a2.xyz + a3.xyz) * f3);
  R = mix(a1.w, a2.w, f);
  vec4 t1 = krTexel(k1, row + 2);
  vec4 t2 = krTexel(k2, row + 2);
  T = normalize(mix(t1.xyz, t2.xyz, f) + vec3(0.0, 1e-5, 0.0));
  vec3 n = mix(krTexel(k1, row + 1).xyz, krTexel(k2, row + 1).xyz, f);
  N = normalize(n - T * dot(n, T) + vec3(1e-5, 0.0, 0.0));
  wet = mix(t1.w, t2.w, f);
  // Ondulation fine calcul\xe9e ici : une vague court le long du bras, plus ample vers la pointe.
  vec3 B = cross(T, N);
  float ripple = sin(s * 17.0 - uTime * 2.4 + arm * 1.9) * 0.6
    + sin(s * 31.0 - uTime * 3.7 + arm * 0.7) * 0.25;
  C += B * ripple * s * s * 0.35 * uWiggle;
}
`,V=`
vec3 krC; float krR; vec3 krN; vec3 krT; float krWet;
krFrame(position.x, position.y, krC, krR, krN, krT, krWet);
vec3 krB = cross(krT, krN);
float krCos = cos(position.z);
vec3 krDir = krCos * krN + sin(position.z) * krB;
vec3 objectNormal = normalize(krDir);
vVentral = krCos;
vS = position.y;
vWet = krWet;
#ifdef USE_TANGENT
  vec3 objectTangent = krT;
#endif
`,H=`
// Ventre un peu aplati.
float krFlat = 1.0 - 0.16 * pow(max(krCos, 0.0), 2.0);
vec3 transformed = krC + krDir * krR * krFlat;
`,U=`
vec3 krC; float krR; vec3 krN; vec3 krT; float krWet;
krFrame(aSucker.x, aSucker.y, krC, krR, krN, krT, krWet);
vec3 krB = cross(krT, krN);
float krAng = aSucker.z * 0.44;
vec3 krUp = normalize(cos(krAng) * krN + sin(krAng) * krB);
vec3 krX = normalize(krT - krUp * dot(krT, krUp));
vec3 krZ = cross(krX, krUp);
vec3 objectNormal = normalize(krX * normal.x + krUp * normal.y + krZ * normal.z);
vVentral = 1.0;
vS = aSucker.y;
vWet = krWet;
`,K=`
float krFlat = 1.0 - 0.16 * pow(max(cos(krAng), 0.0), 2.0);
float krSize = krR * 0.34 * aSucker.w;
// Les ventouses palpitent, chacune \xe0 son rythme.
float krPulse = 1.0 + 0.12 * sin(uTime * 2.6 + aSucker.y * 47.0 + aSucker.x * 3.0);
vec3 transformed = krC + krUp * krR * krFlat * 0.97
  + (krX * position.x + krUp * position.y * krPulse + krZ * position.z) * krSize;
`,j=`
uniform float uTime;
uniform float uFlash;
uniform float uNight;
uniform vec3 uRim;
uniform float uWet;
uniform float uLid;
const vec3 KR_EYE = vec3(${L.x.toFixed(4)}, ${L.y.toFixed(4)}, ${L.z.toFixed(4)});
#if defined(KR_ARM) || defined(KR_SUCKER)
  varying float vVentral;
  varying float vS;
  varying float vWet;
#else
  varying vec3 vKrLocal;
#endif
`,O=`
#include <map_fragment>
float krWetness = 0.0;
float krBelly = 0.0;
float krAlong = 0.5;
#ifdef KR_ARM
{
  // Dos cramoisi qui vire au pourpre vers la pointe, ventre cr\xe8me c\xf4t\xe9 ventouses.
  krAlong = smoothstep(0.1, 0.95, vS);
  diffuseColor.rgb *= mix(vec3(1.06, 0.9, 0.94), vec3(0.7, 0.56, 1.12), krAlong);
  krBelly = smoothstep(0.18, 0.72, vVentral);
  float krLum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
  vec3 krCream = vec3(0.86, 0.6, 0.5) * (0.72 + krLum * 1.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, krCream, krBelly * 0.9);
  krWetness = vWet;
}
#endif
#ifdef KR_SUCKER
  krBelly = 1.0;
  krWetness = vWet;
  krAlong = vS;
#endif
#if !defined(KR_ARM) && !defined(KR_SUCKER)
{
  krWetness = uWet;
  // Eau qui ruisselle en nappes sur la t\xeate qui vient de crever la surface.
  float krAz = atan(vKrLocal.z, vKrLocal.x);
  float krLaneId = floor(krAz * 9.0);
  float krRand = fract(sin(krLaneId * 91.7 + 3.1) * 43758.5);
  float krLane = fract(krAz * 9.0);
  float krLine = 1.0 - smoothstep(0.0, 0.05 + krRand * 0.05, abs(krLane - 0.5));
  // Filets courts qui glissent vers la mer, pas des lignes continues.
  float krFlow = fract(vKrLocal.y * 0.55 + uTime * (0.7 + krRand * 0.8) + krRand * 5.0);
  float krDrop = smoothstep(0.0, 0.08, krFlow) * (1.0 - smoothstep(0.18, 0.42, krFlow));
  float krSheet = krLine * krDrop * step(0.45, krRand) * uWet;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.7, 0.78, 0.82), krSheet * 0.22);
  krWetness = max(krWetness * 0.5, krSheet);
  #ifndef KR_LID
    // Orbites fard\xe9es de prune sombre : l'œil dor\xe9 ressort.
    vec3 krN = normalize(vKrLocal);
    float krOrbit = max(dot(krN, KR_EYE * vec3(1.0, 1.0, -1.0)), dot(krN, KR_EYE));
    float krShade = smoothstep(0.72, 0.9, krOrbit);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.45, 0.28, 0.5), krShade * 0.75);
  #endif
}
#endif
#ifdef KR_LID
{
  // Paupi\xe8re : sph\xe8re ouverte en amande devant l'œil ; uLid = 0 ferme.
  vec3 krD = normalize(vKrLocal);
  float krAzL = atan(krD.x, krD.z);
  float krEl = asin(clamp(krD.y, -1.0, 1.0));
  float krW = 0.86;
  float krHalf = uLid * 0.7 * pow(max(0.0, 1.0 - (krAzL * krAzL) / (krW * krW)), 0.55);
  float krFront = step(0.0, krD.z) * step(abs(krAzL), krW);
  if (krFront > 0.5 && abs(krEl) < krHalf) discard;
  float krEdge = 1.0 - smoothstep(0.0, 0.08, abs(krEl) - krHalf);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1, 0.015, 0.04), krEdge * krFront);
}
#endif
`,$=`
#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.2, clamp(krWetness, 0.0, 1.0));
`,G=`
#include <emissivemap_fragment>
// Photophores : seulement sur le dos.
totalEmissiveRadiance *= 1.0 - krBelly;
`,q=`
#include <lights_fragment_end>
{
  vec3 krV = geometryViewDir;
  float krFres = 1.0 - saturate(dot(normal, krV));
  // Liser\xe9 froid du ciel d'orage : la silhouette se lit m\xeame de nuit.
  totalEmissiveRadiance += uRim * smoothstep(0.6, 0.95, krFres) * (0.14 + 0.6 * uNight) * (0.3 + diffuseColor.rgb * 1.8);
  // Chair translucide : la couleur reste satur\xe9e dans la p\xe9nombre de l'orage.
  totalEmissiveRadiance += diffuseColor.rgb * (0.13 + uNight * 0.06) * (1.0 - krBelly * 0.4);
  // Irisation discr\xe8te (film d'eau et de mucus), surtout sur le dos.
  vec3 krIrid = 0.5 + 0.5 * cos(6.2832 * (krFres * 1.4 + krAlong * 0.8 + vec3(0.0, 0.33, 0.67)));
  totalEmissiveRadiance += krIrid * pow(krFres, 2.6) * 0.17 * (1.0 - krBelly * 0.6);
  #if NUM_DIR_LIGHTS > 0
    // Reflet mouill\xe9, net comme un aplat de dessin anim\xe9.
    vec3 krH = normalize(directionalLights[0].direction + krV);
    float krSpec = smoothstep(0.955, 0.97, dot(normal, krH));
    totalEmissiveRadiance += directionalLights[0].color * krSpec * (0.15 + krWetness * 0.4);
  #endif
  // Reflet de ciel sur la peau mouill\xe9e, visible m\xeame sans soleil.
  float krSky = smoothstep(0.9, 0.93, dot(normal, normalize(vec3(-0.3, 0.75, 0.6))));
  totalEmissiveRadiance += uRim * krSky * krWetness * 0.28;
  // Eclair : le kraken surgit, blanc bleut\xe9, le temps d'un flash.
  totalEmissiveRadiance += vec3(0.7, 0.85, 1.0) * uFlash * (0.1 + krFres * 0.9);
}
`,Y=`
#include <begin_vertex>
vKrLocal = position;
`;function Q(e,t){if(Object.assign(e.uniforms,_),"arm"===t||"sucker"===t){let a="sucker"===t?`${B}
attribute vec4 aSucker;`:B;e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
${a}`).replace("#include <beginnormal_vertex>","arm"===t?V:U).replace("#include <begin_vertex>","arm"===t?H:K)}else e.vertexShader=e.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vKrLocal;").replace("#include <begin_vertex>",Y);e.fragmentShader=e.fragmentShader.replace("#include <common>",`${"arm"===t?"#define KR_ARM\n":"sucker"===t?"#define KR_SUCKER\n":"lid"===t?"#define KR_LID\n":""}#include <common>
${j}`).replace("#include <map_fragment>",O).replace("#include <roughnessmap_fragment>",$).replace("#include <emissivemap_fragment>",G).replace("#include <lights_fragment_end>",q)}let J=`
float krIrisGlow = 0.0;
{
  // Regard vers +Z local. Coordonn\xe9es polaires autour de l'axe du regard.
  vec3 krD = normalize(vKrLocal);
  float krR = acos(clamp(krD.z, -1.0, 1.0));
  float krAz = atan(krD.y, krD.x);
  vec2 krQ = vec2(cos(krAz), sin(krAz)) * krR;
  float krIrisR = 0.58;
  // Scl\xe8re jaune cr\xe8me, assombrie vers l'arri\xe8re, vein\xe9e de rouge autour de l'iris.
  vec3 krSclera = mix(vec3(0.8, 0.66, 0.34), vec3(0.36, 0.15, 0.08), smoothstep(0.85, 1.9, krR));
  float krVein = sin(krAz * 23.0 + sin(krR * 9.0 + krAz * 3.0) * 2.2) * sin(krAz * 11.0 - krR * 6.0);
  float krVeins = smoothstep(0.84, 0.98, abs(krVein)) * (1.0 - smoothstep(krIrisR, krIrisR + 0.8, krR));
  krSclera = mix(krSclera, vec3(0.52, 0.04, 0.05), krVeins * 0.8);
  krSclera = mix(krSclera, vec3(0.62, 0.18, 0.12), (1.0 - smoothstep(krIrisR, krIrisR + 0.12, krR)) * 0.6);
  // Iris dor\xe9 \xe0 stries radiales, anneau limbique sombre.
  float krStria = 0.5 + 0.5 * sin(krAz * 46.0 + sin(krAz * 7.0) * 3.0 + krR * 18.0);
  vec3 krIris = mix(vec3(0.98, 0.7, 0.16), vec3(0.66, 0.2, 0.03), smoothstep(0.05, krIrisR, krR));
  krIris *= 0.72 + krStria * 0.42;
  krIris = mix(krIris, vec3(0.16, 0.05, 0.02), smoothstep(krIrisR - 0.12, krIrisR, krR));
  float krInIris = 1.0 - smoothstep(krIrisR - 0.01, krIrisR + 0.02, krR);
  vec3 krEye = mix(krSclera, krIris, krInIris);
  // Pupille fendue horizontale, pinc\xe9e au centre (halt\xe8re), qui se dilate.
  float krPx = krQ.x / (krIrisR * 0.9);
  float krPy = krQ.y / max(0.02, krIrisR * uPupil);
  float krShape = length(vec2(krPx, krPy * (1.0 + 0.6 * (1.0 - krPx * krPx))));
  float krPupil = 1.0 - smoothstep(0.88, 1.0, krShape);
  krEye = mix(krEye, vec3(0.008, 0.003, 0.012), krPupil);
  diffuseColor.rgb = krEye;
  krIrisGlow = krInIris * (1.0 - krPupil) * (0.55 + krStria * 0.45);
}
`,ee=`
#include <lights_fragment_end>
{
  // Reflets d'œil mouill\xe9, fixes \xe0 l'\xe9cran comme dans un dessin anim\xe9.
  float krCatch = smoothstep(0.972, 0.982, dot(normal, normalize(vec3(-0.45, 0.55, 0.7))))
    + smoothstep(0.994, 0.997, dot(normal, normalize(vec3(0.35, -0.25, 0.9)))) * 0.7;
  totalEmissiveRadiance += vec3(1.0, 0.98, 0.92) * krCatch * 1.5;
  // Iris luminescent la nuit et quand il fixe le bateau.
  totalEmissiveRadiance += vec3(1.0, 0.58, 0.1) * krIrisGlow * uEyeGlow;
  float krFres = 1.0 - saturate(dot(normal, geometryViewDir));
  totalEmissiveRadiance += vec3(0.6, 0.75, 0.82) * pow(krFres, 3.0) * 0.4;
  totalEmissiveRadiance += vec3(0.7, 0.85, 1.0) * uFlash * 0.25;
}
`;function et(e){Object.assign(e.uniforms,_),e.vertexShader=e.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vKrLocal;").replace("#include <begin_vertex>",Y),e.fragmentShader=e.fragmentShader.replace("#include <common>","#include <common>\nvarying vec3 vKrLocal;\nuniform float uPupil;\nuniform float uEyeGlow;\nuniform float uFlash;").replace("#include <map_fragment>",J).replace("#include <lights_fragment_end>",ee)}let ea=null;function er(e){let{skin:t,glow:a}=function(){if(I)return I;let e=new o.CanvasTexture(function(){let e=document.createElement("canvas");e.width=512,e.height=512;let t=e.getContext("2d");if(!t)return e;let a=E(11);t.fillStyle="#8c1d3d",t.fillRect(0,0,512,512);let r=[[86,26,94],[112,18,50],[184,58,76],[66,16,64],[150,34,62]];for(let e=0;e<86;e++){let o=512*a(),i=512*a(),l=512*(.05+.15*a()),n=r[e%r.length],s=.3+.35*a();D(512,o,i,l,(e,a)=>W(t,e,a,l,n,s))}for(let e=0;e<96;e++){let e=512*a(),r=512*a(),o=512*(.007+.016*a()),i=.65+.7*a();D(512,e,r,2*o,(e,a)=>{t.save(),t.translate(e,a),t.scale(i,1),W(t,0,0,1.9*o,[196,74,92],.32),t.fillStyle=N([38,8,34],.82),t.beginPath(),t.arc(0,0,o,0,2*Math.PI),t.fill(),t.restore()})}let o=[[226,98,104],[58,12,40],[246,150,120],[120,20,70]];for(let e=0;e<1100;e++){let r=512*a(),i=512*a(),l=512*(.0012+.003*a());t.fillStyle=N(o[e%o.length],.45+.4*a()),D(512,r,i,l,(e,a)=>{t.beginPath(),t.arc(e,a,l,0,2*Math.PI),t.fill()})}return e}());e.colorSpace=o.SRGBColorSpace,e.wrapS=o.RepeatWrapping,e.wrapT=o.RepeatWrapping,e.anisotropy=4;let t=new o.CanvasTexture(function(){let e=document.createElement("canvas");e.width=256,e.height=256;let t=e.getContext("2d");if(!t)return e;let a=E(29);t.fillStyle="#000",t.fillRect(0,0,256,256);let r=[[110,236,255],[190,120,255],[90,255,214]];for(let e=0;e<9;e++){let o=256*a(),i=256*a(),l=r[e%r.length],n=3+Math.floor(3*a());for(let e=0;e<n;e++){let e=256*(.006+.006*a());D(256,o,i,3*e,(a,r)=>{W(t,a,r,3*e,l,.3),t.fillStyle=N(l,1),t.beginPath(),t.arc(a,r,e,0,2*Math.PI),t.fill()}),i=(i+256*(.045+.03*a()))%256,o=(o+256*(a()-.5)*.02+256)%256}}return e}());return t.colorSpace=o.SRGBColorSpace,t.wrapS=o.RepeatWrapping,t.wrapT=o.RepeatWrapping,I={skin:e,glow:t}}(),r=new o.MeshStandardMaterial({map:t,bumpMap:t,bumpScale:"head"===e||"lid"===e?.55:.35,emissive:new o.Color("#ffffff"),emissiveMap:a,emissiveIntensity:0,roughness:.46,metalness:0});return r.name=`kraken-${e}`,r.onBeforeCompile=t=>Q(t,e),r.customProgramCacheKey=()=>`kraken-${e}-v1`,r}var eo=e.i(60284);let ei={shadow:3.8,hush:1.15,approach:2.8,stalk:2.4,coil:2,attack:2.2,impact:1.4,respawn:1.65,cooldown:1.1},el=["shadow","hush","approach","stalk","coil","attack","impact","respawn","cooldown"],en={};{let e=0;for(let t of el)en[t]=e,e+=ei[t]}let es=en.approach,ec=en.stalk,eu=en.coil,ed=en.attack,eh=en.impact,em=en.respawn,ef=eh+.55,ep=ed+1.1,ev=[{angle:.98,radius:16,length:42,thickness:2.2,order:2,lean:.95,curl:3.6,tilt:-.32,twist:.35},{angle:-1,radius:16.5,length:44,thickness:2.3,order:0,lean:.85,curl:3.9,tilt:-.28,twist:-.35},{angle:1.5,radius:15.5,length:38,thickness:2,order:4,lean:1.05,curl:3.4,tilt:-.36,twist:.45},{angle:-1.52,radius:16,length:40,thickness:2.05,order:1,lean:.95,curl:3.7,tilt:-.3,twist:-.45},{angle:2,radius:12.5,length:34,thickness:1.7,order:5,lean:1.1,curl:3,tilt:-.25,twist:0},{angle:-1.95,radius:13,length:34,thickness:1.7,order:3,lean:1.1,curl:3.2,tilt:-.25,twist:0},{angle:2.7,radius:16.5,length:36,thickness:1.85,order:6,lean:1,curl:3.5,tilt:-.34,twist:.25},{angle:-2.72,radius:17,length:37,thickness:1.9,order:7,lean:.98,curl:3.6,tilt:-.32,twist:-.25}],ek={stage:"idle",timer:0,cooldown:0,side:1,approachX:0,approachZ:0,resetDone:!1,anchorX:0,anchorZ:0,anchorHeading:0,outX:1,outZ:0,latX:0,latZ:1,headX:0,headZ:0,landX:0,landZ:0,teaseClock:0,teaseActive:!1,teaseNext:3.5,teaseX:0,teaseZ:0,teaseDirX:1,teaseDirZ:0,teaseSeed:0,frozen:!1,lastT:0},eg={x:0,y:0,z:0};function ey(e,t,a,r,o,i){let l=Math.cos(o),n=Math.sin(o),s=e*l-t*n,c=e*n+t*l,u=Math.cos(i),d=Math.sin(i),h=c*d+a*u,m=Math.cos(r),f=Math.sin(r);return eg.x=s*m+h*f,eg.y=c*u-a*d,eg.z=-s*f+h*m,eg}function eS(e,t){return e<0?0:Math.min(1,e/.05)*Math.exp(-e*t)}let ex={x:0,y:0,z:0,yaw:0,pitch:0,roll:0};function ew(e){e.visible=0,e.rise=0,e.wrap=0,e.coil=0}let eb=0;function ez(e,t,a,r,o,i,l){if(r<0||r>2.2||eb>=h.BURSTS)return;let n=eb++;h.burstPosition[4*n]=e,h.burstPosition[4*n+1]=t,h.burstPosition[4*n+2]=a,h.burstPosition[4*n+3]=r,h.burstParams[4*n]=o,h.burstParams[4*n+1]=i,h.burstParams[4*n+2]=l}function eM(e,t,a,r,o,i,l,n){let s=t/4.2,c=(0,d.smoothstep)(0,.3,s)*(1-(0,d.smoothstep)(.68,1,s));c<=.001?ew(e):(e.visible=1,e.rootX=r,e.rootZ=o,e.dirX=i,e.dirZ=l,e.length=a?30:23,e.thickness=a?2:1.5,e.rise=.22+.42*c,e.tilt=.18,e.lean=.45,e.curl=2.9-.9*c+.25*Math.sin(1.3*t+n),e.sway=1.5,e.phase=6.28*n,e.twist=a?.5:-.4,e.wet=1,e.wrap=0,e.coil=0)}function eR(){if(!ek.teaseActive){ew(m[6]),ew(m[7]);return}let e=ek.teaseClock,t=-ek.teaseDirZ,a=ek.teaseDirX;eM(m[6],e,!0,ek.teaseX,ek.teaseZ,ek.teaseDirX,ek.teaseDirZ,ek.teaseSeed),eM(m[7],e-.7,!1,ek.teaseX+9*t+5*ek.teaseDirX,ek.teaseZ+9*a+5*ek.teaseDirZ,ek.teaseDirX,ek.teaseDirZ,ek.teaseSeed+.4),ez(ek.teaseX,.1,ek.teaseZ,e-.7,.6,1.2,.7),ez(ek.teaseX+9*t+5*ek.teaseDirX,.1,ek.teaseZ+9*a+5*ek.teaseDirZ,e-1.4,.45,1,.6)}function eA(){ek.anchorX=l.boatState.position.x,ek.anchorZ=l.boatState.position.z,ek.anchorHeading=l.boatState.heading;let e=Math.hypot(ek.anchorX,ek.anchorZ);e>1?(ek.outX=ek.anchorX/e,ek.outZ=ek.anchorZ/e):(ek.outX=Math.cos(ek.anchorHeading),ek.outZ=Math.sin(ek.anchorHeading)),ek.latX=-ek.outZ*ek.side,ek.latZ=ek.outX*ek.side,ek.headX=ek.anchorX+22*ek.outX+3*ek.latX,ek.headZ=ek.anchorZ+22*ek.outZ+3*ek.latZ}function eF(e,t,a,r,o,i){let l=h.krakenState.shadow;l.x=e,l.z=t,l.strength=a,l.heading=r,l.length=o,l.width=i,n.ecologyState.monsterX=e,n.ecologyState.monsterZ=t,n.ecologyState.monsterShadow=a}function eC(){let e=h.krakenState.carry.visible||h.krakenState.head.rise>.001||h.krakenState.ink.fade>.01||h.krakenState.shadow.strength>.01||h.krakenState.veil>.001;for(let t=0;t<h.ARMS&&!e;t++)e=m[t].visible>0;h.krakenState.visible=e}let eT=()=>null,eX=null;function eP(){let e,t,a,r,i,l,n,s;return eX??=(e=function(){let e=[new o.Vector2(.001,-.06),new o.Vector2(.3,-.08),new o.Vector2(.52,.04),new o.Vector2(.7,.2),new o.Vector2(.84,.24),new o.Vector2(.98,.12),new o.Vector2(1.08,-.02)],t=new o.LatheGeometry(e,8),a=new o.InstancedBufferGeometry;a.setAttribute("position",t.getAttribute("position")),a.setAttribute("normal",t.getAttribute("normal")),t.index&&a.setIndex(t.index);let r=t.getAttribute("position"),i=new Float32Array(3*r.count),l=new o.Color("#3a0a22"),n=new o.Color("#8a2a48"),s=new o.Color("#f3d2c0"),c=new o.Color("#e2b3a0"),u=new o.Color;for(let e=0;e<r.count;e++){let t=Math.hypot(r.getX(e),r.getZ(e));t<.4?u.copy(l).lerp(n,t/.4):t<.75?u.copy(n).lerp(s,(t-.4)/.35):u.copy(s).lerp(c,Math.min(1,(t-.75)/.3)),i[3*e]=u.r,i[3*e+1]=u.g,i[3*e+2]=u.b}a.setAttribute("color",new o.BufferAttribute(i,3)),t.dispose();let m=[];for(let e=0;e<h.ARMS;e++)for(let t=-1;t<=1;t+=2){let a=.05+.012*(t>0),r=0;for(;a<.94;){let o=1.5*Math.pow(1-a,.85);m.push(e,a,t,.85+.3*(0,d.hash)(31*e+7.7*r+t)),a+=.34*o*2.36/32,r++}}let f=m.length/4,p=new Float32Array(m.length),v=0;for(let e=0;e<2;e++)for(let t=e;t<f;t+=2)p.set(m.slice(4*t,4*t+4),4*v),v++;return a.setAttribute("aSucker",new o.InstancedBufferAttribute(p,4)),a.instanceCount=f,{geometry:a,count:f}}(),{tentacles:function(e=84,t=14){let a=t+1,r=(e+1)*a,i=new Float32Array(h.ARMS*r*3),l=new Float32Array(h.ARMS*r*2),n=new Uint16Array(h.ARMS*e*t*6),s=0,c=0;for(let o=0;o<h.ARMS;o++){let u=o*r;for(let a=0;a<=e;a++){let r=1-Math.pow(1-a/e,1.35);for(let e=0;e<=t;e++)i[3*s]=o,i[3*s+1]=r,i[3*s+2]=e/t*Math.PI*2,l[2*s]=e/t,l[2*s+1]=7*r+.37*o,s++}for(let r=0;r<e;r++)for(let e=0;e<t;e++){let t=u+r*a+e,o=t+1,i=t+a,l=i+1;n[c++]=t,n[c++]=o,n[c++]=i,n[c++]=o,n[c++]=l,n[c++]=i}}let u=new o.BufferGeometry;return u.setAttribute("position",new o.BufferAttribute(i,3)),u.setAttribute("uv",new o.BufferAttribute(l,2)),u.setIndex(new o.BufferAttribute(n,1)),u}(),suckers:e.geometry,suckerCount:e.count,head:function(){let e=new o.SphereGeometry(1,96,64),t=e.getAttribute("position"),a=e.getAttribute("uv"),r=new o.Vector3,i=[-1,1].map(e=>{let t=P.clone();return t.z*=e,t});for(let e=0;e<t.count;e++){r.set(t.getX(e),t.getY(e),t.getZ(e)).normalize();let o=r.x*h.HEAD.rx,l=r.y*h.HEAD.ry,n=r.z*h.HEAD.rz;if(r.x<0){let e=-r.x;o*=1+(h.HEAD.mantle-1)*e;let t=1-.3*e-.25*Math.pow(e,4);l=l*t+e*e*.8,n*=t}r.x>.55&&(o-=(r.x-.55)*1.3);let s=(X(2.6*r.x+7,2.6*r.y,2.6*r.z)-.5)*.9+(X(7*r.x,7*r.y+3,7*r.z)-.5)*.22;for(let e of(s+=.7*Math.pow(X(15*r.x,15*r.y,15*r.z+11),6),i)){let t=Math.acos(Math.max(-1,Math.min(1,r.dot(e)))),a=Math.min(1,t/.38);s-=(1-a*a)*1.5,s+=.85*Math.exp(-Math.pow((t-.45)/.13,2))*(r.y>e.y?1+(r.y-e.y)*2.6:1),r.y<e.y&&(s+=.28*Math.exp(-Math.pow((t-.66)/.09,2)))}let c=Math.hypot(o,l,n)||1;t.setXYZ(e,o+o/c*s,l+l/c*s,n+n/c*s),a.setXY(e,3*a.getX(e),1.5*a.getY(e))}return e.computeVertexNormals(),e}(),eye:new o.SphereGeometry(1,40,28),lid:new o.SphereGeometry(1.08,40,28),rings:(t=new o.PlaneGeometry(2,2,1,1),(a=new o.InstancedBufferGeometry).setAttribute("position",t.getAttribute("position")),t.index&&a.setIndex(t.index),a.setAttribute("aRing",new o.InstancedBufferAttribute(new Float32Array(4*M),4)),a.setAttribute("aRingFx",new o.InstancedBufferAttribute(new Float32Array(4*M),4)),a.instanceCount=M,t.dispose(),a),drips:function(){let e=new Float32Array(1680);for(let t=0;t<420;t++){let a=t%4==3;e[4*t]=a?h.ARMS:t%h.ARMS,e[4*t+1]=a?(0,d.hash)(3.3*t+1):.12+.84*(0,d.hash)(1.7*t+4),e[4*t+2]=(0,d.hash)(5.9*t+2),e[4*t+3]=(0,d.hash)(9.1*t+7)*Math.PI*2}let t=new o.BufferGeometry;return t.setAttribute("position",new o.BufferAttribute(new Float32Array(1260),3)),t.setAttribute("aDrip",new o.BufferAttribute(e,4)),t}(),spray:function(){let e=new Float32Array(2880);for(let t=0;t<720;t++)e[4*t]=t%h.BURSTS,e[4*t+1]=(0,d.hash)(2.31*t+3)*Math.PI*2,e[4*t+2]=(0,d.hash)(7.77*t+1),e[4*t+3]=(0,d.hash)(4.13*t+9);let t=new o.BufferGeometry;return t.setAttribute("position",new o.BufferAttribute(new Float32Array(2160),3)),t.setAttribute("aSpray",new o.BufferAttribute(e,4)),t}(),ink:new o.PlaneGeometry(84,84,1,1),plane:new o.PlaneGeometry(1,1,1,1),veil:new o.PlaneGeometry(2,2,1,1),materials:{...ea??=(r=er("arm"),i=er("head"),l=er("lid"),(n=new o.MeshStandardMaterial({vertexColors:!0,roughness:.34,metalness:0,side:o.DoubleSide})).name="kraken-sucker",n.onBeforeCompile=e=>Q(e,"sucker"),n.customProgramCacheKey=()=>"kraken-sucker-v1",(s=new o.MeshStandardMaterial({roughness:.14,metalness:0})).name="kraken-eye",s.onBeforeCompile=et,s.customProgramCacheKey=()=>"kraken-eye-v1",{arm:r,head:i,lid:l,sucker:n,eye:s}),ring:new o.ShaderMaterial({uniforms:{...z(),uTime:{value:0},uNight:{value:0}},vertexShader:`
      attribute vec4 aRing;
      attribute vec4 aRingFx;
      varying vec2 vLocal;
      varying vec3 vFx;
      #include <fog_pars_vertex>
      void main() {
        float radius = max(aRing.w, 0.05);
        float stretch = max(aRingFx.z, 1.0);
        // Le quad d\xe9borde de 7 m autour du bras, quelle que soit sa taille.
        float extent = (radius + 7.0) / radius;
        // (x, −y) : le quad regarde vers le haut une fois couch\xe9 sur l'eau (sinon il est \xe9limin\xe9).
        vec2 local = vec2(position.x, -position.y) * extent;
        // Ellipse orient\xe9e (t\xeate) : \xe9tir\xe9e selon son cap.
        float c = cos(aRingFx.w);
        float s = sin(aRingFx.w);
        vec2 stretched = vec2(local.x * stretch, local.y);
        vec2 world = vec2(stretched.x * c - stretched.y * s, stretched.x * s + stretched.y * c) * radius;
        vLocal = local;
        vFx = vec3(aRingFx.xy, radius);
        vec4 mvPosition = modelViewMatrix * vec4(aRing.x + world.x, aRing.y, aRing.z + world.y, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,fragmentShader:`
      uniform float uTime;
      uniform float uNight;
      varying vec2 vLocal;
      varying vec3 vFx;
      #include <fog_pars_fragment>
      ${w}
      void main() {
        // Distance \xe0 la peau du bras, en m\xe8tres (n\xe9gative dedans).
        float d = (length(vLocal) - 1.0) * vFx.z;
        float a = atan(vLocal.y, vLocal.x);
        float n = krNoise(vec2(a * (2.0 + vFx.z * 0.8) + vFx.y * 10.0, uTime * 0.7 + vFx.y * 3.0));
        // Collerette serr\xe9e contre le bras, d\xe9chiquet\xe9e.
        float collar = smoothstep(-0.35, 0.05, d) * (1.0 - smoothstep(0.5, 1.5 + n * 1.3, d));
        // Rides qui s'\xe9loignent.
        float ripples = 0.0;
        for (int i = 0; i < 3; i++) {
          float life = fract(uTime * 0.42 + vFx.y + float(i) / 3.0);
          float r = 0.8 + life * 5.2;
          ripples += (1.0 - smoothstep(0.0, 0.22 + life * 0.25, abs(d - r))) * (1.0 - life) * (1.0 - life);
        }
        float breakup = smoothstep(0.28, 0.62, krNoise(vLocal * vFx.z * 0.9 + vFx.y * 7.0 + uTime * 0.3));
        float foam = max(collar * (0.7 + n * 0.5), ripples * 0.6 * breakup) * vFx.x;
        foam *= 1.0 - smoothstep(5.5, 6.8, d);
        if (foam < 0.01) discard;
        vec3 color = mix(vec3(0.88, 0.97, 0.95), vec3(0.42, 0.95, 0.86), uNight * 0.55);
        gl_FragColor = vec4(color * (1.0 - uNight * 0.25), clamp(foam, 0.0, 0.9));
        #include <fog_fragment>
      }
    `,transparent:!0,depthWrite:!1,fog:!0}),drip:new o.ShaderMaterial({uniforms:R,vertexShader:`
      attribute vec4 aDrip;
      uniform float uTime;
      uniform float uPointScale;
      uniform vec4 uHead;
      uniform float uHeadYaw;
      varying float vAlpha;
      ${b}
      void main() {
        float period = 0.8 + aDrip.z * 0.7;
        float life = fract(uTime / period + aDrip.z * 13.7);
        vec3 spawn;
        float wet;
        if (aDrip.x < ${(h.ARMS-.5).toFixed(1)}) {
          vec3 C; float R; vec3 N; vec3 T;
          krSpine(aDrip.x, aDrip.y, C, R, N, T, wet);
          vec3 B = cross(T, N);
          spawn = C + (cos(aDrip.w) * N + sin(aDrip.w) * B) * R;
          wet *= step(0.06, R);
        } else {
          // T\xeate : un point du d\xf4me \xe9merg\xe9 (rep\xe8re tourn\xe9 par le cap).
          float az = aDrip.y * 6.2832;
          float el = 0.1 + fract(aDrip.w * 0.37) * 1.1;
          vec3 local = vec3(cos(az) * cos(el) * 7.0, sin(el) * 6.0, sin(az) * cos(el) * 7.4);
          float c = cos(uHeadYaw);
          float s = sin(uHeadYaw);
          spawn = uHead.xyz + vec3(local.x * c + local.z * s, local.y, -local.x * s + local.z * c);
          wet = uHead.w;
        }
        float t = life * period;
        vec3 p = spawn + vec3(0.0, -5.2 * t * t, 0.0);
        float alive = step(0.0, p.y) * step(0.35, spawn.y) * step(0.02, wet);
        vAlpha = alive * (1.0 - life * 0.55) * min(1.0, wet * 1.5);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = alive > 0.0 ? clamp(uPointScale * (0.16 + aDrip.z * 0.14) / max(1.0, -mv.z), 1.0, 8.0) : 0.0;
        gl_Position = projectionMatrix * mv;
      }
    `,fragmentShader:`
      uniform float uNight;
      varying float vAlpha;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        q.y *= 0.7;
        float drop = 1.0 - smoothstep(0.22, 0.5, length(q));
        float alpha = drop * vAlpha;
        if (alpha < 0.02) discard;
        vec3 color = mix(vec3(0.8, 0.93, 0.96), vec3(0.45, 0.95, 0.9), uNight * 0.5);
        gl_FragColor = vec4(color, alpha * 0.85);
      }
    `,transparent:!0,depthWrite:!1}),spray:new o.ShaderMaterial({uniforms:A,vertexShader:`
      attribute vec4 aSpray;
      uniform vec4 uBurst[${h.BURSTS}];
      uniform vec4 uBurstFx[${h.BURSTS}];
      uniform float uPointScale;
      varying float vAlpha;
      void main() {
        int slot = int(aSpray.x + 0.5);
        vec4 b = uBurst[slot];
        vec4 fx = uBurstFx[slot];
        float t = b.w - aSpray.w * 0.28;
        float span = 1.0 + fx.z * 0.5;
        float life = t / span;
        float alive = step(0.0, t) * step(life, 1.0) * step(0.01, fx.x);
        vec2 dir = vec2(cos(aSpray.y), sin(aSpray.y));
        float speed = (1.6 + aSpray.z * 5.5) * (0.55 + fx.x * 0.45);
        vec3 velocity = vec3(dir.x * speed, (4.5 + aSpray.z * 10.0) * fx.z, dir.y * speed);
        vec3 p = b.xyz + vec3(dir.x, 0.0, dir.y) * fx.y * (0.6 + aSpray.w * 0.6)
          + velocity * t + vec3(0.0, -9.0, 0.0) * t * t * 0.5;
        alive *= step(-0.4, p.y);
        vAlpha = alive * (1.0 - life) * (1.0 - life * 0.3) * min(1.0, fx.x * 1.3);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float size = (0.16 + aSpray.z * 0.34) * (0.7 + fx.y * 0.1) * (1.0 + life * 0.7);
        gl_PointSize = alive > 0.0 ? clamp(uPointScale * size / max(1.0, -mv.z), 1.0, 22.0) : 0.0;
        gl_Position = projectionMatrix * mv;
      }
    `,fragmentShader:`
      uniform float uNight;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float puff = 1.0 - smoothstep(0.18, 0.5, d);
        float alpha = puff * vAlpha;
        if (alpha < 0.015) discard;
        vec3 color = mix(vec3(0.9, 0.97, 0.98), vec3(0.5, 0.92, 0.88), uNight * 0.45);
        gl_FragColor = vec4(color, alpha * 0.8);
      }
    `,transparent:!0,depthWrite:!1,blending:o.NormalBlending}),ink:new o.ShaderMaterial({uniforms:F,vertexShader:`
      varying vec2 vLocal;
      #include <fog_pars_vertex>
      void main() {
        vLocal = position.xy;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,fragmentShader:`
      uniform float uAmount;
      uniform float uFade;
      uniform float uTime;
      uniform float uSeed;
      uniform float uNight;
      varying vec2 vLocal;
      #include <fog_pars_fragment>
      ${w}
      void main() {
        float radius = 5.0 + 31.0 * uAmount;
        vec2 p = vLocal;
        float n = krFbm(p * 0.07 + uSeed + vec2(uTime * 0.02, -uTime * 0.015));
        float edge = length(p) / radius + (n - 0.5) * 0.55;
        float body = 1.0 - smoothstep(0.72, 1.0, edge);
        if (body < 0.01) discard;
        float swirl = krFbm(p * 0.16 + vec2(n * 4.0, uTime * 0.04));
        vec3 color = mix(vec3(0.016, 0.004, 0.03), vec3(0.11, 0.03, 0.16), swirl * swirl);
        // Lisi\xe8re bioluminescente : l'encre se lit m\xeame sur l'eau noire (plus vive la nuit).
        float rim = smoothstep(0.62, 0.95, edge) * body;
        color += vec3(0.36, 0.12, 0.6) * rim * (0.22 + uNight * 0.4);
        gl_FragColor = vec4(color, body * 0.9 * uFade);
        #include <fog_fragment>
      }
    `,transparent:!0,depthWrite:!1,fog:!0}),shadow:new o.ShaderMaterial({uniforms:C,vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,fragmentShader:`
      uniform float uStrength;
      uniform float uTime;
      uniform vec2 uSize;
      varying vec2 vUv;
      void main() {
        // En m\xe8tres, +x = avant : manteau devant, huit bras qui tra\xeenent en ondulant derri\xe8re.
        vec2 p = (vUv - 0.5) * uSize;
        vec2 m = (p - vec2(uSize.x * 0.2, 0.0)) / vec2(uSize.x * 0.24, uSize.y * 0.24);
        float body = 1.0 - smoothstep(0.55, 1.0, length(m));
        float arms = 0.0;
        float t = clamp((uSize.x * 0.08 - p.x) / (uSize.x * 0.56), 0.0, 1.0);
        for (int i = 0; i < 8; i++) {
          float fi = float(i);
          float spread = (fi - 3.5) / 3.5;
          float centre = spread * uSize.y * 0.34 * (0.3 + t)
            + sin(t * 7.0 - uTime * 1.7 + fi * 1.3) * uSize.y * 0.05 * t;
          float halfWidth = uSize.y * 0.055 * (1.0 - t * 0.85) + 0.3;
          float d = abs(p.y - centre);
          arms = max(arms, (1.0 - smoothstep(halfWidth * 0.5, halfWidth, d)) * (1.0 - smoothstep(0.82, 1.0, t)));
        }
        arms *= step(p.x, uSize.x * 0.12);
        float shape = max(body, arms * 0.85);
        float core = 1.0 - smoothstep(0.0, 1.2, length(m));
        float alpha = shape * (0.3 + core * 0.4) * uStrength;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(0.004, 0.006, 0.012, alpha);
      }
    `,transparent:!0,depthWrite:!1}),veil:new o.ShaderMaterial({uniforms:T,vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,fragmentShader:`
      uniform float uVeil;
      uniform float uMode;
      uniform vec2 uOrigin;
      uniform float uAspect;
      uniform float uTime;
      uniform vec3 uTint;
      varying vec2 vUv;
      ${w}
      void main() {
        vec2 p = (vUv - uOrigin) * vec2(uAspect, 1.0);
        float d = length(p);
        float a = atan(p.y, p.x);
        // Tache qui s'\xe9tend depuis le kraken (bords en volutes)…
        float n = krFbm(vec2(a * 1.9, d * 2.6 - uTime * 0.5));
        float reach = uVeil * 2.6;
        float edge = d + (n - 0.5) * 0.5 * (0.35 + d);
        float grow = 1.0 - smoothstep(reach - 0.05, reach, edge);
        // Liser\xe9 fin (quelques % de l'\xe9cran) : le corps de la tache reste noir d'encre.
        float growRim = smoothstep(reach - 0.07, reach - 0.015, edge) * grow;
        // … puis se dissout en lambeaux sur le port retrouv\xe9.
        vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0);
        float field = krFbm(c * 2.4 + 3.1 + uTime * 0.06) * 0.78 + length(c) * 0.3;
        float threshold = uVeil * 1.3 - 0.05;
        float dissolve = 1.0 - smoothstep(threshold - 0.1, threshold, field);
        float dissolveRim = smoothstep(threshold - 0.05, threshold - 0.01, field) * dissolve;
        float cover = mix(grow, dissolve, uMode);
        float rim = mix(growRim, dissolveRim, uMode);
        if (cover < 0.003) discard;
        float swirl = krFbm(p * 2.8 + vec2(uTime * 0.08, 0.0));
        vec3 ink = mix(vec3(0.006, 0.002, 0.014), vec3(0.04, 0.012, 0.07), swirl * swirl);
        ink += uTint * rim * 0.24;
        gl_FragColor = vec4(ink, cover);
      }
    `,transparent:!0,depthTest:!1,depthWrite:!1})},eyes:[Z(-1),Z(1)]})}let eZ=new o.Matrix4,eI=new o.Vector3,eE=new o.Vector3,eN=new o.Vector3,eD=new o.Vector3,eW=new o.Vector3,e_=new o.Vector3(0,1,0),eL=new o.Vector3,eB={x:0,z:0,radius:0};function eV(e,t,a,r,o){eN.copy(r).normalize(),eI.crossVectors(e_,eN),1e-6>eI.lengthSq()&&eI.set(1,0,0),eI.normalize(),eE.crossVectors(eN,eI),eZ.makeBasis(eI,eE,eN),eZ.scale(eW.setScalar(o)),eZ.setPosition(a),e.setMatrixAt(t,eZ)}function eH(){let e=eP(),o=(0,a.useRef)(null),u=(0,a.useRef)(null),w=(0,a.useRef)(null),b=(0,a.useRef)(null),z=(0,a.useRef)(null),M=(0,a.useRef)(null),X=(0,a.useRef)(null),P=(0,a.useRef)(null),Z=(0,a.useRef)(null),I=(0,a.useRef)(null),E=(0,a.useRef)(null),N=(0,a.useRef)(null),D=(0,a.useRef)(null),W=(0,a.useRef)(null),[L,B]=(0,a.useState)(!1),V=(0,a.useRef)(!1);return(0,r.useFrame)((e,t)=>{let a=e.clock.elapsedTime;if(!V.current&&o.current){V.current=!0;let t=[];for(let a of(o.current.traverse(e=>{e.visible||(t.push(e),e.visible=!0)}),e.gl.compile(o.current,e.camera,e.scene),t))a.visible=!1}!function(e,t){var a,r,o,i;let c=Math.min(e,1/15),u=s.useWorld.getState(),f=u.reducedMotion?.35:1;h.krakenState.calm=f,h.krakenState.time=t,h.krakenState.night=eo.skyState.dayNight,h.krakenState.flash=n.ecologyState.stormFlash,eb=0;for(let e=0;e<h.BURSTS;e++)h.burstParams[4*e]=0;let p=ek.frozen?0:Math.min(e,.25);ek.cooldown=Math.max(0,ek.cooldown-c);let v=Math.cos(l.boatState.heading),k=Math.sin(l.boatState.heading),g=-k*ek.side,y=v*ek.side;if(n.ecologyState.sequenceActive=+("idle"!==ek.stage&&"cooldown"!==ek.stage),n.ecologyState.boundaryStage=ek.stage,n.ecologyState.monsterEffectTime=ek.timer,"idle"===ek.stage){let e,t,a,r,o;n.ecologyState.boundaryHush=(0,d.damp)(n.ecologyState.boundaryHush,0,3,c),n.ecologyState.boundaryCinematic=(0,d.damp)(n.ecologyState.boundaryCinematic,0,2.2,c),n.ecologyState.boundaryControlLock=(0,d.damp)(n.ecologyState.boundaryControlLock,0,4,c),n.ecologyState.monsterShadow=0,n.ecologyState.monsterWake=(0,d.damp)(n.ecologyState.monsterWake,0,3,c),n.ecologyState.monsterSurface=(0,d.damp)(n.ecologyState.monsterSurface,0,3,c),n.ecologyState.impact=0,n.ecologyState.respawnFade=0,n.ecologyState.leviathanAttack=0,h.krakenState.shadow.strength=0;for(let e=0;e<h.ARMS;e++)6!==e&&7!==e&&ew(m[e]);(o=h.krakenState.head).rise=0,o.y=-30,h.krakenState.eye.open=0,h.krakenState.carry.visible=!1,h.krakenState.veil=0,h.krakenState.ink.fade=(0,d.damp)(h.krakenState.ink.fade,0,.6,c);let i="playing"===u.phase,f=i&&ek.cooldown<=0&&n.ecologyState.boundaryWarning>.3;ek.frozen?eR():function(e,t){if(ek.teaseActive)ek.teaseClock+=e,ek.teaseClock>4.4&&(ek.teaseActive=!1,ek.teaseNext=5+5*Math.random());else if(ek.teaseNext-=e,t&&ek.teaseNext<=0){let e=l.boatState.heading,t=Math.cos(e),a=Math.sin(e),r=30+10*Math.random(),o=(6+10*Math.random())*(Math.random()>.5?1:-1);ek.teaseX=l.boatState.position.x+t*r-a*o,ek.teaseZ=l.boatState.position.z+a*r+t*o;let i=l.boatState.position.x-ek.teaseX,n=l.boatState.position.z-ek.teaseZ,s=Math.hypot(i,n)||1;ek.teaseDirX=i/s,ek.teaseDirZ=n/s,ek.teaseSeed=Math.random(),ek.teaseClock=0,ek.teaseActive=!0}eR()}(c,f),!ek.frozen&&i&&ek.cooldown<=0&&n.ecologyState.leviathan>.56&&(ek.stage="shadow",ek.timer=0,ek.side=Math.sin(.17*l.boatState.position.x+l.boatState.position.z)>0?1:-1,e=Math.cos(l.boatState.heading),a=-(t=Math.sin(l.boatState.heading))*ek.side,r=e*ek.side,ek.approachX=l.boatState.position.x+31*e+20*a,ek.approachZ=l.boatState.position.z+31*t+20*r,ek.teaseActive=!1,ek.lastT=0,eA(),s.useWorld.setState({destination:null,freeTarget:null,activeIsland:null})),eC();return}ek.timer+=p;let S=ek.stage;n.ecologyState.boundaryControlLock=(0,d.damp)(n.ecologyState.boundaryControlLock,"shadow"===S?.16:"hush"===S?.38:1,2.4,c),l.boatState.speed=(0,d.damp)(l.boatState.speed,0,"shadow"===S?.42:2.8,c),n.ecologyState.boundaryHush=(0,d.damp)(n.ecologyState.boundaryHush,+("hush"===S),3.2,c);let x="shadow"===S?.12:"hush"===S?.28:+("respawn"!==S&&"cooldown"!==S);n.ecologyState.boundaryCinematic=ek.frozen?x:(0,d.damp)(n.ecologyState.boundaryCinematic,x,1.45,c);let w=en[S]+ek.timer,b=h.krakenState.shadow;if("shadow"===S){let e=(0,d.clamp)(ek.timer/ei.shadow,0,1),t=(0,d.smoothstep)(0,1,e),a=l.boatState.position.x-30*v-24*g,r=l.boatState.position.z-30*k-24*y,o=l.boatState.position.x+35*v+16*g,i=l.boatState.position.z+35*k+16*y,s=a+(o-a)*t,c=r+(i-r)*t,u=.94*Math.sin(e*Math.PI);eF(s,c,u,l.boatState.heading-.22*ek.side,52,25),n.ecologyState.monsterWake=.82*u,n.ecologyState.monsterSurface=.06*u,n.ecologyState.monsterFromX=a,n.ecologyState.monsterFromZ=r,n.ecologyState.monsterToX=s,n.ecologyState.monsterToZ=c}else if("hush"===S)b.strength=(0,d.damp)(b.strength,0,4,c),n.ecologyState.monsterShadow=b.strength,n.ecologyState.monsterWake=(0,d.damp)(n.ecologyState.monsterWake,0,2.6,c),n.ecologyState.monsterSurface=0;else if("approach"===S){let e=(0,d.clamp)(ek.timer/ei.approach,0,1),t=(0,d.smoothstep)(0,1,e),a=Math.sin(e*Math.PI)*ek.side*4.2,r=ek.approachX+(ek.headX-ek.approachX)*t-ek.outZ*a,o=ek.approachZ+(ek.headZ-ek.approachZ)*t+ek.outX*a,i=Math.atan2(ek.anchorZ-o,ek.anchorX-r);eF(r,o,(.3+.46*Math.sin(e*Math.PI))*(1-(0,d.smoothstep)(.6,1,e)),i,50,24),n.ecologyState.monsterWake=.32+.3*t,n.ecologyState.monsterSurface=.04+.1*Math.sin(e*Math.PI),n.ecologyState.monsterFromX=ek.approachX,n.ecologyState.monsterFromZ=ek.approachZ,n.ecologyState.monsterToX=r,n.ecologyState.monsterToZ=o}else if("stalk"===S||"coil"===S||"attack"===S||"impact"===S){b.strength=(0,d.damp)(b.strength,0,3,c),n.ecologyState.monsterShadow=b.strength,n.ecologyState.monsterX=ek.headX,n.ecologyState.monsterZ=ek.headZ,n.ecologyState.monsterFromX=ek.headX+6*ek.outX,n.ecologyState.monsterFromZ=ek.headZ+6*ek.outZ,n.ecologyState.monsterToX=ek.headX-4*ek.outX,n.ecologyState.monsterToZ=ek.headZ-4*ek.outZ;let e=h.krakenState.head.rise;n.ecologyState.monsterWake="impact"===S?.5:.12+.1*e,n.ecologyState.monsterSurface="impact"===S?1:.1+.4*e,n.ecologyState.leviathanAttack="attack"===S||"impact"===S?(0,d.smoothstep)(ed,ed+.22,w):0,n.ecologyState.impact=Math.max(.45*eS(w-ep,4.5),.95*eS(w-ef,3.6)),n.ecologyState.respawnFade="impact"===S?(0,d.smoothstep)(eh+.78,eh+1.38,w):0}else"respawn"===S?(n.ecologyState.respawnFade=ek.timer<.58?1:1-(0,d.smoothstep)(.58,1.65,ek.timer),n.ecologyState.impact=(0,d.damp)(n.ecologyState.impact,0,5,c),n.ecologyState.monsterWake=(0,d.damp)(n.ecologyState.monsterWake,0,3,c),n.ecologyState.monsterSurface=(0,d.damp)(n.ecologyState.monsterSurface,0,4,c),n.ecologyState.monsterShadow=0,b.strength=0,!ek.resetDone&&ek.timer>=.28&&(ek.resetDone=!0,(0,l.resetBoat)(),ek.landX=l.boatState.position.x,ek.landZ=l.boatState.position.z,n.ecologyState.boundaryWarning=0,n.ecologyState.boundaryDanger=0,n.ecologyState.leviathan=0,n.ecologyState.stormCover=0,n.ecologyState.stormWaves=0,n.ecologyState.stormWind=0,n.ecologyState.stormRain=0,n.ecologyState.leviathanAttack=0,s.useWorld.setState({phase:"playing",destination:null,freeTarget:null,activeIsland:null}))):(b.strength=0,n.ecologyState.respawnFade=0,n.ecologyState.leviathanAttack=0,n.ecologyState.monsterShadow=0,n.ecologyState.boundaryCinematic=(0,d.damp)(n.ecologyState.boundaryCinematic,0,3,c),n.ecologyState.boundaryControlLock=(0,d.damp)(n.ecologyState.boundaryControlLock,0,4,c));if(function(e,t,a){let r=h.krakenState.night,o=l.boatState.position.x,i=l.boatState.position.z;if(e<en.hush+.6){if(!ek.teaseActive){ek.teaseActive=!0;let e=Math.cos(l.boatState.heading),t=Math.sin(l.boatState.heading);ek.teaseX=o+38*e+8*t*ek.side,ek.teaseZ=i+38*t-8*e*ek.side;let a=Math.hypot(o-ek.teaseX,i-ek.teaseZ)||1;ek.teaseDirX=(o-ek.teaseX)/a,ek.teaseDirZ=(i-ek.teaseZ)/a,ek.teaseSeed=.7}ek.teaseClock=Math.max(0,e-.3),eR()}else ek.teaseActive=!1;let n=h.krakenState.carry,s=ek.headX-ek.anchorX,c=ek.headZ-ek.anchorZ,u=Math.hypot(s,c)||1,f=s/u,p=c/u;ex.x=o,ex.y=.05,ex.z=i,ex.yaw=-l.boatState.heading,ex.pitch=0,ex.roll=0;let v=e>=ed&&e<em+.3;if(v){let r=(0,d.smoothstep)(ed+.18,ed+2,e);if(ex.x=ek.anchorX+f*r*5,ex.z=ek.anchorZ+p*r*5,ex.y=.05+14.5*r+.25*Math.sin(9*e)*(1-r)*a,ex.pitch=.32*r+.1*Math.sin(1.7*t)*r*a,ex.roll=.22*Math.sin(2.2*t+.6)*r*a,ex.yaw=-ek.anchorHeading+.5*r*ek.side,e>=eh){let t=(0,d.smoothstep)(eh,ef,e);ex.x+=f*t*4,ex.z+=p*t*4,ex.y+=3.5*t,ex.pitch-=.6*t}if(e>=ef){let t=e-ef,r=a<1?20:34,o=ek.anchorX+9*f,i=ek.anchorZ+9*p;ex.x=o-ek.outX*r*t,ex.z=i-ek.outZ*r*t,ex.y=18.05+13*t-8*t*t,ex.pitch=.32-.6+7.5*t*a,ex.roll=2.6*t*a,ex.yaw=-ek.anchorHeading+.5*ek.side+1.2*t*a}n.x=ex.x,n.y=ex.y,n.z=ex.z,n.yaw=ex.yaw,n.pitch=ex.pitch,n.roll=ex.roll}n.visible=v;let k=ek.anchorX,g=ek.anchorZ;for(let r=0;r<h.ARMS;r++){if(e<en.hush+.6&&(6===r||7===r))continue;let o=m[r],i=ev[r];if(e<es){ew(o);continue}let l=es+.32*i.order,n=(0,d.smoothstep)(l,l+2,e),s=(0,d.smoothstep)(eh+.3+.07*i.order,em+.3,e),c=Math.atan2(ek.outZ,ek.outX)+i.angle*ek.side,u=Math.sin(c)*ek.outX-Math.cos(c)*ek.outZ,h=n*(1-s)*(1-(4!==r&&5!==r&&u>.25?.5*(0,d.smoothstep)(ed-.2,ed+.8,e):0));if(h<=.001){ew(o);continue}o.visible=1,o.rootX=k+Math.cos(c)*i.radius,o.rootZ=g+Math.sin(c)*i.radius;let f=k-o.rootX,p=g-o.rootZ,v=Math.hypot(f,p)||1;o.dirX=f/v,o.dirZ=p/v,o.length=i.length,o.thickness=i.thickness,o.rise=h,o.tilt=i.tilt,o.lean=i.lean+.32*(0,d.smoothstep)(eu,eu+1.2,e)-.28*(0,d.smoothstep)(ed+.2,ed+1.1,e)+.7*(0,d.smoothstep)(eh+.1,eh+.7,e),o.curl=i.curl+.35*Math.sin(.4*t+1.7*r)*a,o.sway=1,o.phase=1.37*r,o.twist=i.twist,o.wet=Math.max(.35,1-(0,d.smoothstep)(l+2,l+7,e)),o.wrap=0,o.coil=0;let y=eS(e-(l+.35),2.2);y>.01&&(o.lean-=.25*y),ez(o.rootX+1.5*o.dirX,.1,o.rootZ+1.5*o.dirZ,e-(l+.25),.85,1.6,1)}for(let t=0;t<2;t++){let a=0===t,r=m[a?4:5];if(r.visible<=0)continue;let o=(0,d.smoothstep)(eu+.1,eu+.95,e),i=(0,d.smoothstep)(eu+.55,eu+1.85,e);if(a){let t=(0,d.smoothstep)(ef-.05,ef+.3,e);o*=1-t,i*=1-.7*t}else{let t=(0,d.smoothstep)(ep-.35,ep+.05,e);o*=1-t,i*=1-t}if(r.wrap=o,r.coil=i,o<=.001)continue;let l=ey(a?2.7:-.45,1,0,ex.yaw,ex.pitch,ex.roll);r.hx=ex.x+l.x,r.hy=ex.y+l.y,r.hz=ex.z+l.z;let n=ey(-1,0,0,ex.yaw,ex.pitch,ex.roll);r.ax=n.x,r.ay=n.y,r.az=n.z;let s=ey(0,1,0,ex.yaw,ex.pitch,ex.roll);r.ux=s.x,r.uy=s.y,r.uz=s.z,r.vx=r.ay*r.uz-r.az*r.uy,r.vy=r.az*r.ux-r.ax*r.uz,r.vz=r.ax*r.uy-r.ay*r.ux,r.hLength=2.4,r.hRadiusUp=2.05,r.hRadiusSide=1.5,r.hTurns=1.35;let c=(r.rootX-ex.x)*r.vx+(r.rootZ-ex.z)*r.vz;r.hand=c>0?-1:1,r.wet=1}ez(o,.2,i,e-ed,1,2.6,1.3),ez(o-6*ek.latX,.1,i-6*ek.latZ,e-ep,.95,3,1.2),v&&ez(n.x,n.y-.4,n.z,e-ef,.6,1.3,.35),ez(ek.headX,.2,ek.headZ,e-(es+2.5),1,6,1.1),ez(ek.headX,.2,ek.headZ,e-(eh+.65),.85,7.5,.8),ek.resetDone&&ez(ek.landX,.2,ek.landZ,e-(em+.5),.9,2.4,1.1);let y=h.krakenState.head,S=(0,d.smoothstep)(es+1.6,ec+1.1,e)*(1-(0,d.smoothstep)(eh+.2,em+.15,e));y.rise=S,y.x=ek.headX,y.z=ek.headZ,y.y=-13+13.8*S+.35*Math.sin(.7*t)*S*a,y.yaw=-Math.atan2(ek.anchorZ-y.z,ek.anchorX-y.x)+.04*Math.sin(.3*t)*a,y.roll=.03*Math.sin(.5*t)*a,y.pitch=.025*Math.sin(.37*t+1)*a-.06*(0,d.smoothstep)(ed,ed+1.5,e),y.wet=Math.max(.15,(0,d.smoothstep)(.15,.7,S)*(1-(0,d.smoothstep)(ec+1.5,ec+8,e)));let x=h.krakenState.eye,w=1-Math.exp(-Math.pow((e-(eu+1.05))/.09,2));x.open=(0,d.smoothstep)(ec+.55,ec+1.05,e)*w*(1-(0,d.smoothstep)(eh+.55,eh+.95,e)),x.pupil=.44-.3*(0,d.smoothstep)(ec+1.1,eu+.6,e)+.3*(0,d.smoothstep)(ed+1.4,ef,e),x.glow=(.5+.8*r)*(.75+.6*(0,d.smoothstep)(eu,eu+.6,e)),x.target.set(v?n.x:o,v?n.y+1:1.4,v?n.z:i);let b=h.krakenState.ink;b.x=ek.headX-3*ek.outX,b.z=ek.headZ-3*ek.outZ,b.amount=(0,d.smoothstep)(eh+.2,eh+1.4,e),b.fade=(0,d.smoothstep)(eh+.2,eh+.5,e)*(1-(0,d.smoothstep)(em+.4,em+1.6,e)),b.seed=10*(0,d.hash)(.1*ek.anchorX)}(w,t,f),h.krakenState.veil=n.ecologyState.respawnFade,!ek.frozen&&(a=ek.lastT,a<(r=ec+.3)&&w>=r||(o=ek.lastT,o<(i=ef+.05)&&w>=i))&&(h.krakenState.strike+=1,h.krakenState.strikeX=ek.headX+14*ek.outX+10*ek.latX,h.krakenState.strikeZ=ek.headZ+14*ek.outZ+10*ek.latZ),ek.lastT=w,ek.timer>=ei[S]&&!ek.frozen){let e=el.indexOf(S),t=e<el.length-1?el[e+1]:"idle";"respawn"===t&&(ek.resetDone=!1),"idle"===t&&(ek.cooldown=28),"approach"===t&&eA(),ek.stage=t,ek.timer=0}eC()}(t,a);let r=h.krakenState.visible;o.current&&(o.current.visible=r);let i=n.ecologyState.boundaryStage;if(!L&&(h.krakenState.carry.visible||"approach"===i||"stalk"===i||"coil"===i||"attack"===i)&&B(!0),!r)return;let{quality:H,reducedMotion:U}=s.useWorld.getState(),{calm:K,night:j}=h.krakenState,O=eP();_.uTime.value=a,_.uWiggle.value=K,_.uFlash.value=h.krakenState.flash*(U?.4:1),_.uNight.value=j,_.uWet.value=h.krakenState.head.wet,_.uLid.value=h.krakenState.eye.open,_.uPupil.value=h.krakenState.eye.pupil,_.uEyeGlow.value=h.krakenState.eye.glow;let $=(.03+.6*j)*(.55+.45*Math.sin(1.6*a));O.materials.arm.emissiveIntensity=$,O.materials.head.emissiveIntensity=.8*$,O.materials.lid.emissiveIntensity=.5*$;let G=!1;for(let e=0;e<h.ARMS;e++)G||=m[e].visible>0;G&&function(e,t){for(let a=0;a<h.ARMS;a++)!function(e,t,a,r){let o=h.SPINE-1,i=t.length/o,l=t.dirX,n=t.dirZ,s=-n,c=(1-t.rise)*t.length*.9+.8,u=t.curl+(1-t.rise)*2.4,d=t.rootX,m=-c,p=t.rootZ,w=.56+.43999999999999995*t.coil;for(let e=0;e<=o;e++){let c=e/o;if(e>0){let s=x(t,(e-.5)/o,u,a,r),c=Math.sin(s)*i;d+=c*l,m+=Math.cos(s)*i,p+=c*n}let h=x(t,c,u,a,r),f=t.sway*r*t.length*.07*Math.pow(c,1.6)*(.9*Math.sin(.62*a+1.3*t.phase+3.1*c)+.32*Math.sin(1.45*a+t.phase+6.3*c)),b=d+s*f,z=m,M=p+l*f,R=Math.cos(h),A=R*l,F=-Math.sin(h),C=R*n;if(t.wrap>.001){!function(e,t){let a=e.rootX,r=e.rootZ;if(t<0){y[0]=a,y[1]=-.8+t*e.length,y[2]=r,S[0]=e.dirX,S[1]=0,S[2]=e.dirZ;return}let o=2*Math.PI*e.hTurns*e.hand,i=e.hx+e.ux*e.hRadiusUp,l=e.hy+e.uy*e.hRadiusUp,n=e.hz+e.uz*e.hRadiusUp;if(t<=.56){let s=t/.56,c=6+2*e.hRadiusUp,u=e.ax*e.hLength+o*e.vx*e.hRadiusSide,d=e.ay*e.hLength+o*e.vy*e.hRadiusSide,h=e.az*e.hLength+o*e.vz*e.hRadiusSide,m=Math.hypot(u,d,h)||1;u/=m,d/=m,h/=m;let f=a+2.5*e.dirX,p=r+2.5*e.dirZ,v=i-6*u+3.5*e.ux,k=l-6*d+3.5*e.uy,g=n-6*h+3.5*e.uz,x=(1-s)*(1-s)*(1-s),w=3*(1-s)*(1-s)*s,b=3*(1-s)*s*s,z=s*s*s;y[0]=x*a+w*f+b*v+z*i,y[1]=-.8*x+w*(-.8+c+4)+b*k+z*l,y[2]=x*r+w*p+b*g+z*n;let M=e.hx-y[0],R=e.hy-y[1],A=e.hz-y[2],F=Math.hypot(M,R,A)||1;M/=F,R/=F,A/=F,S[0]=M,S[1]=R,S[2]=A;return}let s=(t-.56)/.43999999999999995,c=o*s,u=Math.cos(c),d=Math.sin(c),h=1-.12*s,m=s*e.hLength;y[0]=e.hx+e.ax*m+(e.ux*u*e.hRadiusUp+e.vx*d*e.hRadiusSide)*h,y[1]=e.hy+e.ay*m+(e.uy*u*e.hRadiusUp+e.vy*d*e.hRadiusSide)*h,y[2]=e.hz+e.az*m+(e.uz*u*e.hRadiusUp+e.vz*d*e.hRadiusSide)*h,S[0]=-(e.ux*u+e.vx*d),S[1]=-(e.uy*u+e.vy*d),S[2]=-(e.uz*u+e.vz*d)}(t,c-1+w);let e=t.wrap;b+=(y[0]-b)*e,z+=(y[1]-z)*e,M+=(y[2]-M)*e,A+=(S[0]-A)*e,F+=(S[1]-F)*e,C+=(S[2]-C)*e}v[3*e]=b,v[3*e+1]=z,v[3*e+2]=M,k[3*e]=A,k[3*e+1]=F,k[3*e+2]=C,g[e]=function(e,t){let a=Math.pow(1-t,1.05);return e.thickness*Math.max(.022,a)*e.visible}(t,c)}let b=Math.cos(t.twist),z=Math.sin(t.twist),M=1,R=0,A=0,F=e*h.SPINE_ROWS*h.SPINE,C=F+h.SPINE,T=C+h.SPINE;for(let e=0;e<=o;e++){let a=0===e?0:e-1,r=e===o?o:e+1,i=v[3*r]-v[3*a],l=v[3*r+1]-v[3*a+1],n=v[3*r+2]-v[3*a+2],s=Math.hypot(i,l,n)||1;i/=s,l/=s,n/=s;let c=k[3*e],u=k[3*e+1],d=k[3*e+2],h=c*i+u*l+d*n,m=Math.hypot(c-=i*h,u-=l*h,d-=n*h);m<.001&&(h=M*i+R*l+A*n,m=Math.hypot(c=M-i*h,u=R-l*h,d=A-n*h)||1),M=c/m,R=u/m;let p=l*(A=d/m)-n*R,y=n*M-i*A,S=i*R-l*M,x=M*b+p*z,w=R*b+y*z,X=A*b+S*z,P=(F+e)*4;f[P]=v[3*e],f[P+1]=v[3*e+1],f[P+2]=v[3*e+2],f[P+3]=g[e],f[P=(C+e)*4]=x,f[P+1]=w,f[P+2]=X,f[P+3]=0,f[P=(T+e)*4]=i,f[P+1]=l,f[P+2]=n,f[P+3]=t.wet}}(a,m[a],e,t);p.needsUpdate=!0}(a,K),u.current&&(u.current.visible=G),w.current&&(w.current.visible=G,w.current.geometry.instanceCount="low"===H?Math.floor(O.suckerCount/2):O.suckerCount);let q=h.krakenState.head,Y=q.rise>.001;if(b.current&&(b.current.visible=Y,b.current.position.set(q.x,q.y,q.z),b.current.rotation.set(q.roll,q.yaw,q.pitch)),Y&&z.current&&M.current){let e=h.krakenState.eye.target;for(let t=0;t<2;t++){let a=O.eyes[t];(function(e,t,a,r){let o=h.krakenState.head,i=e-o.x,l=t-o.y,n=a-o.z,s=Math.cos(-o.yaw),c=Math.sin(-o.yaw);return r.set(i*s+n*c,l,-i*c+n*s)})(e.x,e.y,e.z,eD).sub(a.center).normalize();let r=eD.dot(a.normal);r<.8138784566625339&&eD.addScaledVector(a.normal,-r).normalize().multiplyScalar(.5810351605373051).addScaledVector(a.normal,.8138784566625339),eV(z.current,t,a.center,eD,h.HEAD.eyeRadius),eV(M.current,t,a.center,a.normal,h.HEAD.eyeRadius)}z.current.instanceMatrix.needsUpdate=!0,M.current.instanceMatrix.needsUpdate=!0}let Q=h.krakenState.carry;if(X.current&&(X.current.visible=Q.visible,X.current.position.set(Q.x,Q.y,Q.z),X.current.rotation.set(0,Q.yaw,0)),P.current&&P.current.rotation.set(Q.roll,0,Q.pitch),Z.current){let e=Z.current.geometry,t=e.getAttribute("aRing"),r=e.getAttribute("aRingFx"),o=!1;for(let e=0;e<h.ARMS;e++){let i=m[e].visible>0&&function(e,t){let a=e*h.SPINE_ROWS*h.SPINE;for(let e=0;e<h.SPINE-1;e++){let r=(a+e)*4,o=r+4,i=f[r+1],l=f[o+1];if(i<=0&&l>0){let e=i===l?0:-i/(l-i);return t.x=f[r]+(f[o]-f[r])*e,t.z=f[r+2]+(f[o+2]-f[r+2])*e,t.radius=f[r+3]+(f[o+3]-f[r+3])*e,t.radius>.05}}return!1}(e,eB),l=i?Math.min(1,1.4*eB.radius):0;o||=i,t.setXYZW(e,eB.x,(0,c.waveHeight)(eB.x,eB.z,a)+.06,eB.z,i?eB.radius:.01),r.setXYZW(e,l,.137*e,1,0)}let i=Y?Math.sqrt(Math.max(0,1-Math.pow(q.y/h.HEAD.ry,2))):0;t.setXYZW(h.ARMS,q.x,(0,c.waveHeight)(q.x,q.z,a)+.06,q.z,Math.max(.01,h.HEAD.rz*i*.98)),r.setXYZW(h.ARMS,.9*(i>.05),.71,1.35,-q.yaw),o||=i>.05,t.needsUpdate=!0,r.needsUpdate=!0,Z.current.visible=o;let l=O.materials.ring;l.uniforms.uTime.value=a,l.uniforms.uNight.value=j}let J=e.camera,ee=e.size.height*e.viewport.dpr/(2*Math.tan((J.fov??45)*Math.PI/360));R.uTime.value=a,R.uPointScale.value=ee,R.uHead.value.set(q.x,q.y,q.z,Y?q.wet:0),R.uHeadYaw.value=q.yaw,R.uNight.value=j,I.current&&(I.current.visible=G||Y,I.current.geometry.setDrawRange(0,"high"===H?420:"medium"===H?300:160));let et=!1;for(let e=0;e<h.BURSTS;e++)A.uBurst.value[e].fromArray(h.burstPosition,4*e),A.uBurstFx.value[e].fromArray(h.burstParams,4*e),et||=h.burstParams[4*e]>.01;A.uPointScale.value=ee,A.uNight.value=j,E.current&&(E.current.visible=et,E.current.geometry.setDrawRange(0,"high"===H?720:"medium"===H?520:300));let ea=h.krakenState.ink;N.current&&(N.current.visible=ea.fade>.01,N.current.position.set(ea.x,.1,ea.z),F.uAmount.value=ea.amount,F.uFade.value=ea.fade,F.uTime.value=a,F.uSeed.value=ea.seed,F.uNight.value=j);let er=h.krakenState.shadow;D.current&&(D.current.visible=er.strength>.012,D.current.position.set(er.x,-1.82,er.z),D.current.rotation.z=-er.heading,D.current.scale.set(er.length,er.width,1),C.uStrength.value=er.strength,C.uTime.value=a,C.uSize.value.set(er.length,er.width)),W.current&&(W.current.visible=h.krakenState.veil>.001,W.current.visible&&(eL.set(q.x,Math.max(q.y,1),q.z).project(J),"respawn"!==i&&T.uOrigin.value.set(Math.min(1.2,Math.max(-.2,.5*eL.x+.5)),Math.min(1.2,Math.max(-.2,.5*eL.y+.5))),T.uVeil.value=h.krakenState.veil,T.uMode.value=+("respawn"===i),T.uAspect.value=e.size.width/Math.max(1,e.size.height),T.uTime.value=a))}),(0,t.jsxs)("group",{ref:o,visible:!1,children:[(0,t.jsx)("mesh",{ref:u,geometry:e.tentacles,material:e.materials.arm,frustumCulled:!1,raycast:eT}),(0,t.jsx)("mesh",{ref:w,geometry:e.suckers,material:e.materials.sucker,frustumCulled:!1,raycast:eT}),(0,t.jsxs)("group",{ref:b,visible:!1,children:[(0,t.jsx)("mesh",{geometry:e.head,material:e.materials.head,raycast:eT}),(0,t.jsx)("instancedMesh",{ref:z,args:[e.eye,e.materials.eye,2],frustumCulled:!1,raycast:eT}),(0,t.jsx)("instancedMesh",{ref:M,args:[e.lid,e.materials.lid,2],frustumCulled:!1,raycast:eT})]}),(0,t.jsx)("group",{ref:X,visible:!1,children:(0,t.jsx)("group",{ref:P,children:L&&(0,t.jsx)(i.BoatModel,{})})}),(0,t.jsx)("mesh",{ref:Z,geometry:e.rings,material:e.materials.ring,frustumCulled:!1,renderOrder:4,raycast:eT}),(0,t.jsx)("points",{ref:I,geometry:e.drips,material:e.materials.drip,frustumCulled:!1,renderOrder:6,raycast:eT}),(0,t.jsx)("points",{ref:E,geometry:e.spray,material:e.materials.spray,frustumCulled:!1,renderOrder:7,raycast:eT}),(0,t.jsx)("mesh",{ref:N,geometry:e.ink,material:e.materials.ink,"rotation-x":-Math.PI/2,renderOrder:3,raycast:eT}),(0,t.jsx)("mesh",{ref:D,geometry:e.plane,material:e.materials.shadow,"rotation-x":-Math.PI/2,renderOrder:3,raycast:eT}),(0,t.jsx)("mesh",{ref:W,geometry:e.veil,material:e.materials.veil,frustumCulled:!1,renderOrder:1e4,raycast:eT})]})}new o.Vector3,new URLSearchParams(window.location.search).has("cam"),new o.Vector3,new o.Vector3;let eU=()=>"";e.s(["WorldBoundary",0,function(){let e=(0,a.useId)(),r=(0,a.useSyncExternalStore)(h.subscribeOwner,h.currentOwner,eU);return(0,a.useEffect)(()=>(0,h.claimHost)(e),[e]),r===e?(0,t.jsx)(eH,{}):null}],55232)}]);