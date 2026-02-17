const express = require("express");
const { asyncHandler } = require("../utils/async");
const { normalizeLatLng } = require("../utils/geo");
const {
  listPins,
  createPin,
  addHazardReport,
  getPin
} = require("../data/repository");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const bbox = req.query.minLat
      ? {
          minLat: Number(req.query.minLat),
          minLng: Number(req.query.minLng),
          maxLat: Number(req.query.maxLat),
          maxLng: Number(req.query.maxLng)
        }
      : null;

    if (
      bbox &&
      (!Number.isFinite(bbox.minLat) ||
        !Number.isFinite(bbox.minLng) ||
        !Number.isFinite(bbox.maxLat) ||
        !Number.isFinite(bbox.maxLng))
    ) {
      return res.status(400).json({ error: "invalid_bbox" });
    }

    const pins = await listPins(bbox);
    res.json({ pins });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { reporterId, severity, lat, lng } = req.body || {};
    if (!severity) {
      return res.status(400).json({ error: "severity_required" });
    }
    const location = normalizeLatLng(lat, lng);
    if (!location) {
      return res.status(400).json({ error: "invalid_location" });
    }
    const pin = await createPin({ reporterId, severity, location });
    return res.status(201).json({ pin });
  })
);

router.post(
  "/:pinId/hazard",
  asyncHandler(async (req, res) => {
    const { reporterId, hazardType, notes } = req.body || {};
    if (!hazardType) {
      return res.status(400).json({ error: "hazardType_required" });
    }
    const pin = await getPin(req.params.pinId);
    if (!pin) {
      return res.status(404).json({ error: "pin_not_found" });
    }
    const report = await addHazardReport({
      pinId: pin.id,
      reporterId,
      hazardType,
      notes
    });
    const updatedPin = await getPin(req.params.pinId);
    return res.status(201).json({ report, pin: updatedPin });
  })
);

module.exports = router;
