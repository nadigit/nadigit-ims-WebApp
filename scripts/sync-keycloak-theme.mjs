import { copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const imgDir = join(root, 'keycloak-theme/nadigit-ims/login/resources/img');
mkdirSync(imgDir, { recursive: true });

const copies = [
  ['src/assets/app-logo/nadigitims-logo-dark.svg', 'keycloak-theme/nadigit-ims/login/resources/img/nadigitims-logo.svg'],
  ['src/assets/app-logo/secondary/nadigit-ims-secondary-logo-dark.png', 'keycloak-theme/nadigit-ims/login/resources/img/nadigitims-logo.png'],
  ['src/assets/app-logo/favicon/nadigitims-favicon-light.svg', 'keycloak-theme/nadigit-ims/login/resources/img/favicon.svg'],
];

for (const [src, dest] of copies) {
  copyFileSync(join(root, src), join(root, dest));
  console.log(`Synced ${dest}`);
}
