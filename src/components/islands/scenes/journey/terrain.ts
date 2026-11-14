/**
 * ÎLE PARCOURS — relief sur mesure et plan du décor, sans dépendance (testable hors du
 * navigateur).
 *
 * L'île est coupée en deux par un chenal d'eau de mer que franchit un pont de pierre :
 *  - à gauche (v < 0), la BRETAGNE : lande verte assez haute (l'herbe automatique y
 *    pousse), côte de granit, crique de sable sur le chenal, butte des menhirs ;
 *  - à droite (v > 0), MARSEILLE : garrigue plus basse (sous le seuil de l'herbe
 *    automatique), falaises de calcaire, Vieux-Port creusé à l'embouchure du chenal,
 *    calanque au fond, colline de la Bonne Mère.
 *
 * Repère du chenal : u court le long du chenal (u > 0 : vers la caméra à quai, en
 * moyenne sur la journée), v le traverse (v > 0 : côté Marseille, à droite de l'écran).
 */

/** Direction de l'axe u dans le repère de l'île (radians, même convention que dockAngle). */
export const AXIS = 0.8;
const CU = Math.cos(AXIS);
const SU = Math.sin(AXIS);

export const RADIUS = 17;

export function toFrame(x: number, z: number): [number, number] {
  return [x * CU + z * SU, x * SU - z * CU];
}

export function fromFrame(u: number, v: number): [number, number] {
  return [u * CU + v * SU, u * SU - v * CU];
}

/** rotation.y d'un objet dont l'avant (+z local) doit regarder vers la direction (du, dv). */
export function yawToward(du: number, dv: number) {
  return Math.atan2(du * CU + dv * SU, du * SU - dv * CU);
}

