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
import { RefereeFeedbackService } from '@floorball/core';
import {
  RefereeFeedbackAnswers,
  RefereeFeedbackInvitation,
} from '@floorball/types';

/**
 * Abgabe des Schiri-Feedbacks über einen Einmal-Link, ohne Anmeldung. Gedacht
 * für Kapitän*innen und andere von der Mannschaft benannte Personen, die bewusst
 * kein Benutzerkonto bekommen.
 *
 * Der Token in der Adresse ist die einzige Berechtigung; die Seite zeigt nur die
 * Kopfdaten der einen Begegnung, für die der Link gilt.
 */
@Component({
  templateUrl: './referee-feedback-submit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeFeedbackSubmitComponent implements OnInit, OnDestroy {
  loading = true;
  submitting = false;
  /** Link unbekannt oder widerrufen (410 vom Server). */
  invalid = false;
  /** In dieser Sitzung erfolgreich abgegeben. */
  done = false;

  invitation?: RefereeFeedbackInvitation;
  errorMessage: string | null = null;

  private _token = '';
  private _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _feedbackService: RefereeFeedbackService,
    private _meta: Meta,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Persönlicher Link: gehört nicht in Suchmaschinen.
    this._meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });

    this._token = this._route.snapshot.paramMap.get('token') ?? '';
    this._load();
  }

  ngOnDestroy(): void {
    // Sonst bliebe das noindex für den Rest der Sitzung stehen, wenn die Person
    // von hier aus weiterklickt.
    this._meta.removeTag("name='robots'");
    this._destroy$.next();
    this._destroy$.complete();
  }

  submit(answers: RefereeFeedbackAnswers): void {
    this.submitting = true;
    this.errorMessage = null;
    this._feedbackService
      .submitInvitation(this._token, answers)
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
            err?.error?.error ??
            err?.error?.message ??
            'Das Feedback konnte nicht gespeichert werden.';
          this._cdr.markForCheck();
        },
      });
  }

  formatDate(iso?: string): string {
    if (!iso) return '';

    return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private _load(): void {
    if (!this._token) {
      this.loading = false;
      this.invalid = true;
      return;
    }

    this._feedbackService
      .getInvitation(this._token)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (invitation) => {
          this.invitation = invitation;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.invalid = true;
          this._cdr.markForCheck();
        },
      });
  }
}
