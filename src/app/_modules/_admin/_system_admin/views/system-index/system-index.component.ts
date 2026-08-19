import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import {
  BlockedIp,
  NotificationService,
  SystemHealthData,
  SystemHealthService,
  SystemHealthStatus,
} from '@floorball/core';

@Component({
  templateUrl: './system-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SystemIndexComponent implements OnInit, OnDestroy {
  loading = false;
  data: SystemHealthData | null = null;
  loadError: string | null = null;

  // Sperrliste. Getrennt vom Rest geladen, damit ein Fehler dort nicht die
  // Kennzahlen mitnimmt und umgekehrt.
  blockedIps: BlockedIp[] = [];
  blockedIpsLoadFailed = false;
  newIp = '';
  newReason = '';
  savingBlock = false;
  blockError: string | null = null;

  private _destroy$ = new Subject<void>();

  constructor(
    private _systemHealthService: SystemHealthService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get canSubmitBlock(): boolean {
    return !!this.newIp.trim() && !!this.newReason.trim() && !this.savingBlock;
  }

  loadBlockedIps(): void {
    this.blockedIpsLoadFailed = false;
    this._systemHealthService
      .getBlockedIps()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.blockedIps = result;
          this._cdr.markForCheck();
        },
        error: () => {
          // Ein Ladefehler darf nicht wie eine leere Sperrliste aussehen.
          this.blockedIpsLoadFailed = true;
          this._cdr.markForCheck();
        },
      });
  }

  addBlockedIp(): void {
    if (!this.canSubmitBlock) return;

    this.savingBlock = true;
    this.blockError = null;
    this._systemHealthService
      .createBlockedIp(this.newIp.trim(), this.newReason.trim())
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (created) => {
          // Ohne das Zuruecksetzen bliebe nach einem vorherigen Ladefehler die
          // Fehlermeldung stehen und die neue Zeile unsichtbar: Der Admin sieht
          // den Erfolgs-Toast, aber keinen Eintrag, und traegt erneut ein.
          this.blockedIpsLoadFailed = false;
          this.blockedIps = [created, ...this.blockedIps];
          this.newIp = '';
          this.newReason = '';
          this.savingBlock = false;
          this._notificationService.success(
            this._transloco.translate('system.blockedIps.added'),
            { autoClose: true, keepAfterRouteChange: false }
          );
          this._cdr.markForCheck();
        },
        error: (err) => {
          // Die Serverantwort nennt den Grund (unsinnige Adresse, eigenes Netz,
          // schon gesperrt) – die gehört an das Formular, nicht in einen Toast,
          // der beim nächsten Klick weg ist.
          this.blockError =
            err?.error?.errors?.join(' ') ??
            this._transloco.translate('system.blockedIps.addError');
          this.savingBlock = false;
          this._cdr.markForCheck();
        },
      });
  }

  removeBlockedIp(blocked: BlockedIp): void {
    if (
      !confirm(
        this._transloco.translate('system.blockedIps.removeConfirm', {
          ip: blocked.ip,
        })
      )
    ) {
      return;
    }

    this._systemHealthService
      .deleteBlockedIp(blocked.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.blockedIps = this.blockedIps.filter((b) => b.id !== blocked.id);
          this._notificationService.success(
            this._transloco.translate('system.blockedIps.removed'),
            { autoClose: true, keepAfterRouteChange: false }
          );
          this._cdr.markForCheck();
        },
        error: () => {
          // Die Meldung zeigt der ErrorInterceptor. Wichtig ist hier, dass die
          // Tabelle danach nicht weiter eine Sperre behauptet, die der Server
          // vielleicht gar nicht mehr kennt — also den echten Stand nachziehen.
          this.loadBlockedIps();
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    // Auch die Sperrliste: "Aktualisieren" im Kopf soll die ganze Seite frisch
    // holen. Sonst zeigt die Tabelle nach dem Klick unveraendert den alten
    // Stand, ohne Hinweis darauf, dass dieser Knopf sie nicht betrifft.
    this.loadBlockedIps();
    this.loading = true;
    this.loadError = null;
    this._systemHealthService
      .getSystemHealth()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.data = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          console.error('[SystemIndexComponent] Laden fehlgeschlagen', err);
          this.loadError = this._transloco.translate(
            'system.notifications.loadError'
          );
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  // Basis 1024 wie `df` auf dem Server, damit die Zahlen zu denen dort passen.
  formatBytes(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined) {
      return this._transloco.translate('system.unknown');
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }

    const digits = unit === 0 ? 0 : 1;
    return `${value.toFixed(digits).replace('.', ',')} ${units[unit]}`;
  }

  statusClass(status: SystemHealthStatus | undefined): string {
    switch (status) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'ok':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-fb-gray-800 text-fb-gray-500 border-fb-gray-600';
    }
  }

  barClass(status: SystemHealthStatus | undefined): string {
    switch (status) {
      case 'critical':
        return 'bg-red-600';
      case 'warning':
        return 'bg-amber-500';
      case 'ok':
        return 'bg-green-600';
      default:
        return 'bg-fb-gray-600';
    }
  }

  // Die Schwellen kommen aus der Antwort, damit der Verlauf dieselben Grenzen
  // einfärbt wie die Ampel darüber und nicht eigene Zahlen mitführt.
  statusForPercent(percent: number): SystemHealthStatus {
    const thresholds = this.data?.thresholds;
    if (!thresholds) return 'unknown';
    if (percent >= thresholds.critical_percent) return 'critical';
    if (percent >= thresholds.warning_percent) return 'warning';
    return 'ok';
  }

  statusLabel(status: SystemHealthStatus | undefined): string {
    return this._transloco.translate(`system.status.${status ?? 'unknown'}`);
  }

  // Die Prognose ist bewusst grob. Ab zwei Jahren ist die Monatszahl keine
  // brauchbare Aussage mehr, dann steht dort nur noch die Größenordnung.
  get forecastLabel(): string {
    const months = this.data?.growth.months_until_full;
    if (months === null || months === undefined) {
      return this._transloco.translate('system.growth.forecastUnknown');
    }
    if (months >= 24) {
      return this._transloco.translate('system.growth.forecastYears', {
        years: Math.floor(months / 12),
      });
    }
    return this._transloco.translate('system.growth.forecastMonths', {
      months,
    });
  }

  get maxMonthlyBytes(): number {
    const months = this.data?.growth.months ?? [];
    return Math.max(...months.map((m) => m.total_bytes), 1);
  }

  monthlyWidth(bytes: number): number {
    return (bytes / this.maxMonthlyBytes) * 100;
  }

  formatMonth(monthStr: string): string {
    const [year, month] = monthStr.split('-');
    const name = this._transloco.translate(
      `system.months.${parseInt(month, 10)}`
    );
    return `${name} ${year.slice(2)}`;
  }

  // record_type + name sind die Rohbezeichnungen aus dem Datenmodell. Für die
  // bekannten Fälle gibt es einen lesbaren Namen, alles andere zeigt das Rohe,
  // damit ein neuer Anhang-Typ nicht als Leerstelle erscheint.
  kindLabel(recordType: string, name: string): string {
    const key = `system.uploads.kinds.${recordType}_${name}`;
    const label = this._transloco.translate(key);
    return label === key ? `${recordType} / ${name}` : label;
  }
}
