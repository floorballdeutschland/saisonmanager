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
import { ApiKeyApplicationService } from '@floorball/core';

/** Kommerziell oder nicht: Die Antwort entscheidet, ob es überhaupt weitergeht. */
type Intent = 'non_commercial' | 'commercial';

/**
 * Öffentlicher Antrag auf einen API-Zugang, ohne Anmeldung.
 *
 * Vor dem Formular steht die Frage nach dem kommerziellen Charakter des
 * Vorhabens. Bei „kommerziell" endet der Weg hier mit dem Verweis auf eine
 * individuelle Absprache; es wird nichts abgesendet. Der Server prüft das
 * ebenfalls, die Weiche ist also keine Zugangssicherung, sondern erspart
 * aussichtslose Anträge.
 */
@Component({
  templateUrl: './api-access-request.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ApiAccessRequestComponent implements OnInit, OnDestroy {
  intent: Intent | null = null;

  organisation = '';
  contactName = '';
  email = '';
  address = '';
  projectDescription = '';
  purpose = '';
  projectUrl = '';
  acceptTerms = false;

  submitting = false;
  done = false;
  errorMessage: string | null = null;

  /**
   * Fassung der Vereinbarung, der zugestimmt wird. Kommt vom Server, damit die
   * Angabe im Antrag nicht an einem veralteten Frontend hängt.
   */
  private _termsVersion: string | null = null;

  private _destroy$ = new Subject<void>();

  constructor(
    private _applicationService: ApiKeyApplicationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._applicationService
      .getTermsVersion()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this._termsVersion = result.version;
          this._cdr.markForCheck();
        },
        // Ohne Fassung lässt sich nicht zustimmen: Der Absende-Knopf bleibt
        // gesperrt und der Hinweis unter dem Formular nennt den Grund.
        error: () => {
          this._termsVersion = null;
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  chooseIntent(intent: Intent): void {
    this.intent = intent;
    this.errorMessage = null;
    this._cdr.markForCheck();
  }

  get isCommercial(): boolean {
    return this.intent === 'commercial';
  }

  get showForm(): boolean {
    return this.intent === 'non_commercial' && !this.done;
  }

  get termsVersion(): string | null {
    return this._termsVersion;
  }

  canSubmit(): boolean {
    return (
      // Die Weiche gehört in die Bedingung und nicht nur ins Template: Sonst
      // würde ein Absenden nach der Auswahl „kommerziell" durchlaufen, obwohl
      // das Formular dafür gar nicht gedacht ist.
      this.intent === 'non_commercial' &&
      !this.submitting &&
      !!this._termsVersion &&
      this.acceptTerms &&
      this.organisation.trim().length > 0 &&
      this.contactName.trim().length > 0 &&
      this.email.trim().length > 0 &&
      this.projectDescription.trim().length > 0 &&
      this.purpose.trim().length > 0
    );
  }

  submit(): void {
    if (!this.canSubmit() || !this._termsVersion) return;

    this.submitting = true;
    this.errorMessage = null;

    this._applicationService
      .submit({
        accept_terms: true,
        commercial: false,
        organisation: this.organisation.trim(),
        contact_name: this.contactName.trim(),
        email: this.email.trim(),
        address: this.address.trim(),
        project_description: this.projectDescription.trim(),
        purpose: this.purpose.trim(),
        project_url: this.projectUrl.trim(),
        terms_version: this._termsVersion,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.submitting = false;
          this.done = true;
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.submitting = false;
          this.errorMessage =
            err?.error?.errors?.join(' ') ??
            err?.error?.message ??
            this._transloco.translate('apiAccess.form.genericError');
          this._cdr.markForCheck();
        },
      });
  }
}
