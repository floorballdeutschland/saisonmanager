import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  AssociationService,
  ClubService,
  LeagueService,
  NotificationService,
  SessionService,
} from '@floorball/core';
import { Club, GameOperation, Team, User } from 'src/app/_models';
import { Observable, of, share, Subject, take, takeUntil, tap } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { GameOperationWithLeagues } from 'src/app/_models/game-operation.interface';

@Component({
  templateUrl: './team-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TeamEditComponent implements OnInit, OnDestroy {
  associations$: Observable<GameOperation[]>;

  leagueId?: number;
  team$?: Observable<Team>;
  editMode = true;

  loading$?: Observable<boolean>;
  permittedGameOperations: GameOperationWithLeagues[] = [];
  clubs: Club[] = [];
  isBuliPermitted = false;

  currentUser: User | null = null;
  deleting = false;

  // Merkt sich den zuletzt gewählten Hauptverein, um ihn beim Wechsel aus
  // syndicate_clubs zu entfernen (der Hauptverein wird dort automatisch geführt).
  private _prevMainClubId?: number;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _clubService: ClubService,
    private _leagueService: LeagueService,
    private _router: Router,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _transloco: TranslocoService,
    private _metaTitle: Title,
    private _sessionService: SessionService
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this._cdr.markForCheck();
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
          if (params['teamId']) {
            this.getClubs(parseInt(params['teamId']), 't');
            this.getTeam(params['teamId']);
          } else {
            this.editMode = false;
            const leagueId = parseInt(params['leagueId']);
            this.leagueId = leagueId;
            this.getClubs(leagueId, 'l');
            this.newTeam(leagueId);
          }
        });
      },
      error: (error) => {
        console.log(error);
        const errorMessage = this._transloco.translate(
          'teamAdmin.notifications.noAccess'
        );
        this._notificationService.error(errorMessage);
        this._router.navigate(['/'], { state: { error: errorMessage } });
      },
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  public getClubs(id: number, type: string) {
    this._leagueService.getLeagueClubs(id, type).subscribe({
      next: (result) => {
        this.clubs = result;

        this._cdr.markForCheck();
      },
    });
  }

  public getTeam(id: string) {
    this.team$ = this._leagueService.adminGetTeam(parseInt(id)).pipe(share());

    this.team$
      .pipe(
        tap((team) => {
          if (!team) {
            return;
          }
          this._prevMainClubId = team.club_id;
          this.leagueId = team.league_id;
          this._cdr.markForCheck();
        }),
        take(1),
        takeUntil(this._destroy$)
      )
      .subscribe();
    this._cdr.markForCheck();
  }

  public newTeam(leagueId: number) {
    const team: Team = {
      id: 0,
      name: '',
      short_name: '',
      league_id: leagueId,
      cup_leagues: [],

      club_id: 0,
      syndicate_clubs: [],

      logo_url: '',
      logo_small: '',
      syndicate: false,

      contact_email: '',
      contact_person: '',
    };

    this.team$ = of(team);
    this._cdr.markForCheck();
  }

  public error(team: Team): boolean {
    return this.errorMsg(team).length > 0;
  }

  public errorMsg(team: Team): string[] {
    // eslint-disable-next-line prefer-const
    let msg = [];

    if (team.name.length < 1) {
      msg.push(this._transloco.translate('teamAdmin.edit.errName'));
    }

    if (team.short_name.length < 1) {
      msg.push(this._transloco.translate('teamAdmin.edit.errShortName'));
    }

    if (team.league_id < 1) {
      msg.push(this._transloco.translate('teamAdmin.edit.errLeagueId'));
    }

    if (team.club_id < 1) {
      msg.push(this._transloco.translate('teamAdmin.edit.errClub'));
    }

    if (team.syndicate && team.syndicate_clubs.length < 2) {
      msg.push(this._transloco.translate('teamAdmin.edit.errSyndicateCount'));
    }

    if (team.syndicate && !team.syndicate_clubs.includes(team.club_id)) {
      msg.push(
        this._transloco.translate('teamAdmin.edit.errSyndicateMainClub')
      );
    }

    const regexp = new RegExp(
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
    if (
      !team.contact_email ||
      team.contact_email.length < 1 ||
      !regexp.test(team.contact_email)
    ) {
      msg.push(this._transloco.translate('teamAdmin.edit.errEmail'));
    }

    if (!team.contact_person || team.contact_person.length < 6) {
      msg.push(this._transloco.translate('teamAdmin.edit.errContactPerson'));
    }

    return msg;
  }

  private readonly _allowedLogoTypes = [
    'image/png',
    'image/jpeg',
    'image/webp',
  ];
  private readonly _maxLogoSize = 3 * 1024 * 1024;

  public onLogoSelected(team: Team, input: HTMLInputElement) {
    if (!input.files?.length || !team.id) return;
    const file = input.files[0];

    if (!this._allowedLogoTypes.includes(file.type)) {
      this._notificationService.error(
        this._transloco.translate('teamAdmin.notifications.logoTypeInvalid'),
        {
          autoClose: false,
        }
      );
      input.value = '';
      return;
    }
    if (file.size > this._maxLogoSize) {
      this._notificationService.error(
        this._transloco.translate('teamAdmin.notifications.logoTooLarge'),
        {
          autoClose: false,
        }
      );
      input.value = '';
      return;
    }

    this._clubService
      .uploadTeamLogo(team.id, file)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          input.value = '';
          team.logo_url = result.logo_url;
          team.logo_small = result.logo_small_url;
          this._notificationService.success(
            this._transloco.translate('teamAdmin.notifications.logoUploaded'),
            {
              autoClose: true,
            }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          input.value = '';
          this._notificationService.error(
            this._transloco.translate(
              'teamAdmin.notifications.logoUploadFailed'
            ),
            {
              autoClose: false,
            }
          );
        },
      });
  }

  public toggleCupLeague(team: Team, leagueId: number, event: Event): void {
    if (!team.cup_leagues) team.cup_leagues = [];
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      if (!team.cup_leagues.includes(leagueId)) team.cup_leagues.push(leagueId);
    } else {
      team.cup_leagues = team.cup_leagues.filter((id) => id !== leagueId);
    }
  }

  // SG-Partner an-/abwählen. Der Hauptverein wird hier nicht aufgeführt – er
  // ist immer Teil der SG und wird automatisch in syndicate_clubs gehalten.
  public toggleSyndicateClub(team: Team, clubId: number, event: Event): void {
    if (!team.syndicate_clubs) team.syndicate_clubs = [];
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      if (!team.syndicate_clubs.includes(clubId))
        team.syndicate_clubs.push(clubId);
    } else {
      team.syndicate_clubs = team.syndicate_clubs.filter((id) => id !== clubId);
    }
  }

  // Wird der Hauptverein oben gewechselt, den alten aus der SG-Auswahl nehmen
  // und den neuen aufnehmen (sofern es eine SG ist).
  public onMainClubChange(team: Team): void {
    if (!team.syndicate_clubs) team.syndicate_clubs = [];
    if (this._prevMainClubId) {
      team.syndicate_clubs = team.syndicate_clubs.filter(
        (id) => id !== this._prevMainClubId
      );
    }
    this._prevMainClubId = team.club_id;
    this.addMainClubToSyndicate(team);
  }

  // Beim Umschalten auf „Spielgemeinschaft" den Hauptverein automatisch
  // aufnehmen, damit nur noch die Partnervereine anzuhaken sind.
  public onSyndicateChange(team: Team): void {
    this.addMainClubToSyndicate(team);
  }

  private addMainClubToSyndicate(team: Team): void {
    if (!team.syndicate || !team.club_id) return;
    if (!team.syndicate_clubs) team.syndicate_clubs = [];
    if (!team.syndicate_clubs.includes(team.club_id))
      team.syndicate_clubs.push(team.club_id);
  }

  public hasCupLeagueOptions(team: Team): boolean {
    const go = this.permittedGameOperations.find(
      (g) => g.id === team.game_operation_id
    );
    if (!go) return false;
    return go.leagues.some((l) => l.id !== team.league_id);
  }

  get canDelete(): boolean {
    return !!this.currentUser?.permissions['team_delete'];
  }

  public deleteTeam(team: Team): void {
    if (!team.id || !this.canDelete) return;
    this.deleting = true;
    this._leagueService
      .adminDeleteTeam(team.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.deleting = false;
          this._notificationService.success(
            this._transloco.translate('teamAdmin.notifications.teamDeleted', {
              name: team.name,
            }),
            { autoClose: true, keepAfterRouteChange: true }
          );
          this._router.navigate([
            'verwaltung',
            'ligen',
            team.league_id,
            'teams',
          ]);
        },
        error: (error) => {
          this.deleting = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            error?.error?.message ??
              this._transloco.translate('teamAdmin.notifications.deleteError'),
            { autoClose: false }
          );
        },
      });
  }

  public submit(team: Team) {
    this._leagueService.adminCreateTeam(team).subscribe({
      next: (result) => {
        const message = this._transloco.translate(
          'teamAdmin.notifications.teamSaved',
          { name: result.name, id: result.id }
        );
        this._notificationService.success(message, {
          autoClose: true,
          keepAfterRouteChange: true,
        });

        this._router.navigate([
          'verwaltung',
          'ligen',
          result.league_id,
          'teams',
        ]);
      },
      error: (error) => {
        this._notificationService.error(
          error?.error?.message ?? 'Fehler beim Speichern.',
          {
            autoClose: false,
            keepAfterRouteChange: false,
          }
        );
      },
    });
  }
}
