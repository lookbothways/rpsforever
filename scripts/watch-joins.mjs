// rps forever — automatic join watcher.
//
// Holds a live connection to the Realtime Database and pushes a notification
// to every /subs token when the arena goes from empty to occupied — i.e. the
// first real human shows up, so a lone arrival can summon everyone else.
// Event-driven, so it fires within ~1s of the join.
//
// Stays on the free Spark plan (no Blaze, no Cloud Functions). It just needs
// to keep running somewhere. See the run instructions at the bottom.
//
// Run:
//   FIREBASE_SERVICE_ACCOUNT="$(cat serviceAccount.json)" node watch-joins.mjs
// or point it at a file:
//   FIREBASE_SERVICE_ACCOUNT_FILE=./serviceAccount.json node watch-joins.mjs

import { readFile } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getMessaging } from "firebase-admin/messaging";

// ---------- Tunables (mirror the client) ------------------------------
const STALE_MS       = 15000;            // a player is "active" if seen within this window
const COOLDOWN_MS    = 5 * 60 * 1000;    // min gap between pushes, so we don't spam
const TITLE          = process.env.TITLE   || "rps forever";
const MESSAGE        = process.env.MESSAGE || "A real human just entered the arena. Come play!";

// ---------- Load the shared client config -----------------------------
const cfgText = await readFile(new URL("../firebase-config.js", import.meta.url), "utf8");
const fakeSelf = {};
new Function("self", cfgText)(fakeSelf);
const cfg = fakeSelf.RPS_CONFIG;
if (!cfg || !cfg.firebase || cfg.firebase.projectId.startsWith("REPLACE_ME")) {
  console.error("firebase-config.js is not configured yet."); process.exit(1);
}

// ---------- Service account ------------------------------------------
let svcRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!svcRaw && process.env.FIREBASE_SERVICE_ACCOUNT_FILE) {
  svcRaw = await readFile(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, "utf8");
}
if (!svcRaw) {
  console.error("Set FIREBASE_SERVICE_ACCOUNT (the JSON) or FIREBASE_SERVICE_ACCOUNT_FILE (a path).");
  process.exit(1);
}
let serviceAccount;
try { serviceAccount = JSON.parse(svcRaw); }
catch { console.error("Service account is not valid JSON."); process.exit(1); }

// ---------- Init ------------------------------------------------------
const app = initializeApp({ credential: cert(serviceAccount), databaseURL: cfg.firebase.databaseURL });
const db  = getDatabase(app);
const msg = getMessaging(app);

// ---------- Send a push to every subscriber ---------------------------
async function notifyAll() {
  const snap = await db.ref("subs").once("value");
  const subs = snap.val() || {};
  const targets = Object.entries(subs)
    .filter(([, s]) => s && typeof s.token === "string" && s.token.length > 10)
    .map(([uid, s]) => ({ uid, token: s.token }));
  if (targets.length === 0) { console.log("  (no subscribers to notify)"); return; }

  let ok = 0, fail = 0; const dead = [];
  for (const { uid, token } of targets) {
    try {
      await msg.send({
        token,
        data: { title: TITLE, body: MESSAGE },
        webpush: { headers: { Urgency: "high" }, fcmOptions: { link: "./" } }
      });
      ok++;
    } catch (e) {
      fail++;
      const code = e?.errorInfo?.code || e?.code || "unknown";
      if (code === "messaging/registration-token-not-registered"
       || code === "messaging/invalid-registration-token") dead.push(uid);
    }
  }
  console.log(`  pushed ok=${ok} fail=${fail} dead=${dead.length}`);
  for (const uid of dead) { try { await db.ref(`subs/${uid}`).remove(); } catch {} }
}

// ---------- Count active humans --------------------------------------
function activeHumans(players) {
  const now = Date.now();
  return Object.values(players || {}).filter(
    p => p && p.type && p.lastSeen && (now - p.lastSeen) < STALE_MS
  ).length;
}

// ---------- Watch -----------------------------------------------------
let prevCount = null;     // null until the first snapshot (suppresses startup burst)
let lastNotifiedAt = 0;

console.log(`[watch-joins] connected to ${cfg.firebase.projectId}. Watching /players …`);

db.ref("players").on("value", async (snap) => {
  const count = activeHumans(snap.val());
  if (prevCount === null) {            // first read on startup — just record, don't notify
    prevCount = count;
    console.log(`[watch-joins] baseline active humans = ${count}`);
    return;
  }
  // Fire when the arena goes from empty to occupied (0 -> 1+), so a lone
  // arrival can summon everyone. Rate-limited by the cooldown below.
  if (prevCount === 0 && count >= 1) {
    const now = Date.now();
    if (now - lastNotifiedAt >= COOLDOWN_MS) {
      lastNotifiedAt = now;
      console.log(`[watch-joins] ${new Date().toISOString()} humans ${prevCount} -> ${count}: notifying`);
      try { await notifyAll(); } catch (e) { console.error("  notifyAll error:", e?.message || e); }
    } else {
      console.log(`[watch-joins] humans ${prevCount} -> ${count} but within cooldown; skipping`);
    }
  }
  prevCount = count;
}, (err) => {
  console.error("[watch-joins] listener error:", err?.message || err);
});

// Keep the process alive + a tiny heartbeat so you can see it's running.
setInterval(() => {}, 1 << 30);
process.on("SIGINT", () => { console.log("\n[watch-joins] bye"); process.exit(0); });
