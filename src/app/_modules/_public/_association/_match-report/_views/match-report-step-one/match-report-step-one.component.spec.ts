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
  @Input() gameId?: number;
  @Input() teamId!: number;
  @Input() team!: string;
  @Input() players!: unknown[];
  @Input() events: unknown[] = [];
  @Input() requestedLicensePlayable = false;
}

@Component({ selector: 'fb-overlay-links', template: '', standalone: false })
class OverlayLinksStubComponent {
  @Input() gameDayId?: number | null;
  @Input() label = '';
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
  // in der Begrüßung und auf der Sekretariatsseite gibt. Geprüft wird hier nur,
  // dass die Vorlage ihr die Spieltags-Kennung reicht: ohne sie findet sie
  // ihren Zugang nicht.
  it('reicht den Spieltag an die Overlay-Links durch', () => {
    const fixture = TestBed.createComponent(MatchReportStepOneComponent);
    const game = {
      id: 1,
      game_day_id: 7,
      game_number: '4711',
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
    expect(overlay.gameDayId).toBe(7);
    expect(overlay.label).toBe('Spiel 4711');
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

  // Die Maske schreibt in das Spiel, dessen Kader sie zeigt (Spiel 61889).
  it('reicht die Spiel-ID an den Kader-Dialog durch', () => {
    expect(squad(true).gameId).toBe(1);
  });

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

  // Spiel 61889: Die Spielseite wird beim Wechsel in ein anderes Spiel nicht
  // neu aufgebaut. Blieb die Kadermaske offen, zeigte sie die Spieler des
  // alten Spiels und schrieb in das neue.
  describe('beim Wechsel in ein anderes Spiel', () => {
    function spiel(id: number, homeTeamId: number) {
      return {
        id,
        home_team_id: homeTeamId,
        guest_team_id: 5,
        home_team_name: 'Heim',
        guest_team_name: 'Gast',
        players: { home: [], guest: [] },
        events: [],
      };
    }

    // setInput statt Zuweisung ans Feld: Nur so laeuft ngOnChanges wie
    // unter der echten Spielseite.
    function aufbauen() {
      const fixture = TestBed.createComponent(MatchReportStepOneComponent);
      const stepOne = fixture.componentInstance;
      fixture.componentRef.setInput('game', spiel(61890, 10102));
      stepOne.addDialogOpen = 'home';
      stepOne.squadHistoryDialogOpen = 'home';
      fixture.detectChanges();
      return { fixture, stepOne };
    }

    it('schliesst die offene Kadermaske', () => {
      const { fixture, stepOne } = aufbauen();
      expect(
        fixture.debugElement.query(By.directive(TeamSquadStubComponent))
      ).not.toBeNull();

      fixture.componentRef.setInput('game', spiel(61889, 10100));
      fixture.detectChanges();

      expect(stepOne.addDialogOpen).toBe('');
      expect(stepOne.squadHistoryDialogOpen).toBe('');
      expect(
        fixture.debugElement.query(By.directive(TeamSquadStubComponent))
      ).toBeNull();
    });

    // Die Spielseite laedt das Spiel alle 30 Sekunden neu, als neues Objekt.
    // Das darf die Maske nicht unter den Haenden schliessen.
    it('laesst die Maske beim Nachladen desselben Spiels offen', () => {
      const { fixture, stepOne } = aufbauen();

      fixture.componentRef.setInput('game', spiel(61890, 10102));
      fixture.detectChanges();

      expect(stepOne.addDialogOpen).toBe('home');
      expect(stepOne.squadHistoryDialogOpen).toBe('home');
    });
  });
});
