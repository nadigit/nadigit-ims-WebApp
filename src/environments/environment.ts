// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  firebaseConfig: {
    apiKey: 'AIzaSyAlnytRGPqpMa6ORCbyUdvretgwje-w3zU',
    authDomain: 'nadigitims.firebaseapp.com',
    projectId: 'nadigitims',
    storageBucket: 'nadigitims.appspot.com',
    messagingSenderId: '49137857621',
    appId: '1:49137857621:web:75695ee24281f4dda050dc',
  },
  keycloak: {
    authority: `${window.__env.apiProtocol}://${window.__env.kcHost}:${window.__env.kcPort}`,
    redirectUri: `${window.__env.apiProtocol}://${window.__env.apiHost}:${window.__env.apiPort}/realms/${window.__env.kcRealm}/protocol/openid-connect/callback`,
    postLogoutRedirectUri: `${window.__env.apiProtocol}://${window.__env.apiHost}:${window.__env.apiPort}/logout`,
    realm: `${window.__env.kcRealm}`,
    clientId: `${window.__env.kcClientId}`,
  },
  idleConfig: { idle: 10, timeout: 60, ping: 10 },
};


/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
