import { islandById } from '@/data/islands';
import { islets } from '@/data/islets';
import { yellowStaticIsland } from '@/data/yellow-static';
import type { IslandId, WorldPhase } from '@/types';

/**
 * PAYSAGE SONORE — le mixage. Aucune dépendance au navigateur : testable hors de la page.
 *
 * Chaque île a sa « zone » : des nappes continues (clapotis du port, vent de lande, cigales,
 * bourdon du labo, rumeur de la ville, vagues sur les rochers…) et des événements ponctuels
 * (goélands, grincements du gréement, drisses qui tintent, bouée à cloche…). Une zone est à
 * pleine force au ponton et s'éteint bien avant l'île suivante ; entre les deux, la pleine
 * mer prend le relais (vent proportionnel à la vitesse, claquements de coque). La nuit fait
 * taire les cigales et la ville, réveille les grillons près des îles et la corne de brume.
 *
 * `computeMix` écrit dans un objet préalloué : aucune allocation à chaque mise à jour (5 Hz).
 */

/** Nappes continues (une seule instance de chaque, partagée par les zones qui l'utilisent). */
export const BED = {
  /** Port breton : clapotis contre les cales et les coques. */
  harbor: 0,
  /** Lande bretonne : vent qui siffle dans la bruyère. */
  breton: 1,
  /** Cigales de Provence (Marseille, La Ciotat), de jour. */
  cicadas: 2,
  /** Laboratoire : bourdon de synthé très doux. */
  lab: 3,
  /** Ville des projets : rumeur lointaine. */
  town: 4,
  /** La Ciotat : clapotis sombre contre le quai, grondement du chantier. */
  quay: 5,
  /** Contact : vagues sur les rochers. */
  rocks: 6,
  /** Pleine mer : vent (apparent) proportionnel à la vitesse. */
  wind: 7,
  /** Nuit : grillons près des îles. */
  crickets: 8,
} as const;
export const BED_COUNT = 9;

/** Événements ponctuels. */
export const EVENT = {
  gull: 0,
  creak: 1,
  halyard: 2,
  bellBuoy: 3,
  blip: 4,
  van: 5,
  bike: 6,
  clank: 7,
  plop: 8,
  crash: 9,
  foghorn: 10,
  slap: 11,
  chime: 12,
} as const;
export const EVENT_COUNT = 13;

/** Vitesse de référence du bateau (MAX_SPEED de la navigation). */
const SPEED_REF = 13.5;

/** Moments de la journée où une contribution se fait entendre. */
const ALL = 0;
const DAY = 1;
const NIGHT = 2;
/** Plus rare la nuit (goélands, ville, chantier). */
const HUSHED_NIGHT = 3;

interface Zone {
  /** Centre de la zone (distance au bateau). */
  cx: number;
  cz: number;
  /** Point d'où le son semble venir (panoramique) : le centre, ou une moitié d'île. */
  px: number;
  pz: number;
  radius: number;
  /** Pleine force en deçà, silence au-delà (distance au centre). */
  inner: number;
  outer: number;
  /** Nappes : [nappe, gain, moment] à plat. */
  beds: number[];
  /** Événements : [événement, par minute, moment] à plat. */
  events: number[];
  /** Végétation : grillons la nuit. */
  crickets: number;
  /** Port abrité : le ressac du large s'adoucit. */
  calm: number;
  /** Moitié d'une île coupée en deux (Parcours) : axe du chenal et côté (-1 / +1). */
  side?: { axis: number; sign: number };
}

interface ZoneSpec {
  beds?: number[];
  events?: number[];
  crickets?: number;
  calm?: number;
}

function zone(x: number, z: number, radius: number, reach: number, spec: ZoneSpec): Zone {
  return {
    cx: x,
    cz: z,
    px: x,
    pz: z,
    radius,
    // Le bateau accoste à rayon + 4,5 : pleine force un peu au-delà du ponton.
    inner: radius + 6,
    outer: radius + reach,
    beds: spec.beds ?? [],
    events: spec.events ?? [],
    crickets: spec.crickets ?? 0,
    calm: spec.calm ?? 0,
  };
}

