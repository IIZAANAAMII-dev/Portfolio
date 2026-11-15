import { ShaderChunk, ShaderLib } from 'three';

/**
 * « Pop » de la révélation, calculé sur le GPU.
 *
 * Pendant la cinématique d'ouverture, chaque objet posé sur une île (arbre, maison, rocher,
 * touffe d'herbe, planche de ponton…) jaillit de son propre pivot avec un ressort amorti,
 * du centre de l'île vers ses rivages, juste après que l'île a crevé la surface. Aucun décor
 * n'est modifié : le calcul est greffé une fois pour toutes dans le chunk `project_vertex` de
 * three.js (après le toon, qui ne touche que les fragments) et lit un petit tableau
 * d'uniformes partagé par tous les matériaux intégrés (standard, basic, ombres…).
 *
 *   introPop[0] = (horloge de l'intro en s, actif 0/1, -, -)
 *   introPop[i] = (x, z, rayon d'emprise, instant où l'île surgit en s) ; rayon 0 = libre.
 *
 * Hors cinématique, « actif » vaut 0 : une seule branche sur un uniforme, rien d'autre.
 * Un programme qui inclut le chunk sans recevoir l'uniforme (matériau sur mesure) lit des
 * zéros : il reste inactif. Le relief et les grands blocs fusionnés, dont le pivot est le
 * centre exact de l'île, montent avec elle sans « pop ».
 */
export const INTRO_POP_SLOTS = 12;

type PopHolder = { __introPop?: Float32Array };

/** Tableau partagé par référence entre tous les programmes (conservé au rechargement à chaud). */
export const introPopData: Float32Array = ((globalThis as PopHolder).__introPop ??= new Float32Array(INTRO_POP_SLOTS * 4));

const MARK = 'introPopScale';

const DECLARE = /* glsl */ `
#ifndef INTRO_POP
#define INTRO_POP
uniform vec4 introPop[ ${INTRO_POP_SLOTS} ];
// Ressort amorti (ζ ≈ 0,4) : dépassement d'un quart, un rebond, puis le repos exact.
float introPopSpring( float t ) {
	if ( t <= 0.0 ) return 0.0;
	if ( t >= 1.3 ) return 1.0;
	return 1.0 - exp( - 4.8 * t ) * ( cos( 11.0 * t ) + 0.436 * sin( 11.0 * t ) );
}
float ${MARK}( vec3 pivot ) {
	for ( int i = 1; i < ${INTRO_POP_SLOTS}; i ++ ) {
		vec4 slot = introPop[ i ];
		if ( slot.z <= 0.0 ) continue;
		float reach = length( pivot.xz - slot.xy );
		if ( reach >= slot.z ) continue;
		if ( reach < 0.05 ) return 1.0;
		// Du centre vers le rivage, avec un léger désordre par objet.
		float jitter = fract( sin( dot( floor( pivot.xz * 4.0 ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
		return introPopSpring( introPop[ 0 ].x - slot.w - 0.28 - reach / slot.z * 0.62 - jitter * 0.2 );
	}
	return 1.0;
}
#endif
`;

const APPLY = /* glsl */ `
#ifdef INTRO_POP
if ( introPop[ 0 ].y > 0.5 ) {
	#ifdef USE_INSTANCING
		transformed *= ${MARK}( ( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 ) ).xyz );
	#else
		transformed *= ${MARK}( modelMatrix[ 3 ].xyz );
	#endif
}
#endif
`;

/** Matériaux intégrés qui reçoivent l'uniforme (les ombres comprises : elles « poppent » aussi). */
const SHADERS = ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon', 'matcap', 'normal', 'depth', 'distance', 'shadow'];

/** À appeler avant la compilation des premiers matériaux (module de l'IntroStage). */
export function applyIntroPop() {
  const chunks = ShaderChunk as unknown as Record<string, string>;
  if (!chunks.batching_pars_vertex.includes(MARK)) chunks.batching_pars_vertex = `${chunks.batching_pars_vertex}\n${DECLARE}`;
  if (!chunks.project_vertex.includes(MARK)) chunks.project_vertex = `${APPLY}\n${chunks.project_vertex}`;
  const library = ShaderLib as unknown as Record<string, { uniforms: Record<string, { value: unknown }> } | undefined>;
  for (const id of SHADERS) {
    const shader = library[id];
    if (shader) shader.uniforms.introPop = { value: introPopData };
  }
}

/** Horloge de la cinématique (s) et interrupteur général. */
export function setIntroPopClock(seconds: number, active: boolean) {
  introPopData[0] = seconds;
  introPopData[1] = active ? 1 : 0;
}

/** Une île : centre, rayon d'emprise (0 = libre) et instant où elle surgit. */
export function setIntroPopSlot(index: number, x: number, z: number, footprint: number, start: number) {
  if (index < 1 || index >= INTRO_POP_SLOTS) return;
  const offset = index * 4;
  introPopData[offset] = x;
  introPopData[offset + 1] = z;
  introPopData[offset + 2] = footprint;
  introPopData[offset + 3] = start;
}
