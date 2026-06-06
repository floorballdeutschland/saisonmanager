import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { OnlineTestService } from '@floorball/core';
import {
  OnlineTestAnswer,
  OnlineTestQuestion,
  RefereeOnlineTestStartResponse,
} from '@floorball/types';

const PENALTY_OPTIONS = [
  '2',
  '2+2',
  'TMS',
  'MS',
  'FreischlagA',
  'FreischlagB',
  'Weiterspielen',
  'Bully',
];

@Component({
  templateUrl: './referee-online-test-exam.component.html',
  standalone: false,
})
export class RefereeOnlineTestExamComponent implements OnInit, OnDestroy {
  testId = 0;
  attemptData: RefereeOnlineTestStartResponse | null = null;
  questions: OnlineTestQuestion[] = [];
  answers: OnlineTestAnswer[] = [];
  penaltyOptions = PENALTY_OPTIONS;

  remainingSeconds: number | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private _destroy$ = new Subject<void>();

  submitting = false;
  submitted = false;
  submitResult: { error_points: number; passed: boolean | null } | null = null;

  constructor(
    private _route: ActivatedRoute,
    private _router: Router,
    private _onlineTestService: OnlineTestService
  ) {}

  ngOnInit(): void {
    this.testId = +this._route.snapshot.paramMap.get('id')!;
    this._onlineTestService
      .refereeStart(this.testId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (data) => {
          this.attemptData = data;
          this.questions = data.questions;
          this.answers =
            data.answers.length > 0
              ? data.answers
              : data.questions.map((q) => ({
                  question_id: q.id,
                  rows: q.rows.map((r) => ({ id: r.id, selected: '' })),
                }));

          if (data.time_limit_minutes) {
            const elapsed = Math.floor(
              (Date.now() - new Date(data.started_at).getTime()) / 1000
            );
            this.remainingSeconds = Math.max(
              0,
              data.time_limit_minutes * 60 - elapsed
            );
            this.startTimer();
          }
        },
      });
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this._destroy$.next();
    this._destroy$.complete();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    if (!this.submitted) {
      e.preventDefault();
    }
  }

  getSelection(questionId: number, rowId: number): string {
    return (
      this.answers
        .find((a) => a.question_id === questionId)
        ?.rows.find((r) => r.id === rowId)?.selected ?? ''
    );
  }

  setSelection(questionId: number, rowId: number, value: string): void {
    const answer = this.answers.find((a) => a.question_id === questionId);
    if (!answer) return;
    const row = answer.rows.find((r) => r.id === rowId);
    if (row) row.selected = value;
  }

  submitError: string | null = null;

  submit(): void {
    this.submitting = true;
    this.submitError = null;
    this.clearTimer();
    this._onlineTestService
      .refereeSubmit(this.testId, this.answers)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.submitted = true;
          this.submitting = false;
          this.submitResult = result;
        },
        error: () => {
          this.submitting = false;
          this.submitError = 'Abgabe fehlgeschlagen. Bitte erneut versuchen.';
        },
      });
  }

  goBack(): void {
    this._router.navigate(['/schiedsrichter', 'onlinepruefungen', this.testId]);
  }

  get formattedTime(): string {
    if (this.remainingSeconds == null) return '';
    const m = Math.floor(this.remainingSeconds / 60);
    const s = this.remainingSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  get timerWarning(): boolean {
    return this.remainingSeconds !== null && this.remainingSeconds <= 300;
  }

  private startTimer(): void {
    const startedAtMs = new Date(this.attemptData!.started_at).getTime();
    const limitSec = this.attemptData!.time_limit_minutes! * 60;
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtMs) / 1000);
      this.remainingSeconds = Math.max(0, limitSec - elapsed);
      if (this.remainingSeconds <= 0) {
        this.clearTimer();
        this.submit();
      }
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
}
