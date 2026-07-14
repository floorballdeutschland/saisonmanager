import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import QRCode from 'qrcode';
import { TranslocoService } from '@jsverse/transloco';
import { NotificationService, RefereeService } from '@floorball/core';
import { RefereeProfile } from '@floorball/types';

@Component({
  templateUrl: './referee-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeCardComponent implements OnInit, OnDestroy {
  // Feste öffentliche Lizenzcheck-URL. Der QR-Code muss immer auf die
  // produktive, öffentlich erreichbare Domain zeigen – unabhängig davon, wo
  // der Ausweis gerade angezeigt wird (z. B. lokal). Daher bewusst hartkodiert
  // und nicht aus window.location/environment abgeleitet.
  private static readonly LIZENZCHECK_BASE_URL =
    'https://saisonmanager.de/lizenzcheck';

  profile?: RefereeProfile;
  qrDataUrl?: string;
  loading = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef,
    private _title: Title
  ) {
    this._title.setTitle(
      this._transloco.translate('refereeSelf.card.pageTitle')
    );
  }

  ngOnInit(): void {
    this.loading = true;
    this._refereeService
      .getProfile()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (p) => {
          this.profile = p;
          this.loading = false;
          this._generateQrCode(p);
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate(
              'refereeSelf.notifications.cardLoadError'
            ),
            { autoClose: false, keepAfterRouteChange: false }
          );
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  get expired(): boolean {
    const date = this.profile?.gueltigkeit;
    if (!date) return true;
    const [day, month, year] = date.split('.');
    const parsed = new Date(+year, +month - 1, +day);
    // Bei unerwartetem/unparsebarem Format sicherheitshalber „abgelaufen"
    // anzeigen, statt fälschlich „gültig" (grün) auszugeben.
    if (isNaN(parsed.getTime())) return true;
    return parsed < new Date();
  }

  private _generateQrCode(profile: RefereeProfile): void {
    if (!profile.lizenznummer) return;
    const url = `${RefereeCardComponent.LIZENZCHECK_BASE_URL}?q=${profile.lizenznummer}`;
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 320 })
      .then((dataUrl) => {
        this.qrDataUrl = dataUrl;
        this._cdr.markForCheck();
      })
      .catch((err) => {
        // QR-Code ist nice-to-have; ohne ihn bleibt der Ausweis nutzbar. Den
        // Fehler dennoch loggen, damit ein systematischer Ausfall (z. B. eine
        // Bundling-Regression der qrcode-Lib) sichtbar wird statt still für
        // alle Nutzer zu verschwinden.
        console.error('QR-Code konnte nicht erzeugt werden', err);
      });
  }
}
