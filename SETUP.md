# rps forever — push notifications setup

This adds "Notify me when someone joins" to rps forever, using the **same**
Firebase Cloud Messaging setup as Stretch Goals.

The good news: rps forever **already** has a working Firebase project
(`rpsforever`) with **Realtime Database** and **Anonymous Authentication**
enabled — the game uses them. So most of the heavy lifting is done. You only
need to switch on **Cloud Messaging**, grab two keys, and add the database
rules for the new `/subs` node.

Everything stays on the **Spark (free)** plan. **Do not upgrade to Blaze.**

---

## What's already in the repo

| File | What it does |
|---|---|
| `firebase-config.js` | One shared config (page + service worker + send script). **You add the VAPID key here.** |
| `sw.js` | Service worker that shows the push when the tab is closed/backgrounded. |
| `manifest.webmanifest` + `icons/` | Makes the page installable (needed for iPhone push). |
| `index.html` | Now has the **🔔 Notify me when someone joins** button + opt-in logic. |
| `scripts/send-fcm.mjs` | Admin script: reads `/subs`, sends a push to every subscriber. |
| `.github/workflows/send-notification.yml` | Manual "Run workflow" button to fire a push. |

---

## Firebase side — what you need to do (~10 min)

You'll do all of this in the [Firebase Console](https://console.firebase.google.com)
for the existing **rpsforever** project.

### 1. Generate the VAPID (Web Push) key

This is the public key the browser uses to register for push.

1. Click the **gear icon** (top of left rail) → **Project settings**.
2. Open the **Cloud Messaging** tab.
3. Scroll to **Web configuration** → **Web Push certificates**.
4. Click **Generate key pair**. Copy the long string it produces.
5. Paste it into `firebase-config.js`, replacing `REPLACE_ME_VAPID_PUBLIC_KEY`:

   ```js
   vapidKey: "BPa...long base64 string...",
   ```

   (This key is **public** — safe to commit. Same as the Firebase config values.)

### 2. Add the `/subs` database rules

The game's existing rules don't cover the new `/subs` node where push tokens
live. Open **Realtime Database → Rules** and make sure these rules include the
`subs` block below. **If you already have rules for the game (`players`,
`scores`, `bots`, etc.), keep them — just add the `"subs"` entry alongside.**

```json
{
  "rules": {
    "subs": {
      "$uid": {
        ".read":  "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid",
        "token":     { ".validate": "newData.isString() && newData.val().length < 500" },
        "updatedAt": { ".validate": "newData.isNumber()" },
        "$other":    { ".validate": false }
      }
    }

    // ... keep your existing "players", "scores", "bots" rules here ...
  }
}
```

What this says: each device (anonymous UID) can only write its own token row,
and only your service account (the send script) can read all of them. A row
holds nothing but an opaque FCM token + a timestamp — no identity.

> Note: if your current rules are wide-open (`".read": true, ".write": true`)
> for the game, the `subs` block above will still work because it's more
> specific. But consider tightening the game rules too at some point.

### 3. Create a service account for the GitHub Action

This is the secret that lets the Action send pushes on your behalf.

1. **Project settings → Service accounts** tab → **Generate new private key** →
   confirm. A JSON file downloads.
2. Open it in a text editor and copy the **entire** JSON object.
3. In the GitHub repo: **Settings → Secrets and variables → Actions →
   New repository secret**.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: paste the whole JSON.
4. **Delete the downloaded JSON from your computer** once it's in GitHub.

That's the entire Firebase side. (Cloud Messaging itself doesn't need a
separate "enable" — generating the VAPID key in step 1 switches it on.)

---

## Deploy & test

1. Commit and push these files. Confirm **Settings → Pages** is serving from
   `main` (root) — the game is already live, so this is presumably set.
2. Visit `https://YOUR_USER.github.io/rpsForever/`.
   - **iPhone:** Share → **Add to Home Screen**, open it from the Home Screen
     icon, then tap **🔔 Notify me when someone joins** → Allow.
   - **Android / desktop Chrome:** just tap **🔔 Notify me when someone joins** → Allow.
3. Send a test push: **GitHub → Actions → "Send 'someone joined' notification"
   → Run workflow**.
   - First run with **Dry run: ✓** — the log should say
     `sendable tokens: 1` (or however many devices opted in).
   - Then run again with **Dry run: ✗**. Your device should buzz within seconds.

---

## How the automatic version will work (later)

Right now the push is **manual** — you click "Run workflow". The natural next
step is to fire it automatically when a real human joins. A few options we can
talk through:

- A tiny **Cloud Function** (requires Blaze, but stays free under the generous
  free allowance) triggered on a new `/players` child — fully automatic.
- A **GitHub Action on a schedule** (e.g. every few minutes) that checks
  `/players` for newcomers and pushes — stays on Spark, no Blaze, but not
  instant.
- A small **always-on worker** somewhere (Cloud Run, a Pi, etc.) listening to
  RTDB and pushing on join.

We'll pick one once you've confirmed the manual push works.

---

## Heads-up / things to check

- **`adminUrl` in `firebase-config.js`** is set to
  `https://github.com/lookbothways/rpsForever/actions`. If your repo lives
  somewhere else, fix that URL (it's only used as a convenience link).
- **Service worker scope.** Because the site is served from `/rpsForever/`,
  `sw.js` registers at that scope. That's handled automatically by the
  relative `./sw.js` path — nothing for you to do.
- **No caching.** Unlike Stretch Goals, `sw.js` here does **not** cache the
  game (it must always load fresh from the network). It only handles pushes.

## Privacy / cost notes

- No accounts, no emails, no cookies. Each device gets a random anonymous
  Firebase UID; under it we store only an FCM token + timestamp.
- **Stay on Spark.** The manual setup above is $0 forever. Spark fails closed
  when free limits are hit — that's the safety net.
