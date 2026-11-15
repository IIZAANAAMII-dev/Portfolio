/** Pictogrammes du gameplay : même trait que ceux du HUD (20 × 20, 1,5 px, couleur du texte). */

interface IconProps {
  className?: string;
}

const stroke = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function RodIcon({ className }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path d="M3 17.5 15.5 3" />
      <path d="M15.5 3c1.6 3 2 7.5 1.2 11" strokeDasharray="1.6 1.8" />
      <circle cx="16.4" cy="15.4" r="1.4" />
      <path d="M5.2 15 6.8 16.6" />
    </svg>
  );
}

export function CameraIcon({ className }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path d="M2.8 6.6h3.1l1.4-2h5.4l1.4 2h3.1v9.2H2.8z" />
      <circle cx="10" cy="11" r="3.1" />
      <path d="M14.8 8.6h.6" />
    </svg>
  );
}

/** Bourriche : panier d'osier à anse. */
export function CreelIcon({ className }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path d="M3.4 8.2h13.2l-1.5 8.3H4.9z" />
      <path d="M6 8.2c0-3.4 8-3.4 8 0" />
      <path d="M4.2 11.4h11.6M4.8 14.1h10.4M8 8.4l-.4 8M12 8.4l.4 8" strokeWidth="1.1" />
    </svg>
  );
}

export function FishIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 32" aria-hidden="true">
      <path d="M4 16c6-9 18-12 28-6l8-6-2 12 2 12-8-6C22 28 10 25 4 16z" fill="var(--accent, #5ec8ff)" />
      <path d="M8 18c7 6 17 7 24 2" fill="none" stroke="#f6efe0" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
      <path d="M19 9c2 2 2 9 0 13" fill="none" stroke="rgba(10, 14, 20, 0.28)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="11.5" cy="13.6" r="1.9" fill="#0a0e14" />
    </svg>
  );
}

/** Fanion de régate sur sa marque. */
export function FlagIcon({ className }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path d="M5.5 17.5V2.8" />
      <path d="M5.5 3.2 15.5 6.4 5.5 9.6" fill="currentColor" fillOpacity="0.25" />
      <path d="M3 17.5h5" />
    </svg>
  );
}

export function RestartIcon({ className }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path d="M15.6 7.2A6.2 6.2 0 1 0 16 12" />
      <path d="M16.2 3.2v4.4h-4.4" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path d="M10 16.5V3.5M5 8.5l5-5 5 5" />
    </svg>
  );
}

export function ChevronIcon({ className, left }: IconProps & { left?: boolean }) {
  return (
    <svg className={className} {...stroke}>
      <path d={left ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'} />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path d="M10 3v9.5M6 8.8l4 4 4-4M3.5 16.5h13" />
    </svg>
  );
}

export function ShareIcon({ className }: IconProps) {
  return (
    <svg className={className} {...stroke}>
      <path d="M10 12.5V3M6.5 6.2 10 2.8l3.5 3.4M5 9.5H4v7.5h12V9.5h-1" />
    </svg>
  );
}
