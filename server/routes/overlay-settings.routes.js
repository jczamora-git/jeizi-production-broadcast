const express = require("express");
const { pool } = require("../db");

const router = express.Router();

const allowedKeys = ["game_overlay", "loading_overlay"];
const allowedKeySet = new Set(allowedKeys);

router.get("/", async (req, res) => {
  try {
    const placeholders = allowedKeys.map(() => "?").join(",");
    const [rows] = await pool.query(
      `SELECT overlay_key, is_enabled FROM overlay_settings WHERE overlay_key IN (${placeholders})`,
      allowedKeys
    );

    const settings = allowedKeys.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});

    rows.forEach((row) => {
      settings[row.overlay_key] = row.is_enabled === 1;
    });

    res.json(settings);
  } catch (error) {
    console.error("Failed to fetch overlay settings", error);
    res.status(500).json({ message: "Failed to fetch overlay settings" });
  }
});

router.put("/:overlayKey", async (req, res) => {
  try {
    const { overlayKey } = req.params;

    if (!allowedKeySet.has(overlayKey)) {
      return res.status(400).json({ message: "Invalid overlay setting key" });
    }

    const { is_enabled: isEnabled } = req.body || {};

    if (typeof isEnabled !== "boolean") {
      return res.status(400).json({ message: "is_enabled must be a boolean" });
    }

    const [result] = await pool.query(
      "UPDATE overlay_settings SET is_enabled = ?, updated_at = NOW() WHERE overlay_key = ?",
      [isEnabled ? 1 : 0, overlayKey]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Overlay setting not found" });
    }

    res.json({ overlay_key: overlayKey, is_enabled: isEnabled });
  } catch (error) {
    console.error("Failed to update overlay setting", error);
    res.status(500).json({ message: "Failed to update overlay setting" });
  }
});

module.exports = router;
