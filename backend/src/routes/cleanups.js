const express = require("express");
const { asyncHandler } = require("../utils/async");
const {
  listCleanups,
  createCleanup,
  updateCleanupStatus,
  updatePinStatus,
  addVote,
  addCollection,
  getCleanup,
  listVotes,
  getPin,
  getUser,
  updateUserProgress
} = require("../data/repository");
const { xpForCleanup, applyXp } = require("../game/progression");
const { computeVerificationStatus } = require("../game/verification");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, cleanerId } = req.query;
    const cleanups = await listCleanups({ status, cleanerId });
    res.json({ cleanups });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      pinId,
      cleanerId,
      beforePhotoUrl,
      afterPhotoUrl,
      aiScore,
      trashTypeCode
    } = req.body || {};

    if (!pinId || !beforePhotoUrl || !afterPhotoUrl) {
      return res.status(400).json({ error: "missing_fields" });
    }

    const pin = await getPin(pinId);
    if (!pin) {
      return res.status(404).json({ error: "pin_not_found" });
    }

    if (cleanerId) {
      const cleaner = await getUser(cleanerId);
      if (!cleaner) {
        return res.status(404).json({ error: "user_not_found" });
      }
    }

    const cleanup = await createCleanup({
      pinId,
      cleanerId,
      beforePhotoUrl,
      afterPhotoUrl,
      aiScore: Number.isFinite(aiScore) ? aiScore : 0.5
    });

    await updatePinStatus(pinId, "cleaned_pending");

    if (cleanerId && trashTypeCode) {
      await addCollection({ userId: cleanerId, trashTypeCode, count: 1 });
    }

    return res.status(201).json({ cleanup });
  })
);

router.post(
  "/:cleanupId/votes",
  asyncHandler(async (req, res) => {
    const { cleanupId } = req.params;
    const { voterId, vote } = req.body || {};

    if (!voterId || !vote) {
      return res.status(400).json({ error: "missing_fields" });
    }

    const cleanup = await getCleanup(cleanupId);
    if (!cleanup) {
      return res.status(404).json({ error: "cleanup_not_found" });
    }

    const record = await addVote({ cleanupId, voterId, vote });
    const votes = await listVotes(cleanupId);
    const nextStatus = computeVerificationStatus(cleanup, votes);

    if (nextStatus !== cleanup.status) {
      await updateCleanupStatus(cleanupId, nextStatus);
      if (nextStatus === "verified") {
        const pin = await getPin(cleanup.pinId);
        if (pin) {
          await updatePinStatus(pin.id, "cleaned");
        }
        if (cleanup.cleanerId) {
          const deltaXp = xpForCleanup(pin ? pin.severity : "yellow", true);
          const deltaCurrency = Math.round(deltaXp / 2);
          const user = await getUser(cleanup.cleanerId);
          if (user) {
            const progress = applyXp(user, deltaXp);
            await updateUserProgress(
              user.id,
              progress.xp,
              user.currency + deltaCurrency,
              progress.level
            );
          }
        }
      }
    }

    const updatedCleanup = await getCleanup(cleanupId);
    return res.status(201).json({ vote: record, cleanup: updatedCleanup });
  })
);

module.exports = router;
