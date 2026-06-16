// rps forever — admin send script.
// Reads every push token from /subs in the Realtime Database and sends each
// one an FCM push ("someone joined"). Cleans up dead tokens as it goes.
//
// Run by the GitHub Action (.github/workflows/send-notification.yml) or
// locally with FIREBASE_SERVICE_ACCOUNT set:
//   FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node send-fcm.mjs

import { readFile } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";

// ---------- Load the shared client config -----------------------------
// firebase-config.js contains `self.RPS_CONFIG = { ... };`
// We eval it with a fake `self` so we read the very same values the page uses.
const cfgText = await readFile(new URL("../firebase-config.js", import.meta.url), "utf8");
const fakeSelf = {};
new Function("self", cfgText)(fakeSelf);
const cfg = fakeSelf.RPS_CONFIG;
if (!cfg || !cfg.firebase || cfg.firebase.projectId.startsWith("REPLACE_ME")) {
  console.error("firebase-config.js is not configured yet.");
  process.exit(1);
}

// ---------- Inputs ----------------------------------------------------
const title  = (process.env.TITLE   || "rps forever").trim();
const body   = (process.env.MESSAGE || "Someone just entered the arena. Come play!").trim();
const dryRun = process.env.DRY_RUN === "true";

const svcRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!svcRaw) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT secret.");
  process.exit(1);
}
let serviceAccount;
try { serviceAccount = JSON.parse(svcRaw); }
catch { console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON."); process.exit(1); }

// ---------- Init admin SDK -------------------------------------------
const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: cfg.firebase.databaseURL
});
const db  = getDatabase(app);
const msg = getMessaging(app);

// ---------- Gather tokens --------------------------------------------
const snap = await db.ref("subs").once("value");
const subs = snap.val() || {};
const targets = [];
for (const [uid, s] of Object.entries(subs)) {
  if (s && typeof s === "object" && typeof s.token === "string" && s.token.length > 10) {
    targets.push({ uid, token: s.token });
  }
}
console.log(`Subscribers: ${Object.keys(subs).length}, sendable tokens: ${targets.length}`);

if (targets.length === 0) { console.log("Nobody to notify. Done."); process.exit(0); }
if (dryRun) { console.log("Dry run; nothing sent."); process.exit(0); }

// ---------- Send ------------------------------------------------------
let ok = 0, fail = 0;
const dead = [];
for (const { uid, token } of targets) {
  try {
    // Data-only payload: the service worker calls showNotification itself.
    // Avoids FCM's auto-display path, which can silently drop notifications
    // when icon URLs 404 under project-pages (/repo/...).
    await msg.send({
      token,
      data: { title, body },
      webpush: { headers: { Urgency: "high" }, fcmOptions: { link: "./" } }
    });
    ok++;
  } catch (e) {
    fail++;
    const code = e?.errorInfo?.code || e?.code || "unknown";
    console.error(`fail ${uid}: ${code}`);
    if (code === "messaging/registration-token-not-registered"
     || code === "messaging/invalid-registration-token") {
      dead.push(uid);
    }
  }
}
console.log(`Sent=${ok} fail=${fail} deadTokens=${dead.length}`);

// Tidy up dead tokens so we don't keep retrying them.
for (const uid of dead) {
  try { await db.ref(`subs/${uid}`).remove(); } catch { /* ignore */ }
}
process.exit(0);