function islandZone(id: IslandId, reach: number, spec: ZoneSpec) {
  const island = islandById[id];
  return zone(island.position[0], island.position[1], island.radius, reach, spec);
}

function isletZone(id: string, reach: number, spec: ZoneSpec) {
  const islet = islets.find((entry) => entry.id === id);
  if (!islet) return null;
  return zone(islet.position[0], islet.position[1], islet.radius, reach, spec);
}

/**
 * Île Parcours : le chenal suit l'axe u (angle 0,8 rad dans le repère de l'île, voir
 * scenes/journey/terrain.ts) ; v < 0 côté Bretagne, v > 0 côté Marseille.
 */
const JOURNEY_AXIS = 0.8;
const JOURNEY_HALF = 8;

function journeyHalf(sign: number, spec: ZoneSpec): Zone {
  const island = islandById.journey;
  const base = islandZone('journey', 34, spec);
  // Centre de la moitié : v = ±8 (u = 0), ramené dans le repère du monde.
  const v = sign * JOURNEY_HALF;
  base.px = island.position[0] + v * Math.sin(JOURNEY_AXIS);
  base.pz = island.position[1] - v * Math.cos(JOURNEY_AXIS);
  base.side = { axis: JOURNEY_AXIS, sign };
  return base;
}

const ZONES: Zone[] = [
  // À propos — le port breton : goélands, gréement qui grince, drisses, bouée à cloche.
  islandZone('about', 34, {
    beds: [BED.harbor, 1, ALL],
    events: [
      EVENT.gull, 5, HUSHED_NIGHT,
      EVENT.creak, 3.5, ALL,
      EVENT.halyard, 5, ALL,
      EVENT.bellBuoy, 3.2, ALL,
      EVENT.plop, 3, ALL,
    ],
    crickets: 1,
    calm: 0.6,
  }),
  // Parcours — moitié bretonne (vent de lande), moitié marseillaise (cigales).
  journeyHalf(-1, {
    beds: [BED.breton, 1, ALL],
    events: [EVENT.gull, 1.6, HUSHED_NIGHT],
    crickets: 1,
  }),
  journeyHalf(1, {
    beds: [BED.cicadas, 1, DAY],
    crickets: 0.8,
    calm: 0.2,
  }),
  // Compétences — le laboratoire : bourdon de synthé, petits bips de données.
  islandZone('skills', 32, {
    beds: [BED.lab, 1, ALL],
    events: [EVENT.blip, 8, ALL],
    crickets: 0.5,
  }),
  // Projets — la ville : rumeur douce, camionnette de livraison qui recule, sonnette.
  islandZone('projects', 34, {
    beds: [BED.town, 1, HUSHED_NIGHT],
    events: [
      EVENT.van, 1.1, DAY,
      EVENT.bike, 1.4, DAY,
      EVENT.gull, 0.8, HUSHED_NIGHT,
    ],
    crickets: 0.7,
    calm: 0.3,
  }),
  // Expériences — La Ciotat : grues du chantier, clapotis du quai, goélands, cigales.
  islandZone('experience', 34, {
    beds: [BED.quay, 1, ALL, BED.cicadas, 0.4, DAY],
    events: [
      EVENT.clank, 3, HUSHED_NIGHT,
      EVENT.plop, 5, ALL,
      EVENT.gull, 2.2, HUSHED_NIGHT,
    ],
    crickets: 0.8,
    calm: 0.6,
  }),
  // Contact — le phare : vagues sur les rochers, corne de brume la nuit.
  islandZone('contact', 32, {
    beds: [BED.rocks, 1, ALL],
    events: [
      EVENT.crash, 6, ALL,
      EVENT.foghorn, 2.4, NIGHT,
      EVENT.gull, 1.4, HUSHED_NIGHT,
    ],
    crickets: 0.3,
  }),
  // Îlot de départ : un petit port tranquille.
  zone(0, 0, 7, 24, {
    beds: [BED.harbor, 0.55, ALL],
    events: [EVENT.gull, 2.2, HUSHED_NIGHT, EVENT.creak, 1.5, ALL, EVENT.plop, 2.5, ALL],
    crickets: 0.5,
    calm: 0.3,
  }),
  ...[
    // Îlots de personnalité : Bretagne (goélands, bouée), high-tech (bips), design (carillon).
    // L'îlot breton n'a pas de nappe : il est tout près du ponton de Parcours, dont il
    // fausserait le panoramique de la lande.
    isletZone('breizh', 20, {
      events: [EVENT.gull, 2.5, HUSHED_NIGHT, EVENT.bellBuoy, 1.5, ALL],
      crickets: 0.4,
    }),
    isletZone('tech', 18, { beds: [BED.lab, 0.35, ALL], events: [EVENT.blip, 4, ALL], crickets: 0.2 }),
    isletZone('design', 18, { events: [EVENT.chime, 4.5, ALL], crickets: 0.4 }),
  ].filter((entry): entry is Zone => entry !== null),
];

