import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, TransferRequestService } from '@floorball/core';
import { TransferRequest } from '@floorball/types';
import {
  exportTransferCsv,
  transferStatusClass,
  transferStatusLabel,
  transferTypeClass,
  transferTypeLabel,
} from '../../transfer-request-presentation';

/**
 * Eingehende Transfers und Freigaben: abgeschlossene Vorgaenge, die eine Person
 * von einem Verein ausserhalb in einen Verein des eigenen Landesverbands
 * gebracht haben.
 *
 * Bewusst eine eigene Ansicht neben der Hauptliste, denn hier sind Sichtbarkeit
 * und Zustaendigkeit zwei verschiedene Dinge: Ueber den Vorgang entscheidet der
 * abgebende Landesverband, und daran haengen serverseitig alle Aktionen. Diese
 * Liste ist reine Auskunft und deshalb ohne Aktionen -- auch ohne den Sprung in
 * die Antragsdetails, in denen die Knoepfe des zustaendigen Verbands stehen
 * (der Einzelabruf antwortet dort mit 403).
 */
@Component({
  templateUrl: './transfer-request-incoming.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TransferRequestIncomingComponent implements OnInit, OnDestroy {
  requests: TransferRequest[] = [];
  loading = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _transferService: TransferRequestService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  /**
   * Vergangene Saisons sind standardmäßig ausgeblendet. Der Saisonwechsel räumt
   * die Vorgänge nicht ab — ohne diesen Riegel wüchse die Liste über die Jahre
   * unbegrenzt, und die laufende Saison stünde zwischen Altbestand.
   *
   * Ausgeblendet, nicht weggeworfen: Der Landesverband stellt seine Gebühren
   * für erteilte Freigaben am Saisonende und braucht die Vorsaison dafür
   * vollständig.
   */
  allSeasons = false;

  ngOnInit(): void {
    this.load();
  }

  toggleAllSeasons(): void {
    this.allSeasons = !this.allSeasons;
    this.load();
  }

  private load(): void {
    this.loading = true;
    this._cdr.markForCheck();
    this._transferService
      .getIncoming(this.allSeasons)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.requests = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this._notificationService.error(
            this._transloco.translate(
              'transferRequestAdmin.notifications.loadError'
            )
          );
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  statusLabel(status: string): string {
    return transferStatusLabel(this._transloco, status);
  }

  statusClass(status: string): string {
    return transferStatusClass(status);
  }

  typeLabel(r: TransferRequest): string {
    return transferTypeLabel(this._transloco, r);
  }

  typeClass(r: TransferRequest): string {
    return transferTypeClass(r);
  }

  // Alle angezeigten Zeilen, nicht nur die genehmigten: Die Liste enthaelt
  // ohnehin nur abgeschlossene Vorgaenge, und ein beschlossener Transfer mit
  // noch offenem Wirksamkeitsdatum gehoert in die Ausfuhr.
  exportCsv(): void {
    exportTransferCsv(this._transloco, 'eingehende-transfers', this.requests);
  }
}
