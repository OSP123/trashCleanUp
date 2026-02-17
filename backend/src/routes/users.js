const express = require("express");
const { asyncHandler } = require("../utils/async");
const { listUsers, createUser, getUser } = require("../data/repository");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await listUsers();
    res.json({ users });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { username } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: "username_required" });
    }
    const user = await createUser({ username });
    return res.status(201).json({ user });
  })
);

router.get(
  "/:userId",
  asyncHandler(async (req, res) => {
    const user = await getUser(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: "user_not_found" });
    }
    return res.json({ user });
  })
);

module.exports = router;
