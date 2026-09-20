import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { getTranslocoTestingModule } from '@floorball/core';
import { League } from '@floorball/types';
import { LeagueEditComponent } from './league-edit.component';

describe('LeagueEditComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [LeagueEditComponent],
    })
      .overrideTemplate(LeagueEditComponent, '')
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LeagueEditComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  // Das Mindestalter ist optional, gesetzt aber 1..99 - dieselben Grenzen wie
  // in der API-Validierung. Geprueft wird nur diese eine Meldung, damit der
  // Test nicht an den uebrigen Pflichtfeldern haengt.
  describe('errorMsg: Mindestalter', () => {
    const errMinimumAge = 'leagueAdmin.notifications.errMinimumAge';

    function errorsFor(minimumAge: number | null | undefined): string[] {
      const fixture = TestBed.createComponent(LeagueEditComponent);
      const component = fixture.componentInstance;
      component.newLeague();

      let league!: League;
      component.league$?.subscribe((l) => (league = l));
      league.minimum_age = minimumAge;

      return component.errorMsg(league);
    }

    it('meldet nichts, wenn das Feld leer bleibt', () => {
      expect(errorsFor(null)).not.toContain(errMinimumAge);
      expect(errorsFor(undefined)).not.toContain(errMinimumAge);
    });

    it('laesst ganze Zahlen von 1 bis 99 zu', () => {
      expect(errorsFor(1)).not.toContain(errMinimumAge);
      expect(errorsFor(15)).not.toContain(errMinimumAge);
      expect(errorsFor(99)).not.toContain(errMinimumAge);
    });

    it('meldet 0, negative, zu grosse und gebrochene Werte', () => {
      expect(errorsFor(0)).toContain(errMinimumAge);
      expect(errorsFor(-1)).toContain(errMinimumAge);
      expect(errorsFor(100)).toContain(errMinimumAge);
      expect(errorsFor(15.5)).toContain(errMinimumAge);
    });

    // Text im Zahlenfeld kommt im Modell als null an, sieht also aus wie
    // "keine Untergrenze", steht aber sichtbar im Feld. Ohne die native
    // Auskunft des Feldes wuerde der Editor still das Gegenteil speichern.
    it('meldet eine Eingabe, die der Browser nicht als Zahl lesen kann', () => {
      const fixture = TestBed.createComponent(LeagueEditComponent);
      const component = fixture.componentInstance;
      component.newLeague();

      let league!: League;
      component.league$?.subscribe((l) => (league = l));
      league.minimum_age = null;
      component.onMinimumAgeInput({
        validity: { badInput: true },
      } as HTMLInputElement);

      expect(component.errorMsg(league)).toContain(errMinimumAge);
    });

    it('vergisst die unlesbare Eingabe, sobald das Feld wieder lesbar ist', () => {
      const fixture = TestBed.createComponent(LeagueEditComponent);
      const component = fixture.componentInstance;
      component.newLeague();

      let league!: League;
      component.league$?.subscribe((l) => (league = l));
      component.onMinimumAgeInput({
        validity: { badInput: true },
      } as HTMLInputElement);
      component.onMinimumAgeInput({
        validity: { badInput: false },
      } as HTMLInputElement);
      league.minimum_age = 15;

      expect(component.errorMsg(league)).not.toContain(errMinimumAge);
    });
  });
});
