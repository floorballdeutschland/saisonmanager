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
  NotificationService,
  SessionService,
} from '@floorball/core';
import { Club, GameOperation, StateAssociation } from '@floorball/types';
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
    { name: 'Sonstige', isocode: 'de-sonstige' },
  ];

  stateAssociations: StateAssociation[] = [];
  permissions: { [key: string]: boolean } = {};
  confirmDeactivate = false;

  get leafStateAssociations(): StateAssociation[] {
    const parentIds = new Set(
      this.stateAssociations
        .filter((sa) => sa.parent_id)
        .map((sa) => sa.parent_id as number)
    );
    return this.stateAssociations.filter((sa) => !parentIds.has(sa.id));
  }

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _clubService: ClubService,
    private _sessionService: SessionService,
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
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (user) => {
          this.permissions = user?.permissions ?? {};
          this._cdr.markForCheck();
        },
      });

    this._associationService.stateAssociations$
      .pipe(take(1), takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.stateAssociations = result;
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

  public getSportverbund(club: Club): string {
    const sa = this.stateAssociations.find(
      (s) => s.id === club.state_association_id
    );
    if (!sa) return '–';
    if (sa.parent_id) {
      const parent = this.stateAssociations.find((s) => s.id === sa.parent_id);
      return parent?.name ?? sa.name;
    }
    return sa.name;
  }

  public error(club: Club): boolean {
    return this.errorMsg(club).length > 0;
  }

  public errorMsg(club: Club): string[] {
    const msg = [];

    if (!club.name?.length) {
      msg.push('Es muss ein Vereinsname gesetzt werden');
    }

    if (!club.long_name?.length) {
      msg.push('Es muss ein Vereinsname (aus dem Register) gesetzt werden');
    }

    if (!club.short_name?.length) {
      msg.push('Es muss ein kurzer Vereinsname gesetzt werden');
    }

    return msg;
  }

  private readonly _allowedLogoTypes = [
    'image/png',
    'image/jpeg',
    'image/svg+xml',
  ];
  private readonly _maxLogoSize = 5 * 1024 * 1024;

  public onLogoSelected(club: Club, input: HTMLInputElement) {
    if (!input.files?.length || !club.id) return;
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
      .uploadClubLogo(club.id, file)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          input.value = '';
          club.logo_url = result.logo_url;
          club.logo_small_url = result.logo_small_url;
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

  public canDeactivate(club: Club): boolean {
    return (
      this.editMode &&
      !club.deactivated_at &&
      !!(this.permissions['club_deactivate'] || this.permissions['admin'])
    );
  }

  public canReactivate(club: Club): boolean {
    return (
      this.editMode &&
      !!club.deactivated_at &&
      !!(this.permissions['club_deactivate'] || this.permissions['admin'])
    );
  }

  public deactivateClub(club: Club): void {
    this.confirmDeactivate = false;
    this._clubService.deactivateClub(club.id).subscribe({
      next: (result) => {
        club.deactivated_at = result.deactivated_at;
        this._notificationService.success('Verein wurde deaktiviert.', {
          autoClose: true,
        });
        this._cdr.markForCheck();
      },
      error: () => {
        this._notificationService.error('Deaktivierung fehlgeschlagen.', {
          autoClose: false,
        });
      },
    });
  }

  public reactivateClub(club: Club): void {
    this._clubService.reactivateClub(club.id).subscribe({
      next: (result) => {
        club.deactivated_at = result.deactivated_at;
        this._notificationService.success('Verein wurde reaktiviert.', {
          autoClose: true,
        });
        this._cdr.markForCheck();
      },
      error: () => {
        this._notificationService.error('Reaktivierung fehlgeschlagen.', {
          autoClose: false,
        });
      },
    });
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
