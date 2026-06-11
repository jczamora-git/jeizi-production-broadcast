const express = require("express");
const { pool } = require("../db");

const router = express.Router();

const titleOrder = [
  "elimination",
  "qualifiers",
  "playoffs",
  "semifinals",
  "finals",
];

function normalizeStageTitle(title) {
  const trimmed = String(title || "").trim();
  if (!trimmed) {
    return "Untitled Matches";
  }

  const normalized = trimmed.toLowerCase();
  if (normalized === "elimination") return "Elimination";
  if (normalized === "qualifiers") return "Qualifiers";
  if (normalized === "playoffs") return "Playoffs";
  if (normalized === "finals") return "Finals";
  if (normalized === "semifinals") return "Semifinals";
  if (normalized === "semi-finals") return "Semifinals";
  if (normalized === "semi finals") return "Semifinals";

  return trimmed;
}

function getTitleSortWeight(title) {
  const normalized = String(title || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return 999;
  }

  if (normalized.includes("semi")) {
    return titleOrder.indexOf("semifinals");
  }

  const index = titleOrder.indexOf(normalized);
  return index >= 0 ? index : 900;
}

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         m.id,
         m.match_no,
         m.queue_order,
         m.mode,
         m.title,
         m.status,
         m.blue_score,
         m.red_score,
         m.series_completed,
         m.series_winner_team_id,
         m.series_completed_at,
         m.created_at,
         m.updated_at,
         bt.id AS blue_team_id,
         bt.name AS blue_team_name,
         bt.shortname AS blue_team_shortname,
         bt.logo AS blue_team_logo,
         rt.id AS red_team_id,
         rt.name AS red_team_name,
         rt.shortname AS red_team_shortname,
         rt.logo AS red_team_logo
       FROM matches m
       LEFT JOIN teams bt ON bt.id = m.blue_team_id
       LEFT JOIN teams rt ON rt.id = m.red_team_id
       ORDER BY
         m.title ASC,
         COALESCE(m.queue_order, 999999) ASC,
         COALESCE(m.match_no, 999999) ASC,
         m.id ASC`
    );

    const groupsMap = new Map();

    rows.forEach((match) => {
      const displayTitle = normalizeStageTitle(match.title);
      if (!groupsMap.has(displayTitle)) {
        groupsMap.set(displayTitle, []);
      }
      groupsMap.get(displayTitle).push(match);
    });

    const groups = Array.from(groupsMap.entries())
      .map(([title, matches]) => ({ title, matches }))
      .sort((a, b) => {
        const weightDiff = getTitleSortWeight(a.title) - getTitleSortWeight(b.title);
        if (weightDiff !== 0) {
          return weightDiff;
        }
        return a.title.localeCompare(b.title);
      });

    res.json({ groups });
  } catch (error) {
    console.error("Failed to load schedule", error);
    res.status(500).json({ message: "Failed to load schedule" });
  }
});

module.exports = router;
