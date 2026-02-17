const { query } = require("./db");
const { polygonToWkt, geojsonToPolygon } = require("../utils/geo");

function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    level: row.level,
    xp: row.xp,
    currency: row.currency,
    createdAt: row.created_at
  };
}

function mapPin(row) {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    severity: row.severity,
    status: row.status,
    hazardStatus: row.hazard_status,
    location: { lat: Number(row.lat), lng: Number(row.lng) },
    createdAt: row.created_at
  };
}

function mapCleanup(row) {
  return {
    id: row.id,
    pinId: row.pin_id,
    cleanerId: row.cleaner_id,
    beforePhotoUrl: row.before_photo_url,
    afterPhotoUrl: row.after_photo_url,
    aiScore: Number(row.ai_score),
    status: row.status,
    createdAt: row.created_at
  };
}

function mapVote(row) {
  return {
    cleanupId: row.cleanup_id,
    voterId: row.voter_id,
    vote: row.vote,
    createdAt: row.created_at
  };
}

function mapSquad(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at
  };
}

function mapTerritory(row) {
  const geojson = row.geojson ? JSON.parse(row.geojson) : null;
  return {
    id: row.id,
    name: row.name,
    polygon: geojsonToPolygon(geojson),
    createdAt: row.created_at
  };
}

function mapClaim(row) {
  return {
    territoryId: row.territory_id,
    userId: row.user_id,
    claimedAt: row.claimed_at,
    decayAt: row.decay_at
  };
}

function mapRaid(row) {
  return {
    id: row.id,
    name: row.name,
    location: { lat: Number(row.lat), lng: Number(row.lng) },
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at
  };
}

function mapRaidParticipant(row) {
  return {
    raidId: row.raid_id,
    userId: row.user_id,
    joinedAt: row.joined_at
  };
}

async function listUsers() {
  const { rows } = await query("SELECT * FROM users ORDER BY created_at DESC");
  return rows.map(mapUser);
}

async function createUser({ username }) {
  const { rows } = await query(
    "INSERT INTO users (username) VALUES ($1) RETURNING *",
    [username]
  );
  return mapUser(rows[0]);
}

async function getUser(userId) {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [userId]);
  return rows[0] ? mapUser(rows[0]) : null;
}

