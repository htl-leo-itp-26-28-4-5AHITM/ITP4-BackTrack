// Schlichte Linien-Icons (24er Raster, 1,75 px Strich).
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const PitchIcon = () => (
  <svg {...base}>
    <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
    <path d="M12 5v14" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M2.5 9.5h2.5v5H2.5M21.5 9.5H19v5h2.5" />
  </svg>
);

export const PlayerIcon = () => (
  <svg {...base}>
    <path d="M8 4l-4.5 2.5 1.5 4 2-1V20h10V9.5l2 1 1.5-4L16 4c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z" />
  </svg>
);

export const CompareIcon = () => (
  <svg {...base}>
    <path d="M5 20V10M10 20V4M14 20v-7M19 20V8" />
  </svg>
);

export const UploadIcon = () => (
  <svg {...base}>
    <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V15" />
  </svg>
);

export const ArrowIcon = () => (
  <svg {...base} width={16} height={16}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
