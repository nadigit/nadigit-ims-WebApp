/**
 * Illustrations for the guided-tour popovers.
 *
 * Inline SVG rather than raster art, deliberately:
 *  - the popover is 340px wide and these render crisp at any DPI, for ~1KB each and no extra
 *    HTTP request during a first-run experience;
 *  - line work uses `currentColor`, so the same asset reads correctly on the light web surfaces
 *    and on the dark product surfaces the brand guide designates for the app;
 *  - eight steps stay visually identical in weight, radius and rhythm, which raster generation
 *    cannot guarantee across separate images.
 *
 * Design system (Brand Guidelines V1.2):
 *  - navy #0B1F4A, blue #1E5EFF, cyan #18C5D8, green #16C784, gold #F4B740
 *  - gradients: principal #0B1F4A->#1E5EFF, IA #1E5EFF->#18C5D8, analytics #16C784->#18C5D8
 *  - style: minimalist, structured, premium corporate-tech. Geometry only, no mascots.
 *
 * Shared grid: 300x96 viewBox, 16px margin, 2px strokes, 4px corner radius, one accent per scene.
 */

/** Gradient ids are suffixed per scene so several inline SVGs can coexist in one document. */
function defs(id: string): string {
  return `<defs>
    <linearGradient id="g-${id}-principal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B1F4A"/><stop offset="100%" stop-color="#1E5EFF"/>
    </linearGradient>
    <linearGradient id="g-${id}-ai" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1E5EFF"/><stop offset="100%" stop-color="#18C5D8"/>
    </linearGradient>
    <linearGradient id="g-${id}-growth" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#16C784"/><stop offset="100%" stop-color="#18C5D8"/>
    </linearGradient>
  </defs>`;
}

/** Soft brand field behind every scene, so the strip reads as one family. */
function field(id: string, accent: 'principal' | 'ai' | 'growth' = 'principal'): string {
  return `<rect x="0" y="0" width="300" height="96" rx="10" fill="url(#g-${id}-${accent})" opacity="0.06"/>`;
}

function svg(id: string, body: string, accent: 'principal' | 'ai' | 'growth' = 'principal'): string {
  return (
    `<svg class="ims-tour-illustration" viewBox="0 0 300 96" role="img" aria-hidden="true" ` +
    `xmlns="http://www.w3.org/2000/svg">${defs(id)}${field(id, accent)}${body}</svg>`
  );
}

/**
 * Welcome — the product mark's own idea: a parcel, a scanning arc and a path.
 * Sets the brand tone before any feature is explained.
 */
const WELCOME = svg(
  'welcome',
  `<g fill="none" stroke="currentColor" stroke-opacity="0.28" stroke-width="2" stroke-linecap="round">
     <path d="M28 70h44M28 78h26"/>
   </g>
   <g transform="translate(96 18)">
     <path d="M4 14 30 4l26 10v26L30 50 4 40z" fill="url(#g-welcome-principal)"/>
     <path d="M4 14 30 24l26-10M30 24v26" fill="none" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="2" stroke-linejoin="round"/>
   </g>
   <g transform="translate(178 20)">
     <circle cx="20" cy="20" r="15" fill="none" stroke="url(#g-welcome-ai)" stroke-width="3"/>
     <path d="M31 31l10 10" stroke="url(#g-welcome-ai)" stroke-width="3" stroke-linecap="round"/>
   </g>
   <path d="M232 66c14 0 14-16 28-16" fill="none" stroke="#F4B740" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 7"/>`
);

