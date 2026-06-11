const express = require("express");
const { pool } = require("../db");
const { uploadTeamLogo } = require("../middleware/upload");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM teams ORDER BY name ASC");
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch teams", error);
    res.status(500).json({ message: "Failed to fetch teams" });
  }
});

router.post("/", uploadTeamLogo.single("logo"), async (req, res) => {
  try {
    const { name, shortname, logo } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Team name is required" });
    }

    const logoPath = req.file ? `/uploads/teams/${req.file.filename}` : logo || null;

    const [result] = await pool.query(
      "INSERT INTO teams (name, shortname, logo) VALUES (?,?,?)",
      [name, shortname || null, logoPath]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      shortname: shortname || null,
      logo: logoPath,
    });
  } catch (error) {
    console.error("Failed to create team", error);
    res.status(500).json({ message: "Failed to create team" });
  }
});

router.put("/:id", uploadTeamLogo.single("logo"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, shortname, logo } = req.body;

    let nextLogo = null;
    const hasLogoField = Object.prototype.hasOwnProperty.call(req.body, "logo");

    if (req.file) {
      nextLogo = `/uploads/teams/${req.file.filename}`;
    } else if (hasLogoField) {
      nextLogo = logo || null;
    } else {
      const [rows] = await pool.query("SELECT logo FROM teams WHERE id = ?", [id]);
      nextLogo = rows[0]?.logo ?? null;
    }

    await pool.query(
      "UPDATE teams SET name = ?, shortname = ?, logo = ? WHERE id = ?",
      [name, shortname || null, nextLogo, id]
    );

    res.json({ id: Number(id), name, shortname: shortname || null, logo: nextLogo });
  } catch (error) {
    console.error("Failed to update team", error);
    res.status(500).json({ message: "Failed to update team" });
  }
});

router.delete("/:id", async (req, res) => {
  const teamId = Number(req.params.id);
  if (!teamId) {
    return res.status(400).json({ message: "Invalid team id" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [teamRows] = await connection.query(
      "SELECT id, name FROM teams WHERE id = ? LIMIT 1",
      [teamId]
    );
    const team = teamRows[0];

    if (!team) {
      await connection.rollback();
      return res.status(404).json({ message: "Team not found" });
    }

    const [matchRows] = await connection.query(
      "SELECT id FROM matches WHERE blue_team_id = ? OR red_team_id = ?",
      [teamId, teamId]
    );
    const matchIds = matchRows.map((row) => Number(row.id)).filter(Boolean);

    if (matchIds.length) {
      const matchPlaceholders = matchIds.map(() => "?").join(",");

      await connection.query(
        `DELETE FROM draft_actions
         WHERE game_id IN (
           SELECT id FROM games WHERE match_id IN (${matchPlaceholders})
         )`,
        matchIds
      );
      await connection.query(
        `DELETE FROM games WHERE match_id IN (${matchPlaceholders})`,
        matchIds
      );
      await connection.query(
        `DELETE FROM matches WHERE id IN (${matchPlaceholders})`,
        matchIds
      );
    }

    const [playerTableRows] = await connection.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name = 'players'
       LIMIT 1`
    );

    if (playerTableRows.length) {
      const [playerTeamColumnRows] = await connection.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'players'
           AND column_name = 'team_id'
         LIMIT 1`
      );

      if (playerTeamColumnRows.length) {
        await connection.query("DELETE FROM players WHERE team_id = ?", [teamId]);
      }
    }

    await connection.query("DELETE FROM teams WHERE id = ?", [teamId]);
    await connection.commit();

    const io = req.app.get("io");
    if (io) {
      io.emit("teams:changed");
      io.emit("matches:changed");
      io.emit("standings:changed");
    }

    res.json({
      success: true,
      message: "Team and related records deleted successfully",
      deleted_match_count: matchIds.length,
      deleted_team_id: teamId,
      deleted_team_name: team.name,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Failed to delete team", error);
    res.status(500).json({ message: "Failed to delete team" });
  } finally {
    connection.release();
  }
});

module.exports = router;
