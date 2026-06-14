# Nadigit IMS — Keycloak Login Theme

This folder contains a Keycloak **keycloak.v2** login theme (PatternFly v5 + brand CSS) aligned with the Nadigit IMS brand guidelines (March 2026).

**Production (Docker Compose):** copy or sync this folder to `ims/keycloak-theme/` (mounted by `ims/docker-compose.yml`), then restart Keycloak. The running server does **not** pick up repo changes until the theme is redeployed and cache is cleared.

## Contents

```
keycloak-theme/nadigit-ims/login/
├── theme.properties
├── template.ftl          # marketing logo via <img> (overrides realm display name)
└── resources/
    ├── css/styles.css
    ├── css/nadigit-brand.css
    └── img/
        ├── nadigitims-logo.svg   # synced from app dark logo
        ├── nadigitims-logo.png   # PNG fallback
        └── favicon.svg
```

## Sync logo from webapp assets

After updating files under `src/assets/app-logo/`, copy them into the theme:

```bash
npm run sync:keycloak-theme
```

This keeps `nadigitims-logo.svg` / `.png` aligned with `nadigitims-logo-dark.svg` and `nadigitims-logo-dark-full.png`.

## Deploy (standalone Keycloak)

1. Copy the theme into Keycloak's themes directory:

   ```bash
   cp -r keycloak-theme/nadigit-ims /opt/keycloak/themes/
   ```

   On Windows (PowerShell, adjust paths):

   ```powershell
   Copy-Item -Recurse keycloak-theme\nadigit-ims "C:\path\to\keycloak\themes\"
   ```

2. Restart Keycloak (or rebuild the container image if themes are baked in). With Docker Compose: `docker compose restart keycloak`.

3. Hard-refresh the login page (incognito) after theme changes — Keycloak caches CSS aggressively. On the server, delete `data/tmp/kc-gzip-cache/` if the old logo still appears.

4. In **Keycloak Admin Console** (only if bootstrap is disabled):
   - Open your realm (e.g. `Nadigit_ims`)
   - **Realm settings → Themes**
   - Set **Login theme** to `nadigit-ims`
   - Save

   With Docker Compose and `IMS_KEYCLOAK_BOOTSTRAP_ENABLED=true`, the IMS backend applies this automatically on first startup.

5. Open an incognito window and verify the login page shows:
   - Navy → SaaS blue gradient background
   - Nadigit IMS logo
   - `#1E5EFF` primary button

## Docker / Kubernetes

Mount or COPY the theme into the image:

```dockerfile
COPY keycloak-theme/nadigit-ims /opt/keycloak/themes/nadigit-ims
```

Or mount as a volume:

```yaml
volumes:
  - ./keycloak-theme/nadigit-ims:/opt/keycloak/themes/nadigit-ims
```

## Compatibility notes

- `theme.properties` uses `parent=keycloak.v2` (Keycloak 17+) and loads PatternFly v5 via `stylesCommon` plus `styles.css` (layout) and `nadigit-brand.css` (brand overrides). Do **not** replace parent styles with a single custom file only.
- `darkMode=false` keeps the login card in light mode for readable form fields.
- For **Keycloak 16 or older**, change the parent line to:

  ```
  parent=keycloak
  import=common/keycloak
  ```

- If the logo does not appear, run `npm run sync:keycloak-theme`, confirm `resources/img/nadigitims-logo.svg` exists, redeploy the theme, and clear Keycloak theme cache.
- `template.ftl` is based on Keycloak 26 `keycloak.v2` and injects the marketing logo `<img>` instead of the realm display name. If login layout breaks after a major Keycloak upgrade, compare with the upstream `template.ftl` and merge changes.

## Optional: realm display name

Set **Realm settings → General → Display name** to `Nadigit IMS` and **HTML Display name** if you want the header text to match the webapp.

## Marketing assets

The login theme uses the marketing-approved **dark full logo SVG** (`nadigitims-logo.svg`, sourced from `src/assets/app-logo/nadigitims-logo-dark.svg`). Source Illustrator files are archived under `src/assets/app-logo/official/`. Do not modify proportions or colors without brand approval.
