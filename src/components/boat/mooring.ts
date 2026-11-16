import { Vector3 } from 'three';
import {
  BOLLARD_INSET,
  BOLLARD_NECK,
  BOLLARD_SPREAD,
  DOCK_END_OFFSET,
  HOME_BERTH,
  HOME_DOCK_END,
} from '@/components/islands/docks/layout';
import { homeIsland, islandById } from '@/data/islands';
import { boatState } from '@/lib/boat-state';
import { clamp, shortestAngle, smoothstep } from '@/lib/utils/math';
import type { IslandId, Vec2, WorldPhase } from '@/types';

/**
 * Accostage et appareillage : la chorégraphie du bateau au port, hors React.
 *
 * La navigation (useBoatNavigation) amène le bateau à 1,4 m du point d'accostage puis
 * s'efface (phase « docked » : elle ne déplace plus le bateau). À partir de là, c'est ici :
 *  1. arrivée — le bateau file sur son erre le long d'une courbe douce (vitesse continue,
 *     freinage progressif, marche arrière qui bouillonne sous la poupe) et vient se ranger
 *     de flanc au bout du ponton ;
 *  2. amarrage — le patron lance l'amarre, la boucle tombe sur la bitte, le passavant
 *     bascule du ponton sur le plat-bord ; le bateau encaisse, tangue un peu, se pose ;
 *  3. appareillage — l'amarre est larguée et revient à bord, le passavant se relève, le
 *     moteur toussote trois fois ; le bateau pivote sur son arrière (jamais à travers le
 *     ponton), puis prend de la vitesse progressivement.
 *
 * Tout est lu par les effets (corde, passavant, fumée, écume, caméra, patron) à partir de
 * `mooring`, que Boat met à jour une fois par image, juste après la navigation.
 */

export type MooringPhase = 'free' | 'arriving' | 'moored' | 'leaving';
export type BerthKey = IslandId | 'home';

/** Station (x du bateau, m) où le passavant se pose : le pont de travail arrière. */
export const GANGWAY_STATION = -1.2;
/** Taquet d'amarrage arrière (repère du bateau, côté quai), voir breton/parts.ts. */
export const STERN_CLEAT: [number, number, number] = [-2.9, 0.55, 0.55];
/** Pivots d'appareillage : distance au centre du point qui reste en place quand le bateau tourne. */
const STERN_PIVOT = 2.7;
const BOW_PIVOT = 2.4;
/** Durée pendant laquelle l'appareillage reste guidé (pivot sur l'arrière, montée en vitesse). */
const LEAVE_TIME = 2.2;
/** Au-delà de ce saut d'une image à l'autre, le bateau a été replacé (accostage direct, jouet…). */
const TELEPORT = 3;

/** Durées des gestes (s). */
export const THROW_TIME = 1.15;
/** Instant du lâcher dans le geste, et durée du vol de l'amarre. */
export const THROW_RELEASE = 0.5;
export const LINE_FLIGHT = 0.62;
export const GANGWAY_SWING = 0.95;
export const CAST_OFF_FLIGHT = 0.6;

export interface Berth {
  key: BerthKey;
  home: boolean;
  /** Centre du bateau amarré et cap. */
  x: number;
  z: number;
  heading: number;
  /** Bord du bateau tourné vers le ponton (+1 tribord, −1 bâbord). */
  side: 1 | -1;
  /** Axe du ponton (monde, depuis le centre de l'île). */
  dockAngle: number;
  /** Bitte où l'amarre est capelée (monde). */
  bollard: Vector3;
  /** Un passavant relie le ponton au bateau (îles) ; au port de départ, le bateau touche le ponton. */
  gangway: boolean;
}

