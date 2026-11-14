import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { Matrix4, Uniform, Vector3, type Camera, type PerspectiveCamera } from 'three';

/**
 * Ombrage de contact peint (qualité haute) : là où deux volumes se touchent — pied des
 * arbres et des maisons, bas des falaises, objets posés sur le sable — un léger voile
 * violet, comme le pinceau d'un illustrateur qui « assoit » chaque objet ; les arêtes
 * saillantes s'éclaircissent un peu.
 *
 * Technique : masque flou de la profondeur (Luft et al.), six paires de points opposés
 * autour du pixel. La profondeur d'un plan varie linéairement à l'écran : la moyenne de deux
 * points opposés retombe exactement sur le plan, l'écart ne mesure donc que les creux et les
 * bosses. Rayon constant en mètres, écarts bornés (pas de halo sur les grands vides).
 *
 * La mer n'écrit pas de profondeur : sous sa surface, le tampon contient le fond marin. Le
 * masque « au-dessus de l'eau » (hauteur monde reconstruite) laisse donc l'eau intacte.
 */
const fragmentShader = /* glsl */ `
uniform mat4 uCameraWorld;
uniform mat4 uProjectionInverse;
uniform float uStrength;
uniform float uRidge;
uniform float uWorldRadius;
uniform float uTanHalfFov;
uniform vec3 uTint;

float contactPair(vec2 uv, vec2 offset, float z, inout float ridge) {
  float a = readDepth(uv + offset);
  float b = readDepth(uv - offset);
  if (max(a, b) >= 0.9999) return 0.0;
  float diff = z + getViewZ((a + b) * 0.5);
  float gap = 1.0 - smoothstep(1.4, 3.6, abs(diff));
  ridge += smoothstep(0.06, 0.45, -diff) * gap;
  return smoothstep(0.03, 0.4, diff) * gap;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  outputColor = inputColor;
  if (depth >= 0.9999 || uStrength <= 0.0) return;

  vec4 view = uProjectionInverse * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  view /= view.w;
  float worldY = (uCameraWorld * vec4(view.xyz, 1.0)).y;
  float mask = smoothstep(-0.2, 0.3, worldY);
  if (mask <= 0.0) return;

  float z = -view.z;
  float pixels = clamp(uWorldRadius * resolution.y / (2.0 * z * uTanHalfFov), 1.5, 24.0);
  vec2 r = texelSize * pixels;
  vec2 h = r * 0.5;
  float ridge = 0.0;
  float occlusion = contactPair(uv, vec2(r.x, 0.0), z, ridge)
    + contactPair(uv, vec2(0.5 * r.x, 0.866 * r.y), z, ridge)
    + contactPair(uv, vec2(-0.5 * r.x, 0.866 * r.y), z, ridge)
    + contactPair(uv, vec2(0.866 * h.x, 0.5 * h.y), z, ridge)
    + contactPair(uv, vec2(0.0, h.y), z, ridge)
    + contactPair(uv, vec2(-0.866 * h.x, 0.5 * h.y), z, ridge);
  occlusion = clamp(occlusion / 6.0, 0.0, 1.0) * mask;
  ridge = clamp(ridge / 6.0, 0.0, 1.0) * mask;

  vec3 color = inputColor.rgb;
  color = mix(color, color * uTint, occlusion * uStrength);
  color *= 1.0 + ridge * uRidge;
  outputColor = vec4(color, inputColor.a);
}
`;

/** Uniformes partagés, réglés chaque image (caméra) et par post-look.ts (dosage). */
export const contactUniforms = {
  uCameraWorld: new Uniform(new Matrix4()),
  uProjectionInverse: new Uniform(new Matrix4()),
  uStrength: new Uniform(0.55),
  uRidge: new Uniform(0.08),
  uWorldRadius: new Uniform(0.7),
  uTanHalfFov: new Uniform(0.4),
  uTint: new Uniform(new Vector3(0.6, 0.54, 0.86)),
};

export class ContactShadeEffect extends Effect {
  constructor() {
    super('ContactShadeEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>(Object.entries(contactUniforms)),
    });
  }
}

/** Matrices de la caméra courante (à appeler une fois par image, avant le rendu). */
export function updateContactCamera(camera: Camera) {
  camera.updateMatrixWorld();
  contactUniforms.uCameraWorld.value.copy(camera.matrixWorld);
  contactUniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
  const fov = (camera as PerspectiveCamera).fov;
  if (typeof fov === 'number') contactUniforms.uTanHalfFov.value = Math.tan((fov * Math.PI) / 360);
}
