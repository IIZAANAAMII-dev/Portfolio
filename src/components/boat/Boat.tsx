'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, InstancedMesh, MeshBasicMaterial, Object3D, PointLight, Vector3 } from 'three';
import { introSfx } from '@/components/intro/sfx';
import { ambience } from '@/lib/audio/ambience';
import { boatState } from '@/lib/boat-state';
import { INTRO_DURATION, INTRO_SPLASH_AT } from '@/lib/cinematic';
import { ecologyState } from '@/lib/ecology';
import { skyState } from '@/lib/sky';
import { useWorld } from '@/lib/store';
import { waveHeight } from '@/lib/waves';
import { clamp, damp, hash, shortestAngle } from '@/lib/utils/math';
import { MAX_SPEED, useBoatNavigation } from '@/hooks/useBoatNavigation';
import { BowSpray, Splash, sprayState, triggerSplash } from './Splash';
import { StackSmoke } from './Smoke';
import { Wake } from './Wake';
import { BOAT_FRAME, BoatModel } from './BoatModel';
import { GANGWAY_STATION, mooring, STERN_CLEAT, updateMooring } from './mooring';
import { MooringLine } from './MooringLine';
import { boatMotion } from './motion';

const MAX_VISUAL_SPEED = MAX_SPEED;
/** Hauteur d'où tombe le bateau au clic d'intro (au-dessus du cadre de la caméra). */
const DROP_HEIGHT = 13;
const EXHAUST = [...BOAT_FRAME.exhaust] as [number, number, number];
const LAMP = [...BOAT_FRAME.lamp] as [number, number, number];

/**
 * Chute d'intro : le bateau tombe du ciel (gravité constante), s'étire pendant la chute,
 * s'écrase à l'impact puis rebondit, amorti, comme un jouet qu'on pose dans l'eau.
 * Renvoie le décalage vertical, l'écrasement et l'inclinaison à appliquer.
 */
function dropPose(seconds: number) {
  const impact = INTRO_SPLASH_AT * INTRO_DURATION;
  if (seconds < impact) {
    const f = seconds / impact;
    return { y: DROP_HEIGHT * (1 - f * f), squash: -0.1 * f * f, pitch: -0.16 * f, roll: 0.06 * f };
  }
  const s = seconds - impact;
  const decay = Math.exp(-s * 3.1);
  return {
    // Le bateau s'enfonce d'abord (vitesse d'arrivée), puis remonte et oscille.
    y: -decay * Math.sin(s * 8.5) * 1.15,
    squash: 0.26 * Math.exp(-s * 6.5) * Math.cos(s * 15),
    pitch: decay * Math.sin(s * 6.2 + 0.4) * 0.13,
    roll: decay * Math.sin(s * 5.1 + 1.3) * 0.1,
  };
}

const BOW_FOAM = 16;
const PROP_FOAM = 10;
/** Tableau arrière à la flottaison (repère du bateau) : le remous de l'hélice en sort. */
const TRANSOM_X = -3.08;
const foamDummy = new Object3D();
/** Plat-bord au droit du pont arrière (repère du bateau) : le passavant s'y pose. */
const RAIL_LANDING = new Vector3(GANGWAY_STATION, 0.93, 1.0);
/** Écume : blanche le jour, éteinte la nuit (matériau non éclairé), bleu-vert si le plancton luit. */
const FOAM_DAY = new Color('#effcf7');
const FOAM_NIGHT = new Color('#5f8c92');
const FOAM_BIO = new Color('#46f2dc');

/**
 * Écume au ras de l'eau, en coordonnées monde (elle reste sur la houle quand la coque tangue) :
 * moustaches d'étrave qui glissent le long des flancs en route, et remous de l'hélice derrière
 * le tableau — un bouillonnement paisible au ralenti, un panache brassé quand on met les gaz.
 * Chaque flocon naît et meurt en douceur (taille nulle aux deux bouts du cycle) et les cycles
 * sont intégrés (phase += vitesse × dt) : changer d'allure ne fait jamais sauter l'écume.
 */
