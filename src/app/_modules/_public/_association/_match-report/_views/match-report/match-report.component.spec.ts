import {
  Component,
  Input,
  NO_ERRORS_SCHEMA,
  SimpleChange,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NEVER, of, throwError } from 'rxjs';

import { GameService, NotificationService } from '@floorball/core';
import { getTranslocoTestingModule } from '@floorball/core';
import { Game } from '@floorball/types';

import { TabletShotSyncService } from '../../_components/tablet-capture/tablet-shot-sync.service';
import { MatchReportComponent } from './match-report.component';

/**
 * Statt der echten Fragenliste ein Platzhalter fester Höhe.
 *
 * Die Spec prüft den Rahmen des Fensters, nicht die Fragen darin -- die haben
 * ihre eigene Spec. Gebraucht wird von ihnen hier nur die Bauhöhe, und die
 * lässt sich so einstellen, statt sechzehn Fragen aufzubauen.
 */
@Component({
  selector: 'fb-checklist-questions',
  template: '<div [style.height.px]="hoehe"></div>',
  standalone: false,
})
class ChecklistQuestionsStubComponent {
  @Input() items: unknown[] = [];
  @Input() answers: Record<number, boolean | null> = {};
  @Input() disabled = false;

  // Rund das, was sechzehn Fragen des Bundesverbands aufbauen.
  public hoehe = 2400;
}

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
      declarations: [MatchReportComponent, ChecklistQuestionsStubComponent],
      // Die Ansicht zieht mehrere Kindkomponenten herein, die für diese
      // Prüfungen nichts beitragen. Die Fragenliste ist davon ausgenommen: Sie
      // steht als Platzhalter oben, weil ihre Bauhöhe hier der Prüfgegenstand
      // ist.
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

  function dialog(): HTMLElement {
    return fixture.nativeElement.querySelector(
      '[data-testid="checklist-dialog"]'
    );
  }

  function knopf(beschriftung: string): HTMLButtonElement {
    const treffer = Array.from(
      dialog().querySelectorAll('button')
    ) as HTMLButtonElement[];
    const gefunden = treffer.find((b) => b.textContent?.includes(beschriftung));
    if (!gefunden) throw new Error(`Knopf "${beschriftung}" nicht gefunden`);
    return gefunden;
  }

  it('should create', () => {
    create();
    expect(component).toBeTruthy();
  });

  describe('Spielabschnitt für neue Ereignisse', () => {
    function gameChange(overrides: Partial<Game>) {
      const game = { id: 4711, game_status: 'ingame', ...overrides };
      component.game = game as unknown as Game;
      component.ngOnChanges({
        game: new SimpleChange(undefined, game, true),
      });
    }

    it('nimmt vor dem ersten Abschnitt Abschnitt 1 an, nicht 0', () => {
      create();
      gameChange({ ingame_status: '', current_period_title: undefined });
      expect(component.currentPeriod).toBe('1');
    });

    it('übernimmt den laufenden Abschnitt', () => {
      create();
      gameChange({
        ingame_status: 'period2',
        current_period_title: { period: 2 } as Game['current_period_title'],
      });
      expect(component.currentPeriod).toBe('2');
    });

    it('rundet eine Pause auf den Abschnitt davor ab', () => {
      create();
      gameChange({
        ingame_status: 'pause1',
        current_period_title: { period: 1.5 } as Game['current_period_title'],
      });
      expect(component.currentPeriod).toBe('1');
    });
  });

  describe('Spieltagsbericht', () => {
    // Der Fehler vom 12.09.2026: Das Fenster hatte keinen Scrollweg. Sobald die
    // Fragenliste höher wurde als das Browserfenster, lag die Knopfleiste
    // außerhalb -- und weil `fixed inset-0` die Höhe auf den Viewport nagelt
    // und `items-center` oben wie unten abschneidet, half auch Hochscrollen
    // nicht. Ein Dresdner Spieltag blieb deshalb unabgeschlossen.
    //
    // Geprüft wird deshalb die Erreichbarkeit selbst, nicht das Vorhandensein
    // einer CSS-Klasse: Verschwindet etwa `bottom-0`, bleibt die Klasse
    // `sticky` stehen, klebt aber nichts mehr.
    it('lässt sich scrollen, wenn die Fragen höher bauen als das Fenster', () => {
      // Mit offener Frage, denn nur dann steht die volle Liste im Fenster.
      create({ checklist_answers: [] } as unknown as Partial<Game>);
      openChecklist();

      const overlay = dialog();
      overlay.scrollTop = 99999;

      expect(overlay.scrollHeight).toBeGreaterThan(overlay.clientHeight);
      expect(overlay.scrollTop).toBeGreaterThan(0);
    });

    it('hält die Knopfleiste im Bild -- vor und nach dem Scrollen', () => {
      create({ checklist_answers: [] } as unknown as Partial<Game>);
      openChecklist();

      const overlay = dialog();
      const abschliessen = knopf('Spielbericht abschließen');

      expect(abschliessen.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        overlay.clientHeight
      );

      overlay.scrollTop = 99999;
      expect(abschliessen.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        overlay.clientHeight
      );
    });

    it('schließt sich über den Abbrechen-Knopf', () => {
      create();
      openChecklist();
      expect(component.checklistVisible).toBeTrue();

      knopf('Abbrechen').click();
      fixture.detectChanges();

      expect(component.checklistVisible).toBeFalse();
      expect(dialog()).toBeNull();
    });

    // Ohne Checkliste gibt es nichts zu bestätigen -- dann darf das Fenster
    // nicht erscheinen und der Bericht muss direkt abschließen. Trifft jede
    // Liga, deren Landesverband keine Fragen gepflegt hat.
    it('überspringt das Fenster ganz, wenn keine Checkliste greift', () => {
      create({ checklist_active: false } as unknown as Partial<Game>);
      const status = spyOn(gameService, 'setGameStatus').and.returnValue(
        of(component.game)
      );

      component.closeMatchRecord();
      fixture.detectChanges();

      expect(dialog()).toBeNull();
      expect(status).toHaveBeenCalledWith(4711, 'match_record_closed');
    });

    // Gegenprobe zum vorigen Fall: Auch bei leerer Fragenliste. Fiele die
    // Längenprüfung weg, liefe `allChecklistAnswered()` auf dem leeren Array
    // ins Leere (`every` ist dort wahr) und das Fenster behauptete
    // "0 von 0 Fragen beantwortet".
    it('überspringt das Fenster auch bei leerer Fragenliste', () => {
      create({
        checklist_items: [],
        checklist_answers: [],
      } as unknown as Partial<Game>);
      const status = spyOn(gameService, 'setGameStatus').and.returnValue(
        of(component.game)
      );

      component.closeMatchRecord();
      fixture.detectChanges();

      expect(dialog()).toBeNull();
      expect(status).toHaveBeenCalledWith(4711, 'match_record_closed');
    });

    // Der ErrorInterceptor meldet diesen Endpunkt bereits selbst. Eine zweite
    // Meldung läge deckungsgleich darüber; die Komponente hält sich deshalb
    // zurück und lässt nur das Fenster stehen, damit die Antworten nicht
    // verloren gehen.
    it('meldet einen gescheiterten Speicherversuch nicht selbst noch einmal', () => {
      create();
      openChecklist();
      const fehler = spyOn(notifications, 'error');
      spyOn(gameService, 'setChecklistAnswers').and.returnValue(
        throwError(() => ({
          status: 422,
          error: { message: 'Ungültiges Format.' },
        }))
      );

      knopf('Spielbericht abschließen').click();
      fixture.detectChanges();

      expect(fehler).not.toHaveBeenCalled();
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

      knopf('Spielbericht abschließen').click();
      fixture.detectChanges();

      expect(status).toHaveBeenCalledWith(4711, 'match_record_closed');
      expect(component.checklistVisible).toBeFalse();
    });

    // Der Schreibweg wird beim Schließen nicht abbestellt: Sein Erfolgszweig
    // schlösse den Spielbericht auch dann ab, wenn zwischendurch jemand
    // abbricht -- und der ist nicht wieder zu öffnen.
    it('sperrt alle Knöpfe während des Speicherns', () => {
      create();
      openChecklist();
      // Ein Strom, der nie antwortet: haelt den Speichervorgang offen.
      spyOn(gameService, 'setChecklistAnswers').and.returnValue(NEVER);

      knopf('Spielbericht abschließen').click();
      fixture.detectChanges();

      // Der Bestätigungsknopf heißt währenddessen "Speichern…".
      expect(knopf('Speichern').disabled).toBeTrue();
      expect(knopf('Abbrechen').disabled).toBeTrue();
    });

    // Blieb eine Antwort aus (Funkloch in der Halle), stünde der
    // Bestätigungsknopf sonst dauerhaft auf "Speichern…".
    it('gibt die Knöpfe beim erneuten Öffnen wieder frei', () => {
      create();
      component.checklistSaving = true;

      openChecklist();

      expect(component.checklistSaving).toBeFalse();
      expect(knopf('Spielbericht abschließen').disabled).toBeFalse();
    });

    describe('kompakte Bestätigung', () => {
      // Bei sechzehn Fragen war das Fenster auch scrollbar noch ein Bildschirm
      // voll Wiederholung, obwohl in aller Regel schon alles beantwortet ist.
      it('zeigt bei vollständigen Antworten nur die Zusammenfassung', () => {
        create();
        openChecklist();

        expect(component.checklistConfirmOnly).toBeTrue();
        expect(dialog().textContent).toContain('2 von 2 Fragen');
        expect(dialog().querySelector('fb-checklist-questions')).toBeNull();
      });

      // Eine Verneinung setzt die zuständige SBK auf BCC der
      // Bestätigungsmail. Wer nur eine Zahl liest, bestätigte sonst ungewollt
      // eine Beanstandung.
      it('nennt die verneinten Punkte', () => {
        create();
        openChecklist();

        expect(component.checklistDeniedCount).toBe(1);
        expect(dialog().textContent).toContain(
          'Davon mit „Nein“ beantwortet: 1'
        );
      });

      it('klappt über „Ändern“ die volle Liste auf', () => {
        create();
        openChecklist();

        knopf('Ändern').click();
        fixture.detectChanges();

        expect(dialog().querySelector('fb-checklist-questions')).toBeTruthy();
        expect(dialog().textContent).not.toContain('Fragen beantwortet');
      });

      // Fehlt auch nur eine Antwort, bleibt es beim Ausfüllen -- die
      // Zusammenfassung darf den Riegel nicht aushebeln.
      it('zeigt bei unvollständigen Antworten sofort die Fragen', () => {
        create({
          checklist_answers: [
            { item_id: 7, question: items[0].question, answer: true },
          ],
        } as unknown as Partial<Game>);
        openChecklist();

        expect(component.checklistConfirmOnly).toBeFalse();
        expect(dialog().querySelector('fb-checklist-questions')).toBeTruthy();
      });

      // Nach dem Abbrechen zeigt das Fenster wieder den GESPEICHERTEN Stand:
      // Eine im Ändern-Modus getroffene, nicht gespeicherte Auswahl ist weg,
      // und die Zusammenfassung ist zurück.
      it('beginnt beim erneuten Öffnen wieder mit der Zusammenfassung', () => {
        create();
        openChecklist();
        knopf('Ändern').click();
        fixture.detectChanges();

        knopf('Abbrechen').click();
        fixture.detectChanges();
        openChecklist();

        expect(component.checklistConfirmOnly).toBeTrue();
        expect(dialog().textContent).toContain('2 von 2 Fragen');
      });
    });
  });

  // Tabletmodus (fe#344): Vor dem Abschließen fragt der Spielbericht, ob die
  // Schüsse vollständig erfasst wurden, aber nur bei Tablet-Spielen.
  describe('Frage nach vollständig erfassten Schüssen', () => {
    let http: HttpTestingController;

    beforeEach(() => {
      http = TestBed.inject(HttpTestingController);
    });

    const tabletDialog = () =>
      fixture.nativeElement.querySelector(
        '[data-testid="tablet-complete-dialog"]'
      );

    it('fragt nicht bei Spielen ohne Tablet-Daten', () => {
      create({ checklist_active: false });
      const setStatus = spyOn(gameService, 'setGameStatus').and.returnValue(
        NEVER
      );

      component.closeMatchRecord();
      fixture.detectChanges();

      expect(tabletDialog()).toBeNull();
      expect(setStatus).toHaveBeenCalledWith(4711, 'match_record_closed');
    });

    it('fragt bei Tablet-Spielen und schließt nach der Antwort ab', () => {
      create({ checklist_active: false, tablet_capture: true });
      const setStatus = spyOn(gameService, 'setGameStatus').and.returnValue(
        NEVER
      );

      component.closeMatchRecord();
      fixture.detectChanges();

      expect(tabletDialog()).not.toBeNull();
      expect(setStatus).not.toHaveBeenCalled();

      (
        fixture.nativeElement.querySelector(
          '[data-testid="tablet-complete-no"]'
        ) as HTMLButtonElement
      ).click();
      const request = http.expectOne((req) =>
        req.url.endsWith('games/4711/tablet_capture.json')
      );
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({ complete: false });
      request.flush({ tablet_shots_complete: false });
      fixture.detectChanges();

      expect(tabletDialog()).toBeNull();
      expect(component.game.tablet_shots_complete).toBeFalse();
      expect(setStatus).toHaveBeenCalledWith(4711, 'match_record_closed');
    });

    it('schließt auch ab, wenn das Speichern der Antwort scheitert', () => {
      create({ checklist_active: false, tablet_capture: true });
      const setStatus = spyOn(gameService, 'setGameStatus').and.returnValue(
        NEVER
      );

      component.closeMatchRecord();
      component.answerTabletComplete(true);
      http
        .expectOne((req) => req.url.endsWith('games/4711/tablet_capture.json'))
        .flush({}, { status: 422, statusText: 'Unprocessable' });

      expect(setStatus).toHaveBeenCalledWith(4711, 'match_record_closed');
    });

    it('überträgt vorher ungesendete Schüsse und warnt, wenn etwas liegen bleibt', async () => {
      create({ checklist_active: false });
      const sync = TestBed.inject(TabletShotSyncService);
      sync.buffer(4711).upsert({
        client_uuid: 'u1',
        team: 'home',
        period: 1,
        game_time: '',
        tapped_at: '2026-10-16T12:00:00.000Z',
        x: 0.5,
        y: 0.5,
        result: 'saved',
      });
      const setStatus = spyOn(gameService, 'setGameStatus').and.returnValue(
        NEVER
      );

      try {
        // Auch ohne tablet_capture am Spiel: Dieses Gerät hat Schüsse.
        component.closeMatchRecord();
        fixture.detectChanges();
        expect(tabletDialog()).not.toBeNull();
        expect(component.tabletChecking).toBeTrue();

        http
          .expectOne((req) => req.url.endsWith('games/4711/shots.json'))
          .error(new ProgressEvent('error'), { status: 0 });
        await new Promise((resolve) => setTimeout(resolve));
        fixture.detectChanges();

        expect(component.tabletChecking).toBeFalse();
        expect(component.tabletUnsent).toBe(1);
        expect(
          fixture.nativeElement.querySelector(
            '[data-testid="tablet-complete-unsent"]'
          )
        ).not.toBeNull();
        expect(setStatus).not.toHaveBeenCalled();
      } finally {
        localStorage.removeItem('tablet_shot_buffer_4711');
      }
    });

    it('bricht ohne Statuswechsel ab', () => {
      create({ checklist_active: false, tablet_capture: true });
      const setStatus = spyOn(gameService, 'setGameStatus');

      component.handleGameStatusChange('match_record_closed');
      component.cancelTabletComplete();
      fixture.detectChanges();

      expect(tabletDialog()).toBeNull();
      expect(component.appGameStatus).toBe('aftergame');
      expect(setStatus).not.toHaveBeenCalled();
    });
  });

  describe('Scan des Spielberichtsbogens', () => {
    // Ohne eigenes create() liefe der Block nur auf der Komponente, die ein
    // vorheriger Test zufällig hinterlassen hat, und für sich allein gar nicht.
    beforeEach(() => create());

    const select = (file: File) => {
      const input = { files: [file], value: 'bogen' };
      component.onScanFileSelected({ target: input } as unknown as Event);
      return input;
    };

    it('nimmt ein PDF zum Hochladen an', () => {
      const pdf = new File(['%PDF-1.4'], 'bogen.pdf', {
        type: 'application/pdf',
      });

      select(pdf);

      expect(component.selectedScanFile).toBe(pdf);
      expect(component.scanUploadError).toBe('');
    });

    it('weist ein Foto vor dem Upload ab', () => {
      const upload = spyOn(gameService, 'uploadGameScan');

      const input = select(
        new File(['x'], 'bogen.jpg', { type: 'image/jpeg' })
      );
      component.uploadScan();

      expect(component.selectedScanFile).toBeNull();
      expect(component.scanUploadError).toBe(
        'Nur PDF-Dateien bis 5 MB sind zulässig, Fotos werden nicht angenommen.'
      );
      expect(input.value).toBe('');
      expect(upload).not.toHaveBeenCalled();
    });

    it('weist ein zu großes PDF mit derselben Meldung ab', () => {
      const upload = spyOn(gameService, 'uploadGameScan');
      const big = new File(['%PDF-1.4'], 'bogen.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });

      select(big);
      component.uploadScan();

      expect(component.selectedScanFile).toBeNull();
      expect(component.scanUploadError).toBe(
        'Nur PDF-Dateien bis 5 MB sind zulässig, Fotos werden nicht angenommen.'
      );
      expect(upload).not.toHaveBeenCalled();
    });
  });
});
