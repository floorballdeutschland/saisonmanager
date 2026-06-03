import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService, RefereeService } from '@floorball/core';
import { RefereeGameDay } from '@floorball/types';

@Component({
  templateUrl: './referee-game-days.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefereeGameDaysComponent implements OnInit, OnDestroy {
  gameDays: RefereeGameDay[] = [];
  loading = true;
  confirmingId: number | null = null;

  // "Nicht ordnungsgemäß"-Flow: aktuell offener Spieltag + Antworten je Frage.
  rejectingId: number | null = null;
  rejectAnswers: Record<number, boolean | null> = {};

  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
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

  /** Aktion überhaupt nötig: nur wenn eine Checkliste existiert und noch offen. */
  needsAction(gd: RefereeGameDay): boolean {
    return gd.checklist_required && !gd.my_confirmed_at && !gd.auto_confirmed;
  }

  canConfirm(gd: RefereeGameDay): boolean {
    return this.needsAction(gd) && !this.notYetConfirmable(gd);
  }

  notYetConfirmable(gd: RefereeGameDay): boolean {
    if (!gd.confirmable_from) return false;
    return new Date(gd.confirmable_from).getTime() > Date.now();
  }

  startReject(gd: RefereeGameDay): void {
    this.rejectingId = gd.id;
    this.rejectAnswers = {};
    gd.checklist_items.forEach((i) => (this.rejectAnswers[i.id] = null));
  }

  cancelReject(): void {
    this.rejectingId = null;
    this.rejectAnswers = {};
  }

  setAnswer(itemId: number, value: boolean): void {
    this.rejectAnswers[itemId] = value;
  }

  allAnswered(gd: RefereeGameDay): boolean {
    return gd.checklist_items.every(
      (i) =>
        this.rejectAnswers[i.id] === true || this.rejectAnswers[i.id] === false
    );
  }

  confirmOk(gd: RefereeGameDay): void {
    this._submit(gd, true);
  }

  submitNotOk(gd: RefereeGameDay): void {
    if (!this.allAnswered(gd)) return;
    const answers = gd.checklist_items.map((i) => ({
      item_id: i.id,
      answer: this.rejectAnswers[i.id] as boolean,
    }));
    this._submit(gd, false, answers);
  }

  confirmationStatus(gd: RefereeGameDay): string {
    if (gd.my_confirmed_at) {
      return gd.properly_conducted === false ? 'not_ok' : 'confirmed';
    }
    if (gd.auto_confirmed) return 'auto';
    return 'pending';
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
    gd: RefereeGameDay,
    properly: boolean,
    answers?: { item_id: number; answer: boolean }[]
  ): void {
    this.confirmingId = gd.id;
    this._refereeService
      .confirmGameDay(gd.id, { properly_conducted: properly, answers })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this.gameDays = this.gameDays.map((g) =>
            g.id === gd.id
              ? {
                  ...g,
                  my_confirmed_at: res.confirmed_at,
                  properly_conducted: res.properly_conducted,
                  my_checklist_answers: res.checklist_answers,
                }
              : g
          );
          this.confirmingId = null;
          this.rejectingId = null;
          this.rejectAnswers = {};
          this._cdr.markForCheck();
          this._notificationService.success(
            properly ? 'Spieltag bestätigt.' : 'Meldung gespeichert.',
            { autoClose: true, keepAfterRouteChange: false }
          );
        },
        error: () => {
          this.confirmingId = null;
          this._cdr.markForCheck();
          this._notificationService.error('Speichern fehlgeschlagen.', {
            autoClose: false,
          });
        },
      });
  }

  private _load(): void {
    this._refereeService
      .getGameDays()
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
