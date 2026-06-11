const express = require("express");
const { pool } = require("../db");
const { uploadMapAssets } = require("../middleware/upload");

const router = express.Router();

const uploadMapFields = uploadMapAssets.fields([
  { name: "icon", maxCount: 1 },
  { name: "map_image", maxCount: 1 },
]);

const getUploadedPath = (files, fieldName) => {
  const uploadedFile = files?.[fieldName]?.[0];
  return uploadedFile ? `/uploads/maps/${uploadedFile.filename}` : null;
};

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, icon_path, map_image, created_at, updated_at FROM maps ORDER BY name ASC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch maps", error);
    res.status(500).json({ message: "Failed to fetch maps" });
  }
});

router.post("/", uploadMapFields, async (req, res) => {
  try {
    const { name, icon_path } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Map name is required" });
    }

    const nextIconPath = getUploadedPath(req.files, "icon") || icon_path || null;
    const nextMapImage = getUploadedPath(req.files, "map_image");

    const [result] = await pool.query(
      "INSERT INTO maps (name, icon_path, map_image) VALUES (?, ?, ?)",
      [name, nextIconPath, nextMapImage]
    );

    const [rows] = await pool.query(
      "SELECT id, name, icon_path, map_image, created_at, updated_at FROM maps WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Failed to create map", error);
    res.status(500).json({ message: "Failed to create map" });
  }
});

router.put("/:id", uploadMapFields, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, icon_path } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid map id" });
    }

    if (!name) {
      return res.status(400).json({ message: "Map name is required" });
    }

    const [existingRows] = await pool.query(
      "SELECT id, icon_path, map_image FROM maps WHERE id = ?",
      [id]
    );
    if (!existingRows.length) {
      return res.status(404).json({ message: "Map not found" });
    }

    const existingMap = existingRows[0];
    const uploadedIconPath = getUploadedPath(req.files, "icon");
    const uploadedMapImagePath = getUploadedPath(req.files, "map_image");
    const hasIconField = Object.prototype.hasOwnProperty.call(req.body, "icon_path");

    let nextIconPath = existingMap.icon_path ?? null;
    if (uploadedIconPath) {
      nextIconPath = uploadedIconPath;
    } else if (hasIconField) {
      nextIconPath = icon_path || null;
    }

    const nextMapImage = uploadedMapImagePath || existingMap.map_image || null;

    await pool.query(
      "UPDATE maps SET name = ?, icon_path = ?, map_image = ?, updated_at = NOW() WHERE id = ?",
      [name, nextIconPath, nextMapImage, id]
    );

    const [rows] = await pool.query(
      "SELECT id, name, icon_path, map_image, created_at, updated_at FROM maps WHERE id = ?",
      [id]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error("Failed to update map", error);
    res.status(500).json({ message: "Failed to update map" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM maps WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete map", error);
    res.status(500).json({ message: "Failed to delete map" });
  }
});

module.exports = router;
