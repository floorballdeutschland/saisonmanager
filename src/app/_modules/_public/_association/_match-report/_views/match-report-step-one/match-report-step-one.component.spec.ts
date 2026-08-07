import { TestBed } from '@angular/core/testing';

import { MatchReportStepOneComponent } from './match-report-step-one.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';

describe('MatchReportStepOneComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Transloco gehört dazu, seit die Komponente den SessionService kennt:
      // Der zieht den TranslocoService nach, und ohne ihn scheitert schon das
      // Erzeugen der Komponente am Injector.
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [MatchReportStepOneComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MatchReportStepOneComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Der Spielbericht rendert auch für das Spielsekretariat, das nur einen
  // Einmal-Token hat. Liefe der Overlay-Abruf dort, antwortete er mit 401 und
  // der ErrorInterceptor meldete das Sekretariat mitten im Spiel ab.
  it('bietet die Overlay-Links ohne Anmeldung nicht an', () => {
    const fixture = TestBed.createComponent(MatchReportStepOneComponent);
    const component = fixture.componentInstance;
    component.game = { id: 1, game_day_id: 7 } as never;

    expect(component.canManageOverlay).toBeFalse();
  });
});
