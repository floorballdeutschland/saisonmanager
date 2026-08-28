import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService, RefereeObservationService } from '@floorball/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  RefereeObservationAnswers,
  RefereeObservationCandidate,
} from '@floorball/types';
import {
  OBSERVATION_DIMENSIONS,
  OBSERVATION_RATING_SCALE,
  ObservationDimensionDefinition,
} from '../../observation-dimensions';

/**
 * Der Beobachtungsbogen selbst. Bildet das Microsoft-Formular ab: fünf
 * Bewertungsmatrizen (je Schiedsrichter 1, Schiedsrichter 2 und Gespann) mit
 * ihren Erläuterungen, dazu Spielbeschreibung, Sonstiges und abschließende
 * Bemerkungen.
 *
 * Die Kopfdaten des Formulars (Datum, Mannschaften, Liga, Gespann, Name und
 * Adresse des Coaches) werden nicht erfasst, sondern angezeigt: Sie stehen am
 * Spiel und am angemeldeten Konto.
 *
 * Bewertungen liegen nach Referee-PK im Hash, nicht nach Position im Array. Ein
 * vertauschter Index würde sonst die Bewertung der falschen Person speichern.
 */
@Component({
  templateUrl: './observation-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ObservationFormComponent implements OnInit {
  dimensions: ObservationDimensionDefinition[] = OBSERVATION_DIMENSIONS;
  scale = OBSERVATION_RATING_SCALE;
  /** Die Legende der Skala, 7 bis 1 – im Formular steht sie vor den Fragen. */
  scaleLegend = [7, 6, 5, 4, 3, 2, 1];
  legendOpen = false;

  candidate: RefereeObservationCandidate | null = null;
  loading = true;
  notAllowed = false;
  submitting = false;

  /** refereeId → dimensionKey → Note */
  refereeRatings: Record<number, Record<string, number>> = {};
  /** dimensionKey → Note des Gespanns */
  pairRatings: Record<string, number> = {};
  /** dimensionKey → Erläuterung; „overall" hat keine (siehe Dimensionsliste). */
  comments: Record<string, string> = {};
  matchDescription = '';
  otherMatters = '';
  finalComments = '';

  constructor(
    private _service: RefereeObservationService,
    private _route: ActivatedRoute,
    private _router: Router,
    private _notification: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const gameId = Number(this._route.snapshot.paramMap.get('gameId'));

    // Die Spielauswahl ist zugleich die Berechtigungsprüfung: Was die API hier
    // nicht listet, darf diese Person nicht beobachten.
    this._service.getObservableGames().subscribe({
      next: (candidates) => {
        const match = candidates.find((c) => c.game_id === gameId);
        if (!match || match.done) {
          this.notAllowed = true;
        } else {
          this.candidate = match;
          match.referees.forEach((r) => (this.refereeRatings[r.referee_id] = {}));
        }
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.notAllowed = true;
        this.loading = false;
        this._cdr.markForCheck();
      },
    });
  }

  setRefereeRating(
    refereeId: number,
    dimension: ObservationDimensionDefinition,
    value: number
  ): void {
    this.refereeRatings[refereeId][dimension.key] = value;
  }

  setPairRating(dimension: ObservationDimensionDefinition, value: number): void {
    this.pairRatings[dimension.key] = value;
  }

  /** Alle Bewertungen gesetzt und alle Pflichttexte gefüllt? */
  canSubmit(): boolean {
    if (!this.candidate) return false;

    const everyDimensionRated = this.dimensions.every(
      (dimension) =>
        this.pairRatings[dimension.key] !== undefined &&
        this.candidate!.referees.every(
          (referee) =>
            this.refereeRatings[referee.referee_id]?.[dimension.key] !== undefined
        )
    );
    if (!everyDimensionRated) return false;

    const commentsFilled = this.dimensions
      .filter((dimension) => dimension.commentKey)
      .every((dimension) => !!this.comments[dimension.key]?.trim());

    return (
      commentsFilled &&
      !!this.matchDescription.trim() &&
      !!this.otherMatters.trim() &&
      !!this.finalComments.trim()
    );
  }

  submit(): void {
    if (!this.candidate || !this.canSubmit() || this.submitting) return;

    this.submitting = true;
    this._service.submit(this._answers(this.candidate)).subscribe({
      next: () => {
        this._notification.success(
          this._transloco.translate('refereeObservation.form.saved'),
          { autoClose: true, keepAfterRouteChange: true }
        );
        this._router.navigate(['/schiedsrichter/meine-beobachtungen']);
      },
      // Der ErrorInterceptor zeigt den Fehler bereits an; hier wird nur die
      // Sperre gelöst, damit ein zweiter Versuch möglich bleibt.
      error: () => {
        this.submitting = false;
        this._cdr.markForCheck();
      },
    });
  }

  private _answers(
    candidate: RefereeObservationCandidate
  ): RefereeObservationAnswers {
    return {
      game_id: candidate.game_id,
      match_description: this.matchDescription.trim(),
      stick_play_comment: this.comments['stickPlay'].trim(),
      physical_play_comment: this.comments['physicalPlay'].trim(),
      penalty_line_comment: this.comments['penaltyLine'].trim(),
      game_management_comment: this.comments['gameManagement'].trim(),
      other_matters: this.otherMatters.trim(),
      final_comments: this.finalComments.trim(),
      pair_stick_play_rating: this.pairRatings['stickPlay'],
      pair_physical_play_rating: this.pairRatings['physicalPlay'],
      pair_penalty_line_rating: this.pairRatings['penaltyLine'],
      pair_game_management_rating: this.pairRatings['gameManagement'],
      pair_overall_rating: this.pairRatings['overall'],
      ratings: candidate.referees.map((referee) => {
        const ratings = this.refereeRatings[referee.referee_id];
        return {
          referee_id: referee.referee_id,
          stick_play_rating: ratings['stickPlay'],
          physical_play_rating: ratings['physicalPlay'],
          penalty_line_rating: ratings['penaltyLine'],
          game_management_rating: ratings['gameManagement'],
          overall_rating: ratings['overall'],
        };
      }),
    };
  }

  formatDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
