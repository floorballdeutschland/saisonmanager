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
  LeagueService,
  NotificationService,
} from '@floorball/core';
import { Club, GameOperation, Team } from 'src/app/_models';
import { Observable, of, share, Subject, take, takeUntil, tap } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { GameOperationWithLeagues } from 'src/app/_models/game-operation.interface';

@Component({
  templateUrl: './team-edit.component.html',
  encapsulation: ViewEncapsulation.None,
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

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _clubService: ClubService,
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
            this.getClubs(leagueId, 'l');
            this.newTeam(leagueId);
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
      msg.push('Es muss ein Teamname gesetzt werden');
    }

    if (team.short_name.length < 1) {
      msg.push('Es muss ein kurzer Teamname gesetzt werden');
    }

    if (team.league_id < 1) {
      msg.push('Liga ID falsch');
    }

    if (team.club_id < 1) {
      msg.push('Es muss ein Verein ausgewählt werden');
    }

    if (team.syndicate && team.syndicate_clubs.length < 2) {
      msg.push('Eine SG muss aus zwei Teams bestehen.');
    }

    if (team.syndicate && !team.syndicate_clubs.includes(team.club_id)) {
      msg.push('Der Hauptverein muss auch SG-Verein sein');
    }

    const regexp = new RegExp(
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
    if (
      !team.contact_email ||
      team.contact_email.length < 1 ||
      !regexp.test(team.contact_email)
    ) {
      msg.push('Es muss eine korrekte Ansprechpartner E-Mail gesetzt werden');
    }

    if (!team.contact_person || team.contact_person.length < 6) {
      msg.push('Es muss eine Kontaktperson benannt werden');
    }

    return msg;
  }

  private readonly _allowedLogoTypes = [
    'image/png',
    'image/jpeg',
    'image/svg+xml',
  ];
  private readonly _maxLogoSize = 5 * 1024 * 1024;

  public onLogoSelected(team: Team, input: HTMLInputElement) {
    if (!input.files?.length || !team.id) return;
    const file = input.files[0];

    if (!this._allowedLogoTypes.includes(file.type)) {
      this._notificationService.error('Nur PNG, JPG oder SVG erlaubt.', {
        autoClose: false,
      });
      input.value = '';
      return;
    }
    if (file.size > this._maxLogoSize) {
      this._notificationService.error('Datei zu groß (max. 5 MB).', {
        autoClose: false,
      });
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
          this._notificationService.success('Logo erfolgreich hochgeladen.', {
            autoClose: true,
          });
          this._cdr.markForCheck();
        },
        error: () => {
          input.value = '';
          this._notificationService.error('Logo-Upload fehlgeschlagen.', {
            autoClose: false,
          });
        },
      });
  }

  public submit(team: Team) {
    this._leagueService.adminCreateTeam(team).subscribe({
      next: (result) => {
        const message = [
          'Team ',
          result.name,
          '(',
          result.id,
          ') erfolgreich geändert.',
        ].join('');
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
        this._notificationService.error(error, {
          autoClose: false,
          keepAfterRouteChange: false,
        });
      },
    });
  }
}
