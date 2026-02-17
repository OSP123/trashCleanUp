const express = require("express");
const { asyncHandler } = require("../utils/async");
const { normalizeLatLng } = require("../utils/geo");
const {
  listRaids,
  getRaid,
  createRaid,
  joinRaid,
  getUser
} = require("../data/repository");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const result = await listRaids();
    res.json(result);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, lat, lng, startsAt, endsAt } = req.body || {};
    if (!name || !startsAt || !endsAt) {
      return res.status(400).json({ error: "missing_fields" });
    }
    const location = normalizeLatLng(lat, lng);
    if (!location) {
      return res.status(400).json({ error: "invalid_location" });
    }
    const raid = await createRaid({ name, location, startsAt, endsAt });
    return res.status(201).json({ raid });
  })
);

router.post(
  "/:raidId/join",
  asyncHandler(async (req, res) => {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: "userId_required" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "user_not_found" });
    }
    const raid = await getRaid(req.params.raidId);
    if (!raid) {
      return res.status(404).json({ error: "raid_not_found" });
    }
    const record = await joinRaid({ raidId: req.params.raidId, userId });
    return res.status(201).json({ participant: record });
  })
);

module.exports = router;