function berthAt(
  key: BerthKey,
  center: Vec2,
  dockAngle: number,
  reach: number,
  dockEnd: number,
  heading: number,
  gangway: boolean,
): Berth {
  const dx = Math.cos(dockAngle);
  const dz = Math.sin(dockAngle);
  // +Z du ponton dans le monde (le groupe du ponton est tourné de −angle).
  const lx = -dz;
  const lz = dx;
  const fx = Math.cos(heading);
  const fz = Math.sin(heading);
  // Avant du bateau le long de +Z du ponton (cap = angle + π/2) : tribord regarde l'île.
  const along: 1 | -1 = fx * lx + fz * lz > 0 ? 1 : -1;
  // Le passavant tombe sur le pont arrière : le centre du bateau avance d'autant le long du quai.
  const shift = gangway ? -GANGWAY_STATION : 0;
  const x = center[0] + dx * reach + fx * shift;
  const z = center[1] + dz * reach + fz * shift;
  // Amarre arrière : bitte du coin côté poupe.
  const bollardAlong = dockEnd - BOLLARD_INSET;
  const bollardAcross = -along * BOLLARD_SPREAD;
  const bollard = new Vector3(
    center[0] + dx * bollardAlong + lx * bollardAcross,
    BOLLARD_NECK,
    center[1] + dz * bollardAlong + lz * bollardAcross,
  );
  return { key, home: key === 'home', x, z, heading, side: along, dockAngle, bollard, gangway };
}

/** Poste d'une île : de flanc au bout du ponton, du côté qui demande le moins de barre. */
export function islandBerth(id: IslandId, preferHeading?: number): Berth {
  const island = islandById[id];
  const a = island.dockAngle;
  const port = a + Math.PI / 2;
  const starboard = a - Math.PI / 2;
  const heading = preferHeading !== undefined
    && Math.abs(shortestAngle(preferHeading, starboard)) < Math.abs(shortestAngle(preferHeading, port))
    ? starboard
    : port;
  return berthAt(id, island.position, a, island.radius + 4.5, island.radius + DOCK_END_OFFSET, heading, true);
}

/**
 * Poste du port de départ : de flanc contre le bout du ponton. Celui de l'intro a l'étrave
 * vers +Z du ponton ; un bateau qui revient de l'autre côté s'amarre tête-bêche.
 */
export function homeBerth(preferHeading?: number): Berth {
  const a = homeIsland.dockAngle;
  const intro = a + Math.PI / 2;
  const heading = preferHeading !== undefined && Math.abs(shortestAngle(preferHeading, intro)) > Math.PI / 2 ? a - Math.PI / 2 : intro;
  return berthAt('home', homeIsland.position, a, homeIsland.radius + HOME_BERTH, homeIsland.radius + HOME_DOCK_END, heading, false);
}

const HOME = homeBerth();

/**
 * Point d'approche du port de départ, dans l'axe du poste, du côté d'où vient le bateau :
 * il y arrive lancé dans la bonne direction et n'a plus qu'à glisser contre le ponton.
 */
export function homeApproach(): Vec2 {
  const fx = Math.cos(HOME.heading);
  const fz = Math.sin(HOME.heading);
  const dx = Math.cos(HOME.dockAngle);
  const dz = Math.sin(HOME.dockAngle);
  const ahead = (boatState.position.x - HOME.x) * fx + (boatState.position.z - HOME.z) * fz > 0 ? 1 : -1;
  return [HOME.x + ahead * fx * 6.5 + dx * 2.2, HOME.z + ahead * fz * 6.5 + dz * 2.2];
}

/** Distance du bateau au poste du port de départ. */
export function distanceHome() {
  return Math.hypot(boatState.position.x - HOME.x, boatState.position.z - HOME.z);
}

/* ------------------------------------------------------------------ état partagé */

