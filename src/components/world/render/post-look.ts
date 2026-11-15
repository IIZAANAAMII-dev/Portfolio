import { Vector3 } from 'three';
import { skyState } from '@/lib/sky';
import { ecologyState } from '@/lib/ecology';
import { gradeUniforms } from './GradeEffect';

/**
 * Réglages du post-traitement au fil de la journée (qualité haute). Le jour reste tel
 * quel (la mer et les couleurs que l'on aime) ; l'heure dorée se réchauffe, le crépuscule
 * vire au bleu-violet, la nuit garde des noirs bleutés lisibles et laisse fleurir les
 * lumières (fenêtres, lanternes, phare) dans le bloom.
 */
export const postLook = {
  bloomIntensity: 0.38,
  bloomThreshold: 0.9,
  vignette: 0.38,
};

const SHADOW_DAY = new Vector3(0.42, 0.36, 0.7);
const SHADOW_NIGHT = new Vector3(0.2, 0.28, 0.62);
const HIGHLIGHT_DAY = new Vector3(1.0, 1.0, 1.0);
const HIGHLIGHT_GOLDEN = new Vector3(1.06, 0.99, 0.88);
const HIGHLIGHT_NIGHT = new Vector3(0.96, 0.99, 1.06);

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function updatePostLook() {
  const { dayNight, golden } = skyState;
  const storm = ecologyState.stormCover;
  const u = gradeUniforms;

  // La mer occupe la moitié de l'image : l'étalonnage reste neutre sur ses tons moyens
  // (virage limité aux ombres profondes des îles et aux hautes lumières).
  u.uShadowTint.value.copy(SHADOW_DAY).lerp(SHADOW_NIGHT, dayNight);
  u.uShadowAmount.value = 0.08 + golden * 0.06;
  u.uHighlightTint.value.copy(HIGHLIGHT_DAY).lerp(HIGHLIGHT_GOLDEN, golden).lerp(HIGHLIGHT_NIGHT, dayNight);
  u.uHighlightAmount.value = Math.max(golden, dayNight * 0.5);
  u.uSaturation.value = (1.0 + golden * 0.05 * (1 - dayNight)) * (1 - storm * 0.12);
  u.uContrast.value = 1.0 + golden * 0.03 * (1 - dayNight);
  u.uShoulder.value = 0.86;

  // Nuit : seules les vraies lumières (fenêtres, lanternes, phare) passent le seuil du
  // bloom ; l'écume nocturne, juste en dessous, garde son dessin.
  postLook.bloomThreshold = mix(0.92, 0.76, dayNight);
  postLook.bloomIntensity = mix(0.34 + golden * 0.1, 0.72, dayNight);
  postLook.vignette = mix(0.36, 0.44, dayNight);
}
