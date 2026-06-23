import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, RefereeFeedbackService } from '@floorball/core';
import { RefereeFeedbackGame } from '@floorball/types';

interface FeedbackForm {
  lineRating: number | null;
  lineComment: string;
  communicationRating: number | null;
  communicationComment: string;
  generalComment: string;
}

@Component({
  templateUrl: './referee-feedback.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeFeedbackComponent implements OnInit, OnDestroy {
  games: RefereeFeedbackGame[] = [];
  loading = true;

  ratingScale = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Aktuell geöffnetes Formular (Spiel + Team) und dessen Eingaben.
  openKey: string | null = null;
  submittingKey: string | null = null;
  form: FeedbackForm = this._emptyForm();

  private _destroy$ = new Subject<void>();

  constructor(
    private _feedbackService: RefereeFeedbackService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  key(game: RefereeFeedbackGame): string {
    return `${game.game_id}:${game.team_id}`;
  }

  notYetFillable(game: RefereeFeedbackGame): boolean {
    return new Date(game.fillable_from).getTime() > Date.now();
  }

  open(game: RefereeFeedbackGame): void {
    this.openKey = this.key(game);
    this.form = this._emptyForm();
  }

  cancel(): void {
    this.openKey = null;
    this.form = this._emptyForm();
  }

  canSubmit(): boolean {
    return (
      this.form.lineRating !== null && this.form.communicationRating !== null
    );
  }

  submit(game: RefereeFeedbackGame): void {
    if (!this.canSubmit()) return;

    this.submittingKey = this.key(game);
    this._feedbackService
      .submit({
        game_id: game.game_id,
        team_id: game.team_id,
        line_rating: this.form.lineRating as number,
        line_comment: this.form.lineComment.trim() || undefined,
        communication_rating: this.form.communicationRating as number,
        communication_comment:
          this.form.communicationComment.trim() || undefined,
        general_comment: this.form.generalComment.trim() || undefined,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this.games = this.games.map((g) =>
            this.key(g) === this.key(game)
              ? { ...g, done: true, submitted_at: res.submitted_at }
              : g
          );
          this.submittingKey = null;
          this.openKey = null;
          this.form = this._emptyForm();
          this._cdr.markForCheck();
          this._notificationService.success(
            'Feedback abgegeben. Vielen Dank!',
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
        error: () => {
          this.submittingKey = null;
          this._cdr.markForCheck();
          this._notificationService.error('Speichern fehlgeschlagen.', {
            autoClose: false,
          });
        },
      });
  }

  formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private _emptyForm(): FeedbackForm {
    return {
      lineRating: null,
      lineComment: '',
      communicationRating: null,
      communicationComment: '',
      generalComment: '',
    };
  }

  private _load(): void {
    this._feedbackService
      .getMyFeedbacks()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (games) => {
          this.games = games;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }
}
