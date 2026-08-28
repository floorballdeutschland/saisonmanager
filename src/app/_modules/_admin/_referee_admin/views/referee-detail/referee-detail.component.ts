import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import {
  NotificationService,
  RefereeObservationService,
  RefereeService,
  SessionService,
} from '@floorball/core';
import {
  ExclusionClub,
  RefereeAdmin,
  RefereeAdminGame,
  RefereeClubExclusion,
  RefereeClubExclusionPayload,
  RefereeClubExclusionRequest,
  RefereeFeedbackProfileResponse,
  RefereeObservationAdminResponse,
} from '@floorball/types';
import { OBSERVATION_DIMENSIONS } from '@floorball/referee-observation';

/**
 * Erst ab dieser Anzahl sichtbarer Rückmeldungen werden die Durchschnitte am
 * Profil gezeigt. Bei wenigen Rückmeldungen ist der Mittelwert nicht belastbar.
 */
const MIN_FEEDBACK_COUNT = 5;

@Component({
  templateUrl: './referee-detail.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeDetailComponent implements OnInit, OnDestroy {
  referee?: RefereeAdmin;
  games: RefereeAdminGame[] = [];
  loading = false;
  gamesLoading = false;
  selectedSeasonId?: number;

  canViewFeedback = false;
  feedback?: RefereeFeedbackProfileResponse;
  feedbackLoading = false;
  readonly minFeedbackCount = MIN_FEEDBACK_COUNT;

  // Beobachtungen der Schiedsrichtercoaches. Anders als beim Vereins-Feedback
  // stehen hier die vollständigen Bögen und kein Aggregat allein: Eine
  // Beobachtung ist Entwicklungsarbeit an einer Person, ein Mittelwert daraus
  // wäre die uninteressanteste Hälfte.
  canViewObservations = false;
  // Zurücknehmen ist ein eigenes Recht (Admin und Schiedsrichterkommission).
  // Die Ansetzung liest die Bögen, greift aber nicht in sie ein; hinge der
  // Knopf am Leserecht, stünde er auch bei ihr in der Maske und liefe beim
  // Klick in eine Absage.
  canModerateObservations = false;
  observations?: RefereeObservationAdminResponse;
  observationsLoading = false;
  observationsFailed = false;
  observationDimensions = OBSERVATION_DIMENSIONS;

  // Vereins-Ausschlussliste: nur für die Ansetzung sichtbar und pflegbar.
  canManageExclusions = false;
  exclusions: RefereeClubExclusion[] = [];
  exclusionRequests: RefereeClubExclusionRequest[] = [];
  exclusionClubs: ExclusionClub[] = [];
  newExclusion: { club_id: number | null; reason: string } = {
    club_id: null,
    reason: '',
  };
  showExclusionForm = false;
  exclusionBusy = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _observationService: RefereeObservationService,
    private _route: ActivatedRoute,
    private _notificationService: NotificationService,
    private _transloco: TranslocoService,
    private _sessionService: SessionService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._sessionService.currentUser$
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (user) => {
          this.canViewFeedback = !!user?.permissions['referee_feedback_view'];
          this.canViewObservations =
            !!user?.permissions['referee_observation_view'];
          this.canModerateObservations =
            !!user?.permissions['referee_observation_moderate'];
          this.canManageExclusions =
            !!user?.permissions['menu_item_referee_exclusions'];
          this._maybeLoadFeedback();
          this._maybeLoadObservations();
          this._maybeLoadExclusions();
          this._cdr.markForCheck();
        },
      });

    const param = this._route.snapshot.params['lizenznummer'] as string;
    this.loading = true;

    if (param.startsWith('G-')) {
      // Guest referee: look up directly by DB id
      const id = parseInt(param.slice(2), 10);
      this._refereeService
        .adminGetById(id)
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (r) => {
            this.referee = r;
            this.loading = false;
            this._cdr.markForCheck();
            this.loadGames(r.id);
            this._maybeLoadFeedback();
            this._maybeLoadObservations();
            this._maybeLoadExclusions();
          },
          error: () => this._handleLoadError(),
        });
    } else {
      const lizenznummer = parseInt(param, 10);
      this._refereeService
        .adminGetAll({ q: String(lizenznummer) })
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (results) => {
            const match = results.find((r) => r.lizenznummer === lizenznummer);
            if (match) {
              this._refereeService
                .adminGetById(match.id)
                .pipe(takeUntil(this._destroy$))
                .subscribe({
                  next: (r) => {
                    this.referee = r;
                    this.loading = false;
                    this._cdr.markForCheck();
                    this.loadGames(r.id);
                    this._maybeLoadFeedback();
                    this._maybeLoadObservations();
                    this._maybeLoadExclusions();
                  },
                  error: () => this._handleLoadError(),
                });
            } else {
              this.loading = false;
              this._cdr.markForCheck();
            }
          },
          error: () => this._handleLoadError(),
        });
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  // Direktlink zur (öffentlichen) Spielseite: /:association/:leagueId/spiel/:matchId.
  // Gleiches Muster wie in "Meine Historie" (referee-history.component.ts), damit
  // die RSK-Sicht auf einen Schiedsrichter dieselben Wege anbietet wie seine eigene.
  // Altdaten-Spiele ohne Verband-Slug oder Liga-ID bleiben ohne Link, statt auf
  // eine unvollständige Route zu zeigen.
  matchLink(game: RefereeAdminGame): (string | number)[] | null {
    if (!game.game_operation_slug || !game.league_id) return null;
    return ['/', game.game_operation_slug, game.league_id, 'spiel', game.id];
  }

  loadGames(id: number): void {
    this.gamesLoading = true;
    this._refereeService
      .adminGetGames(id, this.selectedSeasonId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.games = result;
          this.gamesLoading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.gamesLoading = false;
          this._cdr.markForCheck();
        },
      });
  }

  // Lädt das Schiri-Feedback, sobald Berechtigung und Schiri-Datensatz vorliegen.
  private _maybeLoadFeedback(): void {
    if (
      !this.canViewFeedback ||
      !this.referee ||
      this.feedback ||
      this.feedbackLoading
    )
      return;

    this.feedbackLoading = true;
    this._refereeService
      .adminGetFeedbacks(this.referee.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.feedback = result;
          this.feedbackLoading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.feedbackLoading = false;
          this._cdr.markForCheck();
        },
      });
  }

  // Lädt die Beobachtungen, sobald Berechtigung und Schiri-Datensatz vorliegen.
  private _maybeLoadObservations(): void {
    if (
      !this.canViewObservations ||
      !this.referee ||
      this.observations ||
      this.observationsLoading
    )
      return;

    this.observationsLoading = true;
    this._observationService
      .adminGetForReferee(this.referee.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.observations = result;
          this.observationsLoading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.observationsFailed = true;
          this.observationsLoading = false;
          this._cdr.markForCheck();
        },
      });
  }

  /**
   * Einen Bogen zurücknehmen oder wieder sichtbar machen. Der Notausgang für
   * eine entgleiste Rückmeldung; die beobachtete Person sieht den Text sofort
   * nach dem Absenden, deshalb braucht es einen Weg zurück. Inhalte bleiben
   * unveränderlich.
   */
  toggleObservationStatus(observationId: number, hide: boolean): void {
    this._observationService
      .adminSetStatus(observationId, hide ? 'hidden' : 'visible')
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          const entry = this.observations?.observations.find(
            (o) => o.id === observationId
          );
          if (entry) entry.status = hide ? 'hidden' : 'visible';
          this._cdr.markForCheck();
        },
      });
  }

  averageObservationRating(key: string): string {
    const summary = this.observations?.summary as
      | Record<string, number | null>
      | undefined;
    const value = summary?.[key];
    return value === null || value === undefined ? '–' : String(value);
  }

  // Lädt die Ausschlussliste, sobald Berechtigung und Schiri-Datensatz vorliegen.
  private _maybeLoadExclusions(): void {
    if (!this.canManageExclusions || !this.referee) return;

    this._refereeService
      .adminGetRefereeClubExclusions(this.referee.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (payload) => this._applyExclusionPayload(payload),
      });
  }

  get openExclusionRequests(): RefereeClubExclusionRequest[] {
    return this.exclusionRequests.filter((r) => r.status === 'pending');
  }

  // Vereine, die noch nicht auf der Liste stehen. Die Referenz bleibt bei
  // unveränderter Auswahl gleich, sonst würde das Suchfeld seine Trefferliste
  // bei jeder Change-Detection neu aufbauen.
  get selectableExclusionClubs(): ExclusionClub[] {
    const listed = new Set(this.exclusions.map((e) => e.club_id));
    const next = this.exclusionClubs.filter((c) => !listed.has(c.id));
    const cache = this._selectableExclusionClubsCache;
    if (
      next.length !== cache.length ||
      next.some((c, i) => c.id !== cache[i].id)
    ) {
      this._selectableExclusionClubsCache = next;
    }
    return this._selectableExclusionClubsCache;
  }

  private _selectableExclusionClubsCache: ExclusionClub[] = [];

  toggleExclusionForm(): void {
    this.showExclusionForm = !this.showExclusionForm;
    if (this.showExclusionForm && this.exclusionClubs.length === 0) {
      this._refereeService
        .adminGetExclusionClubs()
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: (clubs) => {
            this.exclusionClubs = clubs;
            this._cdr.markForCheck();
          },
        });
    }
  }

  addExclusion(): void {
    if (!this.referee || !this.newExclusion.club_id) return;

    this.exclusionBusy = true;
    this._refereeService
      .adminCreateRefereeClubExclusion(this.referee.id, {
        club_id: this.newExclusion.club_id,
        reason: this.newExclusion.reason.trim(),
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (payload) => {
          this._applyExclusionPayload(payload);
          this.newExclusion = { club_id: null, reason: '' };
          this.showExclusionForm = false;
          this.exclusionBusy = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.exclusionBusy = false;
          this._cdr.markForCheck();
        },
      });
  }

  removeExclusion(entry: RefereeClubExclusion): void {
    if (!this.referee || entry.id == null) return;

    this.exclusionBusy = true;
    this._refereeService
      .adminDeleteRefereeClubExclusion(this.referee.id, entry.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (payload) => {
          this._applyExclusionPayload(payload);
          this.exclusionBusy = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.exclusionBusy = false;
          this._cdr.markForCheck();
        },
      });
  }

  private _applyExclusionPayload(payload: RefereeClubExclusionPayload): void {
    this.exclusions = payload.club_exclusions;
    this.exclusionRequests = payload.club_exclusion_requests;
    this._cdr.markForCheck();
  }

  get detailRouteId(): string | number {
    return this.referee?.guest
      ? (this.referee.lizenznummer_display ?? this.referee.id)
      : (this.referee?.lizenznummer ?? '');
  }

  get isActive(): boolean {
    if (!this.referee?.gueltigkeit) return false;
    const parts = this.referee.gueltigkeit.split('.');
    if (parts.length !== 3) return false;
    // End of the expiry day so license is valid the entire last day
    const date = new Date(+parts[2], +parts[1] - 1, +parts[0], 23, 59, 59);
    return date >= new Date();
  }

  private _handleLoadError(): void {
    this.loading = false;
    this._cdr.markForCheck();
    this._notificationService.error(
      this._transloco.translate('refereeAdmin.notifications.detailLoadError'),
      {
        autoClose: false,
        keepAfterRouteChange: false,
      }
    );
  }
}
