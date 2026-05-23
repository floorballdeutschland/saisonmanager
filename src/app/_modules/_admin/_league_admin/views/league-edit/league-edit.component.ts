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
  GameOperationWithLeagues,
  League,
  LeagueQualification,
  LeagueQualificationType,
} from '@floorball/types';
import { Observable, of, share, Subject, take, takeUntil, tap } from 'rxjs';
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
  allLeagues: League[] = [];
  isBuliPermitted = false;

  private _destroy$ = new Subject<boolean>();

  deletingBanner = false;

  private readonly _allowedBannerType = 'image/webp';
  private readonly _maxBannerSize = 500 * 1024;

  onBannerSelected(league: League, input: HTMLInputElement): void {
    if (!input.files?.length || !league.id) return;
    const file = input.files[0];

    if (file.type !== this._allowedBannerType) {
      this._notificationService.error('Nur WebP-Dateien erlaubt.', {
        autoClose: false,
      });
      input.value = '';
      return;
    }
    if (file.size > this._maxBannerSize) {
      this._notificationService.error('Datei zu groß (max. 500 KB).', {
        autoClose: false,
      });
      input.value = '';
      return;
    }

    this._leagueService
      .adminUploadBanner(league.id, file)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          input.value = '';
          league.banner_url = result.banner_url;
          this._notificationService.success('Banner erfolgreich hochgeladen.', {
            autoClose: true,
          });
          this._cdr.markForCheck();
        },
        error: (err) => {
          input.value = '';
          const msg: string =
            err?.error?.message ?? 'Banner-Upload fehlgeschlagen.';
          this._notificationService.error(msg, { autoClose: false });
        },
      });
  }

  deleteBanner(league: League): void {
    if (!league.id || this.deletingBanner) return;
    if (!confirm('Banner wirklich entfernen?')) return;
    this.deletingBanner = true;
    this._leagueService
      .adminDeleteBanner(league.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          league.banner_url = null;
          this.deletingBanner = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.deletingBanner = false;
          const msg: string =
            err?.error?.message ?? 'Banner konnte nicht gelöscht werden.';
          this._notificationService.error(msg, { autoClose: false });
          this._cdr.markForCheck();
        },
      });
  }

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

  private static readonly _femaleAgeGroups = new Set([
    'Damen',
    'U19 Juniorinnen',
    'U17 Juniorinnen',
    'U15 Juniorinnen',
    'U13 Juniorinnen',
    'U11 Juniorinnen',
    'U9 Juniorinnen',
    'U7 Juniorinnen',
    'U5 Juniorinnen',
  ]);

  public femaleFromAgeGroup(ageGroup: string): boolean {
    return LeagueEditComponent._femaleAgeGroups.has(ageGroup);
  }

  public onLeagueModusChange(league: League, modus: string): void {
    league.league_class_id = modus === 'league' ? 'll' : '';
  }

  public ngOnInit(): void {
    this._leagueService.getAdminLeagues().subscribe({
      next: (result) => {
        // this is the case, when we have enough permissions
        this.permittedGameOperations = result;
        this.allLeagues = result.flatMap((go) => go.leagues ?? []);

        // only if we have FD permission we should be able to create/change a Buli
        const iBP = this.permittedGameOperations
          .map((go) => go.id)
          .reduce((acc, goId) => acc || goId === 1, false);
        this.isBuliPermitted = iBP; // hack to trick the compiler ;-)

        this.allLeagues = this.permittedGameOperations.flatMap(
          (go) => go.leagues ?? []
        );

        this._route.params.subscribe((params) => {
          if (params['leagueId']) {
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
      game_operation_id:
        this.permittedGameOperations.length === 1
          ? this.permittedGameOperations[0].id
          : 0,
      game_operation_name: '',
      league_category_id: '',
      league_class_id: 'll',
      league_system_id: '',
      name: '',
      female: false,
      age_group: '',
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
      direct_comparison: false,
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

    if (!league.overtime_length || !(league.overtime_length > 0)) {
      msg.push('Die Verlängerungsdauer muss eine Zahl >= 0 sein');
    }

    if (!league.age_group) {
      msg.push('Es muss eine Altersklasse gesetzt werden');
    }

    if (league.league_modus === 'league' && !league.league_class_id) {
      msg.push('Es muss eine Ligaklasse gesetzt werden');
    }

    if (league.legacy_league) {
      msg.push('Eine alte Liga kann hier nicht geändert werden.');
    }

    return msg;
  }

  newDocumentName = '';

  newQual: {
    rank_from: number | null;
    rank_to: number | null;
    qualification_type: LeagueQualificationType;
    target_league_id: number | null;
    label: string;
  } = {
    rank_from: null,
    rank_to: null,
    qualification_type: 'promotion',
    target_league_id: null,
    label: '',
  };

  public addQualification(league: League): void {
    if (!league.id || !this.newQual.rank_from || !this.newQual.rank_to) return;
    this._leagueService
      .createQualification(league.id, {
        rank_from: this.newQual.rank_from,
        rank_to: this.newQual.rank_to,
        qualification_type: this.newQual.qualification_type,
        target_league_id: this.newQual.target_league_id,
        label: this.newQual.label || null,
      })
      .pipe(take(1), takeUntil(this._destroy$))
      .subscribe({
        next: (qual) => {
          league.qualifications = [...(league.qualifications ?? []), qual];
          this.newQual = {
            rank_from: null,
            rank_to: null,
            qualification_type: 'promotion',
            target_league_id: null,
            label: '',
          };
          this._cdr.markForCheck();
        },
        error: (err) => {
          const msg = err?.error?.errors?.join(', ') ?? 'Fehler beim Speichern';
          this._notificationService.error(msg, { autoClose: false });
        },
      });
  }

  public deleteQualification(league: League, qual: LeagueQualification): void {
    if (!league.id) return;
    this._leagueService
      .deleteQualification(league.id, qual.id)
      .pipe(take(1), takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          league.qualifications = (league.qualifications ?? []).filter(
            (q) => q.id !== qual.id
          );
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error('Fehler beim Löschen', {
            autoClose: false,
          });
        },
      });
  }

  readonly qualificationColors: Record<string, string> = {
    promotion: '#22c55e',
    playoff: '#60a5fa',
    playdown: '#f97316',
    relegation: '#ef4444',
    championship: '#8b5cf6',
    cup: '#a855f7',
  };

  readonly qualificationTypeLabels: Record<string, string> = {
    promotion: 'Aufstieg',
    playoff: 'Playoffs',
    playdown: 'Playdowns',
    relegation: 'Abstieg',
    championship: 'Deutsche Meisterschaft',
    cup: 'Pokal',
  };

  qualificationColor(type: string): string {
    return this.qualificationColors[type] ?? '#6b7280';
  }

  qualificationTypeLabel(type: string): string {
    return this.qualificationTypeLabels[type] ?? type;
  }

  public addRequiredDocument(league: League): void {
    const name = this.newDocumentName.trim();
    if (!name) return;
    league.required_documents = [...(league.required_documents ?? []), name];
    this.newDocumentName = '';
  }

  public removeRequiredDocument(league: League, index: number): void {
    league.required_documents = (league.required_documents ?? []).filter(
      (_, i) => i !== index
    );
  }

  public submit(league: League) {
    this._leagueService.adminCreateLeagues(league).subscribe({
      next: () => {
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
