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
} from '@floorball/types';
import { Observable, forkJoin } from 'rxjs';
import { Title } from '@angular/platform-browser';
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

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    private _transloco: TranslocoService
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
}
