# Angular-Upgrade-Plan: 19 → 22 (inkl. TypeScript 6, eslint, Tailwind v4)

> Stand: 2026-06-07. Ausgangslage: Angular **19.2.x**, TypeScript **5.8.3**,
> `@angular-eslint` **18.3.1**, eslint **8.57**, Tailwind **3**.
>
> Dieser Plan bündelt die vier Dependabot-PRs, die **nicht** per Lockfile-Fix
> lösbar sind, weil sie echte Breaking-Majors sind:
>
> | PR   | Bump                                               | gehört in Schritt                                                   |
> | ---- | -------------------------------------------------- | ------------------------------------------------------------------- |
> | #574 | TypeScript 5.8 → 6.0                               | **Angular 22** (`build-angular@22` verlangt TS `>=6.0 <6.1`)        |
> | #570 | eslint-Gruppe (`@angular-eslint` → 21, eslint → 9) | **Angular 21** (+ Flat-Config-Migration)                            |
> | #572 | Tailwind 3 → 4                                     | **Angular 20** (v4 ist im Angular-Builder erst ab 20.1 first-class) |
> | #569 | Angular-Gruppe → 22                                | **letzter Schritt**                                                 |
>
> **Diese PRs einzeln zu mergen ist nicht möglich** — sie sind über Peer-Deps
> verzahnt (z. B. `build-angular@22` ⇄ TS 6; `@angular-eslint@21` ⇄ Angular 21).

## Grundprinzip

Angular wird **eine Major-Version pro Schritt** aktualisiert (`ng update` migriert
nur n→n+1). Kein Sprung 19→22. Jeder Schritt = eigener Branch + eigene PR +
CHANGELOG-Eintrag + grüne CI, bevor der nächste beginnt.

Pro Schritt:

```bash
git checkout main && git pull
git checkout -b chore/angular-<N>
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"   # node v20.20.2 / npm 10.8.2 = CI-Version
ng update @angular/core@<N> @angular/cli@<N>          # führt Migrations-Schematics aus
ng update @angular-eslint/schematics@<N>              # eslint-Toolchain mitziehen
# Build + Lint + Test lokal grün machen, committen, PR öffnen
```

> **Verifikations-Lücke:** Lokal ist **kein Chrome** vorhanden → `ng test` läuft
> nur in der CI. Für Tailwind v4 (Schritt 2) gibt es **keinen** automatisierten
> Test, der visuelle Regressionen fängt → dort ist **manuelles visuelles QA
> zwingend** vor dem Merge (siehe Schritt 2).

---

## Schritt 1 — Angular 19 → 20

- `ng update @angular/core@20 @angular/cli@20`
- `ng update @angular-eslint/schematics@20` (von 18 → 20; bringt eslint-Config auf
  den Angular-20-Stand).
- TypeScript: Angular 20 verlangt TS ~5.8/5.9 → ggf. `typescript` auf `~5.9` heben
  (noch **nicht** auf 6 — das ist Schritt 4).
- Erwartete Migrationen: standalone-by-default, `provideHttpClient`-Anpassungen,
  evtl. Control-Flow-Migration (`*ngIf` → `@if`) optional.
- **Akzeptanz:** CI grün (Lint + Test + Build).

## Schritt 2 — Tailwind 3 → 4 (#572)

> Bewusst **direkt nach Angular 20**, weil der Angular-Builder Tailwind v4 erst
> ab 20.1 nativ unterstützt. Auf Angular 19 ließ sich v4 nur über einen
> **nicht unterstützten Sass-Pfad** (`@use "tailwindcss"`) bauen — 154
> „Empty sub-selector"-Warnungen, da Sass v4s natives Nesting/`@layer` zerlegt.

Migrationsschritte:

1. `@tailwindcss/postcss` ergänzen (fehlt in #572!), `.postcssrc.json` mit
   `{ "plugins": { "@tailwindcss/postcss": {} } }` anlegen.
2. Offizielles Codemod nutzen: `npx @tailwindcss/upgrade` (sauberer Git-Tree, Node 20).
   Es migriert: Imports, JS-Config → CSS-`@theme` bzw. `@config`, und benennt
   umbenannte Utilities in **allen ~136 Templates** um
   (`shadow-sm`→`shadow-xs`, `outline-none`→`outline-hidden`, …).
3. `src/styles.scss`: die drei `@import "tailwindcss/base|components|utilities"`
   ersetzen; `@apply`-Blöcke ggf. mit `@reference "tailwindcss";` versehen
   (v4 braucht Theme-Kontext für `@apply` in separaten Dateien).
4. Custom-Theme prüfen: `prefix: ""`, `darkMode: class`, `fb-gray-*`/`primary`,
   `4.5xl`, `font-helvetica`, `variants.extend` (group-hover) → in v4-Syntax
   übertragen. `purge`/`mode`/`variants` entfallen ersatzlos.

> **Breaking-Verhalten in v4 (visuell, von keinem Test gefangen):**
> Default-Border-Farbe `gray-200` → `currentColor`; Ring-Breite/-Farbe;
> `space-*`-/Placeholder-Selektoren; Shadow-Skala. **→ Manuelles Durchklicken
> der Hauptviews (Spielplan, Tabellen, Admin-Formulare, Buttons) Pflicht.**

- **Akzeptanz:** CI grün **UND** visuelles QA durch Mensch abgenommen.

## Schritt 3 — Angular 20 → 21 (+ eslint-Gruppe #570)

- `ng update @angular/core@21 @angular/cli@21`
- `ng update @angular-eslint/schematics@21` → `@angular-eslint` 21
  (Peer: `@angular/cli >=21 <22` — passt jetzt).
- **eslint 8 → 9**: Flat-Config-Migration (`.eslintrc.json` → `eslint.config.js`).
  `@typescript-eslint` 7 → passende v8-Linie. Das ist der inhaltliche Kern von #570.
- TypeScript: Angular 21 verlangt ~5.9 → auf `~5.9` halten.
- **Akzeptanz:** `ng lint` (neue Flat-Config) + Test + Build grün.

## Schritt 4 — Angular 21 → 22 (+ TypeScript 6, #574 + #569)

- `ng update @angular/core@22 @angular/cli@22`
- `ng update @angular-eslint/schematics@22`
- **TypeScript 5.9 → 6.0** (`build-angular@22` verlangt TS `>=6.0 <6.1`).
  TS-6-Breaking-Changes prüfen (verschärfte Checks, entfernte Deprecations).
- **Akzeptanz:** CI grün.

---

## Aufräumen / Nebenbefunde

- `@schematics/angular` ist in `devDependencies` auf `^13.1.2` gepinnt — stark
  veraltet und vermutlich ungenutzt. Im Zuge des Upgrades prüfen und entweder auf
  die Angular-Major-Linie heben oder entfernen.
- `postcss-import`/`postcss-preset-env`/`postcss-url` (in #572 mit-gebumpt) werden
  ohne PostCSS-Config aktuell nicht genutzt → mit der Tailwind-v4-Umstellung
  konsolidieren.
- Nach jedem Major: `CHANGELOG.md` (im API-Repo) unter `## [Unreleased]` ergänzen
  und `version.rb` beim Merge bumpen (MINOR, da kein API-Breaking).

## Reihenfolge & Risiko (Kurzfassung)

```
19 → 20  (Schritt 1)        Risiko: mittel  (Builder/Standalone-Migrationen)
   → Tailwind v4 (Schritt 2) Risiko: HOCH    (visuelle Regressionen, manuelles QA)
20 → 21  (Schritt 3)        Risiko: mittel  (eslint-9-Flat-Config)
21 → 22  (Schritt 4)        Risiko: mittel  (TypeScript 6)
```

Bis dahin: die vier PRs (#569, #570, #572, #574) bleiben blockiert; Dependabot
wird sie immer wieder neu öffnen. Optional als „blocked/major" labeln oder mit
Verweis auf diesen Plan schließen.