/** L'île secrète a sa propre ambiance (bourdon de néon) : le paysage s'y tait. */
const SECRET_X = yellowStaticIsland.position[0];
const SECRET_Z = yellowStaticIsland.position[1];
const SECRET_REACH = yellowStaticIsland.influence;

export interface SoundscapeInput {
  /** Position du bateau (monde). */
  x: number;
  z: number;
  heading: number;
  speed: number;
  /** Ciel : angle du soleil et facteur nuit amorti (0 jour → 1 nuit). */
  sunAngle: number;
  night: number;
  phase: WorldPhase;
  gameTransition: number;
  activeIsland: IslandId | null;
  quickView: boolean;
  /** Approche de la mer interdite (0 → 1) : la tempête prend toute la place. */
  boundary: number;
  /** Un panneau (page du carnet) est ouvert : le monde se fait un peu plus discret. */
  panelOpen: boolean;
}

export interface Mix {
  /** Niveau de chaque nappe (0 → 1, avant l'étalonnage propre à la nappe). */
  bed: Float32Array;
  pan: Float32Array;
  /** Paramètre propre à une nappe (vent : vitesse normalisée). */
  tone: Float32Array;
  /** Fréquence de chaque événement (par seconde). */
  events: Float32Array;
  evLevel: Float32Array;
  evPan: Float32Array;
  /** Niveau global du paysage (phase, île secrète, tempête, panneau, vue rapide). */
  master: number;
  /** Nuance du ressac généré par ambience (1 = inchangé). */
  seaShade: number;
  /** Multiplicateur des fréquences d'événements. */
  rateScale: number;
  /** Poids de la pleine mer (0 au ponton → 1 au large). */
  sea: number;
  speed: number;
  night: number;
}

export function createMix(): Mix {
  return {
    bed: new Float32Array(BED_COUNT),
    pan: new Float32Array(BED_COUNT),
    tone: new Float32Array(BED_COUNT),
    events: new Float32Array(EVENT_COUNT),
    evLevel: new Float32Array(EVENT_COUNT),
    evPan: new Float32Array(EVENT_COUNT),
    master: 0,
    seaShade: 1,
    rateScale: 1,
    sea: 1,
    speed: 0,
    night: 0,
  };
}

export function createInput(): SoundscapeInput {
  return {
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    sunAngle: Math.PI / 2,
    night: 0,
    phase: 'playing',
    gameTransition: 1,
    activeIsland: null,
    quickView: false,
    boundary: 0,
    panelOpen: false,
  };
}

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function timeFactor(when: number, nightness: number) {
  if (when === DAY) return 1 - nightness;
  if (when === NIGHT) return nightness;
  if (when === HUSHED_NIGHT) return 1 - 0.7 * nightness;
  return 1;
}

