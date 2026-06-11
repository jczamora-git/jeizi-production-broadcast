const express = require("express");
const { pool } = require("../db");
const { uploadHeroImage } = require("../middleware/upload");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM heroes ORDER BY name ASC");
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch heroes", error);
    res.status(500).json({ message: "Failed to fetch heroes" });
  }
});

router.post("/", uploadHeroImage.single("image"), async (req, res) => {
  try {
    const { name, role, lane, image_path } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Hero name is required" });
    }

    const imagePath = req.file ? `/uploads/heroes/${req.file.filename}` : image_path || null;

    const [result] = await pool.query(
      "INSERT INTO heroes (name, role, lane, image_path) VALUES (?,?,?,?)",
      [name, role || null, lane || null, imagePath]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      role: role || null,
      lane: lane || null,
      image_path: imagePath,
    });
  } catch (error) {
    console.error("Failed to create hero", error);
    res.status(500).json({ message: "Failed to create hero" });
  }
});

router.put("/:id", uploadHeroImage.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, lane, image_path } = req.body;

    const [existingRows] = await pool.query("SELECT image_path FROM heroes WHERE id = ?", [id]);
    if (!existingRows.length) {
      return res.status(404).json({ message: "Hero not found" });
    }

    let nextImagePath = existingRows[0].image_path ?? null;
    const hasImageField = Object.prototype.hasOwnProperty.call(req.body, "image_path");

    if (req.file) {
      nextImagePath = `/uploads/heroes/${req.file.filename}`;
    } else if (hasImageField) {
      nextImagePath = image_path || null;
    }

    await pool.query(
      "UPDATE heroes SET name = ?, role = ?, lane = ?, image_path = ? WHERE id = ?",
      [name, role || null, lane || null, nextImagePath, id]
    );

    res.json({
      id: Number(id),
      name,
      role: role || null,
      lane: lane || null,
      image_path: nextImagePath,
    });
  } catch (error) {
    console.error("Failed to update hero", error);
    res.status(500).json({ message: "Failed to update hero" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM heroes WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete hero", error);
    res.status(500).json({ message: "Failed to delete hero" });
  }
});

module.exports = router;
