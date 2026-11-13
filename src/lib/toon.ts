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

let applied = false;

export function applyToonShading() {
  if (applied) return;
  const source = ShaderChunk.lights_physical_pars_fragment;
  if (!DIRECT_LIGHT.test(source)) {
    console.warn('[toon] chunk three.js inattendu : cel-shading non appliqué');
    return;
  }
  (ShaderChunk as Record<string, string>).lights_physical_pars_fragment = source.replace(DIRECT_LIGHT, TOON_DIRECT_LIGHT);
  applied = true;
}