export const mooring = {
  phase: 'free' as MooringPhase,
  berth: null as Berth | null,
  /** Instants (horloge three, s) ; -1 = pas prévu. */
  arriveAt: -1,
  /** Fin de la glissade (prévue dès l'arrivée). */
  stopAt: -1,
  throwAt: -1,
  /** L'amarre touche la bitte. */
  lineAt: -1,
  /** Début de la bascule du passavant. */
  gangwayAt: -1,
  castOffAt: -1,
  /** Fin du plan rapproché de l'accostage (la caméra révèle l'île). -1 : pas de plan rapproché. */
  revealAt: -1,
  /** Le patron fait signe à la caméra entre ces deux instants. */
  waveFrom: -1,
  waveTo: -1,
  /** Amarre capelée (ou en vol vers la bitte). */
  line: false,
  /** Passavant en service sur ce poste. */
  gangway: false,
  /** Mouvement réduit au moment de l'accostage (gestes écourtés). */
  calm: false,
  /** Effets en cours (0 → 1) : marche arrière sous la poupe, remous et cabrage du départ. */
  reverse: 0,
  wash: 0,
  lift: 0,
  /** Points monde tenus à jour par le bateau : taquet arrière côté quai, main du patron, pose du passavant. */
  cleat: new Vector3(),
  hand: new Vector3(),
  landing: new Vector3(),
  /** Impulsions de tenue à encaisser par le bateau (Boat les consomme). */
  kick: { heave: 0, pitch: 0, roll: 0 },
  /** Les trois « teuf » de la remise en route (instants). */
  putts: [-1, -1, -1],
  /** Une visite de l'atelier attend le bateau au port de départ. */
  wantHome: false,
};

/** Trajectoire de la glissade (courbe de Bézier cubique, en x/z) et sa loi horaire. */
const glide = {
  p0x: 0, p0z: 0, c0x: 0, c0z: 0, c1x: 0, c1z: 0, p1x: 0, p1z: 0,
  start: 0,
  duration: 1,
  slope: 1,
};

const last = { x: boatState.position.x, z: boatState.position.z, heading: boatState.heading, speed: 0, phase: '' as WorldPhase | '' };
const events = { gangwayLanded: false, lineTaut: false, stopped: false };

/** Loi horaire s(u) : s(0) = 0, s(1) = 1, vitesse initiale `a`, vitesse nulle à l'arrivée. */
function timing(u: number, a: number) {
  return a * u + (3 - 2 * a) * u * u + (a - 2) * u * u * u;
}

function timingRate(u: number, a: number) {
  return a + 2 * (3 - 2 * a) * u + 3 * (a - 2) * u * u;
}

function bezier(s: number, out: { x: number; z: number; tx: number; tz: number }) {
  const v = 1 - s;
  const g = glide;
  out.x = v * v * v * g.p0x + 3 * v * v * s * g.c0x + 3 * v * s * s * g.c1x + s * s * s * g.p1x;
  out.z = v * v * v * g.p0z + 3 * v * v * s * g.c0z + 3 * v * s * s * g.c1z + s * s * s * g.p1z;
  out.tx = 3 * v * v * (g.c0x - g.p0x) + 6 * v * s * (g.c1x - g.c0x) + 3 * s * s * (g.p1x - g.c1x);
  out.tz = 3 * v * v * (g.c0z - g.p0z) + 6 * v * s * (g.c1z - g.c0z) + 3 * s * s * (g.p1z - g.c1z);
  return out;
}

const sample = { x: 0, z: 0, tx: 0, tz: 0 };

