import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { RefereeService } from '@floorball/core';
import { RefereeAdminGame, RefereeVm } from '@floorball/types';

/**
 * Lesende Detailansicht eines Vereinsschiris für den Vereinsmanager. Bewusst
 * getrennt von der Admin-Detailansicht: Die API liefert dem Verein hier nur
 * die Felder der Vereinsliste und die Einsatzhistorie (vm/referees/:id).
 */
@Component({
  templateUrl: './referee-vm-detail.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeVmDetailComponent implements OnInit, OnDestroy {
  referee?: RefereeVm;
  games: RefereeAdminGame[] = [];
  loading = false;
  notFound = false;
  gamesLoading = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = parseInt(this._route.snapshot.params['id'], 10);
    this.loading = true;
    this._refereeService
      .vmGetReferee(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (referee) => {
          this.referee = referee;
          this.loading = false;
          this._cdr.markForCheck();
          this._loadGames(referee.id);
        },
        error: () => {
          this.loading = false;
          this.notFound = true;
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // Gleiches Muster wie in der Admin-Detailansicht: Altdaten ohne Verband-Slug
  // oder Liga-ID bleiben ohne Link.
  matchLink(game: RefereeAdminGame): (string | number)[] | null {
    if (!game.game_operation_slug || !game.league_id) return null;
    return ['/', game.game_operation_slug, game.league_id, 'spiel', game.id];
  }

  private _loadGames(id: number): void {
    this.gamesLoading = true;
    this._refereeService
      .vmGetGames(id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (games) => {
          this.games = games;
          this.gamesLoading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.gamesLoading = false;
          this._cdr.markForCheck();
        },
      });
  }
}
