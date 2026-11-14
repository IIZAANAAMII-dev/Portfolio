import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, ShaderMaterial } from 'three';

/**
 * Matières partagées du laboratoire. Toutes sont créées une fois (le décor n'est chargé
 * qu'une fois) et animées par `updateLabMaterials`, appelé une seule fois par image.
 */

/** Horloge et facteur nuit, partagés par tous les shaders du labo. */
export const labTime = { value: 0 };
export const labNight = { value: 0 };

/**
 * `awake` : la caméra est assez proche pour que les animations se voient. Loin, les
 * boucles des zones se figent (aucun calcul par image).
 */
export const labState = { awake: true };

/** Décors : couleurs peintes par sommet, cel-shading global (toon.ts). */
export const paintMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
paintMaterial.name = 'skills-paint';

/** Lumières (LED, lampes, néons) : couleurs par sommet, sans ombrage, plus vives la nuit. */
export const glowMaterial = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
glowMaterial.name = 'skills-glow';

/** Écrans (pages, afficheurs) : non ombrés, à peine plus lumineux la nuit. */
export const screenMaterial = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
screenMaterial.name = 'skills-screen';

/**
 * Pièces d'interface (cartes, boutons, curseur) : peintes, mais légèrement émissives,
 * comme des éléments affichés. La nuit, elles luisent sur leur page.
 */
function createUiMaterial() {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 });
  material.name = 'skills-ui';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLabNight = labNight;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLabNight;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * (0.16 + uLabNight * 0.55);',
      );
  };
  material.customProgramCacheKey = () => 'skills-ui-v1';
  return material;
}

export const uiMaterial = createUiMaterial();

/** Verre teinté (dôme, fioles, vitres d'instruments). */
export const glassMaterial = new MeshStandardMaterial({
  color: '#c9f4ff',
  roughness: 0.15,
  metalness: 0.05,
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
  side: DoubleSide,
});
glassMaterial.name = 'skills-glass';

const FLOW_PARS_VERTEX = /* glsl */ `
attribute float aFlow;
varying float vFlow;
`;

/**
 * Lignes de lumière (allées, branches git) : des impulsions courent le long de `aFlow`
 * (distance le long de la ligne, en mètres), dans la couleur peinte par sommet.
 */
function createFlowMaterial() {
  const material = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  material.name = 'skills-flow';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLabTime = labTime;
    shader.uniforms.uLabNight = labNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FLOW_PARS_VERTEX}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlow = aFlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLabTime;\nuniform float uLabNight;\nvarying float vFlow;')
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        // Tête lumineuse et traîne : l'impulsion avance vers les aFlow croissants.
        float flowPhase = fract(vFlow * 0.4 - uLabTime * 0.55);
        float flowPulse = pow(flowPhase, 7.0);
        diffuseColor.rgb *= 0.5 + uLabNight * 0.6 + flowPulse * (1.5 + uLabNight * 1.8);`,
      );
  };
  material.customProgramCacheKey = () => 'skills-flow-v1';
  return material;
}

export const flowMaterial = createFlowMaterial();

/**
 * Câbles gainés : caoutchouc sombre (cel-shadé) où passent des impulsions lumineuses.
 * Une matière par couleur d'impulsion.
 */
export function createCableMaterial(pulse: string, speed = 0.9) {
  const material = new MeshStandardMaterial({ color: '#30343f', roughness: 0.55, metalness: 0.1 });
  material.name = `skills-cable-${pulse}`;
  const color = { value: new Color(pulse) };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLabTime = labTime;
    shader.uniforms.uLabNight = labNight;
    shader.uniforms.uPulseColor = color;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${FLOW_PARS_VERTEX}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlow = aFlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uLabTime;\nuniform float uLabNight;\nuniform vec3 uPulseColor;\nvarying float vFlow;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        float cablePulse = pow(fract(vFlow * 0.7 - uLabTime * ${speed.toFixed(2)}), 9.0);
        totalEmissiveRadiance += uPulseColor * (0.1 + uLabNight * 0.3 + cablePulse * (1.8 + uLabNight * 2.2));`,
      );
  };
  material.customProgramCacheKey = () => `skills-cable-v1-${pulse}-${speed}`;
  return material;
}

/** Halo additif (cônes de projecteur, auras) : dégradé vertical et bandes de balayage. */
export function createBeamMaterial(color: string, strength = 0.32) {
  return new ShaderMaterial({
    uniforms: { uTime: labTime, uNight: labNight, uColor: { value: new Color(color) }, uStrength: { value: strength } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uNight;
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float fade = smoothstep(1.0, 0.15, vUv.y) * smoothstep(0.0, 0.08, vUv.y);
        float scan = 0.75 + 0.25 * sin(vUv.y * 38.0 - uTime * 4.0);
        float alpha = fade * scan * uStrength * (0.75 + uNight * 0.6);
        gl_FragColor = vec4(uColor * alpha * 1.6, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
}

/** À appeler une fois par image : horloge, nuit, intensité des lumières. */
export function updateLabMaterials(time: number, night: number) {
  labTime.value = time;
  labNight.value = night;
  glowMaterial.color.setScalar(0.92 + night * 1.45);
  screenMaterial.color.setScalar(0.86 + night * 0.3);
}
