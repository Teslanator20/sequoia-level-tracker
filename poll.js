import { readFile, writeFile } from "node:fs/promises";

const GUILD = "Sequoia";
const API = `https://api.wynncraft.com/v3/guild/${GUILD}`;
const DATA_FILE = "data.json";
const SERIES_FILE = "series.json";

async function loadJson(path, fallback) {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function loadData() {
  return loadJson(DATA_FILE, { current: null, history: [] });
}

async function loadSeries() {
  return loadJson(SERIES_FILE, {
    guild: GUILD,
    unit: "xpPercent",
    note:
      "Point appended only when level or xp changed. src=levelup means backfilled " +
      "from level-up history (xp assumed 0); src=poll means observed directly.",
    points: [],
  });
}

// xpPercent is an integer 0-100, so a point is only worth storing when
// level or xp actually changed. Keeps the file small enough to live in git
// instead of ~288 identical points per day.
function appendPoint(series, level, xpPercent, ts) {
  const last = series.points[series.points.length - 1];
  if (last && last.level === level && last.xp === xpPercent) return false;
  series.points.push({ ts, level, xp: xpPercent, src: "poll" });
  return true;
}

async function main() {
  const data = await loadData();
  const series = await loadSeries();

  const res = await fetch(API, { headers: { "User-Agent": "sequoia-level-tracker" } });
  if (!res.ok) {
    console.error(`API HTTP ${res.status}`);
    process.exit(1);
  }
  const body = await res.json();

  const level = body.level;
  const xpPercent = body.xpPercent;
  const now = new Date().toISOString();

  if (typeof level !== "number") {
    console.error("Unexpected API response", body);
    process.exit(1);
  }

  const prev = data.current;
  if (prev && typeof prev.level === "number" && level > prev.level) {
    data.history.push({
      level,
      fromLevel: prev.level,
      ts: now,
    });
    console.log(`LEVEL UP: ${prev.level} -> ${level} at ${now}`);
  }

  data.current = { level, xpPercent, updatedAt: now };

  const appended = appendPoint(series, level, xpPercent, now);
  series.updatedAt = now;

  await writeFile(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
  await writeFile(SERIES_FILE, JSON.stringify(series, null, 2) + "\n");
  console.log(
    `OK level=${level} xp=${xpPercent}% history=${data.history.length} ` +
      `points=${series.points.length}${appended ? " (+1)" : " (unchanged)"}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
