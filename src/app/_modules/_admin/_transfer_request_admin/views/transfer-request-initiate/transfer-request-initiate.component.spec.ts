import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { TransferRequestInitiateComponent } from './transfer-request-initiate.component';

// Mehrere Freigabeanträge dürfen für einen Spieler parallel laufen, Transfers
// nicht. Welche Art gerade gesperrt ist, weiß nur die API — die Maske lässt die
// Art erst am gefundenen Spieler wählen, die Suche kann sie also nicht
// mitschicken und bekommt sie in `blocked_request_types` zurück.
describe('TransferRequestInitiateComponent', () => {
  let httpMock: HttpTestingController;
  let component: TransferRequestInitiateComponent;

  const search = (
    blocked?: string[],
    reasons?: Record<string, string>,
    playerId = 42
  ) => {
    component.selectedClubId = 7;
    component.firstName = 'Max';
    component.lastName = 'Mustermann';
    component.birthdate = '1995-03-15';
    component.search();

    const req = httpMock.expectOne((r) =>
      r.urlWithParams.includes('search_player.json')
    );
    req.flush({
      player: {
        id: playerId,
        first_name: 'Max',
        last_name: 'Mustermann',
        birthdate: '1995-03-15',
      },
      ...(blocked ? { blocked_request_types: blocked } : {}),
      ...(reasons ? { blocked_request_reasons: reasons } : {}),
    });
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [TransferRequestInitiateComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TransferRequestInitiateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('legt die Auswahl auf die Freigabe um, wenn der Transfer gesperrt ist', () => {
    search(['transfer']);

    expect(component.isTypeBlocked('transfer')).toBeTrue();
    expect(component.isTypeBlocked('release')).toBeFalse();
    // Nicht bloß abgeschaltet: Bliebe die Vorauswahl auf der gesperrten Art,
    // stünde der Knopf unter einer nicht wählbaren Auswahl.
    expect(component.requestType).toBe('release');
  });

  it('laesst die Vorauswahl stehen, wenn nichts gesperrt ist', () => {
    search([]);

    expect(component.requestType).toBe('transfer');
    expect(component.allTypesBlocked).toBeFalse();
  });

  // Eine gesperrte Freigabe betrifft nur diesen Zielverein, der Transfer bleibt
  // möglich — und ist dann die Vorauswahl, die schon stand.
  it('haelt den Transfer offen, wenn nur die Freigabe gesperrt ist', () => {
    search(['release']);

    expect(component.requestType).toBe('transfer');
    expect(component.isTypeBlocked('release')).toBeTrue();
  });

  it('sendet keinen Antrag zur gesperrten Antragsart', () => {
    search(['transfer']);
    component.requestType = 'transfer';

    component.submit();

    // Kein POST: httpMock.verify() im afterEach würde einen offenen Aufruf
    // melden, expectNone benennt den Fehler an der Stelle, an der er entsteht.
    httpMock.expectNone((r) => r.method === 'POST');
    expect(component.submitting).toBeFalse();
  });

  // Der heikelste Pfad: eine Antwort OHNE das Feld (ältere API, Antwort aus
  // einem Zwischenspeicher). Der Rückfall muss „nichts gesperrt" sein — der
  // Riegel liegt am Server, ein Rückfall auf „gesperrt" hielte legitime
  // Anträge auf.
  it('behandelt eine Antwort ohne das Feld als nicht gesperrt', () => {
    search();

    expect(component.blockedRequestTypes).toEqual([]);
    expect(component.isTypeBlocked('transfer')).toBeFalse();
    expect(component.requestType).toBe('transfer');
  });

  // Der Befund, um den es geht: Nach einem umgelegten Treffer stand die
  // Vorauswahl beim nächsten Spieler weiter auf „Spielerfreigabe" — wer den
  // Radioknopf nicht erneut prüfte, stellte den falschen Antrag. Transfer und
  // Freigabe haben völlig verschiedene Folgen (Lizenzen entwertet vs. gültig),
  // und die API kann es nicht abfangen: Der Antrag ist gültig, nur die falsche
  // Art.
  it('setzt die Vorauswahl bei der naechsten Suche zurueck', () => {
    search(['transfer']);
    expect(component.requestType).toBe('release');

    search([], undefined, 43);

    expect(component.requestType).toBe('transfer');
    expect(component.blockedRequestTypes).toEqual([]);
  });

  it('nennt den Grund der API statt des eigenen Textes', () => {
    search(['transfer'], {
      transfer:
        'Für diesen Spieler wurde am 20.08.2026 ein Transfer abgeschlossen.',
    });

    expect(component.blockedReason('transfer')).toContain('20.08.2026');
  });

  it('faellt ohne Grund der API auf den eigenen Text zurueck', () => {
    search(['release']);

    expect(component.blockedReason('release')).toBeTruthy();
  });

  // Beide Arten gesperrt: Die API weist diesen Fall in der Suche selbst ab, die
  // Maske muss ihn trotzdem aushalten (Antwort einer älteren Suche, danach
  // gewechselter Verein).
  it('sperrt den Knopf, wenn beide Arten gesperrt sind', () => {
    search(['transfer', 'release']);

    expect(component.allTypesBlocked).toBeTrue();
    component.submit();
    httpMock.expectNone((r) => r.method === 'POST');
  });

  // Die Suche prüft gegen genau den gewählten Verein (Zuständigkeit,
  // Deaktivierung, laufende Freigabe auf ihn). Ihr Ergebnis gilt für einen
  // anderen Verein nicht, auch die gesperrten Arten nicht.
  it('verwirft den Treffer beim Wechsel des aufnehmenden Vereins', () => {
    search(['transfer']);

    component.onRequestingClubChange(9);

    expect(component.foundPlayer).toBeNull();
    expect(component.blockedRequestTypes).toEqual([]);
    expect(component.selectedClubId).toBe(9);
  });
});
