const express = require("express");
const { pool } = require("../db");

const router = express.Router();

router.get("/session", async (req, res) => {
  try {
    const matchId = Number(req.query.match_id || 0);
    const gameNumber = Number(req.query.game_number || 0);
    if (!matchId || !gameNumber) {
      return res.status(400).json({ message: "match_id and game_number are required" });
    }

    const [rows] = await pool.query(
      "SELECT * FROM draft_sessions WHERE match_id = ? AND game_number = ? LIMIT 1",
      [matchId, gameNumber]
    );

    res.json(rows[0] || null);
  } catch (error) {
    console.error("Failed to fetch draft session", error);
    res.status(500).json({ message: "Failed to fetch draft session" });
  }
});

router.post("/session", async (req, res) => {
  try {
    const {
      match_id,
      game_id,
      game_number,
      blue_team_id,
      red_team_id,
      mode,
      phase_index,
      phase_label,
      timer_remaining,
      timer_running,
      status,
    } = req.body;

    if (!match_id || !game_number) {
      return res.status(400).json({ message: "match_id and game_number are required" });
    }

    const [result] = await pool.query(
      "INSERT INTO draft_sessions (match_id, game_id, game_number, blue_team_id, red_team_id, mode, phase_index, phase_label, timer_remaining, timer_running, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [
        match_id,
        game_id || null,
        game_number,
        blue_team_id || null,
        red_team_id || null,
        mode || null,
        phase_index ?? 0,
        phase_label || null,
        timer_remaining ?? null,
        timer_running ? 1 : 0,
        status || null,
      ]
    );

    const [rows] = await pool.query("SELECT * FROM draft_sessions WHERE id = ?", [
      result.insertId,
    ]);

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Failed to create draft session", error);
    res.status(500).json({ message: "Failed to create draft session" });
  }
});

router.patch("/session/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      match_id,
      game_id,
      game_number,
      blue_team_id,
      red_team_id,
      mode,
      phase_index,
      phase_label,
      timer_remaining,
      timer_running,
      status,
      set_started_at,
      set_completed_at,
      set_locked_at,
      clear_started_at,
      clear_completed_at,
      clear_locked_at,
    } = req.body;

    await pool.query(
      "UPDATE draft_sessions SET match_id = COALESCE(?, match_id), game_id = COALESCE(?, game_id), game_number = COALESCE(?, game_number), blue_team_id = COALESCE(?, blue_team_id), red_team_id = COALESCE(?, red_team_id), mode = COALESCE(?, mode), phase_index = COALESCE(?, phase_index), phase_label = COALESCE(?, phase_label), timer_remaining = COALESCE(?, timer_remaining), timer_running = COALESCE(?, timer_running), status = COALESCE(?, status), started_at = CASE WHEN ? THEN NOW() WHEN ? THEN NULL ELSE started_at END, completed_at = CASE WHEN ? THEN NOW() WHEN ? THEN NULL ELSE completed_at END, locked_at = CASE WHEN ? THEN NOW() WHEN ? THEN NULL ELSE locked_at END WHERE id = ?",
      [
        match_id ?? null,
        game_id ?? null,
        game_number ?? null,
        blue_team_id ?? null,
        red_team_id ?? null,
        mode ?? null,
        phase_index ?? null,
        phase_label ?? null,
        timer_remaining ?? null,
        timer_running === undefined ? null : timer_running ? 1 : 0,
        status ?? null,
        Boolean(set_started_at),
        Boolean(clear_started_at),
        Boolean(set_completed_at),
        Boolean(clear_completed_at),
        Boolean(set_locked_at),
        Boolean(clear_locked_at),
        id,
      ]
    );

    const [rows] = await pool.query("SELECT * FROM draft_sessions WHERE id = ?", [id]);
    res.json(rows[0] || null);
  } catch (error) {
    console.error("Failed to update draft session", error);
    res.status(500).json({ message: "Failed to update draft session" });
  }
});

router.get("/sessions/:sessionId/slots", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const [rows] = await pool.query(
      "SELECT * FROM draft_slots WHERE draft_session_id = ? ORDER BY team_side, slot_type, slot_index",
      [sessionId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch draft slots", error);
    res.status(500).json({ message: "Failed to fetch draft slots" });
  }
});

router.put("/sessions/:sessionId/slots", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      team_side,
      slot_type,
      slot_index,
      phase_index,
      phase_label,
      hero_id,
      hero_name,
      hero_role,
      hero_lane,
      hero_image_path,
      is_locked,
    } = req.body;

    if (team_side === undefined || slot_type === undefined || slot_index === undefined) {
      return res.status(400).json({ message: "slot data is required" });
    }

    const [existingRows] = await pool.query(
      "SELECT id FROM draft_slots WHERE draft_session_id = ? AND team_side = ? AND slot_type = ? AND slot_index = ? LIMIT 1",
      [sessionId, team_side, slot_type, slot_index]
    );

    const lockedAt = is_locked ? new Date() : null;

    if (existingRows.length) {
      await pool.query(
        "UPDATE draft_slots SET phase_index = ?, phase_label = ?, hero_id = ?, hero_name = ?, hero_role = ?, hero_lane = ?, hero_image_path = ?, is_locked = ?, locked_at = ? WHERE id = ?",
        [
          phase_index ?? null,
          phase_label ?? null,
          hero_id ?? null,
          hero_name ?? null,
          hero_role ?? null,
          hero_lane ?? null,
          hero_image_path ?? null,
          is_locked ? 1 : 0,
          lockedAt,
          existingRows[0].id,
        ]
      );
      return res.json({ id: existingRows[0].id });
    }

    const [result] = await pool.query(
      "INSERT INTO draft_slots (draft_session_id, team_side, slot_type, slot_index, phase_index, phase_label, hero_id, hero_name, hero_role, hero_lane, hero_image_path, is_locked, locked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        sessionId,
        team_side,
        slot_type,
        slot_index,
        phase_index ?? null,
        phase_label ?? null,
        hero_id ?? null,
        hero_name ?? null,
        hero_role ?? null,
        hero_lane ?? null,
        hero_image_path ?? null,
        is_locked ? 1 : 0,
        lockedAt,
      ]
    );

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error("Failed to upsert draft slot", error);
    res.status(500).json({ message: "Failed to upsert draft slot" });
  }
});

