'use client';

import { useEffect, useState } from 'react';
import { islands } from '@/data/islands';
import { site } from '@/data/site';
import { boatState } from '@/lib/boat-state';
import { dockPosition, useWorld } from '@/lib/store';
import { isNightTime } from '@/lib/sky';

const RAD2DEG = 180 / Math.PI;

/**
 * Boussole en bas à gauche. Elle est rafraîchie à 60 fps pour refléter la
 * position réelle du bateau. Les îles apparaissent comme des repères autour du
 * cadran ; un repère cliqué définit la destination. L'aiguille pointe vers
 * l'île cible (ou le cap du bateau si aucune cible n'est active).
 */
function Compass() {
  const [boat, setBoat] = useState({ x: boatState.position.x, z: boatState.position.z });
  const destination = useWorld((s) => s.destination);
  const activeIsland = useWorld((s) => s.activeIsland);
  const sailTo = useWorld((s) => s.sailTo);
  const hover = useWorld((s) => s.hover);

  useEffect(() => {
    let rafId = 0;
    const loop = () => {
      setBoat({ x: boatState.position.x, z: boatState.position.z });
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const targetId = destination || activeIsland;
  let needleAngle = boatState.heading * RAD2DEG + 90;
  if (targetId) {
    const [tx, tz] = dockPosition(targetId);
    const dx = tx - boat.x;
    const dz = tz - boat.z;
    needleAngle = Math.atan2(dz, dx) * RAD2DEG + 90;
  }

  return (
    <div className="intro-compass hud-compass" aria-label="Boussole">
      <span>N</span>
      <i style={{ transform: `rotate(${needleAngle}deg)` }} />
      <span>S</span>
      <b>✦</b>
      {islands.map((island) => {
        const dx = island.position[0] - boat.x;
        const dz = island.position[1] - boat.z;
        const angle = Math.atan2(dz, dx);
        const left = 50 + 44 * Math.cos(angle);
        const top = 50 + 44 * Math.sin(angle);
        return (
          <button
            key={island.id}
            type="button"
            className="hud-island-dot"
            aria-label={island.label}
            onClick={(e) => {
              e.stopPropagation();
              sailTo(island.id);
            }}
            onMouseEnter={() => hover(island.id)}
            onMouseLeave={() => hover(null)}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              backgroundColor: island.accent,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * L'interface permanente. Trois éléments seulement, tous dans les marges : le monde
 * garde le centre de l'écran.
 */
export function Hud() {
  const phase = useWorld((s) => s.phase);
  const activeIsland = useWorld((s) => s.activeIsland);
  const destination = useWorld((s) => s.destination);
  const soundOn = useWorld((s) => s.soundOn);
  const isNight = isNightTime(useWorld((s) => s.timeOfDay));
  const toggleSound = useWorld((s) => s.toggleSound);
  const toggleDayNight = useWorld((s) => s.toggleDayNight);
  const setQuickView = useWorld((s) => s.setQuickView);
  const sailTo = useWorld((s) => s.sailTo);
  const hover = useWorld((s) => s.hover);

  const visible = phase === 'playing' || phase === 'docked';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-5 transition-opacity duration-1000 md:p-7"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden={!visible}
    >
      <header className="flex items-start justify-between">
        <p className="text-xs tracking-[0.4em] text-paper/90">{site.shortName}</p>
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            className="ghost-button"
            aria-pressed={soundOn}
            onClick={toggleSound}
          >
            {soundOn ? 'Son' : 'Silence'}
          </button>
          <button
            type="button"
            className="ghost-button"
            aria-pressed={isNight}
            onClick={toggleDayNight}
          >
            {isNight ? 'Nuit' : 'Jour'}
          </button>
          <button type="button" className="ghost-button" onClick={() => setQuickView(true)}>
            Aperçu
          </button>
        </div>
      </header>

      <nav
        className="pointer-events-auto mx-auto flex max-w-full flex-wrap items-center justify-center gap-x-5 gap-y-2 md:gap-x-8"
        aria-label="Sections du portfolio"
      >
        {islands.map((island) => {
          const current = activeIsland === island.id;
          const heading = destination === island.id;
          return (
            <button
              key={island.id}
              type="button"
              onClick={() => sailTo(island.id)}
              onMouseEnter={() => hover(island.id)}
              onMouseLeave={() => hover(null)}
              className="group relative py-2 text-[0.7rem] tracking-[0.2em] uppercase transition-colors duration-200"
              style={{ color: current || heading ? island.accent : 'rgba(244,241,234,0.6)' }}
            >
              {island.label}
              <span
                className="absolute inset-x-0 -bottom-0.5 h-px origin-center scale-x-0 bg-current transition-transform duration-300 group-hover:scale-x-100"
                style={{ transform: current ? 'scaleX(1)' : undefined }}
              />
            </button>
          );
        })}
      </nav>

      {visible && <Compass />}
    </div>
  );
}
