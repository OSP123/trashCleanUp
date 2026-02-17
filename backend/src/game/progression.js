const SEVERITY_XP = {
  yellow: 40,
  orange: 70,
  red: 120
};

function xpForCleanup(severity, isVerified) {
  const base = SEVERITY_XP[severity] || 30;
  return isVerified ? base : Math.round(base * 0.4);
}

function levelFromXp(xp) {
  let level = 1;
  let threshold = 0;
  while (xp >= threshold + 100 * level) {
    threshold += 100 * level;
    level += 1;
  }
  return level;
}

function applyXp(user, deltaXp) {
  const nextXp = Math.max(0, user.xp + deltaXp);
  const nextLevel = levelFromXp(nextXp);
  return { xp: nextXp, level: nextLevel };
}

module.exports = { xpForCleanup, levelFromXp, applyXp };