router.delete("/sessions/:sessionId/slots", async (req, res) => {
  try {
    const { sessionId } = req.params;
    await pool.query("DELETE FROM draft_slots WHERE draft_session_id = ?", [sessionId]);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to clear draft slots", error);
    res.status(500).json({ message: "Failed to clear draft slots" });
  }
});

router.post("/sessions/:sessionId/save-slots", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { slots } = req.body;
    if (!Array.isArray(slots) || !slots.length) {
      return res.status(400).json({ message: "slots array is required" });
    }

    for (const slot of slots) {
      const {
        team_side,
        slot_type,
        slot_index,
        phase_index,
        phase_label,
        hero_id,
        hero_name,
        hero_role,
        hero_lane,
        hero_image_path,
        is_locked,
      } = slot;

      if (team_side === undefined || slot_type === undefined || slot_index === undefined) {
        continue;
      }

      const [existingRows] = await pool.query(
        "SELECT id FROM draft_slots WHERE draft_session_id = ? AND team_side = ? AND slot_type = ? AND slot_index = ? LIMIT 1",
        [sessionId, team_side, slot_type, slot_index]
      );

      const lockedAt = is_locked ? new Date() : null;

      if (existingRows.length) {
        await pool.query(
          "UPDATE draft_slots SET phase_index = ?, phase_label = ?, hero_id = ?, hero_name = ?, hero_role = ?, hero_lane = ?, hero_image_path = ?, is_locked = ?, locked_at = ? WHERE id = ?",
          [
            phase_index ?? null,
            phase_label ?? null,
            hero_id ?? null,
            hero_name ?? null,
            hero_role ?? null,
            hero_lane ?? null,
            hero_image_path ?? null,
            is_locked ? 1 : 0,
            lockedAt,
            existingRows[0].id,
          ]
        );
      } else {
        await pool.query(
          "INSERT INTO draft_slots (draft_session_id, team_side, slot_type, slot_index, phase_index, phase_label, hero_id, hero_name, hero_role, hero_lane, hero_image_path, is_locked, locked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
          [
            sessionId,
            team_side,
            slot_type,
            slot_index,
            phase_index ?? null,
            phase_label ?? null,
            hero_id ?? null,
            hero_name ?? null,
            hero_role ?? null,
            hero_lane ?? null,
            hero_image_path ?? null,
            is_locked ? 1 : 0,
            lockedAt,
          ]
        );
      }
    }

    await pool.query(
      "UPDATE draft_sessions SET status = COALESCE(?, status) WHERE id = ?",
      ["completed", sessionId]
    );

    res.status(201).json({ saved: slots.length });
  } catch (error) {
    console.error("Failed to save draft slots", error);
    res.status(500).json({ message: "Failed to save draft slots" });
  }
});

router.get("/:gameId", async (req, res) => {
  try {
    const { gameId } = req.params;
    const [rows] = await pool.query(
      "SELECT da.*, h.name AS hero_name, h.image_path AS hero_image_path FROM draft_actions da LEFT JOIN heroes h ON da.hero_id = h.id WHERE da.game_id = ? ORDER BY da.action_order ASC",
      [gameId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch draft actions", error);
    res.status(500).json({ message: "Failed to fetch draft actions" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      draft_session_id,
      game_id,
      team_side,
      action_type,
      hero_id,
      action_order,
      phase_index,
      phase_label,
      slot_index,
      locked,
    } = req.body;

    const [result] = await pool.query(
      "INSERT INTO draft_actions (draft_session_id, game_id, team_side, action_type, hero_id, action_order, phase_index, phase_label, slot_index, locked) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        draft_session_id || null,
        game_id || null,
        team_side,
        action_type,
        hero_id || null,
        action_order || null,
        phase_index ?? null,
        phase_label ?? null,
        slot_index ?? null,
        locked ? 1 : 0,
      ]
    );

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error("Failed to create draft action", error);
    res.status(500).json({ message: "Failed to create draft action" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { game_id, team_side, action_type, hero_id, action_order, locked } = req.body;

    await pool.query(
      "UPDATE draft_actions SET game_id = ?, team_side = ?, action_type = ?, hero_id = ?, action_order = ?, locked = ? WHERE id = ?",
      [game_id, team_side, action_type, hero_id, action_order, locked ? 1 : 0, id]
    );

    res.json({ id: Number(id) });
  } catch (error) {
    console.error("Failed to update draft action", error);
    res.status(500).json({ message: "Failed to update draft action" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM draft_actions WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete draft action", error);
    res.status(500).json({ message: "Failed to delete draft action" });
  }
});

module.exports = router;
