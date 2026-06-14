import { copyFileSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const officialDir = join(root, 'src/assets/app-logo/official');
const appLogoDir = join(root, 'src/assets/app-logo');

const OFFICIAL_LIGHT = 'nadigit-ims-primary-logo-light.svg';
const OFFICIAL_DARK = 'nadigit-ims-primary-logo-dark.svg';

const WEB_LIGHT = join(appLogoDir, 'nadigitims-logo-light.svg');
const WEB_DARK = join(appLogoDir, 'nadigitims-logo-dark.svg');
const WEB_LIGHT_PNG = join(appLogoDir, 'nadigitims-logo-light-full.png');
const WEB_DARK_PNG = join(appLogoDir, 'nadigitims-logo-dark-full.png');
const SECONDARY_DARK = join(appLogoDir, 'secondary/nadigit-ims-secondary-logo-dark.svg');

function stripDarkLogoBackground(svg) {
  return svg
    .replace(/^\s*\.st0\{fill:#0B1F4A;\}\r?\n/m, '')
    .replace(/^\s*<rect y="-0\.4" class="st0" width="2500" height="1000\.4"\/>\r?\n/m, '');
}

copyFileSync(join(officialDir, OFFICIAL_LIGHT), WEB_LIGHT);

const darkSvg = readFileSync(join(officialDir, OFFICIAL_DARK), 'utf8');
writeFileSync(WEB_DARK, stripDarkLogoBackground(darkSvg));

const secondaryDarkSvg = readFileSync(SECONDARY_DARK, 'utf8');
writeFileSync(SECONDARY_DARK, stripDarkLogoBackground(secondaryDarkSvg));

console.log(`Synced ${WEB_LIGHT}`);
console.log(`Synced ${WEB_DARK}`);
console.log(`Stripped background from ${SECONDARY_DARK}`);

try {
  const sharp = (await import('sharp')).default;
  await sharp(WEB_LIGHT, { density: 200 }).png().toFile(WEB_LIGHT_PNG);
  await sharp(WEB_DARK, { density: 200 }).png().toFile(WEB_DARK_PNG);
  console.log(`Synced ${WEB_LIGHT_PNG}`);
  console.log(`Synced ${WEB_DARK_PNG}`);
} catch (error) {
  console.warn('PNG fallbacks skipped (install sharp devDependency to regenerate):', error.message);
}
