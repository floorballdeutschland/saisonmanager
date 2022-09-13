import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import {
  AssociationService,
  LeagueService,
  NotificationService,
} from '@floorball/core';
import {
  GameOperation,
  League,
  LeagueClass,
  GameOperationWithLeagues,
} from '@floorball/types';
import { Observable, Subject, share, tap, take, takeUntil, of } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  templateUrl: './league-edit.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class LeagueEditComponent implements OnInit, OnDestroy {
  associations$: Observable<GameOperation[]>;

  leagueId?: number;
  league$?: Observable<League>;
  editMode = true;

  loading$?: Observable<boolean>;
  permittedGameOperations: GameOperationWithLeagues[] = [];
  isBuliPermitted = false;
  leagueClasses: LeagueClass[] = [];

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
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
    this._leagueService.getAdminLeagueClasses().subscribe({
      next: (result) => {
        this.leagueClasses = result;

        this._cdr.markForCheck();
      },
    });

    this._leagueService.getAdminLeagues().subscribe({
      next: (result) => {
        // this is the case, when we have enough permissions
        this.permittedGameOperations = result;

        // only if we have FD permission we should be able to create/change a Buli
        const iBP = this.permittedGameOperations
          .map((go) => go.id)
          .reduce((acc, goId) => acc || goId === 1, false);
        this.isBuliPermitted = iBP; // hack to trick the compiler ;-)

        this._route.params.subscribe((params) => {
          console.log('_route');
          if (params['leagueId']) {
            console.log(params['leagueId']);

            this.getLeague(params['leagueId']);
          } else {
            this.editMode = false;
            this.newLeague();
          }
        });
      },
      error: (error) => {
        console.log(error);
        const errorMessage = 'Dieser Bereich steht dir nicht zur Verfügung.';
        this._notificationService.error(errorMessage);
        this._router.navigate(['/'], { state: { error: errorMessage } });
      },
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  public getLeague(id: string) {
    this.league$ = this._leagueService
      .getSingleLeague(parseInt(id))
      .pipe(share());

    this.league$
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

  public newLeague() {
    const league: League = {
      id: 0,
      game_operation_id: 1,
      game_operation_name: '',
      league_category_id: '',
      league_class_id: '40',
      league_system_id: '',
      name: '',
      female: false,
      enable_scorer: true,
      short_name: '',
      season_id: '0',
      order_key: '1',
      league_type: 'league',
      game_day_numbers: [],
      game_day_titles: [],

      legacy_league: false,
      field_size: 'GF',
      league_modus: 'league',
      has_preround: false,

      table_modus: 'classic',
      periods: 3,
      period_length: 20,
      overtime_length: 10,
    };

    this.league$ = of(league);
    this._cdr.markForCheck();
  }

  public error(league: League): boolean {
    return this.errorMsg(league).length > 0;
  }

  public errorMsg(league: League): string[] {
    // eslint-disable-next-line prefer-const
    let msg = [];

    if (league.name.length < 1) {
      msg.push('Es muss ein Liganame gesetzt werden');
    }

    if (league.short_name.length < 1) {
      msg.push('Es muss ein kurzer Liganame gesetzt werden');
    }

    if (league.game_operation_id < 1) {
      msg.push('Spielbetrieb falsch ausgewählt');
    }

    const regexpNum = new RegExp(/^\d+$/);
    if (!league.order_key || !regexpNum.test(league.order_key)) {
      msg.push('Der Sortierschlüssel muss eine Zahl >= 0 sein');
    }

    if (!league.periods || !(league.periods > 0)) {
      msg.push('Der Anzahl Spielabschnitte muss eine Zahl >= 0 sein');
    }

    if (!league.period_length || !(league.period_length > 0)) {
      msg.push('Die Abschnittsdauer muss eine Zahl >= 0 sein');
    }

    console.log(league);
    if (!league.overtime_length || !(league.overtime_length > 0)) {
      msg.push('Die Verlängerungsdauer muss eine Zahl >= 0 sein');
    }

    if (league.legacy_league) {
      msg.push('Eine alte Liga kann hier nicht geändert werden.');
    }

    return msg;
  }

  public submit(league: League) {
    this._leagueService.adminCreateLeagues(league).subscribe({
      next: (result) => {
        console.log(result);
        const message = [
          'Liga ',
          league.name,
          '(',
          league.id,
          ') erfolgreich geändert.',
        ].join('');
        this._notificationService.success(message, {
          autoClose: true,
          keepAfterRouteChange: true,
        });
        this._router.navigate(['verwaltung', 'ligen']);
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
