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
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    className={className}
    aria-hidden="true"
  >
    <path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.37-.31-.6-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.49.49 0 0 0 14.01 2h-4c-.25 0-.45.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.48 0-.6.22l-2 3.46c-.12.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.37.31.6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.04.24.24.42.49.42h4c.25 0 .45-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.48 0 .6-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" />
  </svg>
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

export const IconEye = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconCpu = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
  </Svg>
);

export const IconFlame = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M12 2c1 3-2 4-2 7a2 2 0 0 0 4 0c1 2 2 3.5 2 5.5a4 4 0 0 1-8 0c0-2 .5-3.5 1.5-5C8 12 9 13 10 12c1-1 2-2.5 2-4z" />
  </Svg>
);

export const IconTrendingUp = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M3 17l6-6 4 4 7-7" />
    <path d="M14 8h6v6" />
  </Svg>
);

export const IconSignal = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 20V4" />
  </Svg>
);

export const IconHash = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
  </Svg>
);

export const IconSearch = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </Svg>
);
