const express = require("express");
const { pool } = require("../db");
const { uploadCasterPhoto } = require("../middleware/upload");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name, photo FROM casters ORDER BY name ASC");
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch casters", error);
    res.status(500).json({ message: "Failed to fetch casters" });
  }
});

router.post("/", uploadCasterPhoto.single("photo"), async (req, res) => {
  try {
    const { name, photo } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Caster name is required" });
    }

    const photoPath = req.file ? `/uploads/casters/${req.file.filename}` : photo || null;

    const [result] = await pool.query(
      "INSERT INTO casters (name, photo) VALUES (?,?)",
      [name, photoPath]
    );

    res.status(201).json({ id: result.insertId, name, photo: photoPath });
  } catch (error) {
    console.error("Failed to create caster", error);
    res.status(500).json({ message: "Failed to create caster" });
  }
});

router.put("/:id", uploadCasterPhoto.single("photo"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, photo } = req.body;

    const [existingRows] = await pool.query("SELECT photo FROM casters WHERE id = ?", [id]);
    if (!existingRows.length) {
      return res.status(404).json({ message: "Caster not found" });
    }

    let nextPhoto = existingRows[0].photo ?? null;
    const hasPhotoField = Object.prototype.hasOwnProperty.call(req.body, "photo");

    if (req.file) {
      nextPhoto = `/uploads/casters/${req.file.filename}`;
    } else if (hasPhotoField) {
      nextPhoto = photo || null;
    }

    await pool.query("UPDATE casters SET name = ?, photo = ? WHERE id = ?", [
      name,
      nextPhoto,
      id,
    ]);

    res.json({ id: Number(id), name, photo: nextPhoto });
  } catch (error) {
    console.error("Failed to update caster", error);
    res.status(500).json({ message: "Failed to update caster" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM casters WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete caster", error);
    res.status(500).json({ message: "Failed to delete caster" });
  }
});

module.exports = router;
