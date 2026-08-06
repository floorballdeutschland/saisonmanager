import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ApiKeyApplicationService } from '@floorball/core';
import { ApiKeyRevealState } from '@floorball/types';
import { API_RATE_LIMIT_PER_MINUTE } from '../../api-terms-version';

/**
 * Abholen des genehmigten API-Keys über den Einmal-Link aus der
 * Freigabe-Mail, ohne Anmeldung.
 *
 * Der Link wird beim Öffnen nur geprüft, nicht verbraucht: Mail-Programme und
 * Virenscanner rufen Links vorab ab und hätten die einmalige Anzeige sonst ins
 * Leere laufen lassen. Erst der bewusste Klick erzeugt den Key und zeigt ihn,
 * genau einmal, weil im System nur sein Prüfwert liegt.
 */
@Component({
  templateUrl: './api-access-key-reveal.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ApiAccessKeyRevealComponent implements OnInit, OnDestroy {
  /** Grenze, mit der der frisch abgeholte Key startet (§ 6.1). */
  readonly rateLimitPerMinute = API_RATE_LIMIT_PER_MINUTE;

  loading = true;
  revealing = false;
  state: ApiKeyRevealState = 'invalid';
  organisation: string | null = null;
  expiresAt: string | null = null;

  rawKey: string | null = null;
  keyName: string | null = null;
  copied = false;
  errorMessage: string | null = null;

  private _token = '';
  private _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _applicationService: ApiKeyApplicationService,
    private _meta: Meta,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Persönlicher Link mit einem Zugangsschlüssel dahinter: gehört unter keinen
    // Umständen in Suchmaschinen.
    this._meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });

    this._token = this._route.snapshot.queryParamMap.get('token') ?? '';
    this._check();
  }

  ngOnDestroy(): void {
    // Sonst bliebe das noindex für den Rest der Sitzung stehen.
    this._meta.removeTag("name='robots'");
    this._destroy$.next();
    this._destroy$.complete();
  }

  reveal(): void {
    if (this.revealing || this.state !== 'valid') return;

    this.revealing = true;
    this.errorMessage = null;
    this._applicationService
      .revealKey(this._token)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.rawKey = result.raw_key;
          this.keyName = result.name;
          this.revealing = false;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.revealing = false;
          this.state = 'invalid';
          this.errorMessage = err?.error?.message ?? null;
          this._cdr.markForCheck();
        },
      });
  }

  copyKey(): void {
    if (!this.rawKey || !navigator?.clipboard) return;

    navigator.clipboard.writeText(this.rawKey).then(() => {
      this.copied = true;
      this._cdr.markForCheck();
    });
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '';

    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private _check(): void {
    if (!this._token) {
      this.loading = false;
      this.state = 'invalid';
      return;
    }

    this._applicationService
      .checkRevealToken(this._token)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.state = result.state;
          this.organisation = result.organisation ?? null;
          this.expiresAt = result.expires_at ?? null;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.state = 'invalid';
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }
}
