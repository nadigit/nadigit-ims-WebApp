/** Central paths for Nadigit IMS brand assets (webapp). Marketing-approved March 2026. */
export const BRAND_ASSETS = {
  /** Full primary logo — light backgrounds (synced from official/nadigit-ims-primary-logo-light.svg). */
  logoLight: 'assets/app-logo/nadigitims-logo-light.svg',
  /** Full primary logo — dark backgrounds (synced from official/nadigit-ims-primary-logo-dark.svg). */
  logoDark: 'assets/app-logo/nadigitims-logo-dark.svg',
  /** Compact wordmark — light backgrounds (top bar, footer). */
  logoSecondaryLight: 'assets/app-logo/secondary/nadigit-ims-secondary-logo-light.svg',
  /** Compact wordmark — dark backgrounds (top bar, footer). */
  logoSecondaryDark: 'assets/app-logo/secondary/nadigit-ims-secondary-logo-dark.svg',
  /** High-res PNG fallbacks (same crop as SVG viewBox). */
  logoLightPng: 'assets/app-logo/nadigitims-logo-light-full.png',
  logoDarkPng: 'assets/app-logo/nadigitims-logo-dark-full.png',
  /** Favicon for light theme / light browser chrome. */
  faviconLight: 'assets/app-logo/favicon/nadigitims-favicon-light.svg',
  /** Favicon for dark theme / dark browser chrome. */
  faviconDark: 'assets/app-logo/favicon/nadigitims-favicon-dark.svg',
  /** PWA / home-screen icon — light theme (1024 PNG). */
  appIconLight: 'assets/app-logo/appicon/nadigitims-App-Icon.png',
  /** PWA / home-screen icon — dark theme (1024 PNG). */
  appIconDark: 'assets/app-logo/appicon/nadigitims-App-Icon-Dark.png',
  /** Custom NadiPilot mark (brand "AI" sparkle), tinted via CSS mask to the brand color. */
  nadiPilotIcon: 'assets/core-images/nadipilot.svg',
  /** CSS class rendering the NadiPilot mark (mask-based, inherits `color`). Used where the icon shows. */
  nadiPilotPrimeIcon: 'nadipilot-mark',
  siteUrl: 'https://ims.nadigit.com',
  corporateUrl: 'https://nadigit.com',
  /** Public product documentation (Docusaurus). */
  docsUrl: 'https://docs.ims.nadigit.com',
} as const;

/** @deprecated Use logoLight / logoDark or brandLogoForScheme */
export const BRAND_ASSETS_LEGACY = {
  logo: BRAND_ASSETS.logoLight,
  logoDark: BRAND_ASSETS.logoDark,
} as const;

export function brandLogoForScheme(colorScheme: string): string {
  return colorScheme === 'dark' ? BRAND_ASSETS.logoDark : BRAND_ASSETS.logoLight;
}

export function brandSecondaryLogoForScheme(colorScheme: string): string {
  return colorScheme === 'dark' ? BRAND_ASSETS.logoSecondaryDark : BRAND_ASSETS.logoSecondaryLight;
}

export function brandFaviconForScheme(colorScheme: string): string {
  return colorScheme === 'dark' ? BRAND_ASSETS.faviconDark : BRAND_ASSETS.faviconLight;
}

export function brandAppIconForScheme(colorScheme: string): string {
  return colorScheme === 'dark' ? BRAND_ASSETS.appIconDark : BRAND_ASSETS.appIconLight;
}
