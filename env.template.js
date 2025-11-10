(function (window) {
  window.__env = {
    kcHost: '${ANGULAR_KC_HOST}',
    kcPort: '${ANGULAR_KC_PORT}',
    apiProtocol: '${ANGULAR_API_PROTOCOL}',
    apiHost: '${ANGULAR_API_HOST}',
    apiPort: '${ANGULAR_API_PORT}',
    kcRealm: '${KEYCLOAK_REALM_NAME}',
    kcClientId: '${KEYCLOAK_CLIENT_ID}'
  };
})(this);
