'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AmbientLight, Color, DirectionalLight, HemisphereLight, PointLight } from 'three';
import { isNightTime, skyState, updateSky } from '@/lib/sky';
import { ecologyState, updateEcology } from '@/lib/ecology';
import { boatState } from '@/lib/boat-state';
import { INTRO_DURATION, introLightStrength } from '@/lib/cinematic';
import { ambience } from '@/lib/audio/ambience';
import { cloudClock } from '@/lib/materials/cloud-shadow';
import { QUALITY_LEVELS } from '@/lib/quality';
import { useWorld } from '@/lib/store';
import { preview } from '@/lib/preview';
import { damp, smoothstep } from '@/lib/utils/math';
import { dawnPresence } from './sky/dawn';
import { lapseAt, NATURAL_RATE, planLapse, raceClouds, timeLapse, type Lapse } from './sky/time-lapse';

/** Carillon de l'avance rapide (son activé) : il descend vers la nuit, monte vers le matin. */
const DUSK_CHIME = [1319, 1047, 880, 659, 523];
const DAWN_CHIME = [523, 659, 784, 1047, 1319];

/**
 * Les ombres de nuages filent avec l'avance rapide. NightGlow écrit leur horloge à chaque
 * image (temps écoulé) ; ce composant est monté une image APRÈS lui, son callback passe donc
 * derrière le sien (même priorité, abonnement plus tardif) et y ajoute l'avance accumulée.
 */
function CloudRace() {
  useFrame((state) => {
    if (timeLapse.cloudLead > 0) cloudClock.value = state.clock.elapsedTime + timeLapse.cloudLead;
  });
  return null;
}

/*
 * Étalonnage « jouet peint » : lumière directe chaude, lumière du ciel lavande (les ombres
 * virent au violet au lieu de griser), rebond turquoise de la mer sous les objets. À
 * l'heure dorée, le soleil passe au corail et le ciel au mauve.
 */
const DAY_SUN_COLOR = new Color('#ffe8c6');
const GOLDEN_SUN_COLOR = new Color('#ff9466');
const NIGHT_SUN_COLOR = new Color('#a8c8dd');
const DAY_SKY_COLOR = new Color('#c9cfff');
const GOLDEN_SKY_COLOR = new Color('#d3b1ec');
const NIGHT_SKY_COLOR = new Color('#2a2f52');
const DAY_GROUND_COLOR = new Color('#3f7276');
const NIGHT_GROUND_COLOR = new Color('#1a2a3a');
const DAY_AMBIENT = new Color('#a3a6e4');
const GOLDEN_AMBIENT = new Color('#b59ad8');
const NIGHT_AMBIENT = new Color('#2c3155');
/** Aube de la cinématique d'ouverture : soleil doré, ciel rosé, ambiance lilas. */
const DAWN_SUN_COLOR = new Color('#ffc58e');
const DAWN_SKY_COLOR = new Color('#f4bfd0');
const DAWN_AMBIENT = new Color('#d6b0d6');

/**
 * Une seule lumière projette des ombres. Le reste est de l'éclairage d'ambiance :
 * c'est le meilleur rapport qualité / coût pour un rendu low-poly.
 */