/** Prépare la glissade du bateau (position, cap et vitesse actuels) jusqu'au poste. */
function planGlide(berth: Berth, time: number, calm: boolean) {
  const { position, heading } = boatState;
  const speed = Math.max(last.speed, boatState.speed, 0);
  const fx = Math.cos(heading);
  const fz = Math.sin(heading);
  const bx = Math.cos(berth.heading);
  const bz = Math.sin(berth.heading);
  const gap = Math.hypot(berth.x - position.x, berth.z - position.z);
  // Poignées : courte à l'entrée (le bateau tourne tôt, son étrave ne pique pas vers le
  // ponton), plus longue à l'arrivée (il se présente bien dans l'axe du poste).
  const lead = clamp(0.35 + speed * 0.32, 0.5, 1.4);
  const tail = clamp(gap * 0.55 + 0.9, 1.4, 3.2);
  glide.p0x = position.x;
  glide.p0z = position.z;
  glide.c0x = position.x + fx * lead;
  glide.c0z = position.z + fz * lead;
  glide.c1x = berth.x - bx * tail;
  glide.c1z = berth.z - bz * tail;
  glide.p1x = berth.x;
  glide.p1z = berth.z;
  // Longueur de la courbe (quelques échantillons suffisent).
  let length = 0;
  let px = glide.p0x;
  let pz = glide.p0z;
  for (let step = 1; step <= 10; step++) {
    bezier(step / 10, sample);
    length += Math.hypot(sample.x - px, sample.z - pz);
    px = sample.x;
    pz = sample.z;
  }
  // Durée : sur son erre, le bateau parcourt la courbe à mi-vitesse en moyenne.
  glide.duration = calm ? 1.1 : clamp(length / Math.max(speed * 0.5, 0.8), 2.5, 4.2);
  // Vitesse initiale raccordée à celle de la navigation (aucun à-coup).
  glide.slope = clamp((speed * glide.duration) / Math.max(3 * lead, 0.01), 0.25, 2.6);
  glide.start = time;
}

function scheduleMooring(berth: Berth, time: number, stopAt: number, calm: boolean, line: boolean) {
  mooring.berth = berth;
  mooring.stopAt = stopAt;
  mooring.calm = calm;
  mooring.line = line;
  mooring.gangway = berth.gangway;
  mooring.castOffAt = -1;
  events.gangwayLanded = false;
  events.lineTaut = false;
  events.stopped = false;
  if (!line) {
    mooring.throwAt = -1;
    mooring.lineAt = -1;
  } else if (calm) {
    mooring.throwAt = -1;
    mooring.lineAt = stopAt;
  } else {
    // Le patron prépare son lancer pendant le dernier mètre : l'amarre touche la bitte juste
    // après l'arrêt, le passavant suit.
    mooring.throwAt = stopAt - 0.75;
    mooring.lineAt = mooring.throwAt + THROW_RELEASE + LINE_FLIGHT;
  }
  mooring.gangwayAt = berth.gangway ? stopAt + (calm ? 0 : 0.3) : -1;
  const settled = berth.gangway
    ? mooring.gangwayAt + (calm ? 0.4 : GANGWAY_SWING + 0.25)
    : (mooring.lineAt >= 0 ? mooring.lineAt + 0.5 : stopAt + 0.3);
  mooring.revealAt = calm ? stopAt + 0.2 : settled + 0.25;
  mooring.waveFrom = calm ? -1 : settled + 0.15;
  mooring.waveTo = calm ? -1 : settled + 3.2;
}

function startArrival(berth: Berth, time: number, calm: boolean) {
  planGlide(berth, time, calm);
  if (berth.home) mooring.wantHome = false;
  mooring.phase = 'arriving';
  mooring.arriveAt = time;
  scheduleMooring(berth, time, time + glide.duration, calm, true);
}

/** Bateau déjà au poste (accostage direct par lien, fin de l'intro) : rien à jouer. */
function snapMoored(berth: Berth, time: number, line: boolean) {
  mooring.phase = 'moored';
  mooring.arriveAt = time;
  scheduleMooring(berth, time, time - 10, true, line);
  mooring.revealAt = -1;
  mooring.waveFrom = line ? time + 0.6 : -1;
  mooring.waveTo = line ? time + 3.6 : -1;
  events.gangwayLanded = true;
  events.lineTaut = true;
  events.stopped = true;
  boatState.position.set(berth.x, 0, berth.z);
  boatState.heading = berth.heading;
  boatState.speed = 0;
}

function startLeaving(time: number, calm: boolean) {
  mooring.phase = 'leaving';
  mooring.castOffAt = time;
  // L'amarre en vol ou capelée revient à bord ; trois coups de moteur pour repartir.
  const spacing = calm ? 0.2 : 0.27;
  mooring.putts[0] = time + 0.04;
  mooring.putts[1] = time + 0.04 + spacing;
  mooring.putts[2] = time + 0.04 + spacing * 2.05;
}

