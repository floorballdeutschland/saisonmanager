import { CommonModule } from '@angular/common';
import {
  ComponentFixture,
  TestBed,
  discardPeriodicTasks,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { NotificationService } from '@floorball/core';
import { Game } from '@floorball/types';

import { ChecklistQuestionsComponent } from '../checklist-questions/checklist-questions.component';
import { ChecklistSectionComponent } from './checklist-section.component';

describe('ChecklistSectionComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ChecklistSectionComponent>;
  let component: ChecklistSectionComponent;

  const items = [
    { id: 7, question: 'War die Halle rechtzeitig offen?', position: 0 },
    { id: 9, question: 'Waren beide Tore vorschriftsmäßig?', position: 1 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, HttpClientTestingModule],
      declarations: [ChecklistSectionComponent, ChecklistQuestionsComponent],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function game(overrides: Partial<Game> = {}): Game {
    return {
      id: 4711,
      checklist_active: true,
      checklist_items: items,
      checklist_answers: [],
      ...overrides,
    } as unknown as Game;
  }

  // Der Spielabruf ersetzt `game`. Über setInput, weil eine reine Zuweisung
  // weder ngOnChanges auslöst noch die Ansicht als zu prüfen markiert.
  function setGame(next: Game) {
    fixture.componentRef.setInput('game', next);
    fixture.detectChanges();
  }

  function create(overrides: Partial<Game> = {}) {
    fixture = TestBed.createComponent(ChecklistSectionComponent);
    component = fixture.componentInstance;
    setGame(game(overrides));
  }

  function expectSave() {
    return http.expectOne(
      (req) => req.url.indexOf('games/4711/checklist_answers') !== -1
    );
  }

  it('bleibt aus, wenn der Landesverband keine Fragen pflegt', () => {
    create({ checklist_active: false, checklist_items: [] });

    expect(component.visible).toBeFalse();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Spieltagscheckliste'
    );
  });

  it('zeigt die Fragen und benennt die offenen', () => {
    create();

    expect(component.openCount).toBe(2);
    expect(fixture.nativeElement.textContent).toContain(
      'War die Halle rechtzeitig offen?'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Noch 2 von 2 Fragen offen'
    );
  });

  it('belegt die Fragen mit dem gespeicherten Stand vor', () => {
    create({
      checklist_answers: [
        {
          item_id: 9,
          question: 'Waren beide Tore vorschriftsmäßig?',
          answer: true,
        },
      ],
    });

    expect(component.answers).toEqual({ 7: null, 9: true });
    expect(component.openCount).toBe(1);
  });

  // Der Zweck des Abschnitts: Was vor dem Spiel beantwortbar ist, darf einzeln
  // gespeichert werden. Ein unvollständiger Stand geht deshalb mit, aber ohne
  // die offenen Fragen -- der Endpunkt verlangt zu jedem Eintrag ein Ja/Nein.
  it('speichert nur die beantworteten Fragen', fakeAsync(() => {
    create();

    component.onAnswerSet({ itemId: 9, answer: false });
    tick(600);

    const request = expectSave();
    expect(request.request.body).toEqual({
      answers: [
        {
          item_id: 9,
          question: 'Waren beide Tore vorschriftsmäßig?',
          answer: false,
        },
      ],
    });

    request.flush({ success: true });
    expect(component.saving).toBeFalse();
    expect(component.game.checklist_answers?.length).toBe(1);
  }));

  // Wer die Liste durchklickt, soll nicht je Frage einen Schreibweg auslösen.
  it('fasst mehrere Klicks zu einem Schreibweg zusammen', fakeAsync(() => {
    create();

    component.onAnswerSet({ itemId: 7, answer: true });
    tick(200);
    component.onAnswerSet({ itemId: 9, answer: true });
    tick(600);

    const request = expectSave();
    expect(request.request.body).toEqual({
      answers: [
        { item_id: 7, question: items[0].question, answer: true },
        { item_id: 9, question: items[1].question, answer: true },
      ],
    });
    request.flush({ success: true });

    expect(component.openCount).toBe(0);
  }));

  // Der Spielabruf wird in der Vorbereitung nach jeder Änderung wiederholt.
  // Eine gerade geklickte, noch nicht geschriebene Antwort darf dabei nicht von
  // der älteren Serverantwort überschrieben werden.
  it('behält eine noch nicht geschriebene Auswahl über einen Spielabruf', fakeAsync(() => {
    create();

    component.onAnswerSet({ itemId: 7, answer: true });
    setGame(game({ checklist_answers: [] }));

    expect(component.answers[7]).toBeTrue();

    tick(600);
    expectSave().flush({ success: true });
  }));

  it('übernimmt den Serverstand für unberührte Fragen', () => {
    create();

    setGame(
      game({
        checklist_answers: [
          { item_id: 7, question: items[0].question, answer: false },
        ],
      })
    );

    expect(component.answers).toEqual({ 7: false, 9: null });
  });

  // Ein Fehler im äußeren Strom beendete ihn; die Checkliste ließe sich dann
  // für den Rest der Sitzung nicht mehr speichern.
  it('meldet einen Fehler und bleibt danach speicherbar', fakeAsync(() => {
    create();
    const notification = TestBed.inject(NotificationService);
    spyOn(notification, 'error');

    component.onAnswerSet({ itemId: 7, answer: true });
    tick(600);
    expectSave().flush(
      { message: 'kaputt' },
      { status: 500, statusText: 'Error' }
    );

    expect(notification.error).toHaveBeenCalled();
    expect(component.saving).toBeFalse();

    component.onAnswerSet({ itemId: 9, answer: true });
    tick(600);
    expectSave().flush({ success: true });

    expect(component.openCount).toBe(0);
  }));
  // Der engste Fall am Spieltisch: letzte Antwort setzen und sofort
  // "Spiel starten" druecken. Der Statuswechsel entfernt den Abschnitt aus der
  // Ansicht, die Komponente wird zerstoert -- und der anstehende Debounce-Wert
  // waere ersatzlos verworfen. debounceTime gibt ihn nur bei einem regulaeren
  // Ende der Quelle heraus, nicht beim Abbestellen.
  it('schickt eine Antwort aus dem Debounce-Fenster beim Abmelden nach', fakeAsync(() => {
    create();

    component.onAnswerSet({ itemId: 7, answer: true });
    // Bewusst NICHT abwarten: Die Antwort steht noch im Fenster.
    tick(100);
    http.expectNone((req) => req.url.indexOf('checklist_answers') !== -1);

    component.ngOnDestroy();

    const req = expectSave();
    expect(
      req.request.body.answers.map((a: { item_id: number }) => a.item_id)
    ).toEqual([7]);
    req.flush({ success: true });
    discardPeriodicTasks();
  }));

  // Gegenprobe: Ist alles gespeichert, wird beim Abmelden nichts nachgeschickt.
  it('schickt beim Abmelden nichts nach, wenn nichts offen ist', fakeAsync(() => {
    create();

    component.onAnswerSet({ itemId: 7, answer: true });
    tick(600);
    expectSave().flush({ success: true });

    component.ngOnDestroy();

    http.expectNone((req) => req.url.indexOf('checklist_answers') !== -1);
    discardPeriodicTasks();
  }));

  // Ein bereits laufender POST darf beim Abmelden nicht abgebrochen werden:
  // takeUntil sitzt deshalb VOR dem switchMap.
  it('fuehrt einen laufenden Schreibweg beim Abmelden zu Ende', fakeAsync(() => {
    create();

    component.onAnswerSet({ itemId: 7, answer: true });
    tick(600);
    const req = expectSave();

    component.ngOnDestroy();

    expect(req.cancelled).toBeFalse();
    req.flush({ success: true });
    discardPeriodicTasks();
  }));
});
