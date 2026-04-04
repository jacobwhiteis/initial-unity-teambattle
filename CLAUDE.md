# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Competitive team battle hub for **Initial Unity Reborn**, a fan-made racing game inspired by Initial D. This site tracks team standings, match results, and CRP (Competition Rating Points) rankings for organized head-to-head team battles.

Intended deployment: `teambattle.initialunityreborn.com`

## Build & Dev Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # Production build (output in dist/)
npm run preview    # Preview production build locally
node scripts/seed.js  # Seed Firestore with test data (12 teams, 10 matches)
```

No test framework is configured.

## Architecture

**Stack:** Vanilla JS + HTML pages, Vite bundler, Firebase (Firestore + Auth with Discord OAuth).

### Pages (multi-page Vite app)

All HTML entry points are defined in `vite.config.js` under `build.rollupOptions.input`:

- `index.html` — Homepage with dual leaderboard (Position + CRP Rankings), expandable team rows, recent matches
- `team.html` — Team profile page (roster, stats, match history)
- `match.html` — Match detail page (per-map breakdown with drivers)
- `admin.html` — Staff dashboard (Discord OAuth-gated): team/driver management, match logging, live battle creation, invite system, danger zone
- `banpick.html` — Map ban/pick tool (migrated from main site). Real-time 2-player session with pick/ban phases
- `battle.html` — Live battle page. Shows ban/pick status, map-by-map result editing, auto-finalization with CRP

### Key Source Files

- `src/main.js` — Homepage: dual-mode leaderboard (Position/CRP tabs), expandable rows with driver roster + match history, recent match cards. Real-time Firestore listeners.
- `src/admin.js` — Staff dashboard: Discord OAuth auth flow, role-based access (admin/moderator), team CRUD, driver CRUD, match logging with CRP, live battle creation with banpick session generation, invite code system, webhook config, danger zone (admin-only).
- `src/battle.js` — Live battle page: real-time match state via onSnapshot, banpick→in_progress auto-transition, map result editing with undo, auto-advance (map winners, series winner detection), finalization with CRP, Discord webhook updates.
- `src/banpick.js` — Map ban/pick session manager (migrated from main site). Firestore real-time sync, phase state machine (WAITING → PICK_HOME_A → PICK_HOME_B → BAN_A ↔ BAN_B → DECIDER).
- `src/crp.js` — CRP calculation engine (pure utility, no DOM/Firebase). Exports: `getTier`, `getRules`, `calcCRP`, `POS_RULES`, `NOVICE_RULES`.
- `src/finalize.js` — Shared match finalization module. CRP calculation + standings updates + position swaps in a single writeBatch. Used by both admin quick-log and live battle page.
- `src/discord.js` — Discord webhook utility. Posts formatted messages to channels/threads. Pre-built helpers for battle events (created, maps selected, race results, finalized).
- `src/firebase.js` — Firebase init, Firestore + Auth exports. Project: `iur-teambattle`.
- `src/team.js` — Team profile page logic.
- `src/match.js` — Match detail page logic.
- `src/nav.js` — Mobile nav toggle.
- `src/styles/global.css` — Full design system: dark gray palette, Bebas Neue + Barlow fonts, all component styles.

### CRP (Competition Rating Points) System

Teams earn CRP per match based on the **opponent's** position/tier:
- Winner gets the loser's position-based `win` value; loser gets the winner's `loss` value
- Home map bonus and streak bonus (every 4th consecutive win) add extra CRP
- CRP values scale with position: #1 win = 32 pts, unranked = 2 pts
- Tiers: Adept (pos 1-5), Proficient (6-10), Intermediate (11-15), Novice (16+), Unranked

Position swaps: if a lower-ranked team beats a higher-ranked team, the winner takes the loser's position; intermediate teams shift down by 1.

See `src/crp.js` for the full calculation logic and `POS_RULES` table.

### Firestore Collections

- `teams/{teamId}` — `name`, `tag`, `captainDiscordId`, `roster[]` (each: name, car, role, discordId), `active`, `createdAt`
- `standings/{teamId}` — `teamName`, `teamTag`, `wins`, `losses`, `mapWins`, `mapLosses`, `winRate`, `streak`, `rank`, `crp`, `position`, `consecutive_wins`, `roster[]`, `match_history[]`, `lastMatchDate`
- `matches/{matchId}` — `teamA`, `teamB`, `teamAName`, `teamBName`, `format`, `status` (banpick|in_progress|completed), `winner`, `score{teamA,teamB}`, `liveScore{teamA,teamB}`, `maps[]`, `mapResults[]` (each: mapName, mapId, type, uphillWinner, downhillWinner, tiebreaker, mapWinner), `banpickSessionId`, `banpickResult{homeA,homeB,decider}`, `discordThreadId`, `date`, `createdAt`, `finalizedAt`, `recordedBy`, `notes`
- `sessions/{sessionId}` — Ban/pick sessions. `phase`, `homeA`, `homeB`, `bans[]`, `history[]`, `teamAName`, `teamBName`, `teamAClaimed`, `teamBClaimed`, `createdAt`
- `staff/{firebaseUid}` — `discordUsername`, `role` (admin|moderator), `addedAt`, `addedBy`
- `invites/{code}` — `role`, `createdBy`, `createdAt`, `used`, `usedBy`, `usedAt`
- `config/discord` — `webhookUrl` (Discord webhook for battle updates)

### Authentication & Authorization

- Discord OAuth via Firebase Auth (`oidc.discord` provider)
- Staff verified against `staff` collection on login
- Invite code system: admins generate codes, new staff redeem on first login
- Roles: `admin` (full access including danger zone + invites), `moderator` (teams, drivers, match logging)

### Discord Bot (Cloudflare Worker)

A Cloudflare Worker at `worker/` handles Discord slash commands for driver management:

- `/add-team-driver [team_tag] @player [display_name]` — adds a Discord user to a team roster
- `/remove-team-driver [team_tag] @player` — removes a Discord user from a roster

Staff-only (verified via `discordId` field on `staff` collection). New drivers must be added via bot (links Discord ID); admin dashboard can edit name/role and remove existing drivers.

```bash
cd worker
npm run dev          # Local dev with wrangler
npm run deploy       # Deploy to Cloudflare
```

Secrets (set via `npx wrangler secret put`): `DISCORD_PUBLIC_KEY`, `DISCORD_APP_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`

Command registration: `DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/register-commands.js`

The Worker uses the Firestore REST API (not firebase-admin, which doesn't run in Workers) with a Google Cloud service account for authentication.

### Hosting

- `_redirects` — Netlify/Cloudflare URL rewrites (clean URLs for `/team/*`, `/match/*`, `/battle/*`, `/banpick/*`, `/admin`)
- Intended host: Cloudflare Pages with custom subdomain

## Related Projects

- **Main Website** — Separate repo (`initial-unity-website`) at `initialunityreborn.com`. Homepage, download, leaderboard, gallery, credits.
- **External API** — `api.initialunityreborn.com` serves leaderboard records. The game identifies players by hardware ID.

## Style Conventions

- Fonts: Bebas Neue (headings), Barlow (body), Barlow Condensed (labels/tabs)
- Primary accent: `#ff5520` (orange), gold: `#e8410a`
- Dark gray palette: bg `#0a0a0a`, surface `#111111`, panel `#181818`
- Win green: `#3cb371`, loss red: `#e84040`
- CSS custom properties defined in `src/styles/global.css` under `:root`
- Subtle warm radial gradient on body background

## Key Patterns

- **Roster sync:** Driver edits must update BOTH `teams/{id}.roster` and `standings/{id}.roster` atomically via `writeBatch`. Each driver has `{ name, role, discordId }`. New drivers are added exclusively via the Discord bot (which links their Discord ID); the admin UI can only edit/remove existing drivers.
- **Match finalization:** Uses shared `finalize.js` module with `writeBatch` to atomically update match doc + both teams' standings + position shifts. Called from both admin quick-log and live battle page.
- **Live battle flow:** Create Battle → banpick session → auto-transition to in_progress when DECIDER reached → staff records race results → auto-advance map/series winners → confirm finalization → CRP applied
- **Discord webhooks:** Battle events post to Discord via webhook URL stored in `config/discord`. Thread ID optional — if blank, posts to webhook's default channel.
- **Real-time updates:** Public pages use `onSnapshot` listeners so standings/matches update without page refresh
- **Match history capped** at 50 entries per team to avoid Firestore doc size limits
- **BO3 format:** Live battles always use BO3 (banpick produces 3 maps). Decider map only shown when score reaches 1-1.
