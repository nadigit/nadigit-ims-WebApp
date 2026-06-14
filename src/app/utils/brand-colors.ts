/**
 * Nadigit IMS official chart & UI color constants (brand guidelines March 2026).
 * Use in Chart.js configs where CSS variables are unavailable.
 */
export const BRAND_COLORS = {
  navy: '#0B1F4A',
  corporate: '#102B63',
  saas: '#1E5EFF',
  saasHover: '#1850E0',
  cyan: '#18C5D8',
  success: '#16C784',
  successHover: '#12A86E',
  premium: '#F4B740',
  premiumHover: '#DFA830',
  danger: '#E5484D',
  dangerHover: '#C93B40',
  textPrimary: '#1A1F36',
  textSecondary: '#667085',
} as const;

/** Order status doughnut: pending → processing → completed → cancelled */
export const BRAND_ORDER_STATUS_CHART = {
  background: [
    BRAND_COLORS.premium,
    BRAND_COLORS.saas,
    BRAND_COLORS.success,
    BRAND_COLORS.danger,
  ],
  hover: [
    BRAND_COLORS.premiumHover,
    BRAND_COLORS.saasHover,
    BRAND_COLORS.successHover,
    BRAND_COLORS.dangerHover,
  ],
} as const;

/** Credit aging buckets: 0–30 → 90+ */
export const BRAND_AGING_CHART = {
  background: [
    BRAND_COLORS.saas,
    BRAND_COLORS.premium,
    BRAND_COLORS.danger,
    BRAND_COLORS.dangerHover,
  ],
  hover: [
    BRAND_COLORS.saasHover,
    BRAND_COLORS.premiumHover,
    BRAND_COLORS.dangerHover,
    '#A83238',
  ],
} as const;

/** Profit/cost doughnut */
export const BRAND_PROFIT_CHART = {
  cost: BRAND_COLORS.saas,
  costHover: BRAND_COLORS.saasHover,
  profit: BRAND_COLORS.success,
  profitHover: BRAND_COLORS.successHover,
  loss: BRAND_COLORS.danger,
  lossHover: BRAND_COLORS.dangerHover,
} as const;

function isLightHexColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

/** Chart.js axis/legend colors — scheme-aware with safe fallbacks (Chart.js hides invalid/empty colors). */
export function getChartThemeColors(): {
  textColor: string;
  textColorSecondary: string;
  surfaceBorder: string;
} {
  if (typeof document === 'undefined') {
    return {
      textColor: BRAND_COLORS.textPrimary,
      textColorSecondary: BRAND_COLORS.textSecondary,
      surfaceBorder: '#DCE3F0',
    };
  }
  const isDark = document.documentElement.getAttribute('color-scheme') === 'dark';
  const style = getComputedStyle(document.documentElement);
  let textColor = style.getPropertyValue('--text-color').trim();
  let textColorSecondary = style.getPropertyValue('--text-color-secondary').trim();
  let surfaceBorder = style.getPropertyValue('--surface-border').trim();

  if (isDark) {
    return {
      textColor: textColor || '#FFFFFF',
      textColorSecondary: textColorSecondary || '#C9D4E5',
      surfaceBorder: surfaceBorder || 'rgba(255, 255, 255, 0.12)',
    };
  }

  // Light mode: never use white/near-white legend text (can leak from stale dark tokens)
  if (!textColor || isLightHexColor(textColor)) {
    textColor = BRAND_COLORS.textPrimary;
  }
  if (!textColorSecondary || isLightHexColor(textColorSecondary)) {
    textColorSecondary = BRAND_COLORS.textSecondary;
  }
  if (!surfaceBorder) {
    surfaceBorder = '#DCE3F0';
  }

  return { textColor, textColorSecondary, surfaceBorder };
}

/** Default multi-series chart palette (brand-aligned). */
export const BRAND_CHART_PALETTE = [
  BRAND_COLORS.saas,
  BRAND_COLORS.cyan,
  BRAND_COLORS.success,
  BRAND_COLORS.premium,
  BRAND_COLORS.corporate,
  '#667085',
] as const;

/** Extended palette for pie/doughnut charts with more segments. */
export const BRAND_CHART_PALETTE_EXTENDED = [
  BRAND_COLORS.saas,
  '#EC4899',
  BRAND_COLORS.premium,
  BRAND_COLORS.success,
  BRAND_COLORS.cyan,
  BRAND_COLORS.corporate,
] as const;

/** Read brand colors from CSS custom properties (respects theme / dark mode overrides). */
export function getBrandCssColors(): string[] {
  if (typeof document === 'undefined') {
    return [...BRAND_CHART_PALETTE];
  }
  const style = getComputedStyle(document.documentElement);
  return [
    style.getPropertyValue('--primary-500').trim() || BRAND_COLORS.saas,
    style.getPropertyValue('--cyan-500').trim() || BRAND_COLORS.cyan,
    style.getPropertyValue('--green-500').trim() || BRAND_COLORS.success,
    style.getPropertyValue('--yellow-500').trim() || BRAND_COLORS.premium,
    style.getPropertyValue('--brand-corporate').trim() || BRAND_COLORS.corporate,
    style.getPropertyValue('--brand-text-secondary').trim() || BRAND_COLORS.textSecondary,
  ];
}

export function getBrandCssHoverColors(): string[] {
  if (typeof document === 'undefined') {
    return BRAND_CHART_PALETTE.map((c) => c);
  }
  const style = getComputedStyle(document.documentElement);
  return [
    style.getPropertyValue('--primary-400').trim() || BRAND_COLORS.saas,
    style.getPropertyValue('--cyan-400').trim() || BRAND_COLORS.cyan,
    style.getPropertyValue('--green-400').trim() || BRAND_COLORS.success,
    style.getPropertyValue('--yellow-400').trim() || BRAND_COLORS.premium,
    style.getPropertyValue('--primary-600').trim() || BRAND_COLORS.corporate,
    style.getPropertyValue('--text-color-secondary').trim() || BRAND_COLORS.textSecondary,
  ];
}
