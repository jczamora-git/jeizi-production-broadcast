const path = require("path");
const fs = require("fs");
const multer = require("multer");

const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

const sanitizeFilename = (filename) =>
  filename
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();

const createSlug = (value, fallback = "file") =>
  String(value || fallback)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "") || fallback;

const slugifyTeamName = (teamName) =>
  createSlug(teamName, "team").replace(/^_+|_+$/g, "") || "team";

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const createStorage = (subfolder, filenameFn) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, "..", "uploads", subfolder);
      ensureDir(uploadPath);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      if (filenameFn) {
        cb(null, filenameFn(req, file));
        return;
      }
      const safeName = sanitizeFilename(file.originalname);
      cb(null, `${Date.now()}-${safeName}`);
    },
  });

const imageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.has(ext)) {
    return cb(new Error("Only image files are allowed"), false);
  }
  return cb(null, true);
};

const createUploader = (subfolder, filenameFn) =>
  multer({
    storage: createStorage(subfolder, filenameFn),
    fileFilter: imageFileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  });

const uploadTeamLogo = createUploader("teams", (req, file) => {
  const slug = slugifyTeamName(req.body?.name);
  const ext = path.extname(file.originalname).toLowerCase();
  return `${slug}_logo_${Date.now()}${ext}`;
});

const uploadHeroImage = createUploader("heroes", (req, file) => {
  const slug = createSlug(req.body?.name, "hero");
  const ext = path.extname(file.originalname).toLowerCase();
  return `${slug}_hero_${Date.now()}${ext}`;
});

const uploadMapAssets = createUploader("maps", (req, file) => {
  const slug = createSlug(req.body?.name, "map");
  const ext = path.extname(file.originalname).toLowerCase();
  const suffix = file.fieldname === "map_image" ? "image" : "icon";
  return `${slug}_map_${suffix}_${Date.now()}${ext}`;
});

const uploadCasterPhoto = createUploader("casters", (req, file) => {
  const slug = createSlug(req.body?.name, "caster");
  const ext = path.extname(file.originalname).toLowerCase();
  return `${slug}_photo_${Date.now()}${ext}`;
});

module.exports = {
  uploadTeamLogo,
  uploadHeroImage,
  uploadMapAssets,
  uploadCasterPhoto,
};
