import { readFile, writeFile } from "node:fs/promises";

const GUILD = "Sequoia";
const API = `https://api.wynncraft.com/v3/guild/${GUILD}`;
const DATA_FILE = "data.json";

async function loadData() {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { current: null, history: [] };
  }
}

async function main() {
  const data = await loadData();

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

  await writeFile(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
  console.log(`OK level=${level} xp=${xpPercent}% history=${data.history.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