/* ------------------------------------------------------------------ outils */

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function smooth(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Bosse douce (1 au centre, 0 au-delà du rayon). */
function bump(u: number, v: number, cu: number, cv: number, radius: number) {
  const d = Math.hypot(u - cu, v - cv) / radius;
  if (d >= 1) return 0;
  const k = 1 - d * d;
  return k * k;
}

/** Distance d'un point à une polyligne (repère u, v). */
export function polylineDistance(points: [number, number][], u: number, v: number) {
  let best = Infinity;
  for (let index = 0; index < points.length - 1; index++) {
    const [au, av] = points[index];
    const [bu, bv] = points[index + 1];
    const du = bu - au;
    const dv = bv - av;
    const t = clamp01(((u - au) * du + (v - av) * dv) / (du * du + dv * dv));
    best = Math.min(best, Math.hypot(u - (au + du * t), v - (av + dv * t)));
  }
  return best;
}

/* ------------------------------------------------------------------ chenal */

/** Ligne médiane du chenal (légère courbe en S). */
export function channelCenter(u: number) {
  return 0.45 * Math.sin(u * 0.2 + 0.7);
}

/** Demi-largeur d'eau du chenal : étroit au pont, évasé aux embouchures. */
export function channelHalfWidth(u: number) {
  return 1.75 + smooth(3, 15, Math.abs(u)) * 1.15;
}

/** Position du pont le long du chenal. */
export const BRIDGE_U = -0.6;
/** Hauteur des culées (paliers de part et d'autre du pont). */
export const LANDING = 1.3;
/** Distance du bord de l'eau à la fin du palier de chaque culée. */
export const LANDING_END = 2.3;

/** Bords d'eau du chenal au droit du pont (v). */
export function bridgeEnds() {
  const center = channelCenter(BRIDGE_U);
  const half = channelHalfWidth(BRIDGE_U);
  return { breton: center - half, provence: center + half };
}

/* ------------------------------------------------------------- Vieux-Port */

/** Bassin du Vieux-Port, côté Marseille, à l'embouchure avant du chenal. */
export const PORT = { u0: 6.6, v1: 6.4, quay: 0.82, quayWidth: 2.5 };

/** Fond du chenal et du bassin. */
export const FLOOR = -1.25;

/** Distance signée au bord du bassin (négative dans l'eau), coins arrondis. */
export function portDistance(u: number, v: number) {
  const a = PORT.u0 - u;
  const b = v - PORT.v1;
  const r = 1.2;
  if (a > -r && b > -r) return Math.hypot(Math.max(a + r, 0), Math.max(b + r, 0)) - r;
  return Math.max(a, b);
}

/* ---------------------------------------------------------------- calanque */

/** Calanque : une crique étroite qui entaille la falaise blanche, au fond à droite. */
export const CALANQUE = { headU: -6.6, headV: 10.4, mouthU: -10.4, mouthV: 17.8 };

export function calanqueDistance(u: number, v: number) {
  const ax = CALANQUE.headU;
  const ay = CALANQUE.headV;
  const dx = CALANQUE.mouthU - ax;
  const dy = CALANQUE.mouthV - ay;
  const t = clamp01(((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy));
  const px = ax + dx * t;
  const py = ay + dy * t;
  // Sinuosité légère, largeur qui s'ouvre vers la mer.
  const wiggle = Math.sin(t * 6.5 + 0.4) * 0.45 * (1 - t);
  const width = mix(0.7, 2.3, smooth(0.05, 0.8, t));
  return Math.hypot(u - px + wiggle, v - py) - width;
}

/* ------------------------------------------------------------ crique bretonne */

/** Crique de sable sur la rive bretonne du chenal, où le canot est tiré au sec. */
export const COVE = { u: 5.9, halfLength: 2.0 };

/* ------------------------------------------------------------------- côtes */

function coastRadius(angle: number, breton: boolean) {
  const base = 1
    + Math.sin(angle * 3 + 0.9) * 0.05
    + Math.sin(angle * 5 - 1.3) * 0.03;
  // Côte bretonne plus déchiquetée, côte provençale plus franche.
  const detail = breton
    ? Math.sin(angle * 11 + 2.1) * 0.03 + Math.sin(angle * 19 - 0.4) * 0.017
    : Math.sin(angle * 9 + 0.3) * 0.014;
  return RADIUS * (base + detail);
}

/** Pente sous-marine commune (haut-fond qui plonge doucement). */
function underwater(d: number, top: number) {
  return Math.max(-2.2, top + d * 0.42 - (d / RADIUS) ** 2 * 3);
}

/** Côte de granit : rochers au ras de l'eau puis talus vers la lande. */
function graniteCoast(d: number, top: number) {
  if (d < 0) return underwater(d, 0.05);
  const ledge = 0.05 + smooth(0, 0.9, d) * 0.75;
  return mix(ledge, top, smooth(0.7, 2.6, d));
}

/** Falaise calcaire : presque verticale, pied dans l'eau. */
function limestoneCliff(d: number, top: number) {
  if (d < 0) return underwater(d, -0.55);
  return mix(-0.55, top, smooth(0, 1.15, d) * 0.85 + smooth(0.3, 1.5, d) * 0.15);
}

/** Plage de sable (sous le ponton) : pente douce, petite falaise derrière. */
function beachCoast(d: number, top: number) {
  if (d < 0) return underwater(d, 0.15);
  const beach = 0.15 + smooth(0, 3.6, d) * 0.55;
  return mix(beach, top, smooth(3.4, 4.6, d));
}

/* ---------------------------------------------------------------- plateaux */

/** Butte des menhirs (Bretagne, au fond). */
export const KNOLL = { u: -9.4, v: -6.6, radius: 4.6 };
/** Colline de la Bonne Mère (Marseille, au fond). */
export const GARDE = { u: -9.8, v: 5.8, radius: 4.2 };

/** Lande bretonne : au-dessus du seuil de l'herbe automatique (plateau − 0,35 ≈ 2,55). */
export function bretonPlateau(u: number, v: number) {
  return 2.85
    + Math.sin(u * 0.45 + 1.2) * Math.cos(v * 0.38) * 0.12
    + bump(u, v, KNOLL.u, KNOLL.v, KNOLL.radius) * 1.15
    + bump(u, v, 2.5, -10, 4.5) * 0.3;
}

/** Garrigue marseillaise : sous le seuil de l'herbe automatique (pas de vert tendre). */
export function provencePlateau(u: number, v: number) {
  const base = 2.25 + Math.sin(u * 0.33 - 0.4) * Math.cos(v * 0.29 + 0.5) * 0.08;
  const hill = bump(u, v, GARDE.u, GARDE.v, GARDE.radius) + bump(u, v, GARDE.u + 2.2, GARDE.v + 1.6, 2.6) * 0.45;
  // Le piton a un sommet aplani pour la basilique.
  return base + Math.min(hill * 3.6, 3.15);
}

/* -------------------------------------------------------------- le sentier */

/**
 * Le chemin de l'histoire, étape par étape, en repère (u, v). Côté Bretagne il est
 * creusé en chemin creux (sous le seuil de l'herbe), côté Marseille il devient une rue
 * dallée qui monte dans le Panier.
 */
export const TRAIL_BRETON: [number, number][] = [
  [6.6, -2.9],
  [5.6, -4.7],
  [3.6, -6.3],
  [1.0, -6.9],
  [-1.3, -6.0],
  [-1.7, -4.4],
  [-1.1, -3.3],
  [BRIDGE_U, -2.9],
];

export const TRAIL_PROVENCE: [number, number][] = [
  [BRIDGE_U, 3.35],
  [-0.2, 4.6],
  [0.9, 6.0],
  [1.2, 7.8],
  [0.6, 9.4],
  [-1.4, 10.1],
  [-3.4, 9.8],
  [-4.6, 9.1],
];

/* ------------------------------------------------------------ relief final */

export function journeyHeight(x: number, z: number) {
  const [u, v] = toFrame(x, z);
  const r = Math.hypot(x, z);
  const angle = Math.atan2(z, x);
  const center = channelCenter(u);
  const dv = v - center;
  const breton = dv < 0;
  const top = breton ? bretonPlateau(u, v) : provencePlateau(u, v);

  // Côte extérieure.
  const dCoast = coastRadius(angle, breton) - r;
  let height: number;
  if (breton) {
    height = graniteCoast(dCoast, top);
  } else {
    // Plage sous le ponton (dockAngle -0.4), falaise blanche partout ailleurs.
    const gap = Math.abs(Math.atan2(Math.sin(angle + 0.4), Math.cos(angle + 0.4)));
    const beachy = 1 - smooth(0.2, 0.42, gap);
    height = mix(limestoneCliff(dCoast, top), beachCoast(dCoast, top), beachy);
  }

  // Chenal : berges raides, sauf autour du pont (culée, palier puis rampe douce) et
  // dans la crique bretonne (plage).
  const dChan = Math.abs(dv) - channelHalfWidth(u);
  let bank: number;
  if (dChan < 0) {
    bank = Math.max(FLOOR, 0.1 + dChan * 1.1);
  } else {
    const steep = mix(0.1, top, smooth(0, breton ? 1.9 : 1.3, dChan));
    const landing = dChan < 0.9
      ? mix(0.1, LANDING, smooth(0, 0.9, dChan))
      : dChan < LANDING_END
        ? LANDING + (dChan - 0.9) * 0.05
        : mix(LANDING + 0.07, top, smooth(LANDING_END, LANDING_END + 4.4, dChan));
    bank = mix(steep, landing, 1 - smooth(2.2, 4.6, Math.abs(u - BRIDGE_U)));
    if (breton) {
      const sand = mix(0.12 + smooth(0, 3, dChan) * 0.72, top, smooth(2.9, 4.5, dChan));
      bank = mix(bank, sand, 1 - smooth(COVE.halfLength - 0.8, COVE.halfLength + 0.8, Math.abs(u - COVE.u)));
    }
  }
  height = Math.min(height, bank);

  if (breton) {
    // Chemin creux : la lande s'abaisse doucement le long du sentier.
    if (height > 2) {
      const dTrail = polylineDistance(TRAIL_BRETON, u, v);
      height -= (1 - smooth(0.3, 0.85, dTrail)) * Math.min(0.38, height - 2.1);
    }
  } else {
    // Vieux-Port : bassin à quai, promenade plate, puis la ville qui monte.
    const dPort = portDistance(u, v);
    let port: number;
    if (dPort < 0) port = mix(PORT.quay, FLOOR, smooth(-0.05, -0.6, dPort));
    else if (dPort < PORT.quayWidth) port = PORT.quay;
    else port = mix(PORT.quay, top, smooth(PORT.quayWidth, PORT.quayWidth + 4.8, dPort));
    height = Math.min(height, port);
    // Calanque.
    const dCal = calanqueDistance(u, v);
    const calanque = dCal < 0
      ? mix(-0.45, -1.3, smooth(0, -0.9, dCal))
      : mix(-0.45, top, smooth(0, 0.8, dCal) * 0.9 + smooth(0.2, 1.4, dCal) * 0.1);
    height = Math.min(height, calanque);
  }
  return height;
}

/* ------------------------------------------------------------ les étapes */

/** Emplacement de chaque étape (repère u, v), dans l'ordre du voyage. */
export const STEP_SPOTS: Record<string, [number, number]> = {
  origines: [5.0, -3.15],
  apprentissage: [-0.2, -7.6],
  marseille: [BRIDGE_U + 0.52, 0.25],
  feeder: [1.2, 10.7],
  horizon: [-4.9, 9.05],
};

/** Grandes emprises du décor (u, v, rayon) : la végétation les évite. */
export const COTTAGE = { u: -3.7, v: -8.7 };
export const TECH = { u: -1.6, v: 12.7 };
