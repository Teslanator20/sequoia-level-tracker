# Sequoia Level Tracker

Polls the Wynncraft API for the guild **Sequoia** every 5 minutes via GitHub
Actions, stores the result in this repo, and serves it as static JSON over
GitHub Pages.

Web UI: <https://teslanator20.github.io/sequoia-level-tracker/>

## Public API

Two static JSON endpoints. No auth, no rate limit, `Access-Control-Allow-Origin: *`
(so browser JS can fetch them directly).

| Endpoint | Contents |
|----------|----------|
| [`data.json`](https://teslanator20.github.io/sequoia-level-tracker/data.json) | Current level/xp + every level-up event |
| [`series.json`](https://teslanator20.github.io/sequoia-level-tracker/series.json) | xp-over-time points |

### `data.json`

```json
{
  "current": {
    "level": 245,
    "xpPercent": 15,
    "updatedAt": "2026-07-29T14:05:34.760Z"
  },
  "history": [
    { "level": 221, "fromLevel": 220, "ts": "2026-05-10T02:36:00.000Z" }
  ]
}
```

- `current.updatedAt` — when the last poll ran, **not** when the value last
  changed. Use it to check freshness.
- `history` — one entry per level-up, oldest first. `ts` is when the poll
  *observed* the new level, so it lags the real level-up by up to 5 minutes.

### `series.json`

```json
{
  "guild": "Sequoia",
  "unit": "xpPercent",
  "updatedAt": "2026-07-29T14:05:34.760Z",
  "points": [
    { "ts": "2026-05-10T02:36:00.000Z", "level": 221, "xp": 0, "src": "levelup" },
    { "ts": "2026-07-29T14:05:34.760Z", "level": 245, "xp": 15, "src": "poll" }
  ]
}
```

- `xp` is `xpPercent` — an integer 0–100, progress toward the next guild level.
- A point is appended **only when `level` or `xp` changed.** Polls that see no
  change write nothing, which is why this file stays small enough to keep in
  git. Consequence: between two points the value was constant, so plot it as a
  step line, not a smooth interpolation.
- `src` says where the point came from:
  - `"poll"` — observed directly by a poll run.
  - `"levelup"` — backfilled from `data.json` history. xp is *assumed* 0
    because xp resets on level-up; it was not actually measured. All points
    before 2026-07-29 are backfilled.

### Notes for consumers

- GitHub Pages sends `Cache-Control: max-age=600`, so a cached response can be
  up to 10 minutes stale while the poll runs every 5. Add a cache-buster
  (`?_=<timestamp>`) or `cache: "no-store"` if you need the freshest value.
- Polling these files more than once a minute is pointless — the data only
  moves every 5 minutes.
- The upstream source is `https://api.wynncraft.com/v3/guild/Sequoia`. Live
  fields this repo does *not* store: members, territories, wars, raids,
  seasonRanks, ranking. Query Wynncraft directly for those.

### Examples

```bash
curl -s https://teslanator20.github.io/sequoia-level-tracker/data.json | jq .current
```

```js
const res = await fetch(
  "https://teslanator20.github.io/sequoia-level-tracker/series.json",
  { cache: "no-store" }
);
const { points } = await res.json();
```

```python
import requests
r = requests.get("https://teslanator20.github.io/sequoia-level-tracker/series.json")
points = r.json()["points"]
```

## Repo layout

| File | Purpose |
|------|---------|
| `poll.js` | Fetches the Wynncraft API, updates `data.json` and `series.json` |
| `.github/workflows/poll.yml` | Cron `*/5 * * * *`, runs `poll.js`, commits changes |
| `index.html` | Web UI, reads `data.json` |
| `data.json`, `series.json` | The stored data / API responses |

Run the poller locally:

```bash
node poll.js
```

It writes to the JSON files in the working directory, so run it from the repo
root.
