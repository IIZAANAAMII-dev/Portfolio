import { Color, MeshStandardMaterial, Vector3 } from 'three';

/**
 * Matériaux du fest-noz : le rendu « jouet » commun (MeshStandardMaterial, cel-shading global)
 * auquel on greffe la lueur du feu de joie (une émission chaude tournée vers le feu, sans
 * lumière réelle), l'animation des danseurs sur le GPU et l'allumage des lampions.
 * Uniformes partagés, mis à jour une fois par image par le fest-noz.
 */
export const fireUniforms = {
  /** Centre du feu en repère vue (recalculé à chaque image). */
  uFireView: { value: new Vector3(0, -1000, 0) },
  uFireColor: { value: new Color('#ffb15c') },
  /** 0 de jour ; flamme qui vacille la nuit. */
  uFireGlow: { value: 0 },
};

export const danceUniforms = {
  /** Temps musical (1 par temps) et rotation de la ronde (rad). */
  uBeat: { value: 0 },
  uRing: { value: 0 },
  /** Facteur nuit : chacun entre dans la ronde à son heure (aOn). */
  uPresence: { value: 0 },
  uCenter: { value: new Vector3() },
  uRadius: { value: 1.3 },
  uCount: { value: 10 },
  /** 0 = mouvements réduits. */
  uMotion: { value: 1 },
  /** Taille des danseurs (lisibles depuis le bateau). */
  uSize: { value: 1.15 },
};

export const lampionUniforms = {
  uNight: { value: 0 },
  uTime: { value: 0 },
};

const FIRE_PARS = /* glsl */ `
uniform vec3 uFireView;
uniform vec3 uFireColor;
uniform float uFireGlow;
`;

/** Lueur du feu : émission chaude, plus forte sur les faces tournées vers lui. */
const FIRE_GLOW = /* glsl */ `
#include <emissivemap_fragment>
{
  vec3 fnToFire = uFireView + vViewPosition;
  float fnDist = length(fnToFire);
  float fnFacing = max(dot(normal, fnToFire / max(fnDist, 1e-3)), 0.0);
  float fnLight = uFireGlow * (0.25 + 0.75 * fnFacing) / (1.0 + fnDist * fnDist * 0.32);
  // Une lumière chaude mais pâle : les couleurs des costumes restent lisibles la nuit.
  totalEmissiveRadiance += (diffuseColor.rgb * vec3(1.0, 0.9, 0.78) + uFireColor * 0.06) * fnLight;
}
`;

/** Matériau « jouet » à couleurs de sommet, éclairé par le feu la nuit. */
export function fireLitMaterial(key: string) {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, fireUniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FIRE_PARS}`)
      .replace('#include <emissivemap_fragment>', FIRE_GLOW);
  };
  material.customProgramCacheKey = () => `festnoz-fire-${key}`;
  return material;
}

const DANCE_PARS = /* glsl */ `
// aPiece : pièce (0 corps, 1-2 bras, 3-4 jambes), variante (1 danseuse, 2 danseur),
// teintures du haut et du bas. aDancer : place dans la ronde, graine, genre, heure d'entrée.
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

// An-dro : la chaîne avance vers la gauche, petits doigts accrochés ; les bras balancent
// d'avant en arrière en cercle (un cycle de quatre temps), un pas chassé par temps, le corps
// rebondit. Chaque danseur pousse du sol à son heure (ressort), face au feu.
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
    float abduct = side * (0.98 + 0.14 * cos(ph) * uMotion);
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
  // Variante inutile (coiffe d'un danseur, chapeau d'une danseuse…) : écrasée.
  float hidden = (aVariant > 0.5 && aVariant < 1.5 && aKind > 0.5) || (aVariant > 1.5 && aKind < 0.5) ? 1.0 : 0.0;
  // Rebond à chaque pas, léger roulis.
  mat3 body = fnRotZ(sin(stepPhase) * 0.05 * uMotion);
  p = body * p;
  n = body * n;
  p.y += abs(sin(stepPhase)) * 0.035 * uMotion;
  // Entrée dans la ronde : il pousse du sol avec un petit dépassement.
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
`;

/** Matériau des danseurs : ronde animée sur le GPU, couleurs propres à chacun, lueur du feu. */
export function dancerMaterial() {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, fireUniforms, danceUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${DANCE_PARS}`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vec3 fnPosition = position;
        vec3 fnNormal = objectNormal;
        festDance(fnPosition, fnNormal);
        objectNormal = fnNormal;`,
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = fnPosition;')
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        #ifdef USE_COLOR
          // Seul le blanc pur prend la couleur du danseur (rayures écrues intactes).
          float fnPure = step(0.98, min(min(color.r, color.g), color.b));
          vColor.rgb *= mix(vec3(1.0), aTop, aPiece.z * fnPure);
          vColor.rgb *= mix(vec3(1.0), aBottom, aPiece.w * fnPure);
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FIRE_PARS}`)
      .replace('#include <emissivemap_fragment>', FIRE_GLOW);
  };
  material.customProgramCacheKey = () => 'festnoz-dancer-v2';
  return material;
}

/** Lampions : papier coloré le jour ; la nuit, chacun s'allume à son heure et vacille. */
export function lampionMaterial() {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, lampionUniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aOn;
        uniform float uNight;
        uniform float uTime;
        varying float vLit;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vLit = smoothstep(aOn, aOn + 0.05, uNight) * (0.86 + 0.14 * sin(uTime * 5.3 + aOn * 97.0));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLit;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vColor.rgb * vLit * 3.2;`,
      );
  };
  material.customProgramCacheKey = () => 'festnoz-lampion-v1';
  return material;
}
