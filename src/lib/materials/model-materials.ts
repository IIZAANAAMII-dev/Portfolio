import type { SubstanceId } from './substances';
import type { SubstanceOptions } from './substance-material';

/**
 * Habillage des modèles Substance : chaque emplacement de matériau (le nom du matériau
 * dans le fichier, conservé par le pipeline) reçoit soit un matériau Substance de la
 * bibliothèque, soit une peinture simple (tissus, verre, ampoules).
 *
 * C'est le seul endroit où se décide l'apparence des modèles : pour repeindre la coque
 * ou changer le bois d'un ponton, on modifie une ligne ici.
 */
export type SlotSpec =
  | { substance: SubstanceId; options?: SubstanceOptions }
  | {
      paint: string;
      roughness?: number;
      metalness?: number;
      emissive?: string;
      emissiveIntensity?: number;
      /** Intensité émissive atteinte en pleine nuit (vitres, lampes) : s'allume avec le cycle. */
      night?: number;
      transparent?: boolean;
      opacity?: number;
      double?: boolean;
    };

export type SubstanceModelName =
  | 'fishing-boat'
  | 'house-mound'
  | 'bell-tower'
  | 'staircase'
  | 'chimney-curved'
  | 'chimney-straight'
  | 'cavern'
  | 'porch'
  | 'flags-multi'
  | 'flags-rectangle'
  | 'sea-dock'
  | 'fence-set'
  | 'cymbal'
  | 'kiosk'
  | 'rocks-edged'
  | 'rocks-small'
  | 'flower-clump'
  | 'starfish';

/** Palette commune, reprise de docs/DESIGN.md et de l'univers Bell Island. */
export const PAINT = {
  hull: '#b8432f',
  antifouling: '#22384a',
  waterline: '#f1e8d4',
  cabin: '#efe7d6',
  rope: '#c9a66b',
  bronze: '#b5894d',
  brass: '#c9a35c',
  ironDark: '#3e4448',
  glass: '#1c3340',
  sail: '#f1e7d2',
  flagRed: '#c9553f',
  flagOchre: '#e0a93f',
  flagTeal: '#3f8f8a',
  flagCream: '#efe2c4',
  petal: '#e58f88',
  petalInner: '#efe2cc',
  pollen: '#f2c14e',
  leaf: '#6f8f4a',
  coral: '#e07a52',
} as const;

const rope: SlotSpec = { substance: 'driftwood', options: { recolor: PAINT.rope, recolorAmount: 0.85, normalStrength: 0.6 } };
const iron: SlotSpec = { substance: 'iron_steam_pipe', options: { recolor: PAINT.ironDark, recolorAmount: 0.55 } };
const bronze: SlotSpec = { substance: 'iron_steam_pipe', options: { recolor: PAINT.bronze, recolorAmount: 0.85, metalness: 0.9, roughness: 0.38 } };
const lamp: SlotSpec = { paint: '#ffe2ad', emissive: '#ffc773', emissiveIntensity: 0.15, night: 3.2, roughness: 0.3 };

