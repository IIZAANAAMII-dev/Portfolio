/**
 * Politique du régulateur graphique, sans React ni three : une fonction pure qui reçoit le
 * bilan d'une fenêtre d'images (médiane et 90e centile des temps d'image) et rend une
 * décision. Testable hors navigateur (simulation de scénarios : appareil faible, chauffe,
 * palier trop ambitieux…). Le composant PerformanceGovernor l'applique.
 *
 *  - Ordre des leviers : la résolution d'abord (par grands pas, jusqu'au plancher du palier),
 *    puis le palier. Effondrement (médiane très lente) : palier tout de suite.
 *  - Montée lente : une longue période d'images parfaites (16 s sur ordinateur, 40 s sur
 *    téléphone), la résolution remonte avant le palier, jamais au-delà du plafond ; pendant
 *    l'essai, un téléphone est jugé comme un ordinateur (il doit rester fluide).
 *  - Pas d'oscillation : un palier essayé puis quitté dans les 30 s est quitté aussitôt (sans
 *    passer par la résolution) et bloqué (3 min, puis pour la visite). Un palier à cadence
 *    plafonnée (« Très léger ») ne se quitte qu'après 3 min sans faute, une seule fois.
 *  - Chauffe : une baisse après au moins 2 min à un palier tenu sans difficulté (1 min
 *    cumulée) est lue comme de la chauffe : plus aucune montée pendant 5 min.
 *  - Choix manuel : le palier ne bouge plus ; seule la résolution baisse, en cas
 *    d'effondrement durable, puis remonte quand la marge revient.
 */

export type PolicyTier = 'minimal' | 'low' | 'medium' | 'high';

const ORDER: readonly PolicyTier[] = ['minimal', 'low', 'medium', 'high'];
const EPSILON = 0.005;
export const PROBATION_MS = 30_000;
export const THERMAL_MS = 5 * 60_000;
export const STABLE_FOR_THERMAL_MS = 120_000;
/** Fenêtres sans difficulté (2,5 s chacune) qu'il faut avoir vues à un palier pour parler de chauffe. */
const STEADY_WINDOWS_FOR_THERMAL = 24;
/** Quitter un palier à cadence plafonnée : il tenait sa cadence, rien ne dit qu'il a de la marge. */
const CAPPED_PATIENCE_MS = 180_000;

function rank(tier: PolicyTier) {
  return ORDER.indexOf(tier);
}

function neighbour(tier: PolicyTier, step: number): PolicyTier {
  return ORDER[Math.min(ORDER.length - 1, Math.max(0, rank(tier) + step))];
}

export interface PolicyConfig {
  mobile: boolean;
  /** Mode automatique (sinon choix manuel : le palier est respecté). */
  auto: boolean;
  /** Plafond de l'appareil en automatique. */
  ceiling: PolicyTier;
  /** Palier le plus léger que le régulateur peut choisir seul. */
  lowest: PolicyTier;
}

export interface PolicyContext {
  tier: PolicyTier;
  /** Cadence plafonnée du palier (images/s, 0 = libre). */
  cap: number;
  dpr: number;
  dprCeiling: number;
  dprFloor: number;
}

export interface WindowStats {
  /** Temps d'image médian et 90e centile (ms). */
  p50: number;
  p90: number;
  /** Durée de la fenêtre (ms). */
  span: number;
}

export interface PolicyState {
  badStreak: number;
  severeStreak: number;
  greatMs: number;
  lastDprChange: number;
  tierSince: number;
  /** Fenêtres « correctes » ou « parfaites » vues depuis l'arrivée au palier. */
  steadyAtTier: number;
  probation: { tier: PolicyTier; until: number; fromCapped: boolean } | null;
  blocked: Map<PolicyTier, { until: number; failures: number }>;
  thermalUntil: number;
}

export type PolicyAction =
  | { type: 'none' }
  | { type: 'dpr'; value: number }
  | { type: 'tier'; tier: PolicyTier };

export function createPolicyState(now: number): PolicyState {
  return {
    badStreak: 0,
    severeStreak: 0,
    greatMs: 0,
    lastDprChange: -Infinity,
    tierSince: now,
    steadyAtTier: 0,
    probation: null,
    blocked: new Map(),
    thermalUntil: 0,
  };
}

/** Seuils (ms) d'une fenêtre : ordinateur 60 i/s visés, téléphone 30 i/s acceptés. */
export function thresholds(mobile: boolean, cap: number) {
  if (cap > 0) {
    const frame = 1000 / cap;
    return { great: frame + 2.5, bad: frame * 1.35, severe: frame * 2.1 };
  }
  return mobile ? { great: 18.5, bad: 36, severe: 55 } : { great: 18.5, bad: 26, severe: 40 };
}

