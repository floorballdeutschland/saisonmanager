import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import {
  catchError,
  debounceTime,
  map,
  of,
  Subject,
  switchMap,
  takeUntil,
} from 'rxjs';
import { GameService, NotificationService } from '@floorball/core';
import { ChecklistAnswer, ChecklistItem, Game } from '@floorball/types';

// Gespeichert wird nach der letzten Auswahl, nicht nach jeder einzelnen: Wer
// die Liste durchklickt, erzeugt sonst für jede Frage einen eigenen Schreibweg.
const SAVE_DEBOUNCE_MS = 600;

/**
 * Die Spieltagscheckliste des Landesverbands, ausfüllbar schon in der
 * Spielvorbereitung.
 *
 * Gefragt wurde sie bisher ausschließlich im Fenster beim Abschließen des
 * Spielberichts, also nach dem Schlusspfiff. Etliche Fragen betreffen aber den
 * Zustand der Halle und die Vorbereitung -- die weiß das Sekretariat vor dem
 * ersten Bully, und nach dem Spiel steht es unter Zeitdruck. Deshalb steht die
 * Liste zusätzlich hier, bei den übrigen Angaben zum Spiel.
 *
 * Sie ersetzt das Fenster am Ende nicht. Das bleibt der Riegel, an dem die
 * Vollständigkeit hängt, und es zeigt den hier gesetzten Stand vorbelegt: Wer
 * vorher ausgefüllt hat, bestätigt am Ende nur noch. Der Server prüft beim
 * Abschließen ohnehin gegen die aktuellen Fragen, ein vorab gesetzter Stand
 * kann also nicht dazu führen, dass eine später hinzugefügte Frage durchfällt.
 *
 * Gespeichert wird wie die übrigen Felder dieses Abschnitts von selbst. Ein
 * unvollständiger Stand ist ausdrücklich erlaubt und wird auch so abgelegt --
 * genau das ist der Zweck, denn nicht jede Frage lässt sich vor dem Spiel
 * beantworten.
 */
@Component({
  selector: 'fb-checklist-section',
  templateUrl: './checklist-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ChecklistSectionComponent implements OnInit, OnChanges, OnDestroy {
  @Input()
  game!: Game;

  public answers: Record<number, boolean | null> = {};
  public saving = false;
  public saved = false;

  private readonly _save = new Subject<void>();
  private readonly _destroy = new Subject<void>();

  // Fragen, an denen in dieser Sitzung etwas angeklickt wurde. Der Spielabruf
  // wird in der Vorbereitung nach jeder Änderung wiederholt (Kader, Betreuer,
  // Schiedsrichter); ohne diese Merkliste überschriebe eine solche Antwort die
  // gerade getroffene, aber noch nicht geschriebene Auswahl.
  private readonly _touched = new Set<number>();

  constructor(
    private _gameService: GameService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  public get items(): ChecklistItem[] {
    return this.game?.checklist_items ?? [];
  }

  public get visible(): boolean {
    return !!this.game?.checklist_active && this.items.length > 0;
  }

  public get openCount(): number {
    return this.items.filter(
      (item) => typeof this.answers[item.id] !== 'boolean'
    ).length;
  }

  ngOnInit(): void {
    this._save
      .pipe(
        debounceTime(SAVE_DEBOUNCE_MS),
        switchMap(() => {
          const answers = this._collectAnswers();
          this.saving = true;
          this._cdr.markForCheck();

          // Der Fehler wird hier abgefangen und nicht im subscribe: Ein Fehler
          // im äußeren Strom beendete ihn, und die Checkliste ließe sich für
          // den Rest der Sitzung nicht mehr speichern.
          return this._gameService
            .setChecklistAnswers(this.game.id, answers)
            .pipe(
              map(() => answers),
              catchError(() => of(null))
            );
        }),
        takeUntil(this._destroy)
      )
      .subscribe((answers) => {
        this.saving = false;

        if (answers) {
          this.game.checklist_answers = answers;
          this.saved = true;
          this._touched.clear();
        } else {
          this.saved = false;
          this._notificationService.error(
            'Die Spieltagscheckliste konnte nicht gespeichert werden. Bitte erneut versuchen.',
            { autoClose: true }
          );
        }

        this._cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['game']) this._syncFromGame();
  }

  ngOnDestroy(): void {
    this._destroy.next();
    this._destroy.complete();
  }

  public onAnswerSet(event: { itemId: number; answer: boolean }): void {
    this.answers = { ...this.answers, [event.itemId]: event.answer };
    this._touched.add(event.itemId);
    this.saved = false;
    this._save.next();
  }

  private _syncFromGame(): void {
    const stored = this.game?.checklist_answers ?? [];
    const next: Record<number, boolean | null> = {};

    for (const item of this.items) {
      if (this._touched.has(item.id)) {
        next[item.id] = this.answers[item.id] ?? null;
        continue;
      }

      const saved = stored.find((answer) => answer.item_id === item.id);
      next[item.id] = saved ? saved.answer : null;
    }

    this.answers = next;
  }

  // Nur die tatsächlich beantworteten Fragen, in der Reihenfolge des
  // Landesverbands. Der Endpunkt verlangt zu jedem Eintrag ein Ja oder Nein,
  // eine offene Frage darf also nicht als leerer Eintrag mitfahren.
  private _collectAnswers(): ChecklistAnswer[] {
    return this.items
      .filter((item) => typeof this.answers[item.id] === 'boolean')
      .map((item) => ({
        item_id: item.id,
        question: item.question,
        answer: this.answers[item.id] as boolean,
      }));
  }
}