/** Accumulateurs du panoramique (poids et sommes pondérées), préalloués. */
const bedPanSum = new Float32Array(BED_COUNT);
const eventPanSum = new Float32Array(EVENT_COUNT);
/** Oreille (caméra estimée) et vecteur « droite de l'écran ». */
const ear = { x: 0, z: 0, rightX: 1, rightZ: 0 };

/**
 * Où se trouve la caméra et vers où regarde-t-elle ? Même logique que CameraRig : à quai,
 * entre le ponton et le soleil, face à l'île ; en navigation, derrière le bateau.
 */
function placeEar(input: SoundscapeInput) {
  if (input.phase === 'docked' && input.activeIsland) {
    const island = islandById[input.activeIsland];
    const sunX = Math.cos(input.sunAngle) * 80;
    const sunLength = Math.hypot(sunX, 40);
    let viewX = Math.cos(island.dockAngle) + sunX / sunLength;
    let viewZ = Math.sin(island.dockAngle) + 40 / sunLength;
    const length = Math.hypot(viewX, viewZ) || 1;
    viewX /= length;
    viewZ /= length;
    const distance = (island.radius + 26) * 0.78;
    ear.x = island.position[0] + viewX * distance;
    ear.z = island.position[1] + viewZ * distance;
    // Regard = -vue ; droite = (-regard.z, regard.x).
    ear.rightX = viewZ;
    ear.rightZ = -viewX;
    return;
  }
  const forwardX = Math.cos(input.heading);
  const forwardZ = Math.sin(input.heading);
  ear.x = input.x - forwardX * 30;
  ear.z = input.z - forwardZ * 30;
  ear.rightX = -forwardZ;
  ear.rightZ = forwardX;
}

/** Panoramique d'un point : -1 à gauche de l'écran, +1 à droite. */
function panToward(x: number, z: number, width: number) {
  const dx = x - ear.x;
  const dz = z - ear.z;
  const length = Math.hypot(dx, dz) || 1;
  const pan = ((dx * ear.rightX + dz * ear.rightZ) / length) * 1.5 * width;
  return pan < -0.8 ? -0.8 : pan > 0.8 ? 0.8 : pan;
}

