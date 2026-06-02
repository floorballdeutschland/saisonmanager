# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repositories

This is a monorepo-adjacent setup across three separate repos:

- `~/saisonmanager` – Angular 18 frontend (this repo)
- `~/saisonmanager-api` – Rails 7 API backend
- `~/saisonmanager-docker` – Docker Compose setup for local dev

## Frontend Commands

```bash
# Dev server (requires local API at localhost:3001)
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

**`build-deploy.sh` caveat:** The script calls `ng` directly, which requires nvm to be in PATH. Running `./build-deploy.sh` in a fresh shell will fail with `ng: command not found`. Always invoke it as:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && export PATH="$PATH:$(pwd)/node_modules/.bin" && ./build-deploy.sh
```

**NEVER deploy using `npm run build` + manual `scp`.** `build-deploy.sh` reads the real API key from the gitignored file `src/environments/.api-key` and substitutes it for the `FRONTEND_API_KEY_PLACEHOLDER` in `environment.prod.ts` before building. Skipping the script deploys a broken frontend where all public API calls fail (wrong key). If `.api-key` is missing, create it:

```bash
echo "<key>" > src/environments/.api-key
```

The key can be found in the admin UI at `/verwaltung/api-keys`.

**Never deploy a development build.** Using `ng build --configuration development` produces a broken blank page in production. Always use `ng build` (production is the default).

**Pre-commit hook caveat:** The Husky hook runs `git-format-staged` (requires Python) and `ng lint`. Both need nvm and local node_modules in PATH. If the hook fails with `ng: not found`, commit with:

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && export PATH="$PATH:$(pwd)/node_modules/.bin" && git commit -m "..."
```

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

The API runs at **http://localhost:3001** (port 3000 is taken by another service). The frontend's `environment.ts` points to `http://localhost:3001/api/v2/`.

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

- `_modules/_admin/` – Protected admin views: `_league_admin`, `_schedule_admin`, `_license_admin`, `_player_admin`, `_club_admin`, `_team_admin`, `_referee_admin`, `_referee_vm`, `_assignment_admin`, `_transfer_request_admin`, `_state_association_admin`, `_api_key_admin`
- `_modules/_referee/` – Referee self-service portal (`/schiedsrichter/profil`, `/schiedsrichter/sperrtermine`)
- `_modules/_public/` – Public-facing views (schedule, scores, login)
- `_modules/_core/_services/` – Shared services (session, API calls)
- `_modules/_uikit/` – Shared UI components
- `_helpers/_interceptors/` – HTTP interceptors: `ApiKeyInterceptor` (adds `X-Api-Key` header) and `ErrorInterceptor` (handles 401/403/404)
- `_helpers/_pipes/` – Domain-specific pipes (sorting, filtering, license display, game timeline) re-exported by `UikitCommonModule`
- `_models/` – TypeScript types

**Adding a new admin module** follows a fixed pattern (use `_state_association_admin` as reference):

1. Create `_modules/_admin/_foo_admin/` with `admin-foo.module.ts`, `admin-foo-routing.module.ts`, `index.ts`, and `views/`
2. Add service to `_modules/_core/_services/` and export from its `index.ts`
3. Add interface to `_models/` and export from its `index.ts`
4. Add path alias to `tsconfig.json`: `"@floorball/admin/foo": ["src/app/_modules/_admin/_foo_admin"]`
5. Add lazy-loaded route to `app-routing.module.ts`
6. Add menu item to `metanavigation.component.html` gated by `showItem('menu_item_foo_admin')`
7. Add `menu_item_foo_admin` to `User#permissions_items` in the API (`app/models/user.rb`)

**UIKit components** (`UikitCommonModule` re-exports everything; import the module, not individual components):

