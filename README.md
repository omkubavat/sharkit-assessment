# AskBoard

A small full-stack marketplace where founders post funding asks — Equity, Loan or Grant — and anyone can browse the live feed and filter by type. Built as a practical assessment: a real frontend talking to a real backend with a persistent Postgres datastore, with a dark "glass" theme and a self-designed light mode.

**Live demo:** https://shark-it.netlify.app/

---

## Demo login

Auth is intentionally minimal for this project's scope — one seeded user, checked against a plain match, no JWT/session infra.

| Field | Value |
|---|---|
| Email | `founder@askboard.demo` |
| Password | `Demo@1234` |

The login screen also has a **"Fill in demo login"** button that fills these in for you.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Plain HTML, CSS, JavaScript (no framework, no build step) | The scope is one login screen, one feed and one form — a framework would add build tooling for no real benefit, and it keeps every line easy to point at and explain. |
| Backend | PHP 8.3, no framework | A small, explicit HTTP → service → repository split, without a framework's routing/DI magic hiding how requests actually flow. |
| Database | PostgreSQL | Persistent relational store with real constraints (`CHECK`, `NOT NULL`) as a backstop behind server-side validation. |
| Frontend hosting | Netlify | Static hosting, deploys straight from the `frontend/` folder. |
| Backend hosting | Railway | Deploys the `Dockerfile` directly; Postgres add-on lives in the same project. |
| Local dev | PHP's built-in server (`php -S`) + a small router | No Apache/nginx/XAMPP needed to run this locally. |

No ORM, no PHP framework, no CSS framework, and no React/Vue on the frontend — deliberately, to keep the amount of "trust me, the framework did it" surface area as small as possible for a 2–3 day assessment with a live "why" walkthrough.

---

## Features

- **Login** — single seeded user, session kept in `localStorage`, redirects straight to the feed.
- **Deal feed** — cards show company, founder, sector, one-line pitch, funding type, amount sought (₹), and equity % for Equity asks.
- **Filter pills** — All / Equity / Loan / Grant, filtered **server-side** via `?type=`.
- **Post an Ask** — a validated form that adds the new ask to the feed instantly, no page reload.
- **Dark / Light mode** — a visible toggle; dark matches the brief's "glass" theme, light is a from-scratch design that keeps the same brand identity with contrast-audited text.
- **Loading, empty and error states** — skeleton cards while loading, a per-filter empty state, and a retry button with a friendly message on network failure or timeout.

---

## Project structure

```
sharkit-assessment/
├── frontend/
│   ├── login.html
│   ├── index.html
│   ├── _redirects            # Netlify: serve login.html at "/"
│   ├── css/
│   │   └── style.css         # design tokens for both themes + all components
│   └── js/
│       ├── theme.js          # dark/light toggle, applied pre-paint
│       ├── auth.js           # seeded-user login, session, route guard
│       └── deals.js          # API client, rendering, filters, post form
│
├── backend/
│   ├── router.php            # only /api/**.php is reachable; blocks .env etc.
│   ├── api/
│   │   ├── health.php
│   │   └── deals/
│   │       ├── list.php      # GET  /api/deals/list.php?type=
│   │       └── create.php    # POST /api/deals/create.php
│   ├── config/
│   │   ├── bootstrap.php     # autoload, .env, error handling, CORS, wiring
│   │   ├── database.php      # PDO connection (local .env or Railway DATABASE_URL)
│   │   └── cors.php
│   ├── controllers/
│   │   └── DealController.php    # HTTP only: method check, parse, status codes
│   ├── services/
│   │   ├── DealService.php       # business rules: all validation lives here
│   │   └── ValidationException.php
│   ├── repositories/
│   │   └── DealRepository.php    # the only file with SQL
│   ├── core/
│   │   └── Response.php
│   ├── database/
│   │   ├── schema.sql
│   │   ├── seed.sql
│   │   ├── migrate.php       # php backend/database/migrate.php --seed
│   │   └── check.php         # php backend/database/check.php  (connection diagnostics)
│   └── .env.example
│
├── Dockerfile                 # Railway build (PHP built-in server + router)
└── .gitignore                 # excludes backend/.env
```

**Layering rule:** controllers never touch SQL, and the repository never sees `$_GET`/`$_POST` or knows what a "valid" deal is. The service is the single source of truth for validation, used by both the create endpoint and (implicitly) documented in the frontend's mirrored client-side checks.

