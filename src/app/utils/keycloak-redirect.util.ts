/**
 * Build redirect_uri for Keycloak login/init. Must match a Valid Redirect URI on the client.
 * Router URLs under base href /webconsole/ are often "/" relative to the app; combining only
 * origin + state.url yields http://localhost:4200/ and breaks OIDC redirect matching.
 */
export function buildKeycloakRedirectUri(): string {
  return window.location.href.split('#')[0].split('?')[0];
}
