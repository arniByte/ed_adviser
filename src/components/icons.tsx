const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export const ArrowUp = () => (
  <svg {...base}>
    <path d="M10 16V4M5 9l5-5 5 5" />
  </svg>
)

export const ArrowRight = () => (
  <svg {...base}>
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
)

export const Mic = () => (
  <svg {...base}>
    <rect x="7" y="2.5" width="6" height="9.5" rx="3" />
    <path d="M4 9.5a6 6 0 0 0 12 0M10 15.5v2.5" />
  </svg>
)

export const External = () => (
  <svg {...base} width={14} height={14}>
    <path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8" />
  </svg>
)

export const MenuIcon = () => (
  <svg {...base}>
    <path d="M4 7.5h12M4 12.5h12" />
  </svg>
)

export const Close = () => (
  <svg {...base}>
    <path d="M5 5l10 10M15 5L5 15" />
  </svg>
)

export const Check = () => (
  <svg {...base}>
    <path d="M4.5 10.5l3.5 3.5 7.5-8" />
  </svg>
)

export const Seal = () => (
  <svg {...base}>
    <path d="M10 2.5l2 1.6 2.5-.2.9 2.4 2.1 1.4-.8 2.4.8 2.4-2.1 1.4-.9 2.4-2.5-.2-2 1.6-2-1.6-2.5.2-.9-2.4-2.1-1.4.8-2.4-.8-2.4 2.1-1.4.9-2.4 2.5.2z" />
    <path d="M7.2 10.2l1.9 1.9 3.8-4" />
  </svg>
)
