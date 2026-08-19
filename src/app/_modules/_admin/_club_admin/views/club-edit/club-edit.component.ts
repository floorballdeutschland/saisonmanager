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
  NotificationService,
  SessionService,
} from '@floorball/core';
import {
  Club,
  ClubManager,
  GameOperation,
  StateAssociation,
} from '@floorball/types';
import { Observable, of, share, Subject, take, takeUntil, tap } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { CLUB_STATE_OPTIONS } from 'src/app/_helpers/_utils/german-states';

@Component({
  templateUrl: './club-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ClubEditComponent implements OnInit, OnDestroy {
  associations$: Observable<GameOperation[]>;

  clubId?: number;
  club$?: Observable<Club>;
  editMode = true;

  loading$?: Observable<boolean>;

  // Geteilt mit dem Zuständigkeitsbereich des Landesverbands, damit die Kürzel
  // nicht zweimal im Code stehen. Hier mit „Sonstige" für Vereine mit Sitz im
  // Ausland; als Zuständigkeitsbereich gibt es den Wert nicht.
  states = CLUB_STATE_OPTIONS;

  stateAssociations: StateAssociation[] = [];
  permissions: { [key: string]: boolean } = {};

  // Die Spielerliste des Vereins liegt hinter menu_item_player_admin. Ohne
  // diese Klammer landete ein Vereinsmanager beim Klick ohne Meldung auf der
  // Startseite, weil der permissionGuard stumm umleitet.
  public get canEditPlayers(): boolean {
    return !!this.permissions['menu_item_player_admin'];
  }

  // Vereinsmanager des Vereins und die aktuelle Auswahl. Kommt aus einem
  // eigenen Endpunkt und nicht aus dem Vereins-Datensatz: Der reist
  // serverseitig durch jede Spieltags-Antwort, dort haben Benutzerdaten
  // nichts zu suchen.
  clubManagers: ClubManager[] = [];
  notifyUserIds: number[] = [];
  confirmDeactivate = false;

  // Spielbetriebe, in denen der/die Nutzer*in Vereine anlegen darf. Nur beim
  // Anlegen relevant: der Heimat-Spielbetrieb entscheidet, wer den Verein
  // verwaltet, und beim Bearbeiten soll er sich nicht versehentlich ändern
  // (dort steht er weiter als Spielverbund read-only).

  // Auswahlliste des Suchfelds: einmal beim Laden gebildet, nicht als Getter.
  // Ein neues Array pro Change-Detection wuerde die Trefferliste des Suchfelds
  // bei jedem Durchlauf neu aufbauen.
  leafStateAssociations: StateAssociation[] = [];

  private _refreshLeafStateAssociations(): void {
    const parentIds = new Set(
      this.stateAssociations
        .filter((sa) => sa.parent_id)
        .map((sa) => sa.parent_id as number)
    );
    this.leafStateAssociations = this.stateAssociations.filter(
      (sa) => !parentIds.has(sa.id)
    );
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
    private _metaTitle: Title,
    private _transloco: TranslocoService
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
          this._refreshLeafStateAssociations();
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
    this.loadClubManagers(parseInt(id));

    this.club$
      .pipe(
        tap((club) => {
          if (!club) {
            return;
          }
          this.clubEditRestricted = club.edit_restricted;
          this._cdr.markForCheck();
        }),
        take(1),
        takeUntil(this._destroy$)
      )
      .subscribe();
    this._cdr.markForCheck();
  }

  private loadClubManagers(clubId: number): void {
    this._clubService
      .getClubManagers(clubId)
      .pipe(take(1), takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.clubManagers = result.managers ?? [];
          this.notifyUserIds = result.notify_user_ids ?? [];
          this._cdr.markForCheck();
        },
        // Bewusst still: Die Empfängerliste ist eine Zusatzangabe. Ein Fehler
        // beim Laden darf das Bearbeiten der Stammdaten nicht mit einem Toast
        // überlagern, den niemand einordnen kann.
        error: () => {
          this.clubManagers = [];
          this._cdr.markForCheck();
        },
      });
  }

  public isNotifyUser(userId: number): boolean {
    return this.notifyUserIds.includes(userId);
  }

  public toggleNotifyUser(userId: number): void {
    this.notifyUserIds = this.isNotifyUser(userId)
      ? this.notifyUserIds.filter((id) => id !== userId)
      : [...this.notifyUserIds, userId];
  }

  public newClub() {
    const club: Club = {
      id: 0,
      name: '',
      short_name: '',
      long_name: '',
      state: 'de-sh',
    };

    this.club$ = of(club);
    this._cdr.markForCheck();
  }

  // Vereinsmanager sehen Bundesland, Landesverband und den daraus abgeleiteten
  // Spielverbund, ändern können sie sie nicht: Sie ordnen den Verein ein, und
  // der Landesverband entscheidet, wer ihn verwaltet. Gegenstück zu
  // ClubsController#restricted_club_params.
  //
  // `edit_restricted` kommt aus der Antwort zum geladenen Verein, weil die
  // Berechtigung pro Verein gilt: Wer eine Spielbetriebsrolle für einen Verband
  // UND eine Vereinsrolle für einen Verein aus einem anderen Verband hat, darf
  // beim einen alles und beim anderen nur die Stammdaten. Das Benutzer-Flag
  // greift nur beim Anlegen, wo es noch keinen Verein gibt.
  public clubEditRestricted?: boolean;

  public get isRestricted(): boolean {
    return (
      this.clubEditRestricted ?? !!this.permissions['club_edit_restricted']
    );
  }

  public getStateName(club: Club): string {
    return this.states.find((s) => s.isocode === club.state)?.name ?? '–';
  }

  public getStateAssociationName(club: Club): string {
    return (
      this.stateAssociations.find((s) => s.id === club.state_association_id)
        ?.name ?? '–'
    );
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
      msg.push(
        this._transloco.translate('clubAdmin.notifications.nameRequired')
      );
    }

    if (!club.long_name?.length) {
      msg.push(
        this._transloco.translate('clubAdmin.notifications.longNameRequired')
      );
    }

    if (!club.short_name?.length) {
      msg.push(
        this._transloco.translate('clubAdmin.notifications.shortNameRequired')
      );
    }

    // maxlength im Formular deckelt die Neueingabe. Diese Prüfung fängt die
    // Bestandswerte ab, die vor der Begrenzung eingetragen wurden: Sonst
    // scheitert das Speichern erst am Server, und zwar auch dann, wenn der
    // Verein nur seine Kontaktadresse ändern wollte.
    if ((club.short_name?.length ?? 0) > 4) {
      msg.push(
        this._transloco.translate('clubAdmin.notifications.shortNameTooLong')
      );
    }

    // Eine Adresse, nicht mehrere. Auf Produktion trug ein Verein zwei
    // Adressen mit Semikolon getrennt im Feld, und beide bekamen nie etwas:
    // Das Feld wird als eine einzige Adresse verschickt. Wer mehrere
    // Empfaenger braucht, waehlt sie darunter als Vereinsmanager aus.
    if (
      club.contact_email?.length &&
      !/^[^@\s;,]+@[^@\s;,]+\.[^@\s;,]+$/.test(club.contact_email.trim())
    ) {
      msg.push(
        this._transloco.translate('clubAdmin.notifications.contactEmailInvalid')
      );
    }

    // Der Landesverband ordnet den Verein ein: Aus ihm ergibt sich der
    // zuständige Spielbetrieb. Ohne ihn lehnt die API das Anlegen ab, weil der
    // Verein sonst in keiner Vereinsliste auftaucht.
    //
    // Nur beim Anlegen geprüft. Beim Bearbeiten darf das Feld leer sein, sonst
    // wären ausgerechnet die Vereine ohne Landesverband nicht pflegbar; ob das
    // Leeren erlaubt ist, entscheidet die Berechtigung und damit der Server.
    if (!this.editMode && !club.state_association_id) {
      msg.push(
        this._transloco.translate(
          'clubAdmin.notifications.stateAssociationRequired'
        )
      );
    }

    return msg;
  }

  private readonly _allowedLogoTypes = [
    'image/png',
    'image/jpeg',
    'image/webp',
  ];
  private readonly _maxLogoSize = 3 * 1024 * 1024;

  public onLogoSelected(club: Club, input: HTMLInputElement) {
    if (!input.files?.length || !club.id) return;
    const file = input.files[0];

    if (!this._allowedLogoTypes.includes(file.type)) {
      this._notificationService.error(
        this._transloco.translate('clubAdmin.notifications.logoTypeError'),
        {
          autoClose: false,
        }
      );
      input.value = '';
      return;
    }
    if (file.size > this._maxLogoSize) {
      this._notificationService.error(
        this._transloco.translate('clubAdmin.notifications.logoSizeError'),
        {
          autoClose: false,
        }
      );
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
          this._notificationService.success(
            this._transloco.translate(
              'clubAdmin.notifications.logoUploadSuccess'
            ),
            {
              autoClose: true,
            }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          // Kein eigener Toast: Die Fehlermeldung zeigt der globale
          // ErrorInterceptor. Bei einem abgelehnten Logo ist das die
          // Begründung des Servers, und eine zweite, generische Meldung hat
          // genau die überdeckt (#84, #228). Hier nur die Dateiauswahl
          // zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
          input.value = '';
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
        this._notificationService.success(
          this._transloco.translate(
            'clubAdmin.notifications.deactivateSuccess'
          ),
          {
            autoClose: true,
          }
        );
        this._cdr.markForCheck();
      },
      error: () => {
        this._notificationService.error(
          this._transloco.translate('clubAdmin.notifications.deactivateError'),
          {
            autoClose: false,
          }
        );
      },
    });
  }

  public reactivateClub(club: Club): void {
    this._clubService.reactivateClub(club.id).subscribe({
      next: (result) => {
        club.deactivated_at = result.deactivated_at;
        this._notificationService.success(
          this._transloco.translate(
            'clubAdmin.notifications.reactivateSuccess'
          ),
          {
            autoClose: true,
          }
        );
        this._cdr.markForCheck();
      },
      error: () => {
        this._notificationService.error(
          this._transloco.translate('clubAdmin.notifications.reactivateError'),
          {
            autoClose: false,
          }
        );
      },
    });
  }

  public submit(club: Club) {
    // Die Auswahl haengt am Formular, nicht am geladenen Vereins-Datensatz.
    // Beim Anlegen gibt es noch keine Vereinsmanager, dann bleibt sie leer.
    club.notify_user_ids = this.notifyUserIds;

    this._clubService.adminCreateClub(club).subscribe({
      next: (result) => {
        const message = this._transloco.translate(
          'clubAdmin.notifications.saveSuccess',
          { name: result.name, id: result.id }
        );
        this._notificationService.success(message, {
          autoClose: true,
          keepAfterRouteChange: true,
        });
        this._router.navigate(['verwaltung', 'vereine']);
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
