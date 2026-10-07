import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import {
  RefereeFeedbackService,
  RefereeObservationService,
} from '@floorball/core';
import {
  RefereeFeedbackOwnSummary,
  RefereeObservation,
} from '@floorball/types';

/**
 * „Mein Feedback" aus Sicht der bewerteten Person, in zwei Abschnitten:
 *
 * - Beobachtungen: die vollständigen Bögen der Schiedsrichtercoaches.
 *   Zurückgenommene Bögen liefert die API nicht aus.
 * - Team-Feedback: nur die Kennzahlen (Anzahl und zwei
 *   Durchschnitte), und die Durchschnitte erst ab der Mindestzahl, die die API
 *   vorgibt. Einzelne Rückmeldungen, Freitexte und Mannschaften bleiben der
 *   Schiedsrichterverwaltung vorbehalten.
 *
 * Beide Abschnitte laden unabhängig voneinander, damit ein Fehler im einen den
 * anderen nicht mitnimmt.
 */
@Component({
  templateUrl: './observation-received.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ObservationReceivedComponent implements OnInit {
  observations: RefereeObservation[] = [];
  loading = true;
  failed = false;

  teamSummary?: RefereeFeedbackOwnSummary;
  teamLoading = true;
  teamFailed = false;

  constructor(
    private _service: RefereeObservationService,
    private _feedbackService: RefereeFeedbackService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._service.getReceived().subscribe({
      next: (observations) => {
        this.observations = observations;
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.failed = true;
        this.loading = false;
        this._cdr.markForCheck();
      },
    });

    this._feedbackService.getOwnSummary().subscribe({
      next: (summary) => {
        this.teamSummary = summary;
        this.teamLoading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.teamFailed = true;
        this.teamLoading = false;
        this._cdr.markForCheck();
      },
    });
  }

  /** Durchschnitte nur, wenn die API sie geliefert hat (ab der Mindestzahl). */
  get hasTeamAverages(): boolean {
    const summary = this.teamSummary;
    return (
      !!summary &&
      summary.count >= summary.min_count &&
      summary.avg_line_rating !== null &&
      summary.avg_communication_rating !== null
    );
  }
}