export function computeMix(input: SoundscapeInput, mix: Mix) {
  mix.bed.fill(0);
  mix.tone.fill(0);
  mix.events.fill(0);
  mix.evLevel.fill(0);
  bedPanSum.fill(0);
  eventPanSum.fill(0);
  placeEar(input);

  const nightness = smoothstep(0.3, 0.8, input.night);
  const speed = clamp01(Math.abs(input.speed) / SPEED_REF);
  let nearest = 0;
  let calm = 0;
  let crickets = 0;
  let cricketPan = 0;
  let cricketWeight = 0;

  for (let index = 0; index < ZONES.length; index++) {
    const area = ZONES[index];
    const distance = Math.hypot(input.x - area.cx, input.z - area.cz);
    if (distance >= area.outer) continue;
    const presence = 1 - smoothstep(area.inner, area.outer, distance);
    if (presence <= 0.0005) continue;
    if (presence > nearest) nearest = presence;
    let weight = presence;
    if (area.side) {
      // Repère du chenal : v = x·sin(axe) − z·cos(axe), relatif au centre de l'île.
      const v = (input.x - area.cx) * Math.sin(area.side.axis) - (input.z - area.cz) * Math.cos(area.side.axis);
      const lean = v / 16 < -1 ? -1 : v / 16 > 1 ? 1 : v / 16;
      // Les deux moitiés restent audibles ; le côté où l'on se trouve domine (puissance égale).
      weight *= Math.sqrt(0.5 + area.side.sign * 0.22 * lean);
    }
    // Loin, l'île est un point ; au ponton, elle occupe tout le cadre (son plus centré).
    const width = 0.25 + 0.75 * smoothstep(area.radius * 0.4, area.radius + 16, distance);
    const pan = panToward(area.px, area.pz, width);

    for (let item = 0; item < area.beds.length; item += 3) {
      const value = weight * area.beds[item + 1] * timeFactor(area.beds[item + 2], nightness);
      if (value <= 0) continue;
      const bed = area.beds[item];
      mix.bed[bed] += value;
      bedPanSum[bed] += value * pan;
    }
    for (let item = 0; item < area.events.length; item += 3) {
      const rate = (weight * area.events[item + 1] * timeFactor(area.events[item + 2], nightness)) / 60;
      if (rate <= 0) continue;
      const kind = area.events[item];
      mix.events[kind] += rate;
      eventPanSum[kind] += rate * pan;
      if (weight > mix.evLevel[kind]) mix.evLevel[kind] = weight;
    }
    calm = Math.max(calm, presence * area.calm);
    const insects = presence * area.crickets;
    if (insects > 0.001) {
      crickets = Math.max(crickets, insects);
      cricketPan += insects * pan;
      cricketWeight += insects;
    }
  }

  for (let bed = 0; bed < BED_COUNT; bed++) {
    const level = mix.bed[bed];
    mix.pan[bed] = level > 0.0001 ? bedPanSum[bed] / level : 0;
    if (level > 1) mix.bed[bed] = 1;
  }
  for (let kind = 0; kind < EVENT_COUNT; kind++) {
    const rate = mix.events[kind];
    mix.evPan[kind] = rate > 0 ? eventPanSum[kind] / rate : 0;
  }

  // Pleine mer : le vent apparent suit la vitesse, un souffle reste même à l'arrêt.
  const sea = 1 - Math.min(1, nearest);
  mix.sea = sea;
  mix.speed = speed;
  mix.night = nightness;
  mix.bed[BED.wind] = (0.16 + 0.84 * Math.pow(speed, 1.3)) * (0.3 + 0.7 * sea) * (1 - 0.3 * nightness);
  mix.tone[BED.wind] = speed;
  mix.pan[BED.wind] = 0;

  // Claquements de l'eau sur la coque : plus fréquents et plus forts avec la vitesse ;
  // à l'arrêt (à quai), un clapotis paresseux contre le bordé.
  mix.events[EVENT.slap] = speed > 0.06 ? 0.25 + 1.15 * speed : 0.1;
  mix.evLevel[EVENT.slap] = 0.35 + 0.65 * speed;
  mix.evPan[EVENT.slap] = 0;

  // Nuit : grillons près des îles, autour des zones de végétation.
  mix.bed[BED.crickets] = nightness * crickets * 0.9;
  mix.pan[BED.crickets] = cricketWeight > 0 ? cricketPan / cricketWeight : 0;

  let phase = 1;
  if (input.phase === 'loading' || input.phase === 'intro') phase = 0;
  else if (input.phase === 'transitioning') phase = smoothstep(0.35, 0.95, input.gameTransition);
  if (input.quickView) phase = 0;
  const secret = 1 - smoothstep(16, SECRET_REACH, Math.hypot(input.x - SECRET_X, input.z - SECRET_Z));
  mix.master = phase * (1 - 0.92 * secret) * (1 - 0.8 * clamp01(input.boundary)) * (input.panelOpen ? 0.85 : 1);
  mix.rateScale = input.panelOpen ? 0.7 : 1;

  // Mer plus douce la nuit et à l'abri des ports (le clapotis prend le relais).
  const shade = Math.max(0.45, 1 - 0.32 * nightness - 0.25 * calm);
  mix.seaShade = 1 + (shade - 1) * phase;
}

/** Pour les tests : nombre de zones déclarées. */
export const ZONE_COUNT = ZONES.length;