/** Navigation — the sidebar rail with an active row. Mirrored in RTL (see SCSS). */
const MENU = svg(
  'menu',
  `<rect x="16" y="14" width="72" height="68" rx="8" fill="url(#g-menu-principal)" opacity="0.9"/>
   <g fill="#FFFFFF" fill-opacity="0.85">
     <rect x="26" y="26" width="52" height="6" rx="3"/>
     <rect x="26" y="40" width="38" height="6" rx="3" fill-opacity="0.5"/>
     <rect x="26" y="54" width="44" height="6" rx="3" fill-opacity="0.5"/>
     <rect x="26" y="68" width="30" height="6" rx="3" fill-opacity="0.5"/>
   </g>
   <rect x="16" y="22" width="3" height="14" rx="1.5" fill="#18C5D8"/>
   <g fill="currentColor" fill-opacity="0.12">
     <rect x="104" y="14" width="180" height="30" rx="6"/>
     <rect x="104" y="52" width="84" height="30" rx="6"/>
     <rect x="200" y="52" width="84" height="30" rx="6"/>
   </g>`
);

/** Getting started — three short steps, the first already complete. */
const GETTING_STARTED = svg(
  'start',
  `<g>
     <circle cx="42" cy="48" r="16" fill="url(#g-start-growth)"/>
     <path d="M35 48l5 5 10-10" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
   </g>
   <path d="M58 48h30" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" stroke-linecap="round"/>
   <circle cx="106" cy="48" r="16" fill="none" stroke="url(#g-start-principal)" stroke-width="3"/>
   <circle cx="106" cy="48" r="5" fill="url(#g-start-principal)"/>
   <path d="M122 48h30" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 6"/>
   <circle cx="170" cy="48" r="16" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="3"/>
   <g fill="currentColor" fill-opacity="0.16">
     <rect x="200" y="34" width="80" height="8" rx="4"/>
     <rect x="200" y="50" width="56" height="8" rx="4"/>
   </g>`,
  'growth'
);

/** Notifications — a bell, its badge, and two calm pulse rings. */
const NOTIFICATIONS = svg(
  'notif',
  `<g transform="translate(122 20)">
     <path d="M28 8a14 14 0 0 0-14 14v12l-5 8h38l-5-8V22A14 14 0 0 0 28 8z" fill="url(#g-notif-principal)"/>
     <path d="M22 46a6 6 0 0 0 12 0" fill="none" stroke="url(#g-notif-principal)" stroke-width="3" stroke-linecap="round"/>
     <circle cx="42" cy="10" r="7" fill="#F4B740"/>
   </g>
   <g fill="none" stroke="currentColor" stroke-linecap="round">
     <path d="M104 34a26 26 0 0 0 0 28" stroke-opacity="0.25" stroke-width="2.5"/>
     <path d="M92 26a40 40 0 0 0 0 44" stroke-opacity="0.13" stroke-width="2.5"/>
     <path d="M196 34a26 26 0 0 1 0 28" stroke-opacity="0.25" stroke-width="2.5"/>
     <path d="M208 26a40 40 0 0 1 0 44" stroke-opacity="0.13" stroke-width="2.5"/>
   </g>`
);

/** Action reminders — a calendar with one flagged day and a small clock. */
const REMINDERS = svg(
  'remind',
  `<g transform="translate(70 16)">
     <rect x="0" y="6" width="76" height="64" rx="8" fill="none" stroke="currentColor" stroke-opacity="0.3" stroke-width="2"/>
     <path d="M0 24h76" stroke="currentColor" stroke-opacity="0.3" stroke-width="2"/>
     <path d="M18 0v12M58 0v12" stroke="url(#g-remind-principal)" stroke-width="3" stroke-linecap="round"/>
     <g fill="currentColor" fill-opacity="0.2">
       <rect x="12" y="34" width="12" height="8" rx="2"/>
       <rect x="32" y="34" width="12" height="8" rx="2"/>
       <rect x="12" y="50" width="12" height="8" rx="2"/>
     </g>
     <rect x="52" y="34" width="12" height="8" rx="2" fill="url(#g-remind-principal)"/>
   </g>
   <g transform="translate(168 30)">
     <circle cx="18" cy="18" r="17" fill="none" stroke="url(#g-remind-ai)" stroke-width="3"/>
     <path d="M18 9v10l7 5" fill="none" stroke="url(#g-remind-ai)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
   </g>`
);

