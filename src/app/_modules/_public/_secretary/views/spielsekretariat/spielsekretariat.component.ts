import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { GameService, SecretaryPayload } from '@floorball/core';
import { SecretaryTokenGameDay } from '@floorball/types';

// Die Antwort wird im GameService begradigt: game_days ist dort immer gefüllt
// (auch bei einer älteren API, die nur game_day kennt) und jedes Spiel trägt
// seinen Spieltag. Diese Ansicht muss den Altfall deshalb nicht mehr kennen.
type SecretaryGameDay = SecretaryPayload;

@Component({
  templateUrl: './spielsekretariat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SpielSekretariatComponent implements OnInit {
  data?: SecretaryGameDay;
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
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: (err) => {
        this.error =
          err?.error?.message ?? 'Der Link ist ungültig oder abgelaufen.';
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

  licenseEntries(): {
    team_name: string;
    players: SecretaryGameDay['license_lists'][string]['players'];
  }[] {
    if (!this.data?.license_lists) return [];
    return Object.values(this.data.license_lists);
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
