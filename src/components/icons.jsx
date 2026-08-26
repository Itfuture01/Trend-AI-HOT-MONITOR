const Svg = ({ children, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IconRadar = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
    <path d="M12 12 12 3" />
    <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconPlus = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconTrash = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </Svg>
);

export const IconPower = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M12 3v8M18.4 6.6a9 9 0 1 1-12.8 0" />
  </Svg>
);

export const IconScan = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M12 3a9 9 0 1 0 9 9" />
    <circle cx="16" cy="8" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconBell = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7M10 21a2 2 0 0 0 4 0" />
  </Svg>
);

export const IconMail = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </Svg>
);

export const IconGear = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
  </Svg>
);

export const IconX = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);

export const IconExternal = ({ className = 'w-4 h-4' }) => (
  <Svg className={className}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
  </Svg>
);

export const IconGlobe = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
  </Svg>
);

export const IconWarn = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M12 3 2 20h20L12 3zM12 10v4M12 17.5v.5" />
  </Svg>
);
