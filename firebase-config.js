// =======================================================================
//  rps forever — Firebase config.
//  Safe to commit. These are public web keys; real security is enforced by
//  the Realtime Database rules in SETUP.md, not by these values.
//
//  This one file is the single source of truth shared by three places:
//    - index.html      (the game + the "notify me" opt-in)
//    - sw.js           (the service worker that shows the push)
//    - scripts/send-fcm.mjs (the admin script that sends the push)
// =======================================================================

self.RPS_CONFIG = {
  firebase: {
    apiKey:            "AIzaSyDCev1bJXI0jGqKvMzrXnSRcZKEwQhRP8s",
    authDomain:        "rpsforever.firebaseapp.com",
    databaseURL:       "https://rpsforever-default-rtdb.europe-west1.firebasedatabase.app",
    projectId:         "rpsforever",
    storageBucket:     "rpsforever.firebasestorage.app",
    messagingSenderId: "577664413632",
    appId:             "1:577664413632:web:0efa4b3ab683399a8e6225"
  },
  // The VAPID web-push public key.
  // Firebase Console → Project Settings → Cloud Messaging tab →
  // Web configuration → Web Push certificates → Generate key pair → copy here.
  vapidKey: "REPLACE_ME_VAPID_PUBLIC_KEY",
  adminUrl: "https://github.com/lookbothways/rpsForever/actions"
};
