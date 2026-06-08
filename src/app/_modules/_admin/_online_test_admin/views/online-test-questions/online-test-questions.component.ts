import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NotificationService, OnlineTestService } from '@floorball/core';
import {
  OnlineTest,
  OnlineTestQuestion,
  OnlineTestRow,
  OnlineTestSolutionRow,
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
  templateUrl: './online-test-questions.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class OnlineTestQuestionsComponent implements OnInit {
  test: OnlineTest | null = null;
  penaltyOptions = PENALTY_OPTIONS;
  editingQuestion:
    | (Partial<OnlineTestQuestion> & {
        rows: OnlineTestRow[];
        solution: OnlineTestSolutionRow[];
      })
    | null = null;
  editingId: number | null = null;
  newRowLabel = '';
  saving = false;

  constructor(
    private _route: ActivatedRoute,
    private _onlineTestService: OnlineTestService,
    private _notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    const id = +this._route.snapshot.paramMap.get('id')!;
    this._onlineTestService
      .adminGet(id)
      .subscribe({ next: (t) => (this.test = t) });
  }

  startNew(): void {
    this.editingId = null;
    this.editingQuestion = {
      scenario: '',
      position: this.test?.questions?.length ?? 0,
      rows: [],
      solution: [],
    };
  }

  startEdit(q: OnlineTestQuestion): void {
    this.editingId = q.id;
    this.editingQuestion = {
      ...q,
      rows: q.rows.map((r) => ({ ...r })),
      solution: q.solution ? q.solution.map((s) => ({ ...s })) : [],
    };
  }

  addRow(): void {
    if (!this.editingQuestion || !this.newRowLabel.trim()) return;
    const id =
      this.editingQuestion.rows.length > 0
        ? Math.max(...this.editingQuestion.rows.map((r) => r.id)) + 1
        : 1;
    this.editingQuestion.rows.push({ id, label: this.newRowLabel.trim() });
    this.editingQuestion.solution.push({ id, value: '' });
    this.newRowLabel = '';
  }

  removeRow(rowId: number): void {
    if (!this.editingQuestion) return;
    this.editingQuestion.rows = this.editingQuestion.rows.filter(
      (r) => r.id !== rowId
    );
    this.editingQuestion.solution = this.editingQuestion.solution.filter(
      (s) => s.id !== rowId
    );
  }

  solutionFor(rowId: number): string {
    return (
      this.editingQuestion?.solution.find((s) => s.id === rowId)?.value ?? ''
    );
  }

  setSolution(rowId: number, value: string): void {
    if (!this.editingQuestion) return;
    const s = this.editingQuestion.solution.find((s) => s.id === rowId);
    if (s) s.value = value;
  }

  saveQuestion(): void {
    if (!this.test || !this.editingQuestion) return;
    this.saving = true;
    const obs = this.editingId
      ? this._onlineTestService.adminUpdateQuestion(
          this.test.id,
          this.editingId,
          this.editingQuestion
        )
      : this._onlineTestService.adminCreateQuestion(
          this.test.id,
          this.editingQuestion
        );

    obs.subscribe({
      next: () => {
        this.saving = false;
        this.editingQuestion = null;
        this._notificationService.success('Frage gespeichert.', {
          autoClose: true,
        });
        this._onlineTestService
          .adminGet(this.test!.id)
          .subscribe({ next: (t) => (this.test = t) });
      },
      error: () => {
        this.saving = false;
        this._notificationService.error('Speichern fehlgeschlagen.', {
          autoClose: false,
        });
      },
    });
  }

  deleteQuestion(q: OnlineTestQuestion): void {
    if (!this.test) return;
    if (!confirm('Frage wirklich löschen?')) return;
    this._onlineTestService.adminDeleteQuestion(this.test.id, q.id).subscribe({
      next: () => {
        this._notificationService.success('Frage gelöscht.', {
          autoClose: true,
        });
        this._onlineTestService
          .adminGet(this.test!.id)
          .subscribe({ next: (t) => (this.test = t) });
      },
      error: () =>
        this._notificationService.error('Löschen fehlgeschlagen.', {
          autoClose: false,
        }),
    });
  }

  cancelEdit(): void {
    this.editingQuestion = null;
  }

  getSolutionValue(
    solution: OnlineTestSolutionRow[] | undefined,
    rowId: number
  ): string {
    return solution?.find((s) => s.id === rowId)?.value || '–';
  }
}
