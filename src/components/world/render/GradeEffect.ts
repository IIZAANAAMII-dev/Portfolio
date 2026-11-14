import { BlendFunction, Effect } from 'postprocessing';
import { Uniform, Vector3 } from 'three';

/**
 * Étalonnage final (qualité haute), fusionné dans la passe du bloom et du vignettage : un
 * seul plein écran de plus, quelques opérations par pixel.
 *
 *  - épaule douce des hautes lumières : au lieu d'écrêter net (sable au soleil, voiles,
 *    écume, fenêtres), les très hautes valeurs s'arrondissent ; tout ce qui est sous le seuil
 *    est intact ;
 *  - virage partiel : ombres légèrement violettes, lumières légèrement chaudes, dosés par
 *    l'heure ; les tons moyens (la mer) ne bougent pas ;
 *  - contraste et saturation, puis un grain de tramage invisible qui casse le banding des
 *    dégradés (ciel, brume, nuit).
 */
const fragmentShader = /* glsl */ `
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uShadowAmount;
uniform float uHighlightAmount;
uniform float uSaturation;
uniform float uContrast;
uniform float uShoulder;
uniform float uDither;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, vec3(0.0));

  float peak = max(max(c.r, c.g), c.b);
  if (peak > uShoulder) {
    float range = 1.0 - uShoulder;
    float mapped = uShoulder + range * (1.0 - exp(-(peak - uShoulder) / range));
    c *= mapped / peak;
  }

  // Travail en espace « perçu » (gamma 2.2), plus proche de l'œil que le linéaire.
  vec3 g = pow(c, vec3(1.0 / 2.2));
  float luma = dot(g, vec3(0.299, 0.587, 0.114));
  float shadowWeight = 1.0 - smoothstep(0.04, 0.42, luma);
  float highlightWeight = smoothstep(0.62, 0.98, luma);
  // Teinte des ombres à luminance égale (même principe que lib/toon.ts).
  vec3 tinted = uShadowTint * (luma / max(dot(uShadowTint, vec3(0.299, 0.587, 0.114)), 1e-3));
  g = mix(g, tinted, shadowWeight * uShadowAmount);
  g = mix(g, g * uHighlightTint, highlightWeight * uHighlightAmount);
  g = (g - 0.42) * uContrast + 0.42;
  float grey = dot(g, vec3(0.299, 0.587, 0.114));
  g = mix(vec3(grey), g, uSaturation);

  float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  g += noise * uDither;

  outputColor = vec4(pow(max(g, vec3(0.0)), vec3(2.2)), inputColor.a);
}
`;

/** Uniformes partagés (un seul étalonnage dans la scène), réglés par post-look.ts. */
export const gradeUniforms = {
  uShadowTint: new Uniform(new Vector3(0.36, 0.3, 0.62)),
  uHighlightTint: new Uniform(new Vector3(1.03, 1.0, 0.95)),
  uShadowAmount: new Uniform(0),
  uHighlightAmount: new Uniform(0),
  uSaturation: new Uniform(1),
  uContrast: new Uniform(1),
  uShoulder: new Uniform(1),
  uDither: new Uniform(1 / 255),
};

export class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', fragmentShader, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>(Object.entries(gradeUniforms)),
    });
  }
}
