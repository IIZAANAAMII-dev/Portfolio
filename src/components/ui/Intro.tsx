'use client';

import { useWorld } from '@/lib/store';

/** L'unique instruction de toute l'expérience. */
export function Intro() {
  const phase = useWorld((s) => s.phase);
  const start = useWorld((s) => s.start);
  const visible = phase === 'intro';

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center pb-[14vh] transition-opacity duration-700"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onClick={visible ? start : undefined}
    >
      <button
        type="button"
        onClick={start}
        className="group flex flex-col items-center gap-3 px-8 py-4"
        aria-label="Commencer l’expérience"
      >
        <span className="hand animate-breathe text-3xl text-paper drop-shadow-[0_2px_18px_rgba(0,0,0,0.8)]">
          Click to start
        </span>
        <span className="h-px w-0 bg-paper/50 transition-all duration-500 group-hover:w-24" />
      </button>
    </div>
  );
}
