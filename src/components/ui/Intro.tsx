'use client';

import { useWorld } from '@/lib/store';

/** Panneau de départ : diorama éclairé, invitation manuscrite, flèche vers l'île. */
export function Intro() {
  const phase = useWorld((s) => s.phase);
  const start = useWorld((s) => s.start);
  const visible = phase === 'intro';

  return (
    <div
      className="intro-vignette fixed inset-0 z-30 transition-opacity duration-700"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
      onClick={visible ? start : undefined}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-[8vh] md:pb-[12vh]">
        <div className="relative flex flex-col items-center">
          <svg
            viewBox="0 0 180 120"
            className="intro-arrow -mb-10 h-28 w-40 text-paper md:h-36 md:w-52"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M96 110 C 86 80, 40 65, 28 40"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M22 46 L 28 40 L 34 48"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <button
            type="button"
            onClick={start}
            className="intro-prompt group relative cursor-pointer rounded-full px-10 py-4 backdrop-blur-sm md:px-14 md:py-5"
            aria-label="Commencer l’expérience"
          >
            <span className="hand text-4xl text-paper drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] md:text-5xl">
              Click to start
            </span>
            <span className="absolute bottom-3 left-1/2 h-0.5 w-0 -translate-x-1/2 bg-paper/60 transition-all duration-500 group-hover:w-1/2" />
          </button>

          <span className="mt-4 text-xs tracking-[0.25em] text-paper/60 uppercase drop-shadow-md">
            Un petit archipel à explorer
          </span>
        </div>
      </div>
    </div>
  );
}