- `<fb-button>` – `variant`: `'default' | 'success' | 'warning' | 'error'` (no `primary`); `icon`: `'add' | 'remove' | 'edit' | 'save' | 'cancel' | 'expand'`; `size`: `'default' | 'small' | 'large'`
- `<fb-confirmation-dialog>` / `<fb-confirmation>` – modal confirmation pattern
- `<fb-notification>` / `<fb-sidebar>` / `<fb-header>` – layout shell components
- `<fb-pagination>` / `<fb-match-day>` / `<fb-operation>` – listing utilities

**TypeScript path aliases** (defined in `tsconfig.json`):

- `@floorball/models` and `@floorball/types` → both map to `_models`; services use `@floorball/types`
- `@floorball/core` → `_modules/_core`
- `@floorball/uikit/common`, `/icons`, `/matches`, `/player`, `/team`, `/skeletons` → specific uikit sub-modules (no wildcard)
- `@floorball/admin/<name>` and `@floorball/public/<name>` → specific paths per module, each declared in `tsconfig.json`
- `@floorball/referee` → `_modules/_referee`

**Newer admin modules:**

- `_referee_vm` – Vereinsmanager view of their club's referees (`/verwaltung/schiedsrichter-verein`)
- `_assignment_admin` – SBK assigns referees to games (`/verwaltung/schiedsrichter-ansetzungen`)
- `_transfer_request_admin` – Player transfer request workflow (`/verwaltung/transfer-anfragen`). Status machine: `pending_club` → `pending_lv` → `approved` / `rejected_by_club` / `rejected_by_lv` / `scheduled`. VM initiates or approves; LV (Landesverband) gives final approval.

**Auth flow:** `SessionService` handles login/logout. On login, the user object (including permissions hash) is stored in `localStorage`. An `ErrorInterceptor` auto-logs out on 401 and redirects on 403. After backend permission changes, users must log out and back in to pick up new `permissions` from localStorage.

**Permission gating in templates:** Components subscribe to `SessionService.currentUser$` and expose a `showItem(key: string)` helper that reads from `user.permissions` (a flat boolean map returned by the API). Example: `*ngIf="showItem('menu_item_league_admin')"`.

**API key auth:** Public API endpoints require an `X-Api-Key` header. The `ApiKeyInterceptor` automatically adds `environment.frontendApiKey` to all requests to `environment.apiURL`. After creating a new "Frontend" key in the admin UI (`/verwaltung/api-keys`), set it in `src/environments/environment.prod.ts` and redeploy. Cookie-authenticated requests bypass the key check entirely.

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

**`season_id` is a sequential integer ID, not the year.** The year/name lives in `Setting.current.seasons` (keyed by season_id), e.g. season_id `15` = `2023/2024`, `17` = `2025/2026`, `18` = `2026/2027`. Use `Setting.current_season_id` for the active season; don't infer a year from the id.

**Route structure:** Two API versions coexist. Public endpoints under `/api/v2/leagues/:id/schedule` etc. require `X-Api-Key` or cookie session. Admin endpoints under `/api/v2/admin/...` require cookie session + role check. The `api_controller.rb` handles the older v1 ticker API (also key-protected). `version_controller.rb` and `sessions_controller.rb` (login/logout) are fully open.

**Public endpoint protection pattern:**

```ruby
skip_before_action :authenticate_user, only: %i[show index]
before_action :authenticate_public_request, only: %i[show index]
```

`authenticate_public_request` is defined in `ApplicationController` — passes if cookie session exists, else checks `X-Api-Key` header against `ApiKey` table.

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

Every fix or feature must go through a PR — no direct pushes to `main`. **Never merge or deploy without explicit user instruction.**

1. Branch from `main`: `git checkout -b fix/description` or `feat/description`
2. Add `## [Unreleased]` entry to `CHANGELOG.md`
3. Open PR with `gh pr create`
4. **Stop here.** Do NOT merge to `main` or deploy unless the user explicitly asks.
5. On merge (when instructed): bump version in `version.rb`, move Unreleased → versioned block in CHANGELOG