function HullFoam() {
  const mesh = useRef<InstancedMesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const churn = useRef(0);
  const phases = useRef({ bow: 0, prop: 0 });
  useFrame((state, delta) => {
    const target = mesh.current;
    if (!target) return;
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const { phase } = useWorld.getState();
    // Le moteur tourne dès que le bateau a touché l'eau (comme l'hélice et la fumée).
    const running = phase === 'playing' || phase === 'docked' || (phase === 'transitioning' && boatMotion.splashAt >= 0);
    const throttle = boatMotion.throttle;
    const strength = clamp((boatState.speed - 0.5) / 7.5, 0, 1);
    churn.current = damp(churn.current, running ? 0.3 + throttle * 0.7 : 0, 2.5, dt);
    // Accostage : marche arrière (l'eau bouillonne vers l'avant) ; départ : l'hélice brasse fort.
    const reverse = mooring.reverse;
    const wash = mooring.wash;
    const prop = Math.max(churn.current, reverse * 0.95, wash * 0.9) * (1 - ecologyState.leviathanAttack);
    const cycle = phases.current;
    cycle.bow = (cycle.bow + dt * (0.55 + strength * 0.65)) % 1;
    cycle.prop = (cycle.prop + dt * (0.5 + prop * 0.8)) % 1;
    target.visible = strength > 0.025 || prop > 0.02;
    if (!target.visible) return;
    material.current?.color.copy(FOAM_DAY).lerp(FOAM_NIGHT, skyState.dayNight).lerp(FOAM_BIO, ecologyState.plankton * 0.75);
    const { position, heading } = boatState;
    const forwardX = Math.cos(heading);
    const forwardZ = Math.sin(heading);
    // (x, z) dans le repère du bateau ; tribord (+Z) est en (−sin, cos) dans le monde.
    const place = (index: number, x: number, z: number, size: number, flat: number) => {
      const worldX = position.x + forwardX * x - forwardZ * z;
      const worldZ = position.z + forwardZ * x + forwardX * z;
      foamDummy.position.set(worldX, waveHeight(worldX, worldZ, time) + 0.07 + Math.sin(time * 2 + index) * 0.025, worldZ);
      foamDummy.rotation.set(0, -heading, 0);
      foamDummy.scale.set(size * 1.8, size * flat, size);
      foamDummy.updateMatrix();
      target.setMatrixAt(index, foamDummy.matrix);
    };
    const bow = Math.min(strength * 6, 1);
    for (let index = 0; index < BOW_FOAM; index++) {
      const life = (cycle.bow + index / BOW_FOAM) % 1;
      const side = index % 2 === 0 ? -1 : 1;
      const envelope = Math.min(life * 6, 1) * Math.sqrt(1 - life);
      place(
        index,
        BOAT_FRAME.bow * 0.82 - life * (BOAT_FRAME.bow + BOAT_FRAME.stern) * 0.78,
        side * (BOAT_FRAME.halfBeam * (0.55 + Math.min(life * 3, 1) * 0.45) + life * 0.4),
        (0.08 + life * 0.18) * (0.45 + strength) * bow * envelope * (0.8 + hash(index * 3.3) * 0.4),
        0.32,
      );
    }
    for (let index = 0; index < PROP_FOAM; index++) {
      const seed = hash(index * 7.31);
      const life = (cycle.prop + index / PROP_FOAM + seed * 0.07) % 1;
      const envelope = Math.min(life * 5, 1) * Math.pow(1 - life, 0.7);
      // En avant : panache derrière le tableau. En arrière : bouillon qui remonte les flancs.
      const ahead = TRANSOM_X - 0.15 - life * (0.55 + throttle * 3.4 + wash * 2.4);
      const astern = TRANSOM_X + 0.15 + life * (0.7 + reverse * 1.5);
      const across = (seed - 0.5) * (0.3 + life * (0.7 + throttle * 1.4 + wash * 1.2));
      const flank = (seed < 0.5 ? -1 : 1) * (0.45 + life * 0.9) * (0.6 + seed * 0.4);
      place(
        BOW_FOAM + index,
        ahead + (astern - ahead) * reverse,
        across + (flank - across) * reverse + Math.sin(time * 2.6 + index * 1.7) * 0.05,
        (0.12 + life * (0.18 + throttle * 0.24 + wash * 0.14)) * prop * envelope,
        0.28,
      );
    }
    target.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, BOW_FOAM + PROP_FOAM]}
      renderOrder={6}
      frustumCulled={false}
      raycast={() => null}
      visible={false}
    >
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial ref={material} color="#effcf7" transparent opacity={0.58} depthWrite={false} />
    </instancedMesh>
  );
}

