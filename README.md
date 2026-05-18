# Rock Paper Scissors (RPSforever)

A constantly-running, anonymous, multiplayer rock-paper-scissors game on a shared grid. No logins, no accounts, no PII. Show up, get assigned a team, chase the other letters.

## How it works

- On arrival you're anonymously assigned to team **R**, **P**, or **S** — whichever has the fewest players (random if equal).
- You get a name like `Boulder-42` and the header tells you who you are.
- Press **START**. Your pointer/finger becomes your letter on the grid. The character is rendered slightly above your finger so you can see it on mobile.
- Move into a cell occupied by someone you beat (R > S > P > R) → you score a point for your team, they get sent back to START.
- Move into a cell occupied by someone who beats you → they score, you get sent back to START.
- Leave the grid and your character sticks to the last spot until you're got or you press STOP.
- If you're the only player around, a faded bot spawns in the middle for you to chase. Catch it and the button turns into **INVITE YOUR FRIENDS** with a shareable URL.

## Tech

- Vanilla HTML/JS, single file.
- Firebase Realtime Database (Spark/free tier) for shared state.
- Firebase Anonymous Auth — no personal data stored, ever.
- Roboto Thin, thin lines, white background. Visual sibling to [weja](https://github.com/lookbothways/weja).

## Configuration

Key tunables live at the top of the `<script>` block in `index.html`:

| Constant | Default | Purpose |
|---|---|---|
| `GRID_RESOLUTION` | `100` | Logical grid size. Bump to `1024` for finer movement; collision and rendering scale automatically. |
| `WRITE_INTERVAL_MS` | `80` | Throttle for position writes to Firebase. Lower = smoother for others, more bandwidth. |
| `STALE_MS` | `15000` | Players unseen this long stop being rendered. |
| `POINTER_OFFSET_CELLS` | `3` | How far above the finger the character renders. |
| `BOT_MOVE_INTERVAL_MS` | `600` | How often the solo-mode bot wanders one step. |
| `ICON_PATHS` | `{ R: null, P: null, S: null }` | Placeholder for swapping the R/P/S text for real icons. |

## Firebase data shape

```
/players/{randomId}    → { name, type, x, y, active, joinedAt, lastSeen }
/bot                   → { type, x, y, owner, lastMove }    (only present when one human is alone)
/scores/{R|P|S}        → integer
```