---

## Running it locally

### 1. Backend

```bash
# requires PHP 8.1+ with the pdo_pgsql extension, and a running PostgreSQL
cp backend/.env.example backend/.env
# edit backend/.env: set DB_NAME, DB_USER, DB_PASSWORD to your local Postgres

php backend/database/check.php            # confirms the connection
php backend/database/migrate.php --seed   # creates the table + 10 demo deals

php -S localhost:8000 -t backend backend/router.php
```

### 2. Frontend

```bash
php -S localhost:5500 -t frontend
```

Open `http://localhost:5500/login.html` — don't open the HTML files directly with `file://`, the API calls will be blocked.

If `frontend/js/deals.js`'s `API_BASE` isn't already `http://localhost:8000`, update it to match.

---

## API contract

Base URL: set in `frontend/js/deals.js` as `API_BASE`.

### `GET /api/deals/list.php`

Query param `type` is optional: `Equity` | `Loan` | `Grant` | `All` (case-insensitive). Returns the newest 50 deals, newest first.

```json
200 OK
{ "data": [
  {
    "id": 12,
    "company_name": "Kisan Cold Chain",
    "founder_name": "Meera Patil",
    "sector": "AgriTech",
    "pitch": "Solar cold storage for small farms, paid per crate stored",
    "funding_type": "Equity",
    "amount_inr": 7500000,
    "equity_percent": 8.0,
    "created_at": "2026-09-25T10:00:00Z"
  }
]}
```

An unrecognised `type` returns `400`.

### `POST /api/deals/create.php`

Body: `application/json`.

```json
{
  "company_name": "string, 1–60 chars",
  "founder_name": "string, 1–60 chars",
  "sector": "one of the fixed sector list",
  "pitch": "string, 1–140 chars",
  "funding_type": "Equity | Loan | Grant",
  "amount_inr": "integer, 10000–1000000000",
  "equity_percent": "number, 0 < x < 100 — required for Equity, must be omitted/null otherwise"
}
```

- **`201`** → `{ "data": <the created deal, same shape as above> }`
- **`422`** → `{ "error": "validation", "message": "...", "fields": { "amount_inr": "..." } }` — one message per invalid field
- **`400`** → malformed/non-object JSON body
- **`415`** → wrong `Content-Type`
- **`405`** → wrong HTTP method

---

## Key decisions and trade-offs

- **Server-side filtering.** `?type=` is resolved in Postgres via an index on `(funding_type, created_at)`, not fetched-then-filtered in JS. It's the same amount of code either way at this scale, but it's the version that still works if the feed grows.
- **No pagination.** The API returns the newest 50 and stops there. Real pagination (cursor-based, to avoid skipping/duplicating rows as new asks come in) was cut deliberately — it's the "over-building" trap the brief warns against for this scope.
- **Auth is intentionally thin.** One seeded user, checked with a plain string match, session kept in `localStorage`. There's no password hashing, no JWT, no server-side session — because the brief explicitly puts that infrastructure out of scope. In a real system, credentials would never live in client-side JS.
- **Validation is duplicated on purpose.** The client checks the same rules as the server for instant feedback, but the **server is the authority** — its `422` field errors are what actually get shown if the two ever disagree.
- **Database `CHECK` constraints as a backstop.** Even if a future code path skipped the service's validation, Postgres itself refuses an amount outside range, an Equity row with no percentage, or a Loan row with one.
- **Light mode is an original design**, since SharkIT only ships dark today. The brand blue used as a fill isn't accessible as text on white (~2.7:1 contrast), so light mode uses a darker sibling colour for anything that's text, and reserves the bright blue for fills, glows and accents.

---

## Deployment

- **Frontend → Netlify**, deployed from `frontend/` (publish directory `frontend`, no build command). `_redirects` routes `/` to `login.html`.
- **Backend → Railway**, built from the root `Dockerfile` (PHP's built-in server + `router.php`, which is the only thing that exposes `/api/**` — `.env`, `config/`, and `database/*.sql` are never reachable over HTTP).
- **Database → Railway PostgreSQL** add-on, connected via `DATABASE_URL`.
- CORS (`backend/config/cors.php`) only allows origins listed in `ALLOWED_ORIGINS`; the deployed frontend's Netlify URL must be added there.