export function Lighting({ shadows }: { shadows: boolean }) {
  const sun = useRef<DirectionalLight>(null);
  const sky = useRef<HemisphereLight>(null);
  const pool = useRef<PointLight>(null);
  const ambient = useRef<AmbientLight>(null);
  const cycleTime = useRef(useWorld.getState().timeOfDay);
  const storeAccumulator = useRef(0);
  const dawnTint = useRef(0);
  /** Avance rapide en cours (bouton Jour/Nuit), voir sky/time-lapse.ts. */
  const lapse = useRef<Lapse | null>(null);
  // Les nuages filants se branchent une image après le montage (voir CloudRace).
  const [cloudRace, setCloudRace] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCloudRace(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const quality = useWorld((state) => state.quality);
  // Ombres nettes en haute qualité ; la carte est recréée quand la qualité change.
  const shadowSize = quality === 'high' ? 2048 : 1024;
  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    light.shadow.mapSize.set(shadowSize, shadowSize);
    light.shadow.map?.dispose();
    light.shadow.map = null;
  }, [shadowSize]);

  // Priorité -10 : ce callback avance l'horloge du monde et met à jour skyState
  // AVANT tous les autres systèmes de la frame (océan, atmosphère, bateau…).
  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const lightDt = preview.time === null ? dt : 10;
    const { phase, reveal, gameTransition, setTimeOfDay, timeLapseTarget, reducedMotion } = useWorld.getState();
    const dayLight = smoothstep(0.08, 0.9, reveal);
    const stillIntro = phase === 'loading' || phase === 'intro'
      ? 1
      : phase === 'transitioning'
        ? introLightStrength(gameTransition)
        : 0;

    // Horloge du monde. Cycle naturel : un tour complet = 5 minutes. `?time=` le fige
    // (aperçus, captures). Le bouton Jour/Nuit demande une heure (`timeLapseTarget`) : le
    // cycle y file en quelques secondes (ralenti, accéléré, ralenti), puis reprend son pas.
    let next: number;
    let rate = NATURAL_RATE;
    if (preview.time !== null) {
      next = preview.time;
      rate = 0;
      lapse.current = null;
      if (timeLapseTarget !== null) useWorld.setState({ timeLapseTarget: null });
    } else {
      const current = lapse.current;
      if (timeLapseTarget === null) {
        lapse.current = null;
      } else if (!current || current.target !== timeLapseTarget) {
        if (reducedMotion || (phase !== 'playing' && phase !== 'docked')) {
          // Mouvement réduit (ou monde pas encore à la main du visiteur : cinématique) :
          // l'heure change d'un coup, et couleurs et lumières s'y fondent en une seconde
          // (facteurs amortis du ciel) au lieu de défiler.
          lapse.current = null;
          cycleTime.current = timeLapseTarget;
          useWorld.setState({ timeOfDay: timeLapseTarget, timeLapseTarget: null });
        } else {
          // Un second clic en pleine avance repart de l'heure et de la vitesse atteintes.
          const speed = current ? lapseAt(current, current.elapsed).rate : NATURAL_RATE;
          lapse.current = planLapse(cycleTime.current, timeLapseTarget, speed);
          if (!lapse.current) useWorld.setState({ timeLapseTarget: null });
          else if (!current) ambience.chime(isNightTime(timeLapseTarget) ? DUSK_CHIME : DAWN_CHIME, 0.16);
        }
      }
      const running = lapse.current;
      if (running) {
        // Temps réel borné (un onglet masqué ne fait pas sauter la fin de l'avance), mais
        // assez large pour qu'un appareil lent (4 images/s) la joue à la bonne durée.
        running.elapsed += Math.min(delta, 0.25);
        const at = lapseAt(running, running.elapsed);
        next = at.time - Math.floor(at.time);
        rate = at.rate;
        if (running.elapsed >= running.duration) {
          next = running.to - Math.floor(running.to);
          lapse.current = null;
          storeAccumulator.current = 0;
          useWorld.setState({ timeOfDay: next, timeLapseTarget: null });
        }
      } else {
        // Une heure posée d'ailleurs dans le store est suivie (relue : un saut vient
        // peut-être d'y être écrit, juste au-dessus).
        const stored = useWorld.getState().timeOfDay;
        if (Math.abs(stored - cycleTime.current) > 0.02) cycleTime.current = stored;
        next = (cycleTime.current + dt * NATURAL_RATE) % 1;
      }
    }
    cycleTime.current = next;
    timeLapse.active = lapse.current !== null;
    raceClouds(rate, dt);
    // Le store suit l'horloge : 4 fois par seconde au pas naturel, 20 pendant l'avance (le
    // cadran du HUD glisse alors avec le soleil).
    storeAccumulator.current += dt;
    if (storeAccumulator.current >= (timeLapse.active ? 0.05 : 0.25)) {
      setTimeOfDay(next);
      storeAccumulator.current = 0;
    }
    // Pendant l'avance, les teintes amorties du ciel suivent le soleil de plus près.
    const hurry = 1 + (Math.min(timeLapse.rate, 40) - 1) * 0.15;
    updateSky(next, preview.time === null ? dt * Math.max(1, hurry) : 10);
    updateEcology(dt);
    const { dayNight, golden, sunAngle: angle, sunElevation } = skyState;
    const storm = ecologyState.stormCover;
    // Aube de la cinématique (sky/DawnSky) : lumière dorée, ciel rosé, le temps du lever.
    const dawnGoal = phase === 'transitioning' ? dawnPresence(gameTransition * INTRO_DURATION) : 0;
    dawnTint.current = damp(dawnTint.current, dawnGoal, 5, dt);
    const dawn = dawnTint.current;

    if (sun.current) {
      sun.current.color
        .copy(DAY_SUN_COLOR)
        .lerp(GOLDEN_SUN_COLOR, golden * 0.85)
        .lerp(NIGHT_SUN_COLOR, dayNight)
        .lerp(DAWN_SUN_COLOR, dawn * 0.5);
      sun.current.intensity = damp(
        sun.current.intensity,
        (0.2 + dayLight * 2.3 + stillIntro * 0.45) * (1 - dayNight * 0.75) * (1 - storm * 0.78),
        1.6,
        lightDt,
      );
      const x = Math.cos(angle) * 80;
      const y = Math.max(sunElevation * 70, 10);
      const z = 40;
      sun.current.position.set(boatState.position.x + x, y, boatState.position.z + z);
      sun.current.target.position.set(boatState.position.x, 0, boatState.position.z);
      sun.current.target.updateMatrixWorld();
    }
    if (sky.current) {
      sky.current.color
        .copy(DAY_SKY_COLOR)
        .lerp(GOLDEN_SKY_COLOR, golden * 0.7)
        .lerp(NIGHT_SKY_COLOR, dayNight)
        .lerp(DAWN_SKY_COLOR, dawn * 0.35);
      sky.current.groundColor.copy(DAY_GROUND_COLOR).lerp(NIGHT_GROUND_COLOR, dayNight);
      sky.current.intensity = damp(
        sky.current.intensity,
        (0.18 + dayLight * 1.22 + stillIntro * 1.05) * (1 - dayNight * 0.5) * (1 - storm * 0.58),
        1.6,
        lightDt,
      );
    }
    if (ambient.current) {
      ambient.current.color
        .copy(DAY_AMBIENT)
        .lerp(GOLDEN_AMBIENT, golden * 0.6)
        .lerp(NIGHT_AMBIENT, dayNight)
        .lerp(DAWN_AMBIENT, dawn * 0.25);
      ambient.current.intensity = damp(
        ambient.current.intensity,
        (0.22 + dayLight * 0.3 + stillIntro * 1.15) * (1 - storm * 0.44),
        1.6,
        lightDt,
      );
    }
    if (pool.current) {
      // Lumière chaude devant le bateau : éclaire sa coque et les voiles.
      const forwardX = Math.cos(boatState.heading);
      const forwardZ = Math.sin(boatState.heading);
      const sideX = forwardZ;
      const sideZ = -forwardX;
      const mx = boatState.position.x + forwardX * 9 + sideX * 3;
      const mz = boatState.position.z + forwardZ * 9 + sideZ * 3;
      pool.current.position.set(mx, 7.2, mz);
      pool.current.intensity = damp(pool.current.intensity, 58 * stillIntro, 3, dt);
      pool.current.distance = 42;
    }
  }, -10);

  return (
    <group>
      {cloudRace && <CloudRace />}
      <hemisphereLight ref={sky} color="#e1f2ff" groundColor="#3a4a52" intensity={0.35} />
      <directionalLight
        ref={sun}
        position={[60, 70, 40]}
        color="#fff0d8"
        intensity={0.2}
        castShadow={shadows && QUALITY_LEVELS[quality].shadows}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
        shadow-camera-near={1}
        shadow-camera-far={180}
        shadow-camera-left={-58}
        shadow-camera-right={58}
        shadow-camera-top={58}
        shadow-camera-bottom={-58}
      />
      <ambientLight ref={ambient} intensity={0.16} color="#a0c4d4" />
      {/* Spot chaud d'ambiance pour l'intro : donne l'impression d'un décor éclairé. Absent
          en qualité basse (téléphones) : éteinte après l'intro, une lumière ponctuelle coûte
          encore à chaque pixel de chaque matériau pendant toute la visite. */}
      {quality !== 'low' && (
        <pointLight
          ref={pool}
          position={[0, 10.5, 0]}
          color="#fff0d8"
          intensity={76}
          distance={42}
          decay={0.9}
        />
      )}
    </group>
  );
}