/** Le palier a changé (par le régulateur ou par le joueur) : nouveau départ. */
export function onTierChanged(state: PolicyState, now: number) {
  state.tierSince = now;
  state.steadyAtTier = 0;
  state.badStreak = 0;
  state.severeStreak = 0;
  state.greatMs = 0;
}

const NONE: PolicyAction = { type: 'none' };

export function decide(
  state: PolicyState,
  config: PolicyConfig,
  context: PolicyContext,
  stats: WindowStats,
  now: number,
): PolicyAction {
  const { tier, dpr, dprCeiling: ceiling, dprFloor: floor } = context;
  const inProbation = Boolean(state.probation && state.probation.tier === tier && now < state.probation.until);
  // Un téléphone qui essaie un palier plus riche doit y rester fluide (seuils d'ordinateur) :
  // gagner du détail pour tomber à 30 images/s n'est pas un progrès.
  const limits = thresholds(config.mobile && !inProbation, context.cap);
  const verdict = stats.p50 > limits.severe ? 'severe' : stats.p90 > limits.bad ? 'bad' : stats.p90 <= limits.great ? 'great' : 'ok';
  const step = Math.max(0.08, (ceiling - floor) / 2);
  if (state.thermalUntil > 0 && now > state.thermalUntil) state.thermalUntil = 0;

  // Longtemps parfait à ce palier, puis plus lent : l'appareil chauffe.
  const markThermal = () => {
    if (now - state.tierSince > STABLE_FOR_THERMAL_MS && state.steadyAtTier >= STEADY_WINDOWS_FOR_THERMAL) {
      state.thermalUntil = now + THERMAL_MS;
    }
  };
  const lowerDpr = (value: number): PolicyAction => {
    markThermal();
    state.lastDprChange = now;
    state.badStreak = 0;
    state.severeStreak = 0;
    state.greatMs = 0;
    return { type: 'dpr', value: Math.max(floor, value) };
  };
  const lowerTier = (): PolicyAction | null => {
    const next = neighbour(tier, -1);
    if (next === tier || rank(next) < rank(config.lowest)) return null;
    if (inProbation) {
      // Palier essayé puis quitté aussitôt : bloqué (3 min, puis pour la visite ; d'emblée
      // pour la visite s'il venait d'un palier plafonné).
      const entry = state.blocked.get(tier) ?? { until: 0, failures: 0 };
      entry.failures += state.probation?.fromCapped ? 2 : 1;
      entry.until = entry.failures >= 2 ? Infinity : now + 3 * 60_000;
      state.blocked.set(tier, entry);
    } else {
      markThermal();
    }
    state.probation = null;
    onTierChanged(state, now);
    return { type: 'tier', tier: next };
  };

  if (verdict === 'severe') {
    state.severeStreak += 1;
    state.badStreak += 1;
    state.greatMs = 0;
    if (config.auto) return lowerTier() ?? (dpr > floor + EPSILON ? lowerDpr(floor) : NONE);
    // Choix manuel : le palier est respecté, la résolution baisse en dernier recours.
    if (state.severeStreak >= 2 && dpr > floor + EPSILON) return lowerDpr(dpr - step);
    return NONE;
  }
  state.severeStreak = 0;

  if (verdict === 'bad') {
    state.badStreak += 1;
    state.greatMs = 0;
    if (!config.auto || state.badStreak < 2) return NONE;
    // Essai d'un palier qui échoue : retour immédiat, la résolution n'y changerait rien.
    if (inProbation) return lowerTier() ?? NONE;
    if (dpr > floor + EPSILON) return now - state.lastDprChange > 4000 ? lowerDpr(dpr - step) : NONE;
    return lowerTier() ?? NONE;
  }

  state.steadyAtTier += 1;
  if (verdict === 'ok') {
    state.badStreak = Math.max(0, state.badStreak - 1);
    state.greatMs = Math.max(0, state.greatMs - stats.span * 0.5);
    return NONE;
  }

  // Images parfaites : on accumule, puis on remonte lentement (résolution d'abord).
  state.badStreak = 0;
  state.greatMs += stats.span;
  const patience = !config.auto ? 20_000 : context.cap > 0 ? CAPPED_PATIENCE_MS : config.mobile ? 40_000 : 16_000;
  if (state.greatMs < patience) return NONE;
  state.greatMs = 0;
  if (dpr < ceiling - EPSILON) {
    state.lastDprChange = now;
    return { type: 'dpr', value: Math.min(ceiling, dpr + step) };
  }
  if (!config.auto || state.thermalUntil > now) return NONE;
  const next = neighbour(tier, 1);
  if (next === tier || rank(next) > rank(config.ceiling)) return NONE;
  const blocked = state.blocked.get(next);
  if (blocked && now < blocked.until) return NONE;
  state.probation = { tier: next, until: now + PROBATION_MS, fromCapped: context.cap > 0 };
  onTierChanged(state, now);
  return { type: 'tier', tier: next };
}
