/**
 * Réglages par modèle du pipeline Substance 3D (voir scripts/assets/build-models.mjs).
 *
 * - `src`      : fichier source dans assets-src/substance/models/
 * - `tris`     : budget de triangles visé après simplification (le simplificateur peut
 *                s'arrêter avant si l'erreur géométrique dépasse `error`)
 * - `error`    : erreur maximale, en fraction du rayon du mesh
 * - `keep`     : nœuds à garder séparés (parties animées : cloches, drapeaux, radar…)
 * - `split`    : chaque mesh devient une pièce autonome centrée sur sa base (lots de rochers,
 *                de clôtures) — l'application les instancie ensuite individuellement
 * - `scale`    : correction d'unité appliquée une seule fois, ici (jamais dans le code)
 * - `pivot`    : 'base' = centré en X/Z, posé sur Y = 0 ; 'none' = origine d'origine
 */
export const MODELS = {
  'fishing-boat': {
    src: 'fishing_boat_01.glb',
    tris: 52000,
    error: 0.0012,
    keep: ['radar_mesh', 'direction_propellor_mesh', 'spot_light_mesh'],
    pivot: 'base',
  },
  'house-mound': { src: 'stylized_bell_island_house_mound.fbx', tris: 20000, error: 0.0015, pivot: 'base' },
  'bell-tower': {
    src: 'stylized_bell_tower.fbx',
    tris: 17000,
    error: 0.0015,
    keep: ['main_bell_mesh', 'bell_clapper_mesh', 'bell_support_001_mesh'],
    pivot: 'base',
  },
  staircase: { src: 'stylized_bifurcated_wood_staircase.fbx', tris: 12000, error: 0.0015, pivot: 'base' },
  'chimney-curved': { src: 'stylized_curved_pipe_chimney.fbx', tris: 2900, error: 0.001, pivot: 'base' },
  'chimney-straight': { src: 'stylized_straight_pipe_chimney.fbx', tris: 3000, error: 0.0015, pivot: 'base' },
  cavern: { src: 'stylized_large_cavern.fbx', tris: 11000, error: 0.002, pivot: 'base' },
  porch: { src: 'stylized_large_wood_porch.fbx', tris: 9000, error: 0.0015, pivot: 'base' },
  'flags-multi': {
    src: 'stylized_multi_flags_pole.fbx',
    tris: 5200,
    error: 0.001,
    keep: ['flag_001_mesh', 'flag_002_mesh', 'flag_003_mesh'],
    pivot: 'base',
  },
  'flags-rectangle': {
    src: 'stylized_rectangle_flags_pole.fbx',
    tris: 4600,
    error: 0.001,
    keep: ['cloth_mesh'],
    pivot: 'base',
  },
  'sea-dock': { src: 'stylized_old_sea_dock.fbx', tris: 10000, error: 0.0015, pivot: 'base' },
  'fence-set': { src: 'stylized_regular_fence_set.fbx', tris: 4000, error: 0.001, split: true },
  cymbal: {
    src: 'stylized_standing_cymbal.fbx',
    tris: 11000,
    error: 0.003,
    keep: ['bell_mesh', 'bell_ring_mesh', 'flag_001_mesh', 'flag_002_mesh'],
    pivot: 'base',
  },
  kiosk: {
    src: 'stylized_wood_kiosk.fbx',
    tris: 9500,
    error: 0.0015,
    keep: ['lamp_001_mesh', 'lamp_002_mesh'],
    pivot: 'base',
  },
  'rocks-edged': { src: 'stylized_edged_rocks_set.fbx', tris: 20000, error: 0.002, split: true },
  'rocks-small': { src: 'stylized_small_rocks_set.fbx', tris: 17000, error: 0.002, split: true },
  'flower-clump': { src: 'stylized_flower_clump.fbx', tris: 4200, error: 0.012, scale: 8, pivot: 'base' },
  starfish: { src: 'stylized_sea_starfish.fbx', tris: 1800, error: 0.002, pivot: 'base' },
};
