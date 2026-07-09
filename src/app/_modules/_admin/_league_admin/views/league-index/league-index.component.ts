import {
  Component,
  ChangeDetectorRef,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  AssociationService,
  LeagueService,
  NotificationService,
} from '@floorball/core';
import {
  GameOperation,
  GameOperationWithLeagues,
  League,
  Season,
} from '@floorball/types';
import { Observable, forkJoin } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { TranslocoService } from '@jsverse/transloco';

@Component({
  templateUrl: './league-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class LeagueIndexComponent implements OnInit {
  associations$: Observable<GameOperation[]>;
  goLeagueItems: GameOperationWithLeagues[] = [];
  loading = true;
  savingOrder = false;

  previousSeason: Season | null = null;

  copyPanelGoId: number | null = null;
  copySourceLeagues: League[] = [];
  copySourceLeagueId: number | null = null;
  copyIncludeTeams = false;
  copyLeaguesLoading = false;
  copying = false;

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    private _transloco: TranslocoService,
    private _router: Router
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._leagueService.getAdminLeagues().subscribe({
      next: (items) => {
        this.goLeagueItems = items;
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this._cdr.markForCheck();
      },
    });

    this._associationService.seasons$.subscribe((seasons) => {
      const current = (seasons ?? []).find((s) => s.current);
      this.previousSeason = current
        ? ((seasons ?? [])
            .filter((s) => s.id < current.id)
            .sort((a, b) => b.id - a.id)[0] ?? null)
        : null;
      this._cdr.markForCheck();
    });
  }

  onLeagueDrop(event: CdkDragDrop<League[]>, goId: number): void {
    const go = this.goLeagueItems.find((g) => g.id === goId);
    if (!go) return;

    const snapshot = [...go.leagues];
    moveItemInArray(go.leagues, event.previousIndex, event.currentIndex);
    this.savingOrder = true;

    const updates = go.leagues.map((league, index) =>
      this._leagueService.adminUpdateLeague(league.id, {
        order_key: String((index + 1) * 10),
      })
    );

    forkJoin(updates).subscribe({
      next: () => {
        this.savingOrder = false;
        this._cdr.markForCheck();
        this._notificationService.success(
          this._transloco.translate('leagueAdmin.notifications.orderSaved')
        );
      },
      error: () => {
        go.leagues = snapshot;
        this.savingOrder = false;
        this._cdr.markForCheck();
        this._notificationService.error(
          this._transloco.translate('leagueAdmin.notifications.orderSaveError')
        );
      },
    });
  }

  toggleCopyPanel(goId: number): void {
    if (this.copyPanelGoId === goId) {
      this.closeCopyPanel();
      return;
    }

    this.copyPanelGoId = goId;
    this.copySourceLeagues = [];
    this.copySourceLeagueId = null;
    this.copyIncludeTeams = false;

    if (!this.previousSeason) return;

    this.copyLeaguesLoading = true;
    this._leagueService.getLeagues(goId, this.previousSeason.id).subscribe({
      next: (leagues) => {
        if (this.copyPanelGoId !== goId) return;
        this.copySourceLeagues = leagues;
        this.copyLeaguesLoading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        if (this.copyPanelGoId !== goId) return;
        this.copyLeaguesLoading = false;
        this._cdr.markForCheck();
        this._notificationService.error(
          this._transloco.translate('leagueAdmin.notifications.copyLoadError')
        );
      },
    });
  }

  closeCopyPanel(): void {
    this.copyPanelGoId = null;
  }

  submitCopy(): void {
    if (!this.copySourceLeagueId || this.copying) return;

    this.copying = true;
    this._leagueService
      .adminCopyLeague(this.copySourceLeagueId, this.copyIncludeTeams)
      .subscribe({
        next: (league) => {
          this.copying = false;
          this._cdr.markForCheck();
          this._notificationService.success(
            this._transloco.translate('leagueAdmin.notifications.copySuccess')
          );
          this._router.navigate([
            '/',
            'verwaltung',
            'ligen',
            league.id,
            'bearbeiten',
          ]);
        },
        error: () => {
          this.copying = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate('leagueAdmin.notifications.copyError')
          );
        },
      });
  }
}
