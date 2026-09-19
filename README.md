# SIF-Guard — Client (React + Vite)

Frontend-first build per the SIH26165 spec, Section 7: a polished, working
UI wired against a typed mock API layer (`src/api/reportsApi.js`) and
realistic fixture data (`src/data/fixtures.js`), so swapping in the real
Node/Express + FastAPI backend later is a drop-in replacement, not a rewrite.

## Stack
React 19 + Vite, Tailwind CSS v4, React Router, Recharts-ready (charts
currently hand-rolled with Framer Motion for the bar/trend visuals — swap
in Recharts components directly in `Dashboard.jsx`/`DrillDown.jsx` if you
want its tooltip/legend machinery), Framer Motion.

## Run it
```bash
npm install
npm run dev
```

## Wiring in the real backend
Every function in `src/api/reportsApi.js` mirrors an endpoint in the build
spec (Section 3) 1:1 — replace the fixture-array logic in each function
with a `fetch()` call to the matching Express route and the pages don't
change at all.

## Structure
```
src/
├── api/reportsApi.js       # mock API layer — mirrors REST contract exactly
├── data/fixtures.js        # mock Report/Site/User data (Section 2 schema)
├── context/AuthContext.jsx # session state — swap login() for real JWT call
├── components/             # Layout, ProtectedRoute, ScanHero (hero animation)
└── pages/                  # Landing, Login, Dashboard, Reports, DrillDown,
                             # Upload, Export, Admin — one per Section 4 page
```

## Design system
Tokens live in `src/index.css` (`@theme` block) — olive-tinted dark palette,
Space Grotesk display font, IBM Plex Mono for data readouts only, per the
design direction in Section 8 of the build spec.

## Roles (demo)
Login page has a role picker for demo purposes (no real auth yet). In
production this is decided by the JWT the real `/api/auth/login` issues.
Frontend route guards in `ProtectedRoute.jsx` are UX-only — real enforcement
must live in Express middleware, as noted in the spec.
