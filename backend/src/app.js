const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
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

  // Serve uploaded files statically (no /api prefix — these are direct asset URLs)
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

  // All API routes mounted under /api
  const apiRouter = express.Router();

  apiRouter.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // File upload endpoint
  apiRouter.post("/upload", upload.single("file"), (req, res) => {
    console.log("📤 Upload request received:", { filename: req.file?.filename });
    if (!req.file) {
      console.error("❌ No file in upload request");
      return res.status(400).json({ error: "no_file_uploaded" });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    console.log("✅ File uploaded successfully:", fileUrl);
    res.json({ url: fileUrl });
  });

  apiRouter.use("/users", usersRoutes);
  apiRouter.use("/squads", squadsRoutes);
  apiRouter.use("/pins", pinsRoutes);
  apiRouter.use("/cleanups", cleanupsRoutes);
  apiRouter.use("/territories", territoriesRoutes);
  apiRouter.use("/raids", raidsRoutes);
  apiRouter.use("/leaderboards", leaderboardsRoutes);
  apiRouter.use("/collections", collectionsRoutes);

  app.use("/api", apiRouter);

  // Serve built frontend in production (Docker)
  const publicPath = path.join(__dirname, "../public");
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(publicPath, "index.html"));
    });
  }

  app.use((err, _req, res, _next) => {
    res.status(500).json({
      error: "server_error",
      message: err.message || "Unexpected error"
    });
  });

  return app;
}

module.exports = { createApp };
