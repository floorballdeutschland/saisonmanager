# Saisonmanager – Frontend

Angular 22 frontend for the Floorball Saisonmanager — a league management system for Floorball Deutschland covering schedules, player licensing, referee management, and club administration.

## Related Repositories

| Repo                                                                                         | Description                                |
| -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [saisonmanager](https://github.com/floorballverband-deutschland/saisonmanager)               | This repo – Angular frontend               |
| [saisonmanager-api](https://github.com/floorballverband-deutschland/saisonmanager-api)       | Rails 7 API backend                        |
| [saisonmanager-docker](https://github.com/floorballverband-deutschland/saisonmanager-docker) | Docker Compose setup for local development |

## Tech Stack

- **Angular 22** with standalone-compatible lazy-loaded feature modules
- **TypeScript 6** with strict path aliases
- **Tailwind CSS v4** for styling
- **Karma/Jasmine** for unit tests
- **ESLint 9** (flat config) + **Husky + Prettier** for linting (pre-commit and CI)

## Quick Start

### Prerequisites

- Node.js 24 (pinned in `.nvmrc`, managed via [nvm](https://github.com/nvm-sh/nvm))
- The API running locally (see [saisonmanager-docker](https://github.com/floorballverband-deutschland/saisonmanager-docker))

### Setup

```bash
nvm use          # switch to the correct Node version
npm install
npm start        # → http://localhost:4200
```

The app points to `http://localhost:3001/api/v2/` by default in dev mode.

### Demo Credentials

| Username     | Password      | Role                              |
| ------------ | ------------- | --------------------------------- |
| `admin`      | `password123` | Admin – full access               |
| `sbk_ost`    | `password123` | SBK Ost – game operations         |
| `sbk_west`   | `password123` | SBK West                          |
| `vm_berlin`  | `password123` | Vereinsmanager – Floorball Berlin |
| `tm_berlin1` | `password123` | Teammanager – Berlin Team 1       |

## Commands

| Command               | Description                                      |
| --------------------- | ------------------------------------------------ |
| `npm start`           | Dev server at `http://localhost:4200`            |
| `npm run start-local` | Dev server bound to `0.0.0.0` (network access)   |
| `npm run build`       | Production build → `dist/saisonmanager/browser/` |
| `ng test`             | Karma unit tests (watch mode)                    |
| `ng lint`             | ESLint                                           |
| `npm run lint`        | Prettier on staged files                         |
| `./build-deploy.sh`   | Build + deploy to production server              |

Run a single spec file with `ng test --no-watch --include='**/foo.component.spec.ts'`.

> **Note:** `ng` requires nvm to be in PATH. If `ng: command not found`, run:
>
> ```bash
> export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
> ```

> **Never deploy a development build.** `ng build --configuration development` produces a blank page in production. Always use `npm run build` (defaults to production).

## Project Structure

```
src/app/
├── _helpers/
│   └── _interceptors/          # HTTP interceptors
│       ├── api-key.interceptor.ts   # adds X-Api-Key header
│       └── error.interceptor.ts     # handles 401/403/404
├── _models/                    # TypeScript interfaces
├── _modules/
│   ├── _admin/                 # Protected admin views, one module per area
│   │   ├── _league_admin/      # (~20 modules: leagues, schedules, licenses,
│   │   ├── _player_admin/      #  players, clubs, teams, referees, assignments,
│   │   └── ...                 #  transfer requests, settings, …)
│   ├── _core/
│   │   └── _services/          # Shared services (session, API)
│   ├── _public/                # Public-facing views
│   ├── _referee/               # Referee self-service portal
│   └── _uikit/                 # Shared UI components
└── environments/
    ├── environment.ts           # Development config
    └── environment.prod.ts      # Production config
```

### TypeScript Path Aliases

Defined in `tsconfig.json`:

| Alias                                    | Maps to                        |
| ---------------------------------------- | ------------------------------ |
| `@floorball/models` / `@floorball/types` | `src/app/_models/`             |
| `@floorball/core`                        | `src/app/_modules/_core/`      |
| `@floorball/uikit/*`                     | `src/app/_modules/_uikit/_*/`  |
| `@floorball/admin/*`                     | `src/app/_modules/_admin/_*/`  |
| `@floorball/public/*`                    | `src/app/_modules/_public/_*/` |
| `@floorball/referee`                     | `src/app/_modules/_referee/`   |

## Authentication & Permissions

`SessionService` handles login/logout. On login, the user object (including a flat permissions map) is stored in `localStorage`.

Permission keys are booleans like `menu_item_league_admin`, `update_player`, etc. — set server-side in `User#permissions_items`. Gate UI elements with:

```html
<div *ngIf="showItem('menu_item_league_admin')">...</div>
```

> **After backend permission changes**, users must log out and back in to pick up updated permissions from localStorage.

**API key auth:** Public endpoints require an `X-Api-Key` header. The `ApiKeyInterceptor` automatically adds `environment.frontendApiKey` to all outgoing requests. After rotating the key in the admin UI, update `environment.prod.ts` and redeploy.

## Adding a New Admin Module

Use `_state_association_admin` as a reference implementation.

1. Create `src/app/_modules/_admin/_foo_admin/` with `admin-foo.module.ts`, `admin-foo-routing.module.ts`, `index.ts`, and `views/`
2. Add a service to `src/app/_modules/_core/_services/` and export from its `index.ts`
3. Add an interface to `src/app/_models/` and export from its `index.ts`
4. Add a path alias to `tsconfig.json`: `"@floorball/admin/foo": ["src/app/_modules/_admin/_foo_admin"]`
5. Add a lazy-loaded route to `app-routing.module.ts`
6. Add a menu item to `metanavigation.component.html` gated by `showItem('menu_item_foo_admin')`
7. Add `menu_item_foo_admin` to `User#permissions_items` in the API (`app/models/user.rb`)

## Deployment

```bash
./build-deploy.sh   # production build + scp to saisonmanager.org
```

Requires nvm in PATH and SSH access to the production server (`ssh saisonmanager`).

## Contributing

- Branch from `main`: `git checkout -b fix/description` or `feat/description`
- Open a PR — no direct pushes to `main`
- CI (GitHub Actions) gates every PR: `ng lint`, headless Karma tests, and a production build
- The pre-commit hook runs Prettier on staged files and `ng lint` (requires nvm in PATH; see the nvm export workaround above if it fails)
