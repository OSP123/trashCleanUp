const express = require("express");
const { asyncHandler } = require("../utils/async");
const {
  listCollections,
  addCollection,
  getUser
} = require("../data/repository");

const router = express.Router();

router.get(
  "/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const user = await getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "user_not_found" });
    }
    const collections = await listCollections(userId);
    res.json({ collections });
  })
);

router.post(
  "/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { trashTypeCode, count } = req.body || {};
    if (!trashTypeCode) {
      return res.status(400).json({ error: "trashTypeCode_required" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "user_not_found" });
    }
    const record = await addCollection({
      userId,
      trashTypeCode,
      count: Number.isFinite(count) ? count : 1
    });
    if (!record) {
      return res.status(404).json({ error: "trash_type_not_found" });
    }
    return res.status(201).json({ collection: record });
  })
);

module.exports = router;
