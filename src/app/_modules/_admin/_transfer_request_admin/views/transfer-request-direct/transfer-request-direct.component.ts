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
import { Subject, takeUntil } from 'rxjs';
import {
  ClubService,
  NotificationService,
  TransferRequestService,
} from '@floorball/core';
import { PlayerSearchResult } from '@floorball/types';

@Component({
  templateUrl: './transfer-request-direct.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TransferRequestDirectComponent implements OnInit, OnDestroy {
  firstName = '';
  lastName = '';
  birthdate = '';

  clubs: { id: number; name: string }[] = [];
  selectedClubId = 0;

  foundPlayer: PlayerSearchResult | null = null;
  searchError = '';
  searching = false;
  submitting = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _transferService: TransferRequestService,
    private _clubService: ClubService,
    private _notificationService: NotificationService,
    private _router: Router,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Bewusst getAdminClubAll() und nicht getAdminClubs(): Der aufnehmende
    // Verein darf in jedem Landesverband liegen, zustimmen muss allein der
    // abgebende (siehe #sbk_may_assign? in der API). Die auf den eigenen
    // Zustaendigkeitsbereich eingegrenzte Liste hat einen SBK deshalb daran
    // gehindert, einen Spieler seines Spielbetriebs verbandsuebergreifend
    // zuzuweisen, obwohl die API es erlaubt haette.
    this._clubService
      .getAdminClubAll(true)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (clubs) => {
          this.clubs = clubs
            .map((c) => ({ id: c.id, name: c.name }))
            .sort((a, b) => a.name.localeCompare(b.name));
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

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // Die Suche wies bis api#597 JEDEN Spieler mit laufendem Vorgang ab. Seit sie
  // nur noch abweist, wenn gar keine Antragsart mehr geht, muss diese Maske den
  // laufenden Transfer selbst kennen: Sonst zeigt sie Treffer und Knopf, und
  // die Absage („Bitte zuerst annullieren") kommt erst nach dem Klick — also
  // genau die spaete Absage, die dieselbe Aenderung an der Antragsmaske
  // beseitigt.
  transferBlockedReason = '';

  search(): void {
    if (
      !this.firstName ||
      !this.lastName ||
      !this.birthdate ||
      !this.selectedClubId
    )
      return;

    this.searching = true;
    this.foundPlayer = null;
    this.searchError = '';
    this.transferBlockedReason = '';

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
          this.foundPlayer = result.player;
          // Die Direktzuweisung IST ein Transfer; eine laufende Freigabe steht
          // ihr nicht entgegen (sie endet mit dem Vollzug), ein laufender
          // Transfer und die Sperrfrist schon.
          this.transferBlockedReason = result.blocked_request_types?.includes(
            'transfer'
          )
            ? (result.blocked_request_reasons?.transfer ??
              this._transloco.translate(
                'transferRequestAdmin.direct.transferBlocked'
              ))
            : '';
          if (!result.player) {
            this.searchError = this._transloco.translate(
              'transferRequestAdmin.notifications.playerNotFound'
            );
          }
          this.searching = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.transferBlockedReason = '';
          this.searchError =
            (typeof err === 'string' ? err : err?.error?.error) ||
            this._transloco.translate(
              'transferRequestAdmin.notifications.searchError'
            );
          this.searching = false;
          this._cdr.markForCheck();
        },
      });
  }

  submit(): void {
    if (!this.foundPlayer || !this.selectedClubId) return;
    if (this.transferBlockedReason) return;

    this.submitting = true;
    this._transferService
      .directAssign(this.foundPlayer.id, this.selectedClubId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.submitting = false;
          this._notificationService.success(
            this._transloco.translate(
              'transferRequestAdmin.notifications.directAssignSuccess'
            )
          );
          this._router.navigate(['/verwaltung/transfer-anfragen']);
        },
        error: (err) => {
          this._notificationService.error(
            (typeof err === 'string' ? err : err?.error?.error) ||
              this._transloco.translate(
                'transferRequestAdmin.notifications.directAssignError'
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
