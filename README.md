TrashCleanUp
=============

Prototype backend for a "Pokemon GO" style trash cleanup game. This repo ships
with a functional API and gameplay loop backed by Postgres/PostGIS.

Highlights
----------
- Map/game loop: dirty pins -> cleanup -> verify -> reward
- Core gamification: XP, levels, collections, leaderboards
- Social features: squads, raids, adopted territories
- Verification: AI score placeholder + community voting

Project layout
--------------
- `backend/`: Node.js API prototype (Express)
- `db/schema.sql`: PostGIS schema you can migrate into Postgres
- `frontend/`: Svelte + Vite client UI
- `ROADMAP.md`: Development phases and milestones

Quick start (local prototype)
-----------------------------
1. `docker compose up -d`
2. `cd backend`
3. `npm install`
4. `DATABASE_URL=postgres://trash:trash@localhost:5433/trash_cleanup npm run migrate`
5. `DATABASE_URL=postgres://trash:trash@localhost:5433/trash_cleanup npm run dev`
6. `cd ../frontend`
7. `npm install`
8. `npm run dev`
9. Visit `http://localhost:5173`

Environment
-----------
- Frontend uses `VITE_API_BASE` (defaults to `/api`).
- Copy `frontend/.env.example` to `frontend/.env` to override.

Production build
----------------
1. `cd frontend`
2. `npm run build`
3. `npm run preview -- --port 5173`

Root scripts
------------
- `npm run frontend:dev`
- `npm run frontend:build`
- `npm run frontend:preview`
- `npm run frontend:verify`
- `npm run backend:test`
- `npm test`

Notes
-----
- The client registers a service worker in production builds.

Notes
-----
- Image uploads and AI verification are stubbed and modeled as URLs + scores.
- The API expects a `DATABASE_URL` environment variable.
- Seed data for trash types is included at the end of `db/schema.sql`.
- Migrations live in `backend/migrations` and are run via `npm run migrate`.
- The client uses Leaflet via CDN for the map view.
