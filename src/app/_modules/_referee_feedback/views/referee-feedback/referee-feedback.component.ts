import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  LOCALE_ID,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, RefereeFeedbackService } from '@floorball/core';
import {
  RefereeFeedbackAnswers,
  RefereeFeedbackGame,
  RefereeFeedbackTeamSettings,
} from '@floorball/types';

@Component({
  templateUrl: './referee-feedback.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeFeedbackComponent implements OnInit, OnDestroy {
  games: RefereeFeedbackGame[] = [];
  loading = true;

  // Einstellung je Mannschaft, wer das Feedback abgibt. Die Werte hängen an der
  // Mannschaft, nicht am Konto: Mehrere Teammanager sehen denselben Eintrag.
  settings: RefereeFeedbackTeamSettings[] = [];
  savingTeamId: number | null = null;

  // Aktuell geöffnetes Formular (Spiel + Team).
  openKey: string | null = null;
  submittingKey: string | null = null;

  private _destroy$ = new Subject<void>();

  constructor(
    private _feedbackService: RefereeFeedbackService,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef,
    @Inject(LOCALE_ID) private _locale: string
  ) {}

  ngOnInit(): void {
    this._load();
    this._loadSettings();
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
  }

  cancel(): void {
    this.openKey = null;
  }

  submit(game: RefereeFeedbackGame, answers: RefereeFeedbackAnswers): void {
    this.submittingKey = this.key(game);
    this._feedbackService
      .submit({
        game_id: game.game_id,
        team_id: game.team_id,
        ...answers,
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
          this._cdr.markForCheck();
          this._notificationService.success(
            this._transloco.translate(
              'refereeFeedback.notifications.submitSuccess'
            ),
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
        error: () => {
          this.submittingKey = null;
          this._cdr.markForCheck();
          this._notificationService.error(
            this._transloco.translate(
              'refereeFeedback.notifications.submitError'
            ),
            {
              autoClose: false,
            }
          );
        },
      });
  }

  saveSetting(setting: RefereeFeedbackTeamSettings): void {
    this.savingTeamId = setting.team_id;
    this._feedbackService
      .updateSettings(setting.team_id, {
        feedback_contact_email: (setting.feedback_contact_email ?? '').trim(),
        feedback_contact_prefer_captain:
          setting.feedback_contact_prefer_captain,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (updated) => {
          this.settings = this.settings.map((s) =>
            s.team_id === updated.team_id ? updated : s
          );
          this.savingTeamId = null;
          this._cdr.markForCheck();
          this._notificationService.success(
            this._transloco.translate(
              'refereeFeedback.notifications.settingSaved'
            ),
            {
              autoClose: true,
              keepAfterRouteChange: false,
            }
          );
        },
        error: () => {
          this.savingTeamId = null;
          this._cdr.markForCheck();
        },
      });
  }

  formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(this._locale, {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(this._locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  private _loadSettings(): void {
    this._feedbackService
      .getSettings()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (settings) => {
          this.settings = settings;
          this._cdr.markForCheck();
        },
        // Der ErrorInterceptor meldet den Fehler schon; ohne eigenen Handler
        // würde RxJS ihn zusätzlich als unbehandelt weiterwerfen und daraus in
        // Sentry ein Crash-Issue machen.
        error: () => {
          this._cdr.markForCheck();
        },
      });
  }
}