/** NadiPilot — the innovation gradient, an orbit and a spark. */
const COPILOT = svg(
  'pilot',
  `<ellipse cx="150" cy="48" rx="58" ry="24" fill="none" stroke="url(#g-pilot-ai)" stroke-width="2" opacity="0.55"/>
   <ellipse cx="150" cy="48" rx="58" ry="24" fill="none" stroke="url(#g-pilot-ai)" stroke-width="2" opacity="0.35" transform="rotate(-32 150 48)"/>
   <path d="M150 26l6.5 13.5L170 46l-13.5 6.5L150 66l-6.5-13.5L130 46l13.5-6.5z" fill="url(#g-pilot-ai)"/>
   <circle cx="208" cy="34" r="4" fill="#18C5D8"/>
   <circle cx="94" cy="62" r="3" fill="#1E5EFF" opacity="0.8"/>
   <circle cx="214" cy="66" r="2.5" fill="#F4B740"/>`,
  'ai'
);

/** Account & settings — structured controls, the brand's "propre et structuré". */
const SETTINGS = svg(
  'settings',
  `<g stroke="currentColor" stroke-opacity="0.25" stroke-width="2.5" stroke-linecap="round">
     <path d="M96 32h108M96 48h108M96 64h108"/>
   </g>
   <circle cx="132" cy="32" r="8" fill="url(#g-settings-principal)"/>
   <circle cx="182" cy="48" r="8" fill="url(#g-settings-ai)"/>
   <circle cx="118" cy="64" r="8" fill="#16C784"/>
   <g transform="translate(28 30)">
     <circle cx="18" cy="18" r="10" fill="none" stroke="url(#g-settings-principal)" stroke-width="3"/>
     <circle cx="18" cy="18" r="3" fill="url(#g-settings-principal)"/>
   </g>
   <rect x="238" y="26" width="34" height="44" rx="6" fill="currentColor" fill-opacity="0.1"/>`
);

/** Finish — the growth gradient: a rising series closed by a check. */
const FINISH = svg(
  'finish',
  `<g stroke="currentColor" stroke-opacity="0.18" stroke-width="2" stroke-linecap="round">
     <path d="M40 74h214"/>
   </g>
   <g fill="url(#g-finish-growth)">
     <rect x="52" y="54" width="16" height="20" rx="4"/>
     <rect x="78" y="44" width="16" height="30" rx="4"/>
     <rect x="104" y="32" width="16" height="42" rx="4"/>
     <rect x="130" y="22" width="16" height="52" rx="4"/>
   </g>
   <path d="M60 50l26-12 26-14 26-8" fill="none" stroke="#1E5EFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>
   <g transform="translate(186 26)">
     <circle cx="22" cy="22" r="22" fill="url(#g-finish-growth)"/>
     <path d="M12 22l7 7 15-15" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
   </g>`,
  'growth'
);

/** Keyed by tour step, so the service can look one up without a switch. */
export const TOUR_ILLUSTRATIONS: Record<string, string> = {
  welcome: WELCOME,
  menu: MENU,
  gettingStarted: GETTING_STARTED,
  notifications: NOTIFICATIONS,
  reminders: REMINDERS,
  copilot: COPILOT,
  settings: SETTINGS,
  finish: FINISH,
};

/**
 * Wraps a step description with its illustration.
 *
 * Scenes that depict a screen position (the navigation rail) carry a modifier so the stylesheet
 * can mirror them under `[dir="rtl"]`, where the real sidebar also flips. Abstract scenes are left
 * alone — mirroring a check mark or a clock would look wrong, not localised.
 */
export function withIllustration(stepKey: string, description: string): string {
  const art = TOUR_ILLUSTRATIONS[stepKey];
  if (!art) {
    return description;
  }
  const directional = stepKey === 'menu' ? ' ims-tour-figure--directional' : '';
  return `<span class="ims-tour-figure${directional}">${art}</span>${description}`;
}
