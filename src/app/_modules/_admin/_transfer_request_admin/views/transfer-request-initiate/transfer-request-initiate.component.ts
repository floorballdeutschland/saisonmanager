import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Subject, take, takeUntil } from 'rxjs';
import {
  ClubService,
  NotificationService,
  SessionService,
  TransferRequestService,
} from '@floorball/core';
import { PlayerSearchResult, TransferRequestType } from '@floorball/types';

@Component({
  templateUrl: './transfer-request-initiate.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TransferRequestInitiateComponent implements OnInit, OnDestroy {
  firstName = '';
  lastName = '';
  birthdate = '';

  foundPlayer: PlayerSearchResult | null = null;
  searchError = '';
  searching = false;
  submitting = false;

  currentUserClubIds: number[] = [];
  selectedClubId = 0;
  managedClubs: { id: number; name: string }[] = [];

  requestType: TransferRequestType = 'transfer';
  // Antragsarten, die fuer den gefundenen Spieler gerade nicht gehen: ein
  // laufender Transfer sperrt den naechsten Transfer, eine laufende Freigabe
  // die naechste Freigabe auf DENSELBEN Verein. Ueber Kreuz sperrt nichts.
  blockedRequestTypes: TransferRequestType[] = [];
  // Der Grund je gesperrter Art, wie ihn die API nennt. Fehlt er (aeltere
  // Antwort), zeigt die Maske ihren eigenen Text -- der deckt den haeufigen
  // Fall ab, nicht aber die Sperrfrist mit ihrem Datum.
  blockedRequestReasons: Partial<Record<TransferRequestType, string>> = {};
  effectiveDateMode: 'immediate' | 'scheduled' = 'immediate';
  effectiveDate = '';

  get minEffectiveDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private _destroy$ = new Subject<void>();

  constructor(
    private _transferService: TransferRequestService,
    private _sessionService: SessionService,
    private _clubService: ClubService,
    private _notificationService: NotificationService,
    private _router: Router,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(take(1), takeUntil(this._destroy$))
      .subscribe({
        next: (user) => {
          this.currentUserClubIds = user?.club_ids || [];
          if (this.currentUserClubIds.length === 1) {
            this.selectedClubId = this.currentUserClubIds[0];
          } else if (this.currentUserClubIds.length > 1) {
            this._clubService
              .adminGetClubAndTeams()
              .pipe(takeUntil(this._destroy$))
              .subscribe({
                next: (clubs) => {
                  this.managedClubs = clubs
                    .filter((c) => this.currentUserClubIds.includes(c.id))
                    .map((c) => ({ id: c.id, name: c.name }));
                  this._cdr.markForCheck();
                },
                error: () => {
                  this._notificationService.error(
                    this._transloco.translate(
                      'transferRequestAdmin.notifications.clubLoadError'
                    )
                  );
                  this._cdr.markForCheck();
                },
              });
          }
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  search(): void {
    if (!this.firstName || !this.lastName || !this.birthdate) return;

    this.searching = true;
    this.foundPlayer = null;
    this.searchError = '';
    // Jede Suche fängt bei der Vorauswahl an, mit der die Maske aufgeht. Ohne
    // das Zurücksetzen bliebe die Umlegung des vorigen Treffers stehen: Wer
    // einen Spieler mit laufendem Transferantrag sucht, danach den Namen
    // korrigiert und einen anderen findet, stellte für den zweiten einen
    // Freigabeantrag statt eines Transfers — die Auswahl stand auf
    // „Spielerfreigabe", ohne dass für diesen Spieler etwas gesperrt war.
    this.requestType = 'transfer';
    this.blockedRequestTypes = [];
    this.blockedRequestReasons = {};
    // Der Verein, mit dem gesucht wird: Die Antwort gilt nur für ihn, die
    // gesperrte Freigabe hängt am Zielverein. Wird währenddessen umgestellt,
    // gehört die Antwort nicht mehr zur Auswahl und wird verworfen.
    const searchedClubId = this.selectedClubId;

    this._transferService
      .searchPlayer(
        this.firstName,
        this.lastName,
        this.birthdate,
        this.selectedClubId
      )
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          if (searchedClubId !== this.selectedClubId) return;

          this.foundPlayer = result.player;
          this.blockedRequestTypes = result.blocked_request_types ?? [];
          this.blockedRequestReasons = result.blocked_request_reasons ?? {};
          // Die gesperrte Art nicht bloss abschalten, sondern die Auswahl
          // umlegen: Sonst steht der Knopf unter einer nicht waehlbaren
          // Vorauswahl und die Absage kaeme erst beim Absenden.
          if (this.isTypeBlocked(this.requestType)) {
            this.requestType =
              this.requestType === 'transfer' ? 'release' : 'transfer';
          }
          if (!result.player) {
            this.searchError = this._transloco.translate(
              'transferRequestAdmin.notifications.playerNotFound'
            );
          }
          this.searching = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          if (searchedClubId !== this.selectedClubId) return;

          this.blockedRequestTypes = [];
          this.blockedRequestReasons = {};
          // err.message wäre nur der technische HTTP-Text – die fachliche
          // Meldung (z.B. Geburtsdatum-Format, 422) steckt in err.error.error.
          this.searchError =
            typeof err === 'string'
              ? err
              : err?.error?.error ||
                this._transloco.translate(
                  'transferRequestAdmin.notifications.searchError'
                );
          this.searching = false;
          this._cdr.markForCheck();
        },
      });
  }

  // Der Treffer gilt nur fuer den Verein, mit dem gesucht wurde: Die Suche
  // prueft gegen ihn (Zustaendigkeit, Deaktivierung, laufende Freigabe auf
  // genau diesen Verein). Nach einem Vereinswechsel steht deshalb wieder die
  // Suche an, statt einer Antwort, die zu einem anderen Verein gehoert.
  // Der Typ ist der Wertebereich von fb-select-search (`SelectSearchValue`,
  // dort nicht über @floorball/uikit/common exportiert): Die Maske rechnet mit
  // einer Zahl, und 0 ist hier „kein Verein gewählt" (siehe resetValue).
  onRequestingClubChange(clubId: string | number | null): void {
    this.selectedClubId = Number(clubId) || 0;
    this.foundPlayer = null;
    this.blockedRequestTypes = [];
    this.blockedRequestReasons = {};
    this.requestType = 'transfer';
    this.searchError = '';
    this._cdr.markForCheck();
  }

  isTypeBlocked(type: TransferRequestType): boolean {
    return this.blockedRequestTypes.includes(type);
  }

  // Der Grund der API, sonst der eigene Text. Die API nennt bei der Sperrfrist
  // das Datum, ab dem es wieder geht -- das kann die Maske nicht wissen.
  blockedReason(type: TransferRequestType): string {
    return (
      this.blockedRequestReasons[type] ??
      this._transloco.translate(
        type === 'release'
          ? 'transferRequestAdmin.initiate.typeReleaseBlocked'
          : 'transferRequestAdmin.initiate.typeTransferBlocked'
      )
    );
  }

  // Beide Arten gesperrt: Der Antrag ist fuer diesen Spieler und diesen Verein
  // gerade nicht moeglich. Die Suche selbst weist diesen Fall bereits ab, die
  // Maske faengt ihn trotzdem — die Antwort koennte aus einem aelteren Aufruf
  // stammen, dessen Vereinsauswahl inzwischen eine andere ist.
  get allTypesBlocked(): boolean {
    return this.isTypeBlocked('transfer') && this.isTypeBlocked('release');
  }

  submit(): void {
    if (!this.foundPlayer || !this.selectedClubId) return;
    if (this.isTypeBlocked(this.requestType)) return;
    if (
      this.requestType === 'transfer' &&
      this.effectiveDateMode === 'scheduled' &&
      !this.effectiveDate
    )
      return;

    const effectiveDate =
      this.requestType === 'transfer' && this.effectiveDateMode === 'scheduled'
        ? this.effectiveDate
        : null;

    this.submitting = true;
    this._transferService
      .create(
        this.foundPlayer.id,
        this.selectedClubId,
        this.requestType,
        effectiveDate
      )
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.submitting = false;
          this._notificationService.success(
            this._transloco.translate(
              this.requestType === 'release'
                ? 'transferRequestAdmin.notifications.createReleaseSuccess'
                : 'transferRequestAdmin.notifications.createTransferSuccess'
            )
          );
          this._router.navigate(['/verwaltung/transfer-anfragen']);
        },
        error: (err) => {
          this._notificationService.error(
            (typeof err === 'string' ? err : err?.error?.error) ||
              this._transloco.translate(
                'transferRequestAdmin.notifications.createError'
              )
          );
          this.submitting = false;
          this._cdr.markForCheck();
        },
      });
  }

  cancel(): void {
    this._router.navigate(['/verwaltung/transfer-anfragen']);
  }
}
