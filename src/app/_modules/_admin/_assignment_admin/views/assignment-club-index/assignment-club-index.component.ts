import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TranslocoService } from '@jsverse/transloco';
import {
  NotificationService,
  RefereeService,
  SeasonInfo,
  SettingsService,
} from '@floorball/core';
import { AssignmentClub, RefereeAssignableGame } from '@floorball/types';

// Zeilenzustand im reduzierten Modus (Weg 3, #403): je Spiel entweder ein Verein,
// der das Gespann stellt, oder ein Freitext für Personen und Paare.
interface ClubRowState {
  clubId: number | null;
  freeText: string;
  saving: boolean;
}

@Component({
  selector: 'fb-assignment-club-index',
  templateUrl: './assignment-club-index.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AssignmentClubIndexComponent implements OnInit {
  games: RefereeAssignableGame[] = [];
  seasons: SeasonInfo[] = [];
  loading = true;

  seasonId = '';
  dateFrom = '';
  dateTo = '';

  rowStates: Record<number, ClubRowState> = {};
  // Vereine je Liga, erst beim Aufklappen einer Zeile geladen: die Auswahl sind
  // die Vereine der Mannschaften dieser Liga, das ist pro Liga verschieden.
  clubsByLeague: Record<number, AssignmentClub[]> = {};
  private _clubsLoading = new Set<number>();

  constructor(
    private _refereeService: RefereeService,
    private _settingsService: SettingsService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._settingsService.getSeasons().subscribe({
      next: (data) => {
        this.seasons = data.seasons;
        this.seasonId = data.current_season_id.toString();
        this._cdr.markForCheck();
        this.load();
      },
      error: () => this.load(),
    });
  }

  load(): void {
    this.loading = true;
    this._cdr.markForCheck();

    const params: Record<string, string> = {};
    if (this.seasonId) params['season_id'] = this.seasonId;
    if (this.dateFrom) params['date_from'] = this.dateFrom;
    if (this.dateTo) params['date_to'] = this.dateTo;

    this._refereeService.adminGetAssignableGames(params).subscribe({
      next: (games) => {
        this.games = games;
        this.rowStates = {};
        games.forEach((game) => {
          this.rowStates[game.id] = {
            clubId: game.assignment_club_id ?? null,
            // Steht ein Verein, gehört der Text ihm – dann bleibt das
            // Freitextfeld leer, sonst stünde der Vereinsname doppelt.
            freeText: game.assignment_club_id
              ? ''
              : (game.nominated_referee_string ?? ''),
            saving: false,
          };
          this._loadClubs(game.league_id);
        });
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this._cdr.markForCheck();
      },
    });
  }

  clubsFor(game: RefereeAssignableGame): AssignmentClub[] {
    return game.league_id ? (this.clubsByLeague[game.league_id] ?? []) : [];
  }

  // Verein und Freitext schließen einander aus: der Server speichert entweder
  // die Verknüpfung oder den Text. Die Maske spiegelt das, damit nicht beides
  // ausgefüllt aussieht und beim Speichern eines davon still verschwindet.
  onClubChange(game: RefereeAssignableGame): void {
    const state = this.rowStates[game.id];
    if (state?.clubId) state.freeText = '';
  }

  onFreeTextChange(game: RefereeAssignableGame): void {
    const state = this.rowStates[game.id];
    if (state?.freeText) state.clubId = null;
  }

  save(game: RefereeAssignableGame): void {
    const state = this.rowStates[game.id];
    if (!state || state.saving) return;

    state.saving = true;
    this._cdr.markForCheck();

    const payload = state.clubId
      ? { club_id: state.clubId }
      : { nominated_referee_string: state.freeText };

    this._refereeService.adminUpdateClubAssignment(game.id, payload).subscribe({
      next: (result) => {
        game.nominated_referee_string = result.nominated_referee_string;
        game.assignment_club_id = result.assignment_club_id ?? null;
        game.assignment_id = result.assignment_id ?? null;
        state.saving = false;
        this._notificationService.success(
          this._transloco.translate('assignmentAdmin.club.saved'),
          { autoClose: true, keepAfterRouteChange: false }
        );
        this._cdr.markForCheck();
      },
      error: () => {
        state.saving = false;
        this._cdr.markForCheck();
      },
    });
  }

  private _loadClubs(leagueId: number | null | undefined): void {
    if (!leagueId) return;
    if (this.clubsByLeague[leagueId] || this._clubsLoading.has(leagueId))
      return;

    this._clubsLoading.add(leagueId);
    this._refereeService
      .adminGetLeagueAssignmentClubs(leagueId)
      .pipe(catchError(() => of([] as AssignmentClub[])))
      .subscribe({
        next: (clubs) => {
          this.clubsByLeague[leagueId] = clubs;
          this._clubsLoading.delete(leagueId);
          this._cdr.markForCheck();
        },
      });
  }
}
