const express = require("express");
const { asyncHandler } = require("../utils/async");
const { normalizeLatLng } = require("../utils/geo");
const {
  listTerritories,
  getTerritory,
  createTerritory,
  claimTerritory,
  getUser
} = require("../data/repository");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const result = await listTerritories();
    res.json(result);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, polygon } = req.body || {};
    if (!name || !Array.isArray(polygon) || polygon.length < 3) {
      return res.status(400).json({ error: "invalid_polygon" });
    }
    const normalized = polygon
      .map((point) => normalizeLatLng(point.lat, point.lng))
      .filter(Boolean);
    if (normalized.length < 3) {
      return res.status(400).json({ error: "invalid_polygon" });
    }
    const territory = await createTerritory({ name, polygon: normalized });
    if (!territory) {
      return res.status(400).json({ error: "invalid_polygon" });
    }
    return res.status(201).json({ territory });
  })
);

router.post(
  "/:territoryId/claim",
  asyncHandler(async (req, res) => {
    const { userId, decayHours } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: "userId_required" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "user_not_found" });
    }
    const territory = await getTerritory(req.params.territoryId);
    if (!territory) {
      return res.status(404).json({ error: "territory_not_found" });
    }
    const hours = Number.isFinite(decayHours) ? decayHours : 72;
    const decayAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    const claim = await claimTerritory({
      territoryId: territory.id,
      userId,
      decayAt
    });
    return res.status(201).json({ claim });
  })
);

module.exports = router;
