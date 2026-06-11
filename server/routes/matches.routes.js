const express = require("express");
const { pool } = require("../db");
const { getMaxGamesByMode, recalculateMatchSeriesState } = require("../matchSeries");

const router = express.Router();
const allowedModes = new Set(["BO1", "BO3", "BO5", "BO7"]);
const allowedTitles = new Set([
  "Elimination",
  "Qualifiers",
  "Playoffs",
  "Semi-Finals (Lower)",
  "Semi-Finals (Upper)",
  "Finals",
]);

function normalizeCasterIds(value) {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join(",");
    return normalized || null;
  }

  if (value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM matches ORDER BY queue_order ASC");
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch matches", error);
    res.status(500).json({ message: "Failed to fetch matches" });
  }
});

router.get("/current", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM matches WHERE status IN ('active','live') ORDER BY queue_order ASC LIMIT 1"
    );
    res.json(rows[0] || null);
  } catch (error) {
    console.error("Failed to fetch current match", error);
    res.status(500).json({ message: "Failed to fetch current match" });
  }
});

router.post("/", async (req, res) => {
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    const {
      match_no,
      blue_team_id,
      red_team_id,
      mode,
      title,
      caster_ids,
      queue_order,
      blue_score,
      red_score,
      status,
    } = req.body;

    if (!blue_team_id || !red_team_id) {
      return res.status(400).json({ message: "Blue Team and Red Team are required" });
    }

    if (String(blue_team_id) === String(red_team_id)) {
      return res.status(400).json({ message: "Blue Team and Red Team must differ" });
    }

    if (!mode || !allowedModes.has(mode)) {
      return res.status(400).json({ message: "Mode must be BO1, BO3, BO5, or BO7" });
    }

    if (!title || !allowedTitles.has(title)) {
      return res.status(400).json({
        message:
          "Title must be one of: Elimination, Qualifiers, Playoffs, Semi-Finals (Lower), Semi-Finals (Upper), Finals",
      });
    }

    let finalMatchNo = match_no;
    if (!finalMatchNo) {
      const [rows] = await pool.query(
        "SELECT COALESCE(MAX(match_no), 0) + 1 AS next_match_no FROM matches"
      );
      finalMatchNo = rows[0]?.next_match_no || 1;
    }

    let finalQueueOrder = queue_order;
    if (!finalQueueOrder && finalQueueOrder !== 0) {
      const [rows] = await pool.query(
        "SELECT COALESCE(MAX(queue_order), 0) + 1 AS next_queue_order FROM matches"
      );
      finalQueueOrder = rows[0]?.next_queue_order || 1;
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const [result] = await connection.query(
      "INSERT INTO matches (match_no, blue_team_id, red_team_id, mode, title, caster_ids, queue_order, blue_score, red_score, status) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        finalMatchNo,
        blue_team_id,
        red_team_id,
        mode,
        title,
        caster_ids || null,
        finalQueueOrder,
        blue_score || 0,
        red_score || 0,
        status || "queued",
      ]
    );

    const matchId = result.insertId;
    const maxGames = getMaxGamesByMode(mode);
    const gameValues = [];

    for (let gameNo = 1; gameNo <= maxGames; gameNo += 1) {
      gameValues.push([matchId, gameNo, null, "setup"]);
    }

    await connection.query(
      "INSERT INTO games (match_id, game_no, map_id, status) VALUES ?",
      [gameValues]
    );

    await connection.commit();

    const io = req.app.get("io");
    if (io) {
      io.emit("matches:changed");
      io.emit("standings:changed");
    }

    res.status(201).json({
      id: matchId,
      generated_games: maxGames,
    });
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }
    console.error("Failed to create match", error);
    res.status(500).json({ message: "Failed to create match" });
  } finally {
    connection.release();
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      match_no,
      blue_team_id,
      red_team_id,
      mode,
      title,
      caster_ids,
      queue_order,
      blue_score,
      red_score,
      status,
    } = req.body;

    const [rows] = await pool.query("SELECT * FROM matches WHERE id = ?", [id]);
    const existingMatch = rows[0];

    if (!existingMatch) {
      return res.status(404).json({ message: "Match not found" });
    }

    const finalMatchNo = match_no ?? existingMatch.match_no;
    const finalBlueTeamId = blue_team_id ?? existingMatch.blue_team_id;
    const finalRedTeamId = red_team_id ?? existingMatch.red_team_id;
    const finalMode = mode ?? existingMatch.mode;
    const finalTitle = title ?? existingMatch.title;
    const finalBlueScore = blue_score ?? existingMatch.blue_score;
    const finalRedScore = red_score ?? existingMatch.red_score;
    const finalQueueOrder = queue_order ?? existingMatch.queue_order;
    const finalStatus = status ?? existingMatch.status;
    const normalizedCasterIds = normalizeCasterIds(caster_ids);
    const finalCasterIds =
      normalizedCasterIds !== undefined ? normalizedCasterIds : existingMatch.caster_ids;

    if (blue_team_id !== undefined && !finalBlueTeamId) {
      return res.status(400).json({ message: "Blue Team is required" });
    }

    if (red_team_id !== undefined && !finalRedTeamId) {
      return res.status(400).json({ message: "Red Team is required" });
    }

    if (String(finalBlueTeamId) === String(finalRedTeamId)) {
      return res.status(400).json({ message: "Blue Team and Red Team must differ" });
    }

    if (!allowedModes.has(finalMode)) {
      return res.status(400).json({ message: "Mode must be BO1, BO3, BO5, or BO7" });
    }

    if (!allowedTitles.has(finalTitle)) {
      return res.status(400).json({
        message:
          "Title must be one of: Elimination, Qualifiers, Playoffs, Semi-Finals (Lower), Semi-Finals (Upper), Finals",
      });
    }

    await pool.query(
      "UPDATE matches SET match_no = ?, blue_team_id = ?, red_team_id = ?, mode = ?, title = ?, caster_ids = ?, queue_order = ?, blue_score = ?, red_score = ?, status = ? WHERE id = ?",
      [
        finalMatchNo,
        finalBlueTeamId,
        finalRedTeamId,
        finalMode,
        finalTitle,
        finalCasterIds,
        finalQueueOrder,
        finalBlueScore,
        finalRedScore,
        finalStatus,
        id,
      ]
    );
    await recalculateMatchSeriesState(id);

    const io = req.app.get("io");
    if (io) {
      io.emit("matches:changed");
      io.emit("standings:changed");
    }

    res.json({ id: Number(id) });
  } catch (error) {
    console.error("Failed to update match:", error);
    res.status(500).json({
      message: "Failed to update match",
      error: error.message,
    });
  }
});

