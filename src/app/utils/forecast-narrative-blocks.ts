export interface ForecastNarrativeBlock {
  title: string;
  body: string;
}

const MAX_SECTIONS = 80;
const MAX_TITLE_CHARS = 240;
const MAX_BODY_CHARS = 24000;

/**
 * Splits backend narrative into titled blocks. Caps sections and length so pathological text cannot freeze the UI.
 */
export function parseForecastNarrativeBlocks(narrative: string | null | undefined): ForecastNarrativeBlock[] {
  const raw = (narrative || '').trim();
  if (!raw) {
    return [];
  }
  const chunks = raw
    .split(/\n\n+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, MAX_SECTIONS);
  return chunks.map((chunk) => {
    const nl = chunk.indexOf('\n');
    if (nl === -1) {
      return { title: '', body: truncate(chunk) };
    }
    const title = chunk.slice(0, nl).trim().slice(0, MAX_TITLE_CHARS);
    const body = truncate(chunk.slice(nl + 1).trim());
    return { title, body };
  });
}

function truncate(s: string): string {
  if (s.length <= MAX_BODY_CHARS) {
    return s;
  }
  return s.slice(0, MAX_BODY_CHARS) + '\u2026';
}
