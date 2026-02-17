const express = require("express");
const multer = require("multer");
const path = require("path");
const pinsRoutes = require("./routes/pins");
const cleanupsRoutes = require("./routes/cleanups");
const territoriesRoutes = require("./routes/territories");
const raidsRoutes = require("./routes/raids");
const leaderboardsRoutes = require("./routes/leaderboards");
const usersRoutes = require("./routes/users");
const squadsRoutes = require("./routes/squads");
const collectionsRoutes = require("./routes/collections");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only image files (jpeg, jpg, png, webp) are allowed"));
  }
});

function createApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // Serve uploaded files statically
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // File upload endpoint
  app.post("/upload", upload.single("file"), (req, res) => {
    console.log("📤 Upload request received:", { filename: req.file?.filename });
    if (!req.file) {
      console.error("❌ No file in upload request");
      return res.status(400).json({ error: "no_file_uploaded" });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    console.log("✅ File uploaded successfully:", fileUrl);
    res.json({ url: fileUrl });
  });

  app.use("/users", usersRoutes);
  app.use("/squads", squadsRoutes);
  app.use("/pins", pinsRoutes);
  app.use("/cleanups", cleanupsRoutes);
  app.use("/territories", territoriesRoutes);
  app.use("/raids", raidsRoutes);
  app.use("/leaderboards", leaderboardsRoutes);
  app.use("/collections", collectionsRoutes);

  app.use((err, _req, res, _next) => {
    res.status(500).json({
      error: "server_error",
      message: err.message || "Unexpected error"
    });
  });

  return app;
}

module.exports = { createApp };
