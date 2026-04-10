# Öffentliche API-Endpunkte – Saisonmanager

**Base URL:** `https://saisonmanager.de`
(nginx leitet `/api/v2/` an den Rails-Backend weiter; Frontend und API teilen sich die Domain)

## Initialisierung

| Methode | Pfad           | Beschreibung                                           |
| ------- | -------------- | ------------------------------------------------------ |
| `GET`   | `/api/v2/init` | Saisons, aktuelle Saison, Sportverbände (Cache 30 Min) |

## Authentifizierung

| Methode | Pfad                     | Beschreibung                    |
| ------- | ------------------------ | ------------------------------- |
| `POST`  | `/api/v2/login`          | Login mit Benutzername/Passwort |
| `POST`  | `/api/v2/logout`         | Logout, löscht Session-Cookie   |
| `POST`  | `/api/v2/lost_password`  | Passwort-Reset anfordern        |
| `POST`  | `/api/v2/reset_password` | Passwort mit Reset-Token setzen |

## Ligen

| Methode | Pfad                                                      | Beschreibung                         |
| ------- | --------------------------------------------------------- | ------------------------------------ |
| `GET`   | `/api/v2/leagues`                                         | Alle Ligen (Cache 5 Min)             |
| `GET`   | `/api/v2/leagues/:id`                                     | Liga-Details                         |
| `GET`   | `/api/v2/leagues/:id/schedule`                            | Spielplan einer Liga                 |
| `GET`   | `/api/v2/leagues/:id/table`                               | Tabelle                              |
| `GET`   | `/api/v2/leagues/:id/grouped_table`                       | Gruppierte Tabelle                   |
| `GET`   | `/api/v2/leagues/:id/scorer`                              | Torschützenliste                     |
| `GET`   | `/api/v2/leagues/:id/meta`                                | Metadaten                            |
| `GET`   | `/api/v2/leagues/:id/license_list`                        | Lizenzliste                          |
| `GET`   | `/api/v2/leagues/:id/game_days/current/schedule`          | Spielplan des aktuellen Spieltags    |
| `GET`   | `/api/v2/leagues/:id/game_days/:game_day_number/schedule` | Spielplan eines bestimmten Spieltags |

## Spiele

| Methode | Pfad                                                   | Beschreibung                  |
| ------- | ------------------------------------------------------ | ----------------------------- |
| `GET`   | `/api/v2/games`                                        | Alle Spiele                   |
| `GET`   | `/api/v2/games/:id`                                    | Spiel-Details (auch als iCal) |
| `GET`   | `/api/v1/ticker/games/:id`                             | Ticker-Format für Live-Daten  |
| `GET`   | `/api/v1/upcoming_games`                               | Kommende Spiele für Benutzer  |
| `GET`   | `/api/v1/ticker/:game_operation_id/:season_id/leagues` | Ligen für Ticker              |

## Spieltage

| Methode | Pfad                    | Beschreibung     |
| ------- | ----------------------- | ---------------- |
| `GET`   | `/api/v2/game_days`     | Alle Spieltage   |
| `GET`   | `/api/v2/game_days/:id` | Spieltag-Details |

## Teams

| Methode | Pfad                | Beschreibung                          |
| ------- | ------------------- | ------------------------------------- |
| `GET`   | `/api/v2/teams/:id` | Team-Details (auch als iCal-Kalender) |

## Vereine

| Methode | Pfad     | Beschreibung |
| ------- | -------- | ------------ |
| `GET`   | `/clubs` | Alle Vereine |

## Spieler

| Methode | Pfad                       | Beschreibung          |
| ------- | -------------------------- | --------------------- |
| `GET`   | `/players`                 | Alle Spieler          |
| `GET`   | `/players/:id`             | Spieler-Details       |
| `GET`   | `/api/v2/transfers/public` | Öffentliche Transfers |

## Sportverbände

| Methode | Pfad                                      | Beschreibung                              |
| ------- | ----------------------------------------- | ----------------------------------------- |
| `GET`   | `/game_operations`                        | Alle Verbände                             |
| `GET`   | `/game_operations/:id/leagues`            | Ligen eines Verbands (aktuelle Saison)    |
| `GET`   | `/game_operations/:id/leagues/:season_id` | Ligen eines Verbands für bestimmte Saison |
| `GET`   | `/game_operations/by_shortname/:name`     | Verband nach Kurzname                     |

## Schiedsrichter

| Methode | Pfad                         | Beschreibung                      |
| ------- | ---------------------------- | --------------------------------- |
| `GET`   | `/api/v2/referees/:id/games` | Alle Spiele eines Schiedsrichters |
| `GET`   | `/api/v2/user/referees/:id`  | Schiedsrichter-Details            |

## Sonstiges

| Methode | Pfad                    | Beschreibung              |
| ------- | ----------------------- | ------------------------- |
| `GET`   | `/arenas`               | Alle Arenen               |
| `GET`   | `/license_fees`         | Lizenzgebühren            |
| `GET`   | `/calendar/leagues/:id` | iCal-Kalender einer Liga  |
| `GET`   | `/calendar/teams/:id`   | iCal-Kalender eines Teams |

---

> **Hinweis:** Viele Pfade existieren doppelt als Legacy-Routen ohne `/api/v2/`-Präfix (z.B. `/leagues`, `/games`, `/game_day`).
> Unter `/api/v2/user/...` gibt es weitere Endpunkte für authentifizierte Nicht-Admin-Nutzer (Spielverwaltung, Lizenzverwaltung, Aufstellungen) – diese erfordern einen gültigen Login.