export function Boat() {
  const group = useRef<Group>(null);
  const rocker = useRef<Group>(null);
  const drop = useRef<Group>(null);
  const stackTip = useRef<Object3D>(null);
  const boatLight = useRef<PointLight>(null);
  const splashed = useRef(false);
  const engineClock = useRef(0);
  // Mesures du mouvement et ressort du choc (tout hors React, lu à chaque image).
  const previous = useRef({ heading: boatState.heading, speed: boatState.speed, collision: 0, phase: '', putt: 0 });
  const attitude = useRef({ pitch: 0, roll: 0, yaw: 0, bump: 0, bumpVelocity: 0 });
  /** Tenue à l'amarrage : pilonnement, tangage et roulis amortis (arrêt, amarre, passavant). */
  const settle = useRef({ heave: 0, heaveV: 0, pitch: 0, pitchV: 0, roll: 0, rollV: 0 });
  /** Hauteur de flottaison lissée (sans la tenue, qui s'y ajoute). */
  const float = useRef(0);
  const quality = useWorld((state) => state.quality);

  useBoatNavigation();

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    const world = useWorld.getState();
    const { phase, gameTransition, reducedMotion } = world;
    // Accostage / appareillage : peut réécrire la position, le cap et la vitesse du bateau.
    updateMooring(time, dt, world);
    const { position, heading, speed } = boatState;
    // Avant le clic, il n'y a pas encore de bateau : il tombe dans l'anneau au départ.
    const waiting = phase === 'loading' || phase === 'intro';
    const dropping = phase === 'transitioning' && gameTransition * INTRO_DURATION < INTRO_SPLASH_AT * INTRO_DURATION + 2.2;
    const pose = dropping ? dropPose(gameTransition * INTRO_DURATION) : null;
    const last = previous.current;
    const body = attitude.current;

    if (group.current) group.current.visible = !waiting;
    if (waiting) boatMotion.splashAt = -1;
    if (phase === 'transitioning' && !splashed.current && gameTransition >= INTRO_SPLASH_AT) {
      splashed.current = true;
      boatMotion.splashAt = time;
      triggerSplash(time, position.x, position.z, 1);
      ambience.splash();
    }

    engineClock.current += dt;
    if (engineClock.current > 0.12) {
      engineClock.current = 0;
      const running = phase === 'playing' || phase === 'docked';
      ambience.setEngine(running ? Math.min(speed / MAX_VISUAL_SPEED, 1) : 0);
    }

    if (boatLight.current) {
      const silhouetteLight = Math.max(skyState.dayNight, ecologyState.stormCover * 0.52);
      boatLight.current.intensity = damp(boatLight.current.intensity, silhouetteLight * 18, 2, dt);
    }

    // Mouvement mesuré : lacet, accélération, barre. Le modèle, le patron et la fumée le lisent.
    if (dt > 0) {
      const turn = shortestAngle(last.heading, heading) / dt;
      const accel = (speed - last.speed) / dt;
      boatMotion.turn = damp(boatMotion.turn, clamp(turn, -2.5, 2.5), 5, dt);
      boatMotion.accel = damp(boatMotion.accel, clamp(accel, -24, 24), 4, dt);
      boatMotion.throttle = clamp(speed / MAX_VISUAL_SPEED, 0, 1);
      boatMotion.steer = damp(boatMotion.steer, clamp(boatMotion.turn * 1.6, -0.55, 0.55), 3, dt);
    }
    last.heading = heading;
    last.speed = speed;
    // Événements : accostage (le patron salue), choc contre une côte (sursaut, gerbe d'embruns).
    if (phase === 'docked' && last.phase !== 'docked') boatMotion.dockedAt = time;
    last.phase = phase;
    if (boatState.collision > last.collision + 0.05) {
      body.bumpVelocity += boatState.collision * (reducedMotion ? 1.1 : 2.6);
      boatMotion.bumpAt = time;
      sprayState.burst = Math.max(sprayState.burst, boatState.collision);
    }
    last.collision = boatState.collision;
    // Ressort amorti : un petit cabrage qui s'éteint en deux ou trois oscillations.
    body.bumpVelocity += (-body.bump * 95 - body.bumpVelocity * 7.5) * dt;
    body.bump += body.bumpVelocity * dt;

    // Remise en route : trois « teuf », l'avant se soulève et la cheminée crache à chacun.
    let putt = -1;
    mooring.putts.forEach((at, index) => {
      if (at >= 0 && time >= at && time < at + 0.14) putt = index;
    });
    if (putt >= 0) boatMotion.accel = Math.max(boatMotion.accel, 13 - putt * 2);
    const puttKey = putt >= 0 ? mooring.putts[putt] : last.putt;
    if (putt >= 0 && puttKey !== last.putt) introSfx.cough(0.5 + putt * 0.12);
    last.putt = puttKey;

    // Tenue à l'amarrage : impulsions (arrêt, amarre raidie, passavant posé) dans trois ressorts.
    const hold = settle.current;
    const kick = mooring.kick;
    const give = reducedMotion ? 0.3 : 1;
    hold.heaveV += kick.heave * 0.3 * give;
    hold.pitchV += kick.pitch * 0.35 * give;
    hold.rollV += kick.roll * 0.3 * give;
    kick.heave = 0;
    kick.pitch = 0;
    kick.roll = 0;
    hold.heaveV += (-hold.heave * 42 - hold.heaveV * 4.2) * dt;
    hold.heave += hold.heaveV * dt;
    hold.pitchV += (-hold.pitch * 30 - hold.pitchV * 3.4) * dt;
    hold.pitch += hold.pitchV * dt;
    hold.rollV += (-hold.roll * 26 - hold.rollV * 3.2) * dt;
    hold.roll += hold.rollV * dt;

    if (group.current) {
      const y = waveHeight(position.x, position.z, time);
      const drift = (Math.sin(time * 0.74) * 0.16
        + Math.sin(time * 1.3 + 1.1) * 0.07
        + Math.sin(time * 2.1 + 2.5) * 0.03) * (reducedMotion ? 0.5 : 1);
      const swallowed = ecologyState.leviathanAttack;
      const heave = y + drift
        + Math.sin(time * 1.35) * Math.min(speed / MAX_VISUAL_SPEED, 1) * 0.055
        + Math.sin(time * 2.35 + position.x * 0.08) * ecologyState.stormWaves * 0.12;
      group.current.position.x = position.x;
      // Pendant la chute, la position est imposée : un lissage la ferait traîner.
      float.current = pose ? heave + pose.y : damp(float.current, heave - swallowed * 5.4, 8, dt);
      group.current.position.y = float.current + (pose ? 0 : hold.heave);
      group.current.position.z = position.z;
      group.current.rotation.y = -heading;
      const scale = damp(group.current.scale.x, 1 - swallowed * 0.42, 6, dt);
      group.current.scale.setScalar(scale);
    }

    if (drop.current) {
      const squash = (pose?.squash ?? 0) + body.bump * 0.06;
      drop.current.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
      drop.current.rotation.set(pose?.roll ?? 0, 0, pose?.pitch ?? 0);
      drop.current.position.y = body.bump * 0.08;
    }

    if (rocker.current) {
      const sampleDistance = 2.45;
      const ahead = waveHeight(
        position.x + Math.cos(heading) * sampleDistance,
        position.z + Math.sin(heading) * sampleDistance,
        time,
      );
      const behind = waveHeight(
        position.x - Math.cos(heading) * sampleDistance,
        position.z - Math.sin(heading) * sampleDistance,
        time,
      );
      // Tribord (+Z du bateau) est en (−sin, cos) dans le monde : rotation.y = −cap.
      const starboard = waveHeight(
        position.x - Math.sin(heading) * 1.05,
        position.z + Math.cos(heading) * 1.05,
        time,
      );
      const port = waveHeight(
        position.x + Math.sin(heading) * 1.05,
        position.z - Math.cos(heading) * 1.05,
        time,
      );
      const damping = 1 - Math.min(speed / 14, 0.5);
      const motion = reducedMotion ? 0.35 : 1;
      const throttle = boatMotion.throttle;
      // Assiette : l'avant se lève quand le moteur pousse, pique au freinage, et le bateau
      // déjauge un peu en route. Gîte : il se couche dans les virages, d'autant plus qu'il va vite.
      const surge = clamp(boatMotion.accel * 0.0055, -0.06, 0.075) * motion;
      const lean = clamp(boatMotion.turn * throttle * 0.2, -0.12, 0.12) * motion;
      // Départ : l'avant se cabre en prenant de la vitesse ; arrivée : il s'assoit quand on réduit.
      const trim = mooring.lift * 0.05 * motion - mooring.reverse * 0.018 * motion;
      body.pitch = damp(
        body.pitch,
        (ahead - behind) * 0.34 * damping
          + Math.sin(time * 1.13) * ecologyState.stormWind * 0.055
          + ecologyState.leviathanAttack * 0.72
          + surge + throttle * 0.028 + trim,
        4,
        dt,
      );
      body.roll = damp(
        body.roll,
        (port - starboard) * 0.52 * damping + boatState.collision * 0.08
          + Math.sin(time * 0.83 + 1.2) * ecologyState.stormWind * 0.075
          - ecologyState.leviathanAttack * 0.38
          + lean,
        3,
        dt,
      );
      // Au mouillage, il évite doucement sur son amarre ; en virage, l'arrière dérape un peu.
      body.yaw = damp(
        body.yaw,
        Math.sin(time * 0.37) * 0.022 * (1 - throttle) * motion - boatMotion.turn * throttle * 0.05 * motion,
        2,
        dt,
      );
      rocker.current.rotation.set(
        body.roll + body.bump * 0.18 + hold.roll,
        body.yaw + body.bump * 0.05,
        body.pitch + body.bump * 0.42 + hold.pitch,
      );
      boatMotion.roll = rocker.current.rotation.x;
    }

    // Points d'amarrage dans le monde (corde, passavant) : taquet arrière et plat-bord côté quai.
    if (drop.current && mooring.phase !== 'free') {
      const side = mooring.berth?.side ?? 1;
      drop.current.updateWorldMatrix(true, false);
      drop.current.localToWorld(mooring.cleat.set(STERN_CLEAT[0], STERN_CLEAT[1], STERN_CLEAT[2] * side));
      drop.current.localToWorld(mooring.landing.copy(RAIL_LANDING).setZ(RAIL_LANDING.z * side));
    }
  });

  return (
    <>
      <group ref={group}>
        <group ref={rocker}>
          {quality !== 'low' && (
            <pointLight
              ref={boatLight}
              position={LAMP}
              color="#fff4e6"
              intensity={0}
              distance={22}
              decay={1.8}
            />
          )}
          <group ref={drop}>
            <BoatModel />
            <object3D ref={stackTip} position={EXHAUST} />
          </group>
        </group>
      </group>
      <MooringLine />
      <HullFoam />
      <StackSmoke anchor={stackTip} />
      <BowSpray />
      <Wake />
      <Splash />
    </>
  );
}
