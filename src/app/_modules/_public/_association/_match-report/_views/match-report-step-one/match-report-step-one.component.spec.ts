import { TestBed } from '@angular/core/testing';
import { Component, Input, NO_ERRORS_SCHEMA } from '@angular/core';
import { By } from '@angular/platform-browser';

import { MatchReportStepOneComponent } from './match-report-step-one.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';

// Nur die Eingaenge, die geprueft werden. Der echte Kader-Dialog laedt beim
// Erzeugen seine Lizenzliste nach; hier geht es allein um die Frage, was die
// Vorlage an ihn weiterreicht.
@Component({ selector: 'fb-team-squad', template: '', standalone: false })
class TeamSquadStubComponent {
  @Input() side!: string;
  @Input() teamId!: number;
  @Input() team!: string;
  @Input() players!: unknown[];
  @Input() events: unknown[] = [];
  @Input() requestedLicensePlayable = false;
}

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
      declarations: [MatchReportStepOneComponent, TeamSquadStubComponent],
      schemas: [NO_ERRORS_SCHEMA],
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

  // Die zweite Stufe der Verdrahtung: Das Spiel traegt die Regel, der
  // Kader-Dialog filtert danach. Ohne diese Pruefung liesse sich die Bindung
  // aus der Vorlage entfernen, ohne dass ein Test rot wird.
  function squad(requestedLicensePlayable?: boolean): TeamSquadStubComponent {
    const fixture = TestBed.createComponent(MatchReportStepOneComponent);
    fixture.componentInstance.game = {
      id: 1,
      home_team_id: 4,
      guest_team_id: 5,
      home_team_name: 'Heim',
      guest_team_name: 'Gast',
      players: { home: [], guest: [] },
      events: [],
      requested_license_playable: requestedLicensePlayable,
    } as never;
    fixture.componentInstance.addDialogOpen = 'home';
    fixture.detectChanges();

    return fixture.debugElement.query(By.directive(TeamSquadStubComponent))
      .componentInstance as TeamSquadStubComponent;
  }

  it('reicht die Regel des Spiels an den Kader-Dialog durch', () => {
    expect(squad(true).requestedLicensePlayable).toBeTrue();
    expect(squad(false).requestedLicensePlayable).toBeFalse();
  });

  // Frontend-Deploy vor dem API-Deploy: Das Feld fehlt am Spiel. Der Dialog
  // muss dann false bekommen und nicht undefined, sonst filterte er nach einem
  // Wert, den niemand gesetzt hat.
  it('macht aus einem fehlenden Feld ein ausdrueckliches false', () => {
    expect(squad(undefined).requestedLicensePlayable).toBeFalse();
  });
});
