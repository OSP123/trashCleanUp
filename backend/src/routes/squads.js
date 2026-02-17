const express = require("express");
const { asyncHandler } = require("../utils/async");
const {
  listSquads,
  getSquad,
  createSquad,
  addSquadMember,
  getUser
} = require("../data/repository");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const squads = await listSquads();
    res.json({ squads });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: "name_required" });
    }
    const squad = await createSquad({ name });
    return res.status(201).json({ squad });
  })
);

router.post(
  "/:squadId/members",
  asyncHandler(async (req, res) => {
    const { userId, role } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: "userId_required" });
    }
    const user = await getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "user_not_found" });
    }
    const squad = await getSquad(req.params.squadId);
    if (!squad) {
      return res.status(404).json({ error: "squad_not_found" });
    }
    const membership = await addSquadMember({
      squadId: req.params.squadId,
      userId,
      role
    });
    return res.status(201).json({ membership });
  })
);

module.exports = router;
