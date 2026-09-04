import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  GameService,
  SecretaryLicenseList,
  SecretaryPayload,
} from '@floorball/core';
import { SecretaryTokenGameDay } from '@floorball/types';

// Die Antwort wird im GameService begradigt: game_days ist dort immer gefüllt
// (auch bei einer älteren API, die nur game_day kennt) und jedes Spiel trägt
// seinen Spieltag. Diese Ansicht muss den Altfall deshalb nicht mehr kennen.
type SecretaryGameDay = SecretaryPayload;

/** Die Lizenzlisten einer Liga, in der Reihenfolge der Spieltage des Links. */
interface LicenseGroup {
  leagueId: number | null;
  leagueName: string | null;
  entries: SecretaryLicenseList[];
}

@Component({
  templateUrl: './spielsekretariat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SpielSekretariatComponent implements OnInit {
  data?: SecretaryGameDay;
  // Einmal nach dem Laden gebaut statt bei jedem Prüflauf: Die Ansicht steht
  // am Spieltisch stundenlang offen, und neue Objekte je Aufruf würden die
  // Tabellen bei jedem Prüflauf neu zeichnen.
  licenseGroups: LicenseGroup[] = [];
  error?: string;
  loading = true;
  token = '';
  activeTab: 'games' | 'licenses' = 'games';
  readonly today = new Date().toISOString().slice(0, 10);

  constructor(
    private _route: ActivatedRoute,
    private _gameService: GameService,
    private _cdr: ChangeDetectorRef,
    private _title: Title
  ) {
    this._title.setTitle('Spielsekretariat | Floorball Saisonmanager');
  }

  ngOnInit(): void {
    this.token = this._route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.error = 'Kein Token angegeben.';
      this.loading = false;
      this._cdr.markForCheck();
      return;
    }

    this._gameService.getSecretaryGameDay(this.token).subscribe({
      next: (data) => {
        this.data = data;
        this.licenseGroups = this._buildLicenseGroups(data);
        this.loading = false;
        this._cdr.markForCheck();
      },
      // err.message stammt aus normalizeSecretaryPayload und meldet eine
      // unbrauchbare Antwort. Diesen Fall nicht als abgelaufenen Link ausgeben:
      // Das Sekretariat ließe sich sonst einen neuen Link geben, der genauso
      // scheitert.
      error: (err) => {
        this.error =
          err?.error?.message ??
          (err instanceof Error ? err.message : null) ??
          'Der Link ist ungültig oder abgelaufen.';
        this.loading = false;
        this._cdr.markForCheck();
      },
    });
  }

  gameDays(): SecretaryTokenGameDay[] {
    return this.data?.game_days ?? [];
  }

  /** Mehrere Ligen im selben Link: dann gehört die Liga an jedes Spiel. */
  get multipleLeagues(): boolean {
    return this.gameDays().length > 1;
  }

  headerTitle(): string {
    return this.gameDays()
      .map((gd) => gd.league)
      .filter((name) => !!name)
      .join(' · ');
  }

  /** Halle des Links. Alle abgedeckten Spieltage teilen sie sich. */
  arena(): string | null {
    return this.gameDays()[0]?.arena ?? null;
  }

  date(): string | null {
    return this.gameDays()[0]?.date ?? null;
  }

  // Spielseite: /:association/:leagueId/spiel/:matchId. Verbands-Slug und
  // league_id liefert der Spieltags-Payload; fehlt eines von beiden, gibt es
  // keinen sinnvollen Pfad, und der Eintrag bleibt bewusst unverlinkt. Ein
  // Teilpfad würde auf der Verbandsroute stumm als leere Seite landen, weil
  // :association/:leagueId zwei beliebige Segmente schluckt.
  //
  // Der Link kann mehrere Ligen abdecken, deshalb wird der Spieltag des Spiels
  // gesucht statt pauschal der erste genommen – sonst landete ein Spiel der
  // zweiten Liga unter der leagueId der ersten.
  matchReportUrl(game: { id: number; game_day_id: number }): string | null {
    const day = this.gameDays().find((gd) => gd.id === game.game_day_id);
    if (!day?.game_operation_slug || !day.league_id) {
      return null;
    }

    return `/${day.game_operation_slug}/${day.league_id}/spiel/${
      game.id
    }?secretary_token=${encodeURIComponent(this.token)}`;
  }

  /** Mehrere Ligen in den Lizenzlisten: dann bekommt jede Gruppe ihre Überschrift. */
  get multipleLicenseLeagues(): boolean {
    return this.licenseGroups.length > 1;
  }

  /**
   * Lizenzlisten nach Liga gebündelt. Ein Link deckt alle Ligen einer Halle an
   * einem Tag ab; ohne die Gliederung stehen alle Mannschaften des Tages
   * hintereinander weg, quer über die Altersklassen.
   *
   * Die Reihenfolge der Gruppen stammt aus den Spieltagen des Links, die die
   * API nach Datum und Liganame sortiert. Auf die Reihenfolge der Schlüssel in
   * `license_lists` ist bewusst kein Verlass: Das ist ein Objekt mit den
   * Mannschafts-ids als Schlüssel, und JavaScript zieht zahlenartige Schlüssel
   * unabhängig von der Einfügereihenfolge nach vorn.
   *
   * Eine ältere API kennt league_id noch nicht. Dann landet alles in einer
   * namenlosen Gruppe, und die Ansicht sieht aus wie vorher.
   */
  private _buildLicenseGroups(data: SecretaryGameDay): LicenseGroup[] {
    const groups = new Map<number | null, LicenseGroup>();

    for (const day of data.game_days) {
      if (day.league_id != null && !groups.has(day.league_id)) {
        groups.set(day.league_id, {
          leagueId: day.league_id,
          leagueName: day.league ?? null,
          entries: [],
        });
      }
    }

    for (const entry of Object.values(data.license_lists ?? {})) {
      const key = entry.league_id ?? null;
      let group = groups.get(key);
      if (!group) {
        group = {
          leagueId: key,
          leagueName: entry.league_name ?? null,
          entries: [],
        };
        groups.set(key, group);
      }
      group.entries.push(entry);
    }

    return [...groups.values()]
      .filter((group) => group.entries.length > 0)
      .map((group) => ({
        ...group,
        entries: [...group.entries].sort((a, b) =>
          a.team_name.localeCompare(b.team_name, 'de')
        ),
      }));
  }

  statusClass(status: string): string {
    if (status === 'Genehmigt') return 'text-green-700';
    if (status === 'Beantragt') return 'text-yellow-700';
    return 'text-fb-gray-400';
  }

  expiresAt(): Date | null {
    if (!this.data?.expires_at) return null;
    return new Date(this.data.expires_at);
  }
}
