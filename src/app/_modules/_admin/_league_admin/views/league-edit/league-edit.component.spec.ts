import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterLink } from '@angular/router';
import {
  RouterTestingHarness,
  RouterTestingModule,
} from '@angular/router/testing';
import { of } from 'rxjs';
import {
  AssociationService,
  DocumentTypeService,
  getTranslocoTestingModule,
  LeagueService,
} from '@floorball/core';
import { UikitCommonModule } from '@floorball/uikit/common';
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
    const errBadInput = 'leagueAdmin.notifications.errMinimumAgeBadInput';

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

      expect(component.errorMsg(league)).toContain(errBadInput);
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
      expect(component.errorMsg(league)).not.toContain(errBadInput);
    });
  });

  // Die Overage-Regel lockert nur einen Stichtag "geboren ab"; dieselbe
  // Bedingung prueft die API (League#female_overage_needs_born_from_deadline).
  describe('errorMsg: Overage-Regel', () => {
    const errFemaleOverage = 'leagueAdmin.notifications.errFemaleOverage';

    function errorsFor(changes: Partial<League>): string[] {
      const fixture = TestBed.createComponent(LeagueEditComponent);
      const component = fixture.componentInstance;
      component.newLeague();

      let league!: League;
      component.league$?.subscribe((l) => (league = l));
      Object.assign(league, changes);

      return component.errorMsg(league);
    }

    it('meldet nichts ohne Overage-Regel', () => {
      expect(errorsFor({ female_overage_years: null })).not.toContain(
        errFemaleOverage
      );
    });

    it('akzeptiert die Regel mit Stichtag geboren ab', () => {
      expect(
        errorsFor({
          female_overage_years: 1,
          before_deadline: false,
          deadline: '2014-01-01',
        })
      ).not.toContain(errFemaleOverage);
    });

    it('lehnt die Regel bei geboren bis oder ohne Stichtag ab', () => {
      expect(
        errorsFor({
          female_overage_years: 1,
          before_deadline: true,
          deadline: '2014-01-01',
        })
      ).toContain(errFemaleOverage);
      expect(
        errorsFor({
          female_overage_years: 1,
          before_deadline: false,
          deadline: undefined,
        })
      ).toContain(errFemaleOverage);
    });
  });

  // Reiter mit echtem Template. Die Dienste liefern nur, was die Ansicht zum
  // Aufbauen braucht.
  describe('Reiter', () => {
    const existing = {
      id: 5,
      game_operation_id: 1,
      name: 'Testliga',
      short_name: 'TL',
      order_key: '1',
      league_modus: 'league',
      league_class_id: 'll',
      age_group: 'Herren',
      periods: 3,
      period_length: 20,
      overtime_length: 10,
      qualifications: [],
      required_documents: [],
    } as unknown as League;

    let league: League;
    let harness: RouterTestingHarness;

    async function open(url: string): Promise<void> {
      league = { ...existing };
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [
          CommonModule,
          FormsModule,
          HttpClientTestingModule,
          UikitCommonModule,
          RouterLink,
          getTranslocoTestingModule(),
        ],
        declarations: [LeagueEditComponent],
        providers: [
          provideRouter([
            { path: 'ligen/neu', component: LeagueEditComponent },
            { path: 'ligen/:leagueId', component: LeagueEditComponent },
          ]),
          {
            provide: LeagueService,
            useValue: {
              getAdminLeagues: () => of([{ id: 1, name: 'FD', leagues: [] }]),
              getSingleLeague: () => of(league),
            },
          },
          {
            provide: DocumentTypeService,
            useValue: { adminGetDocumentTypes: () => of([]) },
          },
          { provide: AssociationService, useValue: { associations$: of([]) } },
        ],
      }).compileComponents();
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url, LeagueEditComponent);
      harness.detectChanges();
    }

    function tab(id: string): HTMLElement | null {
      return harness.routeNativeElement!.querySelector(
        `[data-testid="tab-${id}"]`
      );
    }

    function panel(): HTMLElement {
      return harness.routeNativeElement!.querySelector('[role="tabpanel"]')!;
    }

    it('oeffnet die Liga mit den Hauptdaten', async () => {
      await open('/ligen/5');
      expect(panel().getAttribute('data-testid')).toBe('tabpanel-liga');
      expect(panel().querySelector('[name="league_modus"]')).not.toBeNull();
      expect(panel().querySelector('[name="before_deadline"]')).toBeNull();
      expect(panel().querySelector('[name="table_modus"]')).toBeNull();
      expect(panel().querySelector('[name="direct_comparison"]')).toBeNull();
    });

    it('oeffnet den Reiter aus der URL', async () => {
      await open('/ligen/5?reiter=modus');
      expect(panel().getAttribute('data-testid')).toBe('tabpanel-modus');
      expect(
        panel().querySelector('[name="league_id_preround"]')
      ).not.toBeNull();
      // Tabellenregeln stehen mit im Modus-Reiter.
      expect(panel().querySelector('[name="table_modus"]')).not.toBeNull();
      expect(
        panel().querySelector('[name="direct_comparison"]')
      ).not.toBeNull();
    });

    it('bietet Logo und Banner nur fuer eine gespeicherte Liga an', async () => {
      await open('/ligen/5');
      expect(tab('medien')).not.toBeNull();

      await open('/ligen/neu?reiter=medien');
      expect(tab('medien')).toBeNull();
      expect(panel().getAttribute('data-testid')).toBe('tabpanel-liga');
    });

    it('markiert den Reiter mit dem fehlenden Pflichtfeld', async () => {
      await open('/ligen/5');
      expect(tab('regeln')!.className).not.toContain('!text-red-600');

      // Wie eine Eingabe im Formular: ohne markForCheck erreicht der Durchlauf
      // die Ansicht unter dem Harness-Wurzelelement nicht.
      league.periods = 0;
      harness.routeDebugElement!.injector.get(ChangeDetectorRef).markForCheck();
      harness.detectChanges();

      expect(tab('regeln')!.className).toContain('!text-red-600');
      expect(tab('liga')!.className).not.toContain('!text-red-600');
      expect(tab('modus')!.className).not.toContain('!text-red-600');
    });

    // Der Reiterwechsel zerstoert das Feld samt unlesbarem Text, das Modell
    // bleibt null. Die Sperre muss bleiben, sonst wuerde still "keine
    // Untergrenze" gespeichert.
    it('haelt die unlesbare Mindestalter-Eingabe ueber den Reiterwechsel fest', async () => {
      await open('/ligen/5?reiter=regeln');
      const component = harness.routeDebugElement!
        .componentInstance as LeagueEditComponent;
      component.onMinimumAgeInput({
        validity: { badInput: true },
      } as HTMLInputElement);
      harness.detectChanges();

      tab('liga')!.click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(panel().getAttribute('data-testid')).toBe('tabpanel-liga');
      expect(component.error(league)).toBeTrue();
      expect(tab('regeln')!.className).toContain('!text-red-600');
      expect(harness.routeNativeElement!.textContent).toContain(
        'leagueAdmin.notifications.errMinimumAgeBadInput'
      );
    });

    // Zurueck im Reiter ist das Feld leer, und ein leeres Zahlenfeld loest
    // kein input aus. Verwerfen ist der einzige Weg zu "keine Untergrenze".
    it('laesst die unlesbare Eingabe nach dem Reiterwechsel verwerfen', async () => {
      await open('/ligen/5?reiter=regeln');
      const component = harness.routeDebugElement!
        .componentInstance as LeagueEditComponent;
      component.onMinimumAgeInput({
        validity: { badInput: true },
      } as HTMLInputElement);
      harness.detectChanges();

      tab('liga')!.click();
      await harness.fixture.whenStable();
      harness.detectChanges();
      tab('regeln')!.click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      const field = panel().querySelector<HTMLInputElement>(
        '[name="minimum_age"]'
      )!;
      expect(field.value).toBe('');
      expect(component.error(league)).toBeTrue();

      harness
        .routeNativeElement!.querySelector<HTMLButtonElement>(
          '[data-testid="discard-minimum-age"]'
        )!
        .click();
      harness.detectChanges();

      expect(component.error(league)).toBeFalse();
      expect(league.minimum_age).toBeNull();
      expect(
        harness.routeNativeElement!.querySelector(
          '[data-testid="discard-minimum-age"]'
        )
      ).toBeNull();
      expect(harness.routeNativeElement!.textContent).toContain(
        'leagueAdmin.edit.saveChanges'
      );
    });
  });
});