export const MODEL_MATERIALS: Record<SubstanceModelName, Record<string, SlotSpec>> = {
  'fishing-boat': {
    // Coque : bois battu par les embruns, peint (rouge, liseré, carène) en conservant son grain.
    boat_body: {
      substance: 'ocean_spray_swept_wood',
      options: {
        // Le fil du bois Substance est vertical : un quart de tour le couche le long de la coque.
        rotation: Math.PI / 2,
        recolor: PAINT.hull,
        recolorAmount: 0.82,
        band: { color: PAINT.antifouling, below: 0.62, softness: 0.012 },
        stripe: { color: PAINT.waterline, at: 0.68, width: 0.07 },
      },
    },
    // Pont : bois marin patiné par les embruns, sans peinture.
    floor: { substance: 'ocean_spray_swept_wood_planks', options: { normalStrength: 0.9, rotation: Math.PI / 2 } },
    cabin: { substance: 'wood_barrier', options: { recolor: PAINT.cabin, recolorAmount: 0.88 } },
    bunker: { substance: 'wood_beam' },
    cabin_interior: { substance: 'wood_beam', options: { tint: '#8a7464' } },
    holders: iron,
    light_frame: iron,
    wires: { paint: '#24282b', roughness: 0.6 },
    transformers: iron,
    radar: { paint: '#eeeae0', roughness: 0.45 },
    rope,
    window_transparency: { paint: PAINT.glass, roughness: 0.06, metalness: 0.4, emissive: '#ffcf8a', emissiveIntensity: 0, night: 1.6 },
    display: { paint: '#1a1410', emissive: '#ff9a3c', emissiveIntensity: 0.5, night: 1.4 },
    light: lamp,
  },
  'house-mound': {
    mound: { substance: 'earth_and_grass', options: { projection: 'triplanar', space: 'world', top: 'wild_grass', topThreshold: 0.35 } },
    wall_plaster: { substance: 'mossy_brick_wall' },
    bottom_platform: { substance: 'blocky_stone_cliff', options: { projection: 'triplanar', space: 'world' } },
    light_wood: { substance: 'wood_barrier' },
    window_wood: { substance: 'wood_flooring', options: { recolor: PAINT.flagTeal, recolorAmount: 0.55 } },
    window_pieces: { paint: PAINT.glass, roughness: 0.08, metalness: 0.3, emissive: '#ffcf8a', emissiveIntensity: 0, night: 2.2 },
  },
  'bell-tower': {
    main_bell: bronze,
    small_bells: bronze,
    horn_details: { substance: 'iron_steam_pipe', options: { recolor: PAINT.brass, recolorAmount: 0.8 } },
    bell_hooks: iron,
    central_bolts: iron,
    bell_string: rope,
    roof: { substance: 'wood_flooring', options: { recolor: '#7a3b2e', recolorAmount: 0.45 } },
    tower_supports: { substance: 'wood_beam' },
    tower_support: { substance: 'wood_beam' },
    central_horn_box: { substance: 'wood_barrier' },
    horns: { substance: 'wood_barrier' },
    horn_connector: { substance: 'wood_beam' },
  },
  staircase: { stairs: { substance: 'wood_beam' } },
  'chimney-curved': { chimney_top: iron, chimney_bottom: iron },
  'chimney-straight': { stylized_straight_pipe_chimney: iron },
  cavern: { stylized_large_cavern: { substance: 'mossy_island_cliff', options: { projection: 'triplanar', space: 'world', top: 'wild_grass' } } },
  porch: { plank: { substance: 'wood_flooring' } },
  'flags-multi': {
    flag: { paint: PAINT.flagRed, roughness: 0.9, double: true },
    flag_001: { paint: PAINT.flagOchre, roughness: 0.9, double: true },
    flag_004: { paint: PAINT.flagTeal, roughness: 0.9, double: true },
    pole: { substance: 'wood_beam' },
    rope,
  },
  'flags-rectangle': {
    cloth: { paint: PAINT.flagCream, roughness: 0.9, double: true },
    pole: { substance: 'wood_beam' },
  },
  'sea-dock': {
    wood: { substance: 'ocean_spray_swept_wood_planks', options: { recolor: '#9b7550', recolorAmount: 0.6 } },
    docking: { substance: 'driftwood' },
    line: rope,
    screw: iron,
  },
  'fence-set': { fence: { substance: 'wood_barrier' } },
  cymbal: {
    bell: bronze,
    plank: { substance: 'wood_beam' },
    top_plank_cap: iron,
    flag_pin: iron,
    rope,
    flag: { paint: PAINT.flagRed, roughness: 0.9, double: true },
  },
  kiosk: {
    base: { substance: 'wood_beam' },
    planks: { substance: 'wood_flooring' },
    roof: { substance: 'wood_flooring', options: { recolor: PAINT.flagTeal, recolorAmount: 0.6 } },
    napkin: { paint: PAINT.flagCream, roughness: 0.95, double: true },
    napkin_001: { paint: PAINT.flagRed, roughness: 0.95, double: true },
    card: { paint: '#f3ead6', roughness: 0.9, double: true },
    line: rope,
    cable: { paint: '#2a2622', roughness: 0.7 },
    lamp_cap: iron,
    lamp_holder: iron,
    lamp,
    lamp_001: lamp,
  },
  'rocks-edged': {
    rock: { substance: 'island_cliff', options: { projection: 'triplanar', space: 'world', top: 'wild_grass', topThreshold: 0.78 } },
  },
  'rocks-small': {
    rock: { substance: 'barnacle_covered_rock', options: { projection: 'triplanar', space: 'world' } },
  },
  'flower-clump': {
    grass: { paint: PAINT.leaf, roughness: 0.85, double: true },
    ovary: { paint: PAINT.pollen, roughness: 0.7 },
    inner_petal: { paint: PAINT.petalInner, roughness: 0.75, double: true },
    outer_petal: { paint: PAINT.petal, roughness: 0.75, double: true },
  },
  starfish: { stylized_sea_starfish: { substance: 'coast_cliff_rock_overgrown', options: { recolor: PAINT.coral, recolorAmount: 0.9, projection: 'triplanar', space: 'world', scale: 0.12 } } },
};
