import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { GameService } from '@floorball/core';
import { ChecklistVeto, ChecklistVetoAnswer } from '@floorball/types';

/**
 * Einspruch des Ausrichtervereins gegen die Spieltagscheckliste, die die
 * Spielleitung beim Abschluss des Spielberichts beantwortet hat. Erreichbar nur
 * über den Einmal-Link aus der Bestätigungsmail; der Token ist die einzige
 * Berechtigung, ein Benutzerkonto gibt es dazu nicht.
 *
 * Fachlich zählt der erste Einspruch: nach dem Absenden ist der Link verbraucht,
 * eine Korrektur ist nicht vorgesehen (so steht es auch in der Mail).
 */
@Component({
  templateUrl: './checklist-veto.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ChecklistVetoComponent implements OnInit, OnDestroy {
  loading = true;
  submitting = false;
  /** Token unbekannt, Spiel nicht gefunden oder Link nie erzeugt. */
  invalid = false;
  /** In dieser Sitzung erfolgreich eingereicht. */
  done = false;

  veto?: ChecklistVeto;
  errorMessage: string | null = null;

  /** Antworten des Ausrichters, je Checklisten-Position. */
  answers: Record<number, boolean> = {};

  private _gameId = 0;
  private _token = '';
  private _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _gameService: GameService,
    private _meta: Meta,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Persönlicher Link: gehört nicht in Suchmaschinen.
    this._meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });

    this._gameId = Number(this._route.snapshot.paramMap.get('gameId')) || 0;
    this._token = this._route.snapshot.queryParamMap.get('token') ?? '';
    this._load();
  }

  ngOnDestroy(): void {
    // Sonst bliebe das noindex für den Rest der Sitzung stehen, wenn die Person
    // von hier aus weiterklickt.
    this._meta.removeTag("name='robots'");
    this._destroy$.next();
    this._destroy$.complete();
  }

  /** Antwort der Spielleitung zu einer Frage, oder null wenn unbeantwortet. */
  originalAnswer(itemId: number): boolean | null {
    const entry = this.veto?.original_answers?.find(
      (answer) => answer.item_id === itemId
    );

    return entry ? entry.answer : null;
  }

  setAnswer(itemId: number, answer: boolean): void {
    this.answers[itemId] = answer;
  }

  /**
   * Erst absenden, wenn jede Frage beantwortet ist: Der Server speichert genau
   * die übergebene Liste als neuen Stand, eine Teilmenge würde die restlichen
   * Fragen stillschweigend verlieren.
   */
  complete(): boolean {
    const items = this.veto?.checklist_items ?? [];

    return (
      items.length > 0 &&
      items.every((item) => this.answers[item.id] !== undefined)
    );
  }

  /** Weicht der Einspruch überhaupt vom Stand der Spielleitung ab? */
  changed(): boolean {
    return (this.veto?.checklist_items ?? []).some(
      (item) => this.answers[item.id] !== this.originalAnswer(item.id)
    );
  }

  submit(): void {
    if (!this.complete() || this.submitting) {
      return;
    }

    const answers: ChecklistVetoAnswer[] = (
      this.veto?.checklist_items ?? []
    ).map((item) => ({
      item_id: item.id,
      question: item.question,
      answer: this.answers[item.id],
    }));

    this.submitting = true;
    this.errorMessage = null;
    this._gameService
      .submitChecklistVeto(this._gameId, this._token, answers)
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
            'Der Einspruch konnte nicht gespeichert werden.';
          this._cdr.markForCheck();
        },
      });
  }

  formatDate(date?: string): string {
    if (!date) return '';

    return new Date(date + 'T00:00:00').toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private _load(): void {
    if (!this._gameId || !this._token) {
      this.loading = false;
      this.invalid = true;
      return;
    }

    this._gameService
      .getChecklistVeto(this._gameId, this._token)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (veto) => {
          this.veto = veto;
          // Antworten der Spielleitung als Ausgangsstand vorbelegen: Der
          // Einspruch betrifft in der Regel einzelne Fragen, nicht alle.
          veto.checklist_items.forEach((item) => {
            const original = this.originalAnswer(item.id);
            if (original !== null) {
              this.answers[item.id] = original;
            }
          });
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