async function updateUserProgress(userId, nextXp, nextCurrency, nextLevel) {
  const { rows } = await query(
    "UPDATE users SET xp = $2, currency = $3, level = $4 WHERE id = $1 RETURNING *",
    [userId, nextXp, nextCurrency, nextLevel]
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

async function listSquads() {
  const { rows } = await query("SELECT * FROM squads ORDER BY created_at DESC");
  return rows.map(mapSquad);
}

async function getSquad(squadId) {
  const { rows } = await query("SELECT * FROM squads WHERE id = $1", [squadId]);
  return rows[0] ? mapSquad(rows[0]) : null;
}

async function createSquad({ name }) {
  const { rows } = await query(
    "INSERT INTO squads (name) VALUES ($1) RETURNING *",
    [name]
  );
  return mapSquad(rows[0]);
}

async function addSquadMember({ squadId, userId, role }) {
  const { rows } = await query(
    `INSERT INTO squad_members (squad_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (squad_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [squadId, userId, role || "member"]
  );
  return {
    squadId: rows[0].squad_id,
    userId: rows[0].user_id,
    role: rows[0].role,
    joinedAt: rows[0].joined_at
  };
}

async function listPins(bbox) {
  if (bbox) {
    const { rows } = await query(
      `SELECT id, reporter_id, severity, status, hazard_status,
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng,
        created_at
       FROM pins
       WHERE ST_Intersects(
         location::geometry,
         ST_MakeEnvelope($1, $2, $3, $4, 4326)
       )
       ORDER BY created_at DESC`,
      [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat]
    );
    return rows.map(mapPin);
  }

  const { rows } = await query(
    `SELECT id, reporter_id, severity, status, hazard_status,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      created_at
     FROM pins
     ORDER BY created_at DESC`
  );
  return rows.map(mapPin);
}

async function createPin({ reporterId, severity, location }) {
  const { rows } = await query(
    `INSERT INTO pins (reporter_id, severity, status, hazard_status, location)
     VALUES ($1, $2, 'dirty', 'clear',
       ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
     )
     RETURNING id, reporter_id, severity, status, hazard_status,
       ST_Y(location::geometry) AS lat,
       ST_X(location::geometry) AS lng,
       created_at`,
    [reporterId || null, severity, location.lng, location.lat]
  );
  return mapPin(rows[0]);
}

async function getPin(pinId) {
  const { rows } = await query(
    `SELECT id, reporter_id, severity, status, hazard_status,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      created_at
     FROM pins
     WHERE id = $1`,
    [pinId]
  );
  return rows[0] ? mapPin(rows[0]) : null;
}

async function updatePinStatus(pinId, status) {
  const { rows } = await query(
    `UPDATE pins SET status = $2 WHERE id = $1
     RETURNING id, reporter_id, severity, status, hazard_status,
       ST_Y(location::geometry) AS lat,
       ST_X(location::geometry) AS lng,
       created_at`,
    [pinId, status]
  );
  return rows[0] ? mapPin(rows[0]) : null;
}

async function addHazardReport({ pinId, reporterId, hazardType, notes }) {
  await query(
    `UPDATE pins SET hazard_status = 'reported' WHERE id = $1`,
    [pinId]
  );
  const { rows } = await query(
    `INSERT INTO hazard_reports (pin_id, reporter_id, hazard_type, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [pinId, reporterId || null, hazardType, notes || null]
  );
  return {
    id: rows[0].id,
    pinId: rows[0].pin_id,
    reporterId: rows[0].reporter_id,
    hazardType: rows[0].hazard_type,
    notes: rows[0].notes,
    createdAt: rows[0].created_at
  };
}

async function listCleanups({ status, cleanerId } = {}) {
  if (status || cleanerId) {
    const filters = [];
    const values = [];
    if (status) {
      values.push(status);
      filters.push(`status = $${values.length}`);
    }
    if (cleanerId) {
      values.push(cleanerId);
      filters.push(`cleaner_id = $${values.length}`);
    }
    const { rows } = await query(
      `SELECT * FROM cleanups
       WHERE ${filters.join(" AND ")}
       ORDER BY created_at DESC`,
      values
    );
    return rows.map(mapCleanup);
  }
  const { rows } = await query(
    "SELECT * FROM cleanups ORDER BY created_at DESC"
  );
  return rows.map(mapCleanup);
}

async function createCleanup({
  pinId,
  cleanerId,
  beforePhotoUrl,
  afterPhotoUrl,
  aiScore
}) {
  const { rows } = await query(
    `INSERT INTO cleanups
      (pin_id, cleaner_id, before_photo_url, after_photo_url, ai_score, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING *`,
    [pinId, cleanerId || null, beforePhotoUrl, afterPhotoUrl, aiScore]
  );
  return mapCleanup(rows[0]);
}

async function getCleanup(cleanupId) {
  const { rows } = await query("SELECT * FROM cleanups WHERE id = $1", [
    cleanupId
  ]);
  return rows[0] ? mapCleanup(rows[0]) : null;
}

async function updateCleanupStatus(cleanupId, status) {
  const { rows } = await query(
    "UPDATE cleanups SET status = $2 WHERE id = $1 RETURNING *",
    [cleanupId, status]
  );
  return rows[0] ? mapCleanup(rows[0]) : null;
}

async function listVotes(cleanupId) {
  const { rows } = await query(
    "SELECT * FROM cleanup_votes WHERE cleanup_id = $1",
    [cleanupId]
  );
  return rows.map(mapVote);
}

async function addVote({ cleanupId, voterId, vote }) {
  await query(
    `INSERT INTO cleanup_votes (cleanup_id, voter_id, vote)
     VALUES ($1, $2, $3)
     ON CONFLICT (cleanup_id, voter_id)
     DO UPDATE SET vote = EXCLUDED.vote`,
    [cleanupId, voterId, vote]
  );
  const { rows } = await query(
    "SELECT * FROM cleanup_votes WHERE cleanup_id = $1 AND voter_id = $2",
    [cleanupId, voterId]
  );
  return rows[0] ? mapVote(rows[0]) : null;
}

async function listTerritories() {
  const territoriesResult = await query(
    `SELECT id, name, created_at,
      ST_AsGeoJSON(area::geometry) AS geojson
     FROM territories
     ORDER BY created_at DESC`
  );
  const claimsResult = await query("SELECT * FROM territory_claims");

  return {
    territories: territoriesResult.rows.map(mapTerritory),
    claims: claimsResult.rows.map(mapClaim)
  };
}

async function getTerritory(territoryId) {
  const { rows } = await query(
    `SELECT id, name, created_at,
      ST_AsGeoJSON(area::geometry) AS geojson
     FROM territories
     WHERE id = $1`,
    [territoryId]
  );
  return rows[0] ? mapTerritory(rows[0]) : null;
}

async function createTerritory({ name, polygon }) {
  const wkt = polygonToWkt(polygon);
  if (!wkt) return null;
  const { rows } = await query(
    `INSERT INTO territories (name, area)
     VALUES ($1, ST_GeogFromText($2))
     RETURNING id, name, created_at,
       ST_AsGeoJSON(area::geometry) AS geojson`,
    [name, wkt]
  );
  return mapTerritory(rows[0]);
}

async function claimTerritory({ territoryId, userId, decayAt }) {
  const { rows } = await query(
    `INSERT INTO territory_claims (territory_id, user_id, decay_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (territory_id, user_id)
     DO UPDATE SET decay_at = EXCLUDED.decay_at, claimed_at = NOW()
     RETURNING *`,
    [territoryId, userId, decayAt]
  );
  return mapClaim(rows[0]);
}

async function listRaids() {
  const raidsResult = await query(
    `SELECT id, name,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      starts_at, ends_at, created_at
     FROM raids
     ORDER BY starts_at ASC`
  );
  const participantsResult = await query("SELECT * FROM raid_participants");
  return {
    raids: raidsResult.rows.map(mapRaid),
    participants: participantsResult.rows.map(mapRaidParticipant)
  };
}

async function getRaid(raidId) {
  const { rows } = await query(
    `SELECT id, name,
      ST_Y(location::geometry) AS lat,
      ST_X(location::geometry) AS lng,
      starts_at, ends_at, created_at
     FROM raids
     WHERE id = $1`,
    [raidId]
  );
  return rows[0] ? mapRaid(rows[0]) : null;
}

async function createRaid({ name, location, startsAt, endsAt }) {
  const { rows } = await query(
    `INSERT INTO raids (name, location, starts_at, ends_at)
     VALUES ($1,
       ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
       $4, $5
     )
     RETURNING id, name,
       ST_Y(location::geometry) AS lat,
       ST_X(location::geometry) AS lng,
       starts_at, ends_at, created_at`,
    [name, location.lng, location.lat, startsAt, endsAt]
  );
  return mapRaid(rows[0]);
}

async function joinRaid({ raidId, userId }) {
  const { rows } = await query(
    `INSERT INTO raid_participants (raid_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (raid_id, user_id) DO NOTHING
     RETURNING *`,
    [raidId, userId]
  );
  if (!rows[0]) {
    const existing = await query(
      "SELECT * FROM raid_participants WHERE raid_id = $1 AND user_id = $2",
      [raidId, userId]
    );
    return existing.rows[0] ? mapRaidParticipant(existing.rows[0]) : null;
  }
  return mapRaidParticipant(rows[0]);
}

async function listCollections(userId) {
  const { rows } = await query(
    `SELECT c.user_id, c.trash_type_id, c.count, c.updated_at,
      t.code AS trash_type_code, t.name AS trash_type_name
     FROM collections c
     JOIN trash_types t ON t.id = c.trash_type_id
     WHERE c.user_id = $1
     ORDER BY c.updated_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    userId: row.user_id,
    trashTypeId: row.trash_type_id,
    count: row.count,
    updatedAt: row.updated_at,
    trashTypeCode: row.trash_type_code,
    trashTypeName: row.trash_type_name
  }));
}

async function addCollection({ userId, trashTypeCode, count }) {
  const { rows } = await query(
    `WITH upsert AS (
       INSERT INTO collections (user_id, trash_type_id, count)
       SELECT $1, t.id, $3
       FROM trash_types t
       WHERE t.code = $2
       ON CONFLICT (user_id, trash_type_id)
       DO UPDATE SET count = collections.count + EXCLUDED.count,
         updated_at = NOW()
       RETURNING user_id, trash_type_id, count, updated_at
     )
     SELECT upsert.*, t.code AS trash_type_code, t.name AS trash_type_name
     FROM upsert
     JOIN trash_types t ON t.id = upsert.trash_type_id`,
    [userId, trashTypeCode, count]
  );
  if (!rows[0]) return null;
  return {
    userId: rows[0].user_id,
    trashTypeId: rows[0].trash_type_id,
    count: rows[0].count,
    updatedAt: rows[0].updated_at,
    trashTypeCode: rows[0].trash_type_code,
    trashTypeName: rows[0].trash_type_name
  };
}

async function listLeaderboards() {
  const { rows } = await query(
    "SELECT * FROM users ORDER BY xp DESC LIMIT 50"
  );
  return rows.map(mapUser);
}

module.exports = {
  listUsers,
  createUser,
  getUser,
  updateUserProgress,
  listSquads,
  getSquad,
  createSquad,
  addSquadMember,
  listPins,
  createPin,
  getPin,
  updatePinStatus,
  addHazardReport,
  listCleanups,
  createCleanup,
  getCleanup,
  updateCleanupStatus,
  listVotes,
  addVote,
  listTerritories,
  getTerritory,
  createTerritory,
  claimTerritory,
  listRaids,
  getRaid,
  createRaid,
  joinRaid,
  listCollections,
  addCollection,
  listLeaderboards
};
