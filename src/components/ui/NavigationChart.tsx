'use client';

import { useEffect, useRef } from 'react';
import { islands } from '@/data/islands';
import { useWorld } from '@/lib/store';

/*
 * NON MONTÉE (fusion de origin/Portfolio) : cette carte modale téléporte le bateau
 * (jumpTo) et double la navigation du HUD (boussole, barre des îles) et la carte du carnet.
 * Ses styles (.navigation-chart…) sont restés dans le globals.css de origin/Portfolio (06308d0).
 */
// The chart uses the actual world coordinates; it remains legible before exploration.
const project = ([x, z]: [number, number]) => [50 + x * .45, 52 + z * .42];
function coast(radius: number, index: number) {
  return Array.from({ length: 49 }, (_, n) => {
    const a = n / 48 * Math.PI * 2;
    const r = radius * (1 + .12 * Math.sin(a * 3 + index) + .08 * Math.cos(a * 7));
    return `${n ? 'L' : 'M'}${Math.cos(a) * r},${Math.sin(a) * r}`;
  }).join(' ') + ' Z';
}

export function NavigationChart({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const current = useWorld((s) => s.activeIsland);
  useEffect(() => {
    const element = dialog.current;
    if (open) element?.showModal();
    else element?.close();
  }, [open]);
  return (
    <dialog ref={dialog} className="navigation-chart" aria-labelledby="chart-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="navigation-chart__inner">
        <header><span className="atlas-kicker">Atlas personnel / Index des escales</span><button type="button" className="chart-close" onClick={onClose} autoFocus aria-label="Fermer la carte">✕</button></header>
        <div className="navigation-chart__intro"><h2 id="chart-title">Choisis<br /><em>ton horizon.</em></h2><p>Du port breton aux projets immersifs,<br />chaque île raconte une partie de mon histoire.<br /><strong>Une escale, un clic.</strong></p></div>
        <div className="navigation-chart__sea">
          <svg viewBox="0 0 600 480" preserveAspectRatio="none" aria-hidden="true">
            <defs><pattern id="chart-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="currentColor" strokeWidth=".5" opacity=".12" /></pattern></defs>
            <rect width="600" height="480" fill="url(#chart-grid)" />
            <circle cx="300" cy="250" r="178" fill="none" stroke="currentColor" opacity=".12" />
            <circle cx="300" cy="250" r="118" fill="none" stroke="currentColor" opacity=".12" />
            {islands.map((island, i) => { const [x,y]=project(island.position); return <g key={island.id} transform={`translate(${x*6} ${y*4.8})`}><path d={coast(island.radius*2.4,i)} fill="#d5d8be" stroke="#758b7b" /><path d={coast(island.radius*1.65,i)} fill="none" stroke="#758b7b" opacity=".4" /></g>; })}
            <path d="M149 189 Q265 278 489 302 Q316 403 241 383 Q122 399 106 310" fill="none" stroke="#ba6746" strokeWidth="1.3" strokeDasharray="4 6" opacity=".65" />
            <text x="300" y="250" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontSize="15" fill="currentColor" opacity=".5">la mer des possibles</text>
            <g transform="translate(538 410)" stroke="currentColor" opacity=".6"><circle r="24" fill="none" /><path d="M0-30V30M-30 0H30M0-21L5 0 0 21-5 0Z" fill="currentColor" /><text y="-36" textAnchor="middle" stroke="none" fill="currentColor" fontSize="10">N</text></g>
          </svg>
          {islands.map((island, i) => {const [x,y]=project(island.position); return <button key={island.id} type="button" className="chart-destination" style={{left:`${x}%`,top:`${y}%`}} aria-current={current===island.id ? 'location' : undefined} onClick={()=>{useWorld.getState().jumpTo(island.id);onClose();}}><b>{String(i+1).padStart(2,'0')}</b><span>{island.label}</span></button>;})}
        </div>
        <footer><span>Navigation directe · le bateau reste à ta disposition</span><span>KLG / Carnet de navigation</span></footer>
      </div>
    </dialog>
  );
}