router.put("/:id/set-active", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;

    await connection.beginTransaction();
    await connection.query(
      "UPDATE matches SET status = 'queued' WHERE status IN ('active','live') AND status <> 'finished'"
    );
    await connection.query("UPDATE matches SET status = 'active' WHERE id = ?", [id]);
    await connection.commit();

    const io = req.app.get("io");
    if (io) {
      io.emit("matches:changed");
    }

    res.json({ id: Number(id), status: "active" });
  } catch (error) {
    await connection.rollback();
    console.error("Failed to set active match", error);
    res.status(500).json({ message: "Failed to set active match" });
  } finally {
    connection.release();
  }
});

router.put("/:id/start", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const matchId = Number(id);

    if (!Number.isFinite(matchId) || matchId <= 0) {
      return res.status(400).json({ message: "Invalid match id" });
    }

    await connection.beginTransaction();
    const [matchRows] = await connection.query(
      "SELECT id FROM matches WHERE id = ? LIMIT 1",
      [matchId]
    );
    if (!matchRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Match not found" });
    }
    await connection.query(
      "UPDATE matches SET status = 'finished' WHERE status IN ('active','live','ongoing') AND id <> ?",
      [matchId]
    );
    await connection.query("UPDATE matches SET status = 'live' WHERE id = ?", [matchId]);
    await connection.commit();

    const io = req.app.get("io");
    if (io) {
      io.emit("matches:changed");
    }

    res.json({ id: matchId, status: "live" });
  } catch (error) {
    await connection.rollback();
    console.error("Failed to start match", error);
    res.status(500).json({ message: "Failed to start match" });
  } finally {
    connection.release();
  }
});

router.put("/:id/finish", async (req, res) => {
  try {
    const { id } = req.params;
    await recalculateMatchSeriesState(id);
    await pool.query("UPDATE matches SET status = 'finished' WHERE id = ?", [id]);
    const io = req.app.get("io");
    if (io) {
      io.emit("matches:changed");
      io.emit("standings:changed");
    }

    res.json({ id: Number(id), status: "finished" });
  } catch (error) {
    console.error("Failed to finish match", error);
    res.status(500).json({ message: "Failed to finish match" });
  }
});

router.put("/:id/score", async (req, res) => {
  try {
    const { id } = req.params;
    const { blue_score, red_score } = req.body;
    await pool.query("UPDATE matches SET blue_score = ?, red_score = ? WHERE id = ?", [
      blue_score,
      red_score,
      id,
    ]);
    const io = req.app.get("io");
    if (io) {
      io.emit("matches:changed");
    }

    res.json({ id: Number(id), blue_score, red_score });
  } catch (error) {
    console.error("Failed to update match score", error);
    res.status(500).json({ message: "Failed to update match score" });
  }
});

router.put("/load-next", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [nextRows] = await connection.query(
      "SELECT * FROM matches WHERE status = 'queued' ORDER BY queue_order ASC LIMIT 1"
    );
    const nextMatch = nextRows[0];

    if (!nextMatch) {
      await connection.commit();
      return res.json(null);
    }

    await connection.query(
      "UPDATE matches SET status = 'queued' WHERE status IN ('active','live') AND status <> 'finished'"
    );
    await connection.query("UPDATE matches SET status = 'active' WHERE id = ?", [
      nextMatch.id,
    ]);

    await connection.commit();
    const io = req.app.get("io");
    if (io) {
      io.emit("matches:changed");
      io.emit("standings:changed");
    }

    res.json(nextMatch);
  } catch (error) {
    await connection.rollback();
    console.error("Failed to load next match", error);
    res.status(500).json({ message: "Failed to load next match" });
  } finally {
    connection.release();
  }
});

router.delete("/:id", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    await connection.beginTransaction();

    const [matchRows] = await connection.query("SELECT id FROM matches WHERE id = ?", [id]);
    const match = matchRows[0];
    if (!match) {
      await connection.rollback();
      return res.status(404).json({ message: "Match not found" });
    }

    await connection.query(
      "DELETE FROM draft_actions WHERE game_id IN (SELECT id FROM games WHERE match_id = ?)",
      [id]
    );
    await connection.query("DELETE FROM games WHERE match_id = ?", [id]);
    await connection.query("DELETE FROM matches WHERE id = ?", [id]);

    await connection.commit();
    const io = req.app.get("io");
    if (io) {
      io.emit("matches:changed");
    }

    res.json({ id: Number(id), deleted: true });
  } catch (error) {
    await connection.rollback();
    console.error("Failed to delete match", error);
    res.status(500).json({ message: "Failed to delete match" });
  } finally {
    connection.release();
  }
});

module.exports = router;
