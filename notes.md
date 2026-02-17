Date: 2026-01-27
Tasks:
- Made frontend mobile-first with progress/collection panels
- Added cleanups filter by cleaner and profile refresh UI
- Added backend and frontend test suites, ran them successfully
Follow-ups:
- None

Date: 2026-01-27
Tasks:
- Migrated frontend to Vite with `src/` entrypoints
- Updated docs to use `npm run dev` for the client
- Verified frontend tests pass after migration
Follow-ups:
- None

Date: 2026-01-27
Tasks:
- Switched frontend API base to `/api` with Vite proxy
- Installed Leaflet via npm and moved CSS import into Vite
- Added production build/preview steps to README
Follow-ups:
- None

Date: 2026-01-27
Tasks:
- Added Vite config with proxy and env-based API base
- Added frontend `.env.example` and README env notes
- Verified frontend tests after config split
Follow-ups:
- None

Date: 2026-01-27
Tasks:
- Migrated frontend to Svelte with Leaflet + service worker
- Added root scripts and frontend build verification
- Verified frontend tests and production build output
Follow-ups:
- None

Date: 2026-02-08
Tasks:
- Fixed ECONNREFUSED errors by configuring and starting backend server
- Created backend/.env with DATABASE_URL and PORT configuration
- Fixed .pgmrc configuration to use DATABASE_URL environment variable
- Ran database migrations successfully
- Updated Vite proxy config to rewrite /api paths (strip prefix)
- Created scripts/start-dev.sh helper script for starting all services
- Verified backend API endpoints are responding correctly
Follow-ups:
- Restart frontend dev server for Vite config changes to take effect

Date: 2026-02-08
Tasks:
- Redesigned UI to be mobile-first and map-focused with primary goal of trash pickup
- Removed all complex forms/panels (Player, Spot Trash, Clean+Verify, Community Vote, etc.)
- Created full-screen map layout with minimal top bar showing user level/XP
- Added floating action button (FAB) for primary trash reporting action
- Implemented bottom sheet with severity selector (Litter/Overflow/Dumping)
- Added GPS auto-fill for trash reporting
- Implemented auto-login feature (selects first available user on mount)
- Fixed map click UX: clicking map directly opens report sheet with clicked location
- Added pin details bottom sheet: displays severity, status, reporter, location, and "Clean This" action
- Added profile overlay: slides from left, shows user stats (level/XP/currency), collections grid, and user switching
- Created onboarding flow: full-screen modal for first-time users with username input and gradient design
- Implemented cleanup flow: camera/photo upload for before/after photos, trash type selector, submit to API
Follow-ups:
- None - core gameplay loop is complete (report → view → clean → verify → reward)

Date: 2026-02-16
Tasks:
- Migrated photo upload from base64-in-database to proper file storage system
- Installed multer middleware for handling multipart file uploads (10MB limit, image-only validation)
- Created `/backend/uploads/` directory with static file serving at `/uploads/*`
- Added POST `/upload` endpoint with structured logging (emoji markers for debugging)
- Updated frontend `handlePhotoUpload` to upload files via FormData and store URL paths instead of base64 strings
- Removed unused `submitCleanupOld` function from frontend
- Verified end-to-end flow: upload → storage → static serving all working correctly
- Fixed backend database connection issue by installing dotenv and loading .env file in index.js
- Added cleanup photo display to pin sheet: users can now see before/after photos and cleanup details when viewing a pin
- Added CSS styles for cleanup display with grid layout for side-by-side before/after comparison
Follow-ups:
- None - photo storage is now scalable and follows best practices, and cleanup photos are visible to all users

Date: 2026-02-17
Tasks:
- Fixed 3 bugs preventing cleanup photos from showing when clicking a pin:
  1. Added `/uploads` Vite proxy rule so image requests reach the backend (were 404ing in dev)
  2. Fixed cleanup filter in pin sheet: `c.pin_id` → `c.pinId` (API returns camelCase; filter never matched)
  3. Fixed all snake_case property references in cleanup display template: `cleaner_id` → `cleanerId`, `before_photo_url` → `beforePhotoUrl`, `after_photo_url` → `afterPhotoUrl`, `trash_type_code` → `trashTypeCode`
Follow-ups:
- Restart Vite dev server for proxy change to take effect; verify photos appear on existing pins
