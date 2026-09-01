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

@Component({ selector: 'fb-overlay-links', template: '', standalone: false })
class OverlayLinksStubComponent {
  @Input() game!: unknown;
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
      declarations: [
        MatchReportStepOneComponent,
        TeamSquadStubComponent,
        OverlayLinksStubComponent,
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MatchReportStepOneComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Der Abschnitt selbst steckt in einer eigenen Komponente, weil es ihn auch
  // in der Begrüßung gibt. Geprüft wird hier nur, dass die Vorlage ihr das
  // Spiel reicht: Ohne Spieltags-Kennung findet sie ihren Zugang nicht.
  it('reicht das Spiel an die Overlay-Links durch', () => {
    const fixture = TestBed.createComponent(MatchReportStepOneComponent);
    const game = {
      id: 1,
      game_day_id: 7,
      home_team_id: 4,
      guest_team_id: 5,
      home_team_name: 'Heim',
      guest_team_name: 'Gast',
      players: { home: [], guest: [] },
      events: [],
    } as never;
    fixture.componentInstance.game = game;
    // Der Abschnitt hängt an den Spielinformationen, die es nur mit den
    // Zusatzfeldern gibt.
    fixture.componentInstance.additionalFields = {} as never;
    fixture.detectChanges();

    const overlay = fixture.debugElement.query(
      By.directive(OverlayLinksStubComponent)
    ).componentInstance as OverlayLinksStubComponent;
    expect(overlay.game).toBe(game);
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
