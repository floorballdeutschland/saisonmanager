import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { GameService, NotificationService } from '@floorball/core';
import { getTranslocoTestingModule } from '@floorball/core';
import { Game } from '@floorball/types';

import { MatchReportComponent } from './match-report.component';

describe('MatchReportComponent', () => {
  let fixture: ComponentFixture<MatchReportComponent>;
  let component: MatchReportComponent;
  let gameService: GameService;
  let notifications: NotificationService;

  const items = [
    {
      id: 7,
      question: 'War die Sporthalle rechtzeitig zugänglich?',
      position: 0,
    },
    {
      id: 9,
      question: 'War ein Catering/Imbiss-Stand vorhanden?',
      position: 1,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [MatchReportComponent],
      // Die Ansicht zieht ein Dutzend Kindkomponenten herein, die für diese
      // Prüfungen nichts beitragen. Geprüft wird der Rahmen des Fensters, nicht
      // die Fragenliste darin -- die hat ihre eigene Spec.
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    gameService = TestBed.inject(GameService);
    notifications = TestBed.inject(NotificationService);
  });

  function create(overrides: Partial<Game> = {}) {
    fixture = TestBed.createComponent(MatchReportComponent);
    component = fixture.componentInstance;
    component.game = {
      id: 4711,
      game_status: 'aftergame',
      checklist_active: true,
      checklist_items: items,
      checklist_answers: [
        { item_id: 7, question: items[0].question, answer: true },
        { item_id: 9, question: items[1].question, answer: false },
      ],
      ...overrides,
    } as unknown as Game;
    fixture.detectChanges();
  }

  function openChecklist() {
    component.closeMatchRecord();
    fixture.detectChanges();
  }

  function overlay(): HTMLElement {
    return fixture.nativeElement.querySelector('.fixed.inset-0');
  }

  it('should create', () => {
    create();
    expect(component).toBeTruthy();
  });

  describe('Spieltagscheckliste', () => {
    // Der Fehler vom 12.09.2026: Das Fenster hatte keinen Scrollweg. Bei sechs
    // Fragen ist es rund 870 Pixel hoch, bei sechzehn über 3000 -- die
    // Knopfleiste lag damit außerhalb jedes üblichen Fensters, und weil
    // `items-center` oben wie unten abschneidet, war weder Abschließen noch
    // Abbrechen erreichbar. Ein Spieltag blieb deshalb unabgeschlossen.
    it('macht den Hintergrund scrollbar, damit die Knöpfe erreichbar bleiben', () => {
      create();
      openChecklist();

      expect(overlay().classList).toContain('overflow-y-auto');
    });

    // Scrollbar allein genügt nicht: Bei sechzehn Fragen läge die Leiste sonst
    // erst nach 3000 Pixeln, und das am Spieltisch unter Zeitdruck.
    it('hält die Knopfleiste am unteren Rand fest', () => {
      create();
      openChecklist();

      const leiste = overlay().querySelector('.sticky');
      expect(leiste).toBeTruthy();
      expect(leiste!.textContent).toContain('Spielbericht abschließen');
      expect(leiste!.textContent).toContain('Abbrechen');
    });

    it('schließt sich über Abbrechen', () => {
      create();
      openChecklist();
      expect(component.checklistVisible).toBeTrue();

      component.cancelChecklist();
      fixture.detectChanges();

      expect(component.checklistVisible).toBeFalse();
      expect(overlay()).toBeNull();
    });

    // Zuvor setzte der Fehlerzweig nur `checklistSaving` zurück. Der
    // ErrorInterceptor verbraucht die Serverantwort, also entstand weder ein
    // Toast noch ein Sentry-Eintrag: Der Knopf wirkte tot.
    it('meldet einen gescheiterten Speicherversuch sichtbar', () => {
      create();
      openChecklist();
      const fehler = spyOn(notifications, 'error');
      spyOn(gameService, 'setChecklistAnswers').and.returnValue(
        throwError(() => 'Die Spieltagscheckliste muss vollständig sein.')
      );

      component.submitChecklist();
      fixture.detectChanges();

      expect(fehler).toHaveBeenCalledWith(
        'Die Spieltagscheckliste muss vollständig sein.'
      );
      // Das Fenster bleibt stehen: Die Antworten sind nicht gespeichert, und
      // ein stilles Schließen verlöre sie.
      expect(component.checklistVisible).toBeTrue();
      expect(component.checklistSaving).toBeFalse();
    });

    it('schließt den Bericht ab, wenn das Speichern gelingt', () => {
      create();
      openChecklist();
      spyOn(gameService, 'setChecklistAnswers').and.returnValue(
        of({ success: true })
      );
      const status = spyOn(gameService, 'setGameStatus').and.returnValue(
        of(component.game)
      );

      component.submitChecklist();
      fixture.detectChanges();

      expect(status).toHaveBeenCalledWith(4711, 'match_record_closed');
      expect(component.checklistVisible).toBeFalse();
    });
  });
});
