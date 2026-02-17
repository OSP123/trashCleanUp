const express = require("express");
const { asyncHandler } = require("../utils/async");
const { listLeaderboards } = require("../data/repository");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { scope } = req.query;
    const leaders = await listLeaderboards();
    res.json({
      scope: scope || "global",
      leaders
    });
  })
);

module.exports = router;
