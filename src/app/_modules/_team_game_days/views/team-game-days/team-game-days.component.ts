import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, TeamService } from '@floorball/core';
import { TeamGameDay, TeamGameDayTeam } from '@floorball/types';

@Component({
  templateUrl: './team-game-days.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TeamGameDaysComponent implements OnInit, OnDestroy {
  gameDays: TeamGameDay[] = [];
  loading = true;

  // Aktuell speichernde / im "Nicht ordnungsgemäß"-Flow befindliche Mannschaft,
  // identifiziert über die Kombination Spieltag + Team ("<gameDayId>:<teamId>").
  confirmingKey: string | null = null;
  rejectingKey: string | null = null;
  rejectAnswers: Record<number, boolean | null> = {};

  private _destroy$ = new Subject<void>();

  constructor(
    private _teamService: TeamService,
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

  key(gd: TeamGameDay, team: TeamGameDayTeam): string {
    return `${gd.id}:${team.team_id}`;
  }

  /** Aktion nötig: Checkliste existiert, Team noch nicht bestätigt und nicht auto-bestätigt. */
  needsAction(gd: TeamGameDay, team: TeamGameDayTeam): boolean {
    return gd.checklist_required && !team.confirmed_at && !gd.auto_confirmed;
  }

  canConfirm(gd: TeamGameDay, team: TeamGameDayTeam): boolean {
    return this.needsAction(gd, team) && !this.notYetConfirmable(gd);
  }

  notYetConfirmable(gd: TeamGameDay): boolean {
    if (!gd.confirmable_from) return false;
    return new Date(gd.confirmable_from).getTime() > Date.now();
  }

  statusFor(gd: TeamGameDay, team: TeamGameDayTeam): string {
    if (team.confirmed_at) {
      return team.properly_conducted === false ? 'not_ok' : 'confirmed';
    }
    if (gd.auto_confirmed) return 'auto';
    return 'pending';
  }

  startReject(gd: TeamGameDay, team: TeamGameDayTeam): void {
    this.rejectingKey = this.key(gd, team);
    this.rejectAnswers = {};
    gd.checklist_items.forEach((i) => (this.rejectAnswers[i.id] = null));
  }

  cancelReject(): void {
    this.rejectingKey = null;
    this.rejectAnswers = {};
  }

  setAnswer(itemId: number, value: boolean): void {
    this.rejectAnswers[itemId] = value;
  }

  allAnswered(gd: TeamGameDay): boolean {
    return gd.checklist_items.every(
      (i) =>
        this.rejectAnswers[i.id] === true || this.rejectAnswers[i.id] === false
    );
  }

  confirmOk(gd: TeamGameDay, team: TeamGameDayTeam): void {
    this._submit(gd, team, true);
  }

  submitNotOk(gd: TeamGameDay, team: TeamGameDayTeam): void {
    if (!this.allAnswered(gd)) return;
    const answers = gd.checklist_items.map((i) => ({
      item_id: i.id,
      answer: this.rejectAnswers[i.id] as boolean,
    }));
    this._submit(gd, team, false, answers);
  }

  formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('de-DE', {
      weekday: 'long',
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

  private _submit(
    gd: TeamGameDay,
    team: TeamGameDayTeam,
    properly: boolean,
    answers?: { item_id: number; answer: boolean }[]
  ): void {
    this.confirmingKey = this.key(gd, team);
    this._teamService
      .confirmTeamGameDay(gd.id, team.team_id, {
        properly_conducted: properly,
        answers,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this.gameDays = this.gameDays.map((g) =>
            g.id === gd.id
              ? {
                  ...g,
                  my_teams: g.my_teams.map((t) =>
                    t.team_id === team.team_id
                      ? {
                          ...t,
                          confirmed_at: res.confirmed_at,
                          properly_conducted: res.properly_conducted,
                          checklist_answers: res.checklist_answers,
                        }
                      : t
                  ),
                }
              : g
          );
          this.confirmingKey = null;
          this.rejectingKey = null;
          this.rejectAnswers = {};
          this._cdr.markForCheck();
          this._notificationService.success(
            properly ? 'Spieltag bestätigt.' : 'Meldung gespeichert.',
            { autoClose: true, keepAfterRouteChange: false }
          );
        },
        error: () => {
          this.confirmingKey = null;
          this._cdr.markForCheck();
          this._notificationService.error('Speichern fehlgeschlagen.', {
            autoClose: false,
          });
        },
      });
  }

  private _load(): void {
    this._teamService
      .getTeamGameDays()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (days) => {
          this.gameDays = days;
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