function free() {
  mooring.phase = 'free';
  mooring.line = false;
  mooring.gangway = false;
  mooring.revealAt = -1;
  mooring.waveFrom = -1;
  mooring.waveTo = -1;
  mooring.throwAt = -1;
}

export type MooringWorld = {
  phase: WorldPhase;
  activeIsland: IslandId | null;
  destination: IslandId | null;
  freeTarget: Vec2 | null;
  reducedMotion: boolean;
};

/**
 * Une image d'accostage / d'appareillage. Appelée par Boat juste après la navigation : peut
 * réécrire la position, le cap et la vitesse du bateau (phases arrivée, amarré, départ).
 */
export function updateMooring(time: number, dt: number, world: MooringWorld) {
  const { phase, activeIsland, destination, freeTarget, reducedMotion } = world;
  const goal = destination !== null || freeTarget !== null;
  const jumped = Math.hypot(boatState.position.x - last.x, boatState.position.z - last.z) > TELEPORT;
  const previous = last.phase;
  // Bateau déplacé d'un coup (lien direct vers une autre île, jouet lancé, île secrète) :
  // l'ancien poste ne vaut plus rien. Un nouveau poste peut être pris dans la même image.
  if (jumped && mooring.phase !== 'free') free();

  if (phase === 'loading' || phase === 'intro' || phase === 'transitioning') {
    if (mooring.phase !== 'free') free();
  } else if (phase === 'docked' && activeIsland) {
    const current = mooring.berth?.key === activeIsland && (mooring.phase === 'arriving' || mooring.phase === 'moored');
    if (!current) {
      // Vraie arrivée : la navigation vient de lâcher le bateau tout près du point d'accostage.
      if (previous === 'playing' && !jumped) startArrival(islandBerth(activeIsland, boatState.heading), time, reducedMotion);
      else snapMoored(islandBerth(activeIsland, boatState.heading), time, true);
    }
  } else if (phase === 'playing') {
    if (goal && (mooring.phase === 'arriving' || mooring.phase === 'moored')) startLeaving(time, reducedMotion);
    else if (mooring.phase === 'free' && previous === 'transitioning' && distanceHome() < 2) {
      // Fin de l'intro : le bateau flotte à son poste du port de départ (sans amarre).
      snapMoored(HOME, time, false);
    } else if (mooring.phase === 'free' && mooring.wantHome && !goal && distanceHome() < 9 && boatState.speed < 4.5 && !jumped) {
      startArrival(homeBerth(boatState.heading), time, reducedMotion);
    }
  }

  const berth = mooring.berth;
  mooring.reverse = 0;
  mooring.wash = Math.max(0, mooring.wash - dt * 0.7);
  mooring.lift = Math.max(0, mooring.lift - dt * 1.2);

  if (mooring.phase === 'arriving' && berth) {
    const u = clamp((time - glide.start) / glide.duration, 0, 1);
    const s = timing(u, glide.slope);
    bezier(s, sample);
    const rate = timingRate(u, glide.slope) / glide.duration;
    const length = Math.hypot(sample.tx, sample.tz);
    boatState.position.set(sample.x, 0, sample.z);
    if (length > 1e-4) boatState.heading = Math.atan2(sample.tz, sample.tx);
    boatState.speed = length * rate;
    // Dernier tiers : marche arrière, l'eau bouillonne vers l'avant sous la poupe.
    mooring.reverse = smoothstep(0.45, 0.7, u) * (1 - smoothstep(0.92, 1, u)) * (reducedMotion ? 0.4 : 1);
    if (u >= 1) {
      mooring.phase = 'moored';
      boatState.heading = berth.heading;
      boatState.speed = 0;
    }
  } else if (mooring.phase === 'moored' && berth) {
    // À quai : le bateau reste à son poste (la navigation est passive, ou sans cible).
    boatState.position.set(berth.x, 0, berth.z);
    boatState.heading = berth.heading;
    boatState.speed = 0;
  } else if (mooring.phase === 'leaving') {
    const since = time - mooring.castOffAt;
    if (jumped || since > LEAVE_TIME || !goal) {
      free();
    } else {
      // Montée en vitesse progressive : le bateau « s'arrache » au lieu de bondir.
      const cap = reducedMotion ? 2 + since * 14 : 0.45 + 13 * (since / LEAVE_TIME) ** 2;
      const speed = Math.min(boatState.speed, cap);
      // À petite vitesse, la barre a peu d'effet : virage plus lent, qui s'ouvre avec la vitesse.
      const maxTurn = (0.5 + speed * 0.24) * dt;
      const turn = clamp(shortestAngle(last.heading, boatState.heading), -maxTurn, maxTurn);
      const heading = last.heading + turn;
      let x = last.x + Math.cos(heading) * speed * dt;
      let z = last.z + Math.sin(heading) * speed * dt;
      if (berth && turn !== 0) {
        // Pivot sur l'extrémité côté quai : l'arrière (ou l'étrave) ne balaie jamais le ponton.
        const weight = 1 - smoothstep(0, LEAVE_TIME * 0.8, since);
        const towardDock = Math.sign(turn) === berth.side;
        const lever = towardDock ? -BOW_PIVOT : STERN_PIVOT;
        x += lever * (Math.cos(heading) - Math.cos(last.heading)) * weight;
        z += lever * (Math.sin(heading) - Math.sin(last.heading)) * weight;
      }
      boatState.position.set(x, 0, z);
      boatState.heading = heading;
      boatState.speed = speed;
      const push = 1 - smoothstep(0.2, LEAVE_TIME, since);
      mooring.wash = Math.max(mooring.wash, push * (reducedMotion ? 0.5 : 1));
      mooring.lift = Math.max(mooring.lift, smoothstep(0.25, 0.7, since) * push * (reducedMotion ? 0 : 1));
    }
  }

  // Événements d'amarrage : arrêt, amarre raidie, passavant posé (impulsions de tenue).
  if (mooring.phase === 'moored' && berth && !mooring.calm) {
    if (!events.stopped && time >= mooring.stopAt) {
      events.stopped = true;
      mooring.kick.pitch -= 0.6;
      mooring.kick.heave -= 0.35;
    }
    if (!events.lineTaut && mooring.lineAt >= 0 && time >= mooring.lineAt + 0.45) {
      events.lineTaut = true;
      mooring.kick.roll += 0.35 * berth.side;
    }
    if (berth.gangway && !events.gangwayLanded && time >= mooring.gangwayAt + GANGWAY_SWING) {
      events.gangwayLanded = true;
      mooring.kick.heave -= 0.55;
      mooring.kick.roll += 0.6 * berth.side;
    }
  }

  last.x = boatState.position.x;
  last.z = boatState.position.z;
  last.heading = boatState.heading;
  last.speed = boatState.speed;
  last.phase = phase;
}

/** Instant de la dernière arrivée prévue (pour la caméra) : vrai pendant le plan rapproché. */
export function arrivalShot(time: number) {
  return mooring.revealAt >= 0 && time < mooring.revealAt && (mooring.phase === 'arriving' || mooring.phase === 'moored');
}

/** Progression (0 → 1) de la bascule du passavant ; 0 = rangé sur le ponton. */
export function gangwayDeploy(time: number) {
  if (!mooring.gangway || mooring.gangwayAt < 0) return 0;
  if (mooring.castOffAt >= 0 && time >= mooring.castOffAt) {
    const since = time - mooring.castOffAt;
    return 1 - smoothstep(0, mooring.calm ? 0.35 : 0.8, since);
  }
  const swing = mooring.calm ? 0.35 : GANGWAY_SWING;
  return clamp((time - mooring.gangwayAt) / swing, 0, 1);
}
