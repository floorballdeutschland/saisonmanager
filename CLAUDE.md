# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repositories

This is a monorepo-adjacent setup across three separate repos:

- `~/saisonmanager` – Angular 18 frontend (this repo)
- `~/saisonmanager-api` – Rails 7 API backend
- `~/saisonmanager-docker` – Docker Compose setup for local dev

## Frontend Commands

```bash
# Dev server (requires API at sm.jholocal.de or local)
npm start                    # ng serve → http://localhost:4200
npm run start-local          # ng serve --host 0.0.0.0 (for network access)

# Build
npm run build                # production build → dist/saisonmanager/browser/
./build-deploy.sh            # build + scp to saisonmanager.org

# Tests
ng test                      # Karma unit tests

# Lint (runs automatically as pre-commit hook via Husky)
npm run lint                 # Prettier on staged files only
```

**`build-deploy.sh` caveat:** The script calls `ng` directly, which requires nvm to be in PATH. Running `./build-deploy.sh` in a fresh shell will fail with `ng: command not found`. Run it from a shell where `nvm use` has been called, or invoke `npm run build` first then `scp -r dist/saisonmanager/browser/* saisonmanager:/opt/saisonmanager/saisonmanager-frontend/` manually.

**Never deploy a development build.** Using `ng build --configuration development` produces a broken blank page in production. Always use `ng build` (production is the default).

**Pre-commit hook caveat:** The Husky hook runs `git-format-staged` which requires Python. If the hook fails with `python: not found`, ensure `~/.local/bin` is in PATH and `python` symlinks to `python3`. The hook also runs `ng lint_association` — the full PATH must include `~/.nvm/versions/node/.../bin` and `saisonmanager/node_modules/.bin`.

## API Commands (in `~/saisonmanager-api`)

```bash
# Run in Docker (preferred)
cd ~/saisonmanager-docker
docker compose -f docker-compose.yml -f docker-compose.dev.yml up postgres -d
docker compose -f docker-compose.yml -f docker-compose.dev.yml up rails-api -d  # → port 3001

# One-off rails commands in Docker
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm rails-api \
  bundle exec rails <command> RAILS_ENV=development

# DB setup (first time)
docker compose ... run --rm rails-api bundle exec rails db:migrate RAILS_ENV=development
docker compose ... run --rm rails-api bundle exec rails db:seed RAILS_ENV=development

# Lint (API)
bundle exec rubocop
```

**Note:** `rails db:schema:load` fails in Docker because it tries to connect to the test DB via Unix socket. Use `rails db:migrate` instead — the schema was bootstrapped from `db/migrate/20170101000000_create_main_tables.rb` (not from a SQL dump).

## Local Dev Environment

The API runs at **http://localhost:3001** (port 3000 is taken by another service). The frontend's `environment.ts` points to `https://sm.jholocal.de/api/v2/` by default — point it to `http://localhost:3001/api/v2/` for fully local development.

**Demo credentials** (all password: `password123`):

| Username     | Role                              |
| ------------ | --------------------------------- |
| `admin`      | Admin – full access               |
| `sbk_ost`    | SBK Ost – game operations for Ost |
| `sbk_west`   | SBK West                          |
| `vm_berlin`  | Vereinsmanager – Floorball Berlin |
| `tm_berlin1` | Teammanager – Berlin Team 1       |

## Architecture

### Frontend (Angular 18)

**Module structure** under `src/app/`:

- `_modules/_admin/` – Protected admin views: `_league_admin`, `_schedule_admin`, `_license_admin`, `_player_admin`, `_club_admin`, `_team_admin`
- `_modules/_public/` – Public-facing views (schedule, scores, login)
- `_modules/_core/_services/` – Shared services (session, API calls)
- `_modules/_uikit/` – Shared UI components
- `_helpers/_interceptors/` – HTTP interceptors
- `_models/` – TypeScript types

**TypeScript path aliases** (defined in `tsconfig.json`):

- `@floorball/models` and `@floorball/types` → both map to `_models` (use either)
- `@floorball/core` → `_modules/_core`
- `@floorball/uikit/*` → `_modules/_uikit/_*`
- `@floorball/admin/*` and `@floorball/public/*` for lazy-loaded feature modules

**Auth flow:** `SessionService` handles login/logout. On login, the user object (including permissions hash) is stored in `localStorage`. An `ErrorInterceptor` auto-logs out on 401 and redirects on 403.

**Permission gating in templates:** Components subscribe to `SessionService.currentUser$` and expose a `showItem(key: string)` helper that reads from `user.permissions` (a flat boolean map returned by the API). Example: `*ngIf="showItem('menu_item_league_admin')"`.

### API (Rails 7)

**Auth:** Cookie-based sessions (`cookies.signed[:user_id]`). `ApplicationController` calls `authenticate_user` before every action. The sessions controller sets the cookie on login.

