const request = require("supertest");
const { createApp } = require("../src/app");
const { query, pool } = require("../src/data/db");

const app = createApp();

async function resetDb() {
  await query(
    `TRUNCATE cleanup_votes,
      cleanups,
      collections,
      hazard_reports,
      territory_claims,
      territories,
      raid_participants,
      raids,
      squad_members,
      squads,
      pins,
      users
     RESTART IDENTITY CASCADE`
  );
}

describe("API core loop", () => {
  beforeAll(async () => {
    await resetDb();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  test("health check", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  test("user -> pin -> cleanup -> vote -> reward", async () => {
    const userResponse = await request(app)
      .post("/users")
      .send({ username: "eco_hero" });
    expect(userResponse.status).toBe(201);

    const cleaner = userResponse.body.user;
    const voters = [];
    for (let i = 0; i < 3; i += 1) {
      const voterResponse = await request(app)
        .post("/users")
        .send({ username: `voter_${i}` });
      voters.push(voterResponse.body.user);
    }

    const pinResponse = await request(app)
      .post("/pins")
      .send({ severity: "red", lat: 37.7749, lng: -122.4194 });
    expect(pinResponse.status).toBe(201);
    const pin = pinResponse.body.pin;

    const cleanupResponse = await request(app)
      .post("/cleanups")
      .send({
        pinId: pin.id,
        cleanerId: cleaner.id,
        beforePhotoUrl: "https://example.com/before.jpg",
        afterPhotoUrl: "https://example.com/after.jpg",
        aiScore: 0.4,
        trashTypeCode: "plastic"
      });
    expect(cleanupResponse.status).toBe(201);
    const cleanup = cleanupResponse.body.cleanup;

    for (const voter of voters) {
      const voteResponse = await request(app)
        .post(`/cleanups/${cleanup.id}/votes`)
        .send({ voterId: voter.id, vote: "legit" });
      expect(voteResponse.status).toBe(201);
    }

    const refreshedCleanup = await request(app).get("/cleanups");
    const verified = refreshedCleanup.body.cleanups.find(
      (item) => item.id === cleanup.id
    );
    expect(verified.status).toBe("verified");

    const refreshedUser = await request(app).get(`/users/${cleaner.id}`);
    expect(refreshedUser.body.user.xp).toBeGreaterThan(0);
    expect(refreshedUser.body.user.currency).toBeGreaterThan(0);
  });

  test("cleanups filter by cleaner", async () => {
    const userResponse = await request(app)
      .post("/users")
      .send({ username: "filter_user" });
    const cleaner = userResponse.body.user;

    const pinResponse = await request(app)
      .post("/pins")
      .send({ severity: "yellow", lat: 40.7128, lng: -74.006 });

    await request(app)
      .post("/cleanups")
      .send({
        pinId: pinResponse.body.pin.id,
        cleanerId: cleaner.id,
        beforePhotoUrl: "https://example.com/before.jpg",
        afterPhotoUrl: "https://example.com/after.jpg",
        aiScore: 0.6
      });

    const listResponse = await request(app).get(
      `/cleanups?cleanerId=${cleaner.id}`
    );
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.cleanups.length).toBe(1);
  });
});
