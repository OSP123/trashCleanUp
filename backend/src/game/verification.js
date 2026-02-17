function summarizeVotes(votes) {
  const totals = { legit: 0, fake: 0 };
  for (const vote of votes) {
    if (vote.vote === "legit") totals.legit += 1;
    if (vote.vote === "fake") totals.fake += 1;
  }
  return totals;
}

function computeVerificationStatus(cleanup, votes) {
  const totals = summarizeVotes(votes);
  const totalVotes = totals.legit + totals.fake;

  if (cleanup.aiScore >= 0.8) return "verified";
  if (cleanup.aiScore <= 0.2 && totalVotes >= 2) return "rejected";

  if (totalVotes >= 3) {
    const legitRatio = totals.legit / totalVotes;
    if (legitRatio >= 0.67) return "verified";
    if (legitRatio <= 0.33) return "rejected";
  }

  return "pending";
}

module.exports = { summarizeVotes, computeVerificationStatus };