**Permission system:** Each `User` has a JSONB `permissions` array of objects `{ user_group_id, game_operation_id, club_id }`. The `permission_hash` method resolves this into `ph[:admin]`, `ph[:sbk]`, `ph[:vm]`, `ph[:tm]` — each an array of game_operation IDs the user is scoped to. `0` means global access across all Verbände.

**Permission check pattern:**

```ruby
ph = current_user.permission_hash
go_id = resource.league.game_operation_id
allowed = ph[:admin].present? ||
          (ph[:sbk].present? && (ph[:sbk].include?(0) || ph[:sbk].include?(go_id)))
```

**`User#club_ids` returns `permission_hash[:vm]`** — an array of club IDs the user manages as Vereinsmanager. This is **empty for admin and SBK users**, even though they have broad access. Frontend code that loops over `user.club_ids` to load clubs will silently do nothing for admin/SBK users; use `GET admin/clubs.json` (`Club.admin_user_clubs`) to get their accessible clubs instead.

When building `go_ids` arrays in `admin_user_clubs`-style methods, always use `go_ids.flatten!` (mutating) — `go_ids.flatten` (non-mutating) silently leaves nested arrays.

**Data model overview:**

- `GameOperation` (Verband: FD, SBK Ost, SBK West…) → has many `League`s
- `League` → has many `GameDay`s and `Team`s
- `GameDay` → has many `Game`s (each belongs to an arena and hosting club)
- `Game` – stores game events and player lineups as JSONB columns; `nominated_referee_ids` JSONB
- `Player` – stores club memberships (`clubs` JSONB) and license history (`licenses` JSONB)
- `Referee` – separate model with name, license level, game history
- `StateAssociation` (Landesverband) – referenced by `Club#state_association_id`
- `User` – `permissions` JSONB, `teams` integer array

**Key JSONB columns:**

- `Setting` – single-row config: `nations`, `league_categories`, `league_classes`, `seasons`, `systems`, `penalties`, etc. Access via `Setting.current`
- `Game#players` – `{ "home": [...], "guest": [...] }` with trikot numbers and player IDs
- `Game#events` – array of goal/penalty events used to compute the score
- `Player#clubs` – array of `{ club_id, team_id, valid_until, ... }`
- `Player#licenses` – array with nested `history` array of status transitions

**game_number is stored as text.** Sort numerically with `NULLIF(game_number, '')::integer NULLS LAST`.

**Route structure:** Two API versions coexist. Public endpoints under `/leagues/:id/schedule` etc. Admin endpoints under `/api/v2/admin/...`. The `api_controller.rb` handles the older v1 ticker API.

## Deployment

No CI/CD. Manual deploy:

- **Frontend:** `./build-deploy.sh` (production build + `scp` to `/opt/saisonmanager/saisonmanager-frontend/` on the server)
- **API + Docker/nginx configs:** After pushing to GitHub:
  ```bash
  ssh saisonmanager /opt/saisonmanager/deploy.sh
  ```
  The script: `git pull` on `saisonmanager-docker`, then `git reset --hard origin/main` on `saisonmanager-api`, then restarts both `nginx` and `rails-api` containers via docker compose.

**Production server:** `ssh saisonmanager` → `root@178.104.133.109` (YubiKey FIDO2, `~/.ssh/yubikey`)

- Docker setup lives at `/opt/saisonmanager/saisonmanager-docker/`
- Deploy script: `/opt/saisonmanager/deploy.sh`

**Archive server:** `archiv.saisonmanager.org` → Hetzner `116.203.113.70` (SSH via YubiKey)

## Versioning & Changelog

Semantic Versioning (MAJOR.MINOR.PATCH) — defined in `~/saisonmanager-api/config/initializers/version.rb`.

**Rules:**

- **Patch** (1.0.x): bugfixes, performance improvements, no new functionality
- **Minor** (1.x.0): new user-facing features
- **Major** (x.0.0): breaking API changes

**Workflow (mandatory for every PR):**

1. Add an entry under `## [Unreleased]` in `~/saisonmanager-api/CHANGELOG.md`
   - Use sections: `### Behoben` (fixes), `### Neu` (features), `### Verbessert` (improvements)
2. On merge to `main`: move the `[Unreleased]` block to a new versioned entry and bump `version.rb`
   ```
   ## [1.1.0] - YYYY-MM-DD
   ```
3. The version and changelog are exposed publicly at `GET /api/v2/version` and can be shown in the admin UI.

**Version endpoint response:**

```json
{
  "version": "1.0.0",
  "changelog": [
    {
      "version": "1.0.0",
      "date": "2026-04-10",
      "changes": { "Behoben": ["..."], "Verbessert": ["..."] }
    }
  ]
}
```

## Pull Request Workflow

Every fix or feature must go through a PR — no direct pushes to `main`.

1. Branch from `main`: `git checkout -b fix/description` or `feat/description`
2. Add `## [Unreleased]` entry to `CHANGELOG.md`
3. Open PR with `gh pr create`
4. On merge: bump version in `version.rb`, move Unreleased → versioned block in CHANGELOG
