import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  AssociationService,
  ClubService,
  GameOperationService,
  NotificationService,
} from '@floorball/core';
import { Club, GameOperation } from '@floorball/types';
import { Observable, of, share, Subject, take, takeUntil, tap } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  templateUrl: './club-edit.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class ClubEditComponent implements OnInit, OnDestroy {
  associations$: Observable<GameOperation[]>;

  clubId?: number;
  club$?: Observable<Club>;
  editMode = true;

  loading$?: Observable<boolean>;
  gameOperations: GameOperation[] = [];

  states = [
    { name: 'Baden-Württemberg', isocode: 'de-bw' },
    { name: 'Bayern', isocode: 'de-by' },
    { name: 'Berlin', isocode: 'de-be' },
    { name: 'Brandenburg', isocode: 'de-bb' },
    { name: 'Bremen', isocode: 'de-hb' },
    { name: 'Hamburg', isocode: 'de-hh' },
    { name: 'Hessen', isocode: 'de-he' },
    { name: 'Mecklenburg-Vorpommern', isocode: 'de-mv' },
    { name: 'Niedersachsen', isocode: 'de-ni' },
    { name: 'Nordrhein-Westfalen', isocode: 'de-nw' },
    { name: 'Rheinland-Pfalz', isocode: 'de-rp' },
    { name: 'Saarland', isocode: 'de-sl' },
    { name: 'Sachsen', isocode: 'de-sn' },
    { name: 'Sachsen-Anhalt', isocode: 'de-st' },
    { name: 'Schleswig-Holstein', isocode: 'de-sh' },
    { name: 'Thüringen', isocode: 'de-th' },
  ];

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _clubService: ClubService,
    private _gameOperationService: GameOperationService,
    private _router: Router,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._gameOperationService.getAdminGameOperations().subscribe({
      next: (result) => {
        this.gameOperations = result;

        this._cdr.markForCheck();
      },
    });

    this._route.params.subscribe((params) => {
      if (params['clubId']) {
        this.getClub(params['clubId']);
      } else {
        this.editMode = false;
        this.newClub();
      }
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  public getClub(id: string) {
    this.club$ = this._clubService.getAdminClub(parseInt(id)).pipe(share());

    this.club$
      .pipe(
        tap((league) => {
          if (!league) {
            return;
          }
        }),
        take(1),
        takeUntil(this._destroy$)
      )
      .subscribe();
    this._cdr.markForCheck();
  }

  public newClub() {
    const club: Club = {
      id: 0,
      name: '',
      short_name: '',
      long_name: '',
      state: 'de-sh',
      game_operation_id: 0,
      additional_game_operation_ids: [],
    };

    this.club$ = of(club);
    this._cdr.markForCheck();
  }

  public error(club: Club): boolean {
    return this.errorMsg(club).length > 0;
  }

  public errorMsg(club: Club): string[] {
    // eslint-disable-next-line prefer-const
    let msg = [];

    if (club.name.length < 1) {
      msg.push('Es muss ein Vereinsname gesetzt werden');
    }

    if (club.long_name.length < 1) {
      msg.push('Es muss ein Vereinsname (aus dem Register) gesetzt werden');
    }

    if (club.short_name.length < 1) {
      msg.push('Es muss ein kurzer Vereinsname gesetzt werden');
    }

    return msg;
  }

  public submit(club: Club) {
    this._clubService.adminCreateClub(club).subscribe({
      next: (result) => {
        const message = [
          'Verein ',
          result.name,
          '(',
          result.id,
          ') erfolgreich geändert.',
        ].join('');
        this._notificationService.success(message, {
          autoClose: true,
          keepAfterRouteChange: true,
        });
        this._router.navigate(['verwaltung', 'vereine']);
      },
      error: (error) => {
        this._notificationService.error(error, {
          autoClose: false,
          keepAfterRouteChange: false,
        });
      },
    });
  }
}
