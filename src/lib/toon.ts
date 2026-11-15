import { ShaderChunk } from 'three';

/**
 * Cel-shading global.
 *
 * Le calcul de lumière directe des matériaux standard de three.js (RE_Direct_Physical) est
 * remplacé une fois pour toutes : la quantité de lumière ne suit plus le cosinus de façon
 * continue mais une rampe à paliers nets (ombre propre, demi-teinte étroite, pleine
 * lumière), et un liseré de lumière souligne les silhouettes côté soleil. Les textures
 * Substance (couleur, normales, rugosité) restent intactes : seul le modelé devient
 * « dessin animé ».
 *
 * Appelé avant la compilation des premiers matériaux (voir Scene.tsx). Les shaders sur mesure
 * (océan, sillage, ciel) ne sont pas concernés : ils gèrent leur propre stylisation.
 */
/** Les builds de three.js retirent les lignes vides : on cherche le code espaces compris. */
const DIRECT_LIGHT =
  /float dotNL = saturate\( dot\( geometryNormal, directLight\.direction \) \);\s*vec3 irradiance = dotNL \* directLight\.color;/;

const TOON_DIRECT_LIGHT = `float dotNL = saturate( dot( geometryNormal, directLight.direction ) );

	// Rampe à paliers : demi-teinte étroite puis pleine lumière. Son énergie moyenne reste
	// proche de celle de Lambert, pour ne pas surexposer la scène.
	float toonNL = smoothstep( 0.0, 0.06, dotNL ) * 0.48
		+ smoothstep( 0.4, 0.46, dotNL ) * 0.37;
	vec3 irradiance = toonNL * directLight.color;

	// Liseré lumineux franc sur les silhouettes éclairées.
	float toonRim = 1.0 - saturate( dot( geometryNormal, geometryViewDir ) );
	toonRim = smoothstep( 0.7, 0.76, toonRim ) * smoothstep( 0.1, 0.3, dotNL );
	reflectedLight.directDiffuse += directLight.color * BRDF_Lambert( material.diffuseContribution ) * toonRim * 0.22;`;

/**
 * Ombres colorées. Multiplier un vert par une lumière bleue ne donne qu'un vert-bleu : pour
 * des ombres franchement violettes, la part non éclairée par le soleil voit sa teinte
 * remplacée (luminance conservée) par un violet pervenche. Le rapport lumière directe /
 * lumière d'ambiance ne dépend pas de l'albédo : le masque est le même pour toutes les
 * matières. Les pools de lumière des lanternes, directes, restent chaudes.
 */
const SHADOW_TINT = /* glsl */ `
#if defined( STANDARD )
{
  const vec3 toonLuma = vec3( 0.2126, 0.7152, 0.0722 );
  // Violet pervenche (#8f7fd6) ramené à une luminance de 1 ; les ombres sont légèrement
  // relevées (× 1,18) : contraste doux de dessin animé plutôt que noirs bouchés.
  const vec3 toonShadowTint = vec3( 1.063, 0.82, 2.599 );
  float toonDirectLum = dot( reflectedLight.directDiffuse, toonLuma );
  float toonIndirectLum = dot( reflectedLight.indirectDiffuse, toonLuma );
  float toonShade = 1.0 - smoothstep( 0.2, 0.9, toonDirectLum / max( toonIndirectLum, 1e-5 ) );
  reflectedLight.indirectDiffuse = mix(
    reflectedLight.indirectDiffuse,
    toonIndirectLum * toonShadowTint * 1.18,
    toonShade * 0.42
  );
}
#endif
`;

let applied = false;

export function applyToonShading() {
  if (applied) return;
  const source = ShaderChunk.lights_physical_pars_fragment;
  if (!DIRECT_LIGHT.test(source)) {
    console.warn('[toon] chunk three.js inattendu : cel-shading non appliqué');
    return;
  }
  const chunks = ShaderChunk as Record<string, string>;
  chunks.lights_physical_pars_fragment = source.replace(DIRECT_LIGHT, TOON_DIRECT_LIGHT);
  chunks.lights_fragment_end = `${ShaderChunk.lights_fragment_end}\n${SHADOW_TINT}`;
  applied = true;
}
