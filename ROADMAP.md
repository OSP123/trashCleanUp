Roadmap
=======

This roadmap tracks the build-out of the trash cleanup game. Each phase is
designed to be shippable and to unlock the next layer of experience.

Phase 0: Developer Experience
-----------------------------
- Docker + PostGIS setup
- Database migrations
- API health and error handling
- Local client for manual testing

Phase 1: Core Loop MVP
----------------------
- Mobile-first UI with map + pins
- Create user, drop pin, submit cleanup
- Community vote flow
- XP, levels, currency updates
- Minimal feed for pins and cleanups

Phase 2: Map & Territory Systems
--------------------------------
- Territory polygons rendered on map
- Claim/decay UI with timers
- Heatmap overlay for dirty vs clean areas
- "Adopt a spot" leaderboard badge when entering zone

Phase 3: Social & Raids
-----------------------
- Squads (create, join, list members)
- Raid scheduling + join flow
- Squad and raid leaderboards
- Notifications for nearby raids

Phase 4: Verification & Safety
------------------------------
- Before/after alignment UI
- AI verification integration hook
- Community moderation queue
- Hazard reporting workflow
- Safety guidance content surfaced in app

Phase 5: Engagement & Retention
-------------------------------
- Collection book UI + badges
- Daily/weekly challenges
- Push notifications
- Reward economy tuning

Phase 6: Production Hardening
-----------------------------
- Auth + secure session
- Rate limits + abuse protection
- S3 upload + signed URLs
- Observability + analytics

Milestones to Track
-------------------
- M1: Core loop runs on mobile browser
- M2: Territory system + heatmap live
- M3: Social features + raids live
- M4: Verification + safety launch-ready
