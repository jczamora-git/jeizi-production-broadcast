const fs = require("fs");
const path = require("path");
const { pool } = require("../db");

const HERO_META = {
  akai: { name: "Akai", role: "Tank, Support" },
  aamon: { name: "Aamon", role: "Assassin" },
  aurora: { name: "Aurora", role: "Mage" },
  balmond: { name: "Balmond", role: "Fighter" },
  eudora: { name: "Eudora", role: "Mage" },
  dyroth: { name: "Dyrroth", role: "Fighter" },
  dyrroth: { name: "Dyrroth", role: "Fighter" },
  marcel: { name: "Marcel", role: "Fighter" },
  sora: { name: "Sora", role: "Fighter, Assassin" },
  yi_sun_shin: { name: "Yi Sun-Shin", role: "Assassin, Marksman" },
  yisunshin: { name: "Yi Sun-Shin", role: "Assassin, Marksman" },
};

const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

const normalizeKey = (filename) =>
  filename
    .toLowerCase()
    .replace(path.extname(filename).toLowerCase(), "")
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

const toDisplayName = (key) =>
  key
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const resolveHeroesDir = () =>
  path.join(__dirname, "..", "..", "public", "legacy", "heroes");

const getHeroFiles = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs
    .readdirSync(dirPath)
    .filter((file) => allowedExtensions.has(path.extname(file).toLowerCase()));
};

const getLaneColumn = async () => {
  const [columns] = await pool.query("SHOW COLUMNS FROM heroes");
  return columns.some((column) => column.Field === "lane");
};

const upsertHero = async ({ name, role, image_path, lane, hasLane }) => {
  const [rows] = await pool.query("SELECT id FROM heroes WHERE name = ? LIMIT 1", [name]);
  if (rows.length) {
    if (hasLane) {
      await pool.query(
        "UPDATE heroes SET role = ?, image_path = ?, lane = ? WHERE id = ?",
        [role, image_path, lane, rows[0].id]
      );
    } else {
      await pool.query("UPDATE heroes SET role = ?, image_path = ? WHERE id = ?", [
        role,
        image_path,
        rows[0].id,
      ]);
    }
    return "updated";
  }

  if (hasLane) {
    await pool.query("INSERT INTO heroes (name, role, image_path, lane) VALUES (?,?,?,?)", [
      name,
      role,
      image_path,
      lane,
    ]);
  } else {
    await pool.query("INSERT INTO heroes (name, role, image_path) VALUES (?,?,?)", [
      name,
      role,
      image_path,
    ]);
  }

  return "inserted";
};

const run = async () => {
  const heroesDir = resolveHeroesDir();
  const files = getHeroFiles(heroesDir);

  if (!files.length) {
    console.log("No hero images found in public/legacy/heroes");
    return;
  }

  const hasLane = await getLaneColumn();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      skipped += 1;
      continue;
    }

    const key = normalizeKey(file);
    const meta = HERO_META[key];
    if (!meta) {
      console.warn(`Missing metadata for ${file}`);
    }

    const name = meta?.name || toDisplayName(key);
    const role = meta?.role || "";
    const lane = hasLane ? meta?.lane || null : undefined;
    const image_path = `/legacy/heroes/${file}`;

    const result = await upsertHero({ name, role, image_path, lane, hasLane });
    if (result === "inserted") {
      inserted += 1;
    } else if (result === "updated") {
      updated += 1;
    }
  }

  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
};

run()
  .catch((error) => {
    console.error("Seed failed", error);
  })
  .finally(() => {
    pool.end();
  });
