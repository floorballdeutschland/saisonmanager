import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { GameService } from '@floorball/core';

interface SecretaryGameDay {
  game_day: {
    id: number;
    date: string;
    league: string;
    arena?: string;
    game_operation_slug?: string;
  };
  games: {
    id: number;
    game_number?: string;
    start_time?: string;
    home_team?: string;
    guest_team?: string;
    game_status?: string;
  }[];
  license_lists: Record<
    string,
    {
      team_name: string;
      players: {
        name: string;
        birthdate?: string;
        license_status: string;
        approved_at?: string;
        valid_until?: string;
      }[];
    }
  >;
  expires_at: string;
  created_by?: string;
}

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

  matchReportUrl(gameId: number): string {
    const slug = this.data?.game_day.game_operation_slug;
    return slug
      ? `/${slug}/spielbericht/${gameId}?secretary_token=${encodeURIComponent(
          this.token
        )}`
      : `/spielbericht/${gameId}?secretary_token=${encodeURIComponent(
          this.token
        )}`;
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
