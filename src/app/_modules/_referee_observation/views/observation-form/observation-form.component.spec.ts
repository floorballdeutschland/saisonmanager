import { ChangeDetectorRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import {
  NotificationService,
  RefereeObservationService,
} from '@floorball/core';
import {
  RefereeObservation,
  RefereeObservationCandidate,
} from '@floorball/types';
import { getTranslocoTestingModule } from '../../../_core/_i18n/transloco-testing';
import { ObservationFormComponent } from './observation-form.component';

/**
 * Der Bogen ist vollständig oder gar nicht: Das Original-Formular verlangt jede
 * Bewertung und jeden Text. Wichtiger noch ist die Zuordnung der Bewertungen
 * über die Referee-PK statt über die Position -- eine Verwechslung würde die
 * Note der falschen Person zuschreiben, und niemand könnte das später bemerken.
 *
 * Direkt instanziiert statt über TestBed: geprüft wird die Logik, das Template
 * trägt dazu nichts bei.
 */
describe('ObservationFormComponent', () => {
  let component: ObservationFormComponent;
  let service: jasmine.SpyObj<RefereeObservationService>;
  let router: jasmine.SpyObj<Router>;

  const candidate: RefereeObservationCandidate = {
    game_id: 42,
    game_number: '101',
    date: '2026-08-01',
    start_time: '14:00',
    home_team: 'Heim',
    guest_team: 'Gast',
    league: 'Liga',
    league_id: 7,
    league_level: 'Meisterrunde · 1. Bundesliga',
    game_operation_slug: 'fd',
    assigned_as_coach: true,
    referees: [
      { referee_id: 11, name: 'Anna Schiri', position: 1 },
      { referee_id: 22, name: 'Bo Pfiff', position: 2 },
    ],
    done: false,
    observation_id: null,
  };

  function build(route = '42'): void {
    component = new ObservationFormComponent(
      service,
      {
        snapshot: { paramMap: { get: () => route } },
      } as unknown as ActivatedRoute,
      router,
      { success: () => undefined } as unknown as NotificationService,
      { translate: (key: string) => key } as unknown as TranslocoService,
      { markForCheck: () => undefined } as unknown as ChangeDetectorRef
    );
  }

  function fillEverything(): void {
    component.matchDescription = 'Kopf-an-Kopf.';
    component.otherMatters = 'Nichts.';
    component.finalComments = 'Kommunikation ausbauen.';
    component.dimensions.forEach((dimension, index) => {
      if (dimension.commentKey) {
        component.comments[dimension.key] = `Text ${index}`;
      }
      component.setPairRating(dimension, 4);
      component.setRefereeRating(11, dimension, 6);
      component.setRefereeRating(22, dimension, 3);
    });
  }

  beforeEach(() => {
    service = jasmine.createSpyObj<RefereeObservationService>(
      'RefereeObservationService',
      ['getObservableGames', 'submit']
    );
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    service.getObservableGames.and.returnValue(of([candidate]));
    service.submit.and.returnValue(of({ id: 1 } as RefereeObservation));
    build();
    component.ngOnInit();
  });

  it('laedt das Spiel aus der Auswahl und legt je Schiri einen Bewertungsblock an', () => {
    expect(component.candidate?.game_id).toBe(42);
    expect(component.notAllowed).toBeFalse();
    expect(Object.keys(component.refereeRatings)).toEqual(['11', '22']);
  });

  it('weist ein Spiel ab, das die Auswahl nicht enthaelt', () => {
    build('999');
    component.ngOnInit();

    expect(component.notAllowed).toBeTrue();
    expect(component.candidate).toBeNull();
  });

  it('weist ein bereits abgegebenes Spiel ab', () => {
    service.getObservableGames.and.returnValue(
      of([{ ...candidate, done: true }])
    );
    build();
    component.ngOnInit();

    expect(component.notAllowed).toBeTrue();
  });

  it('sperrt das Absenden, solange eine Bewertung oder ein Text fehlt', () => {
    expect(component.canSubmit()).toBeFalse();

    fillEverything();
    expect(component.canSubmit()).toBeTrue();

    // Eine einzelne fehlende Bewertung genuegt, um wieder zu sperren.
    delete component.refereeRatings[22]['overall'];
    expect(component.canSubmit()).toBeFalse();
  });

  it('sperrt das Absenden bei leerem Pflichttext', () => {
    fillEverything();
    component.finalComments = '   ';

    expect(component.canSubmit()).toBeFalse();
  });

  it('ordnet die Bewertungen der richtigen Person zu', () => {
    fillEverything();
    component.setRefereeRating(22, component.dimensions[0], 2);
    component.submit();

    const payload = service.submit.calls.mostRecent().args[0];
    const anna = payload.ratings.find((r) => r.referee_id === 11);
    const bo = payload.ratings.find((r) => r.referee_id === 22);

    expect(anna?.stick_play_rating).toBe(6);
    expect(bo?.stick_play_rating).toBe(2);
    expect(payload.pair_overall_rating).toBe(4);
    expect(payload.game_id).toBe(42);
  });

  it('sendet getrimmte Texte', () => {
    fillEverything();
    component.matchDescription = '  Kopf-an-Kopf.  ';
    component.submit();

    expect(service.submit.calls.mostRecent().args[0].match_description).toBe(
      'Kopf-an-Kopf.'
    );
  });

  it('geht nach dem Absenden zurueck zur Uebersicht', () => {
    fillEverything();
    component.submit();

    expect(router.navigate).toHaveBeenCalledWith([
      '/schiedsrichter/meine-beobachtungen',
    ]);
  });

  it('loest die Sperre nach einem Fehler, damit ein zweiter Versuch moeglich bleibt', () => {
    fillEverything();
    service.submit.and.returnValue(throwError(() => new Error('kaputt')));
    component.submit();

    expect(component.submitting).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('sendet nicht doppelt, solange eine Abgabe laeuft', () => {
    fillEverything();
    component.submitting = true;
    component.submit();

    expect(service.submit).not.toHaveBeenCalled();
  });
});

/**
 * Pfeift ein Gast mit einem regulären Partner, bietet der Bogen nur den
 * Partner zur Einzelbewertung an. Der Hinweis erklärt, warum die zweite
 * Person fehlt; ohne ihn sähe das wie ein Datenfehler aus.
 */
describe('ObservationFormComponent (Hinweis auf nicht bewertbare Schiris)', () => {
  const base: RefereeObservationCandidate = {
    game_id: 42,
    game_number: '101',
    date: '2026-08-01',
    start_time: null,
    home_team: 'Heim',
    guest_team: 'Gast',
    league: null,
    league_id: null,
    league_level: null,
    game_operation_slug: null,
    assigned_as_coach: true,
    referees: [{ referee_id: 11, name: 'Anna Schiri', position: 1 }],
    done: false,
    observation_id: null,
  };

  function render(
    candidate: RefereeObservationCandidate
  ): ComponentFixture<ObservationFormComponent> {
    TestBed.configureTestingModule({
      declarations: [ObservationFormComponent],
      imports: [
        FormsModule,
        // Global unter dem Alias, weil die Komponente ohne ihr Modul im
        // TestBed steht und der Scope dann nicht geladen wird.
        getTranslocoTestingModule({
          de: {
            refereeObservation: {
              form: { unratedHint: 'Nicht einzeln bewertet: {{names}}.' },
            },
          },
        }),
      ],
      providers: [
        {
          provide: RefereeObservationService,
          useValue: { getObservableGames: () => of([candidate]) },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '42' } } },
        },
        { provide: Router, useValue: { navigate: () => undefined } },
        { provide: NotificationService, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(ObservationFormComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('zeigt den Hinweis mit dem Namen des Gastes', () => {
    const fixture = render({
      ...base,
      unrated_referee_names: ['Gustav Gast'],
    });
    const hint = fixture.nativeElement.querySelector(
      '[data-testid="unrated-hint"]'
    );
    expect(hint?.textContent).toContain('Nicht einzeln bewertet: Gustav Gast.');
  });

  it('zeigt keinen Hinweis bei vollstaendigem Gespann', () => {
    const fixture = render(base);
    expect(
      fixture.nativeElement.querySelector('[data-testid="unrated-hint"]')
    ).toBeNull();
  });
});

/**
 * Bearbeitung des eigenen Bogens (feedback#74): Der Bogen kommt aus den eigenen
 * Bögen, nicht aus der Spielauswahl, und das Formular ist mit ihm vorbelegt.
 */
describe('ObservationFormComponent (Bearbeiten)', () => {
  let component: ObservationFormComponent;
  let service: jasmine.SpyObj<RefereeObservationService>;
  let router: jasmine.SpyObj<Router>;

  const observation: RefereeObservation = {
    id: 5,
    game_id: 42,
    game_number: '101',
    date: '2026-08-01',
    home_team: 'Heim',
    guest_team: 'Gast',
    league: 'Liga',
    league_id: 7,
    game_operation_slug: 'fd',
    coach_id: 9,
    coach_name: 'Cem Coach',
    status: 'visible',
    submitted_at: '2026-08-02T10:00:00Z',
    edited_at: null,
    assigned_as_coach: true,
    match_description: 'Kopf-an-Kopf.',
    stick_play_comment: 'Stock.',
    physical_play_comment: 'Koerper.',
    penalty_line_comment: 'Strafen.',
    game_management_comment: 'Leitung.',
    other_matters: 'Nichts.',
    final_comments: 'Kommunikation ausbauen.',
    pair_stick_play_rating: 5,
    pair_physical_play_rating: 5,
    pair_penalty_line_rating: 4,
    pair_game_management_rating: 5,
    pair_overall_rating: 5,
    ratings: [
      {
        referee_id: 22,
        referee_name: 'Bo Pfiff',
        position: 2,
        stick_play_rating: 3,
        physical_play_rating: 3,
        penalty_line_rating: 3,
        game_management_rating: 3,
        overall_rating: 3,
      },
      {
        referee_id: 11,
        referee_name: 'Anna Schiri',
        position: 1,
        stick_play_rating: 6,
        physical_play_rating: 6,
        penalty_line_rating: 6,
        game_management_rating: 6,
        overall_rating: 6,
      },
    ],
  };

  function build(id = '5'): void {
    component = new ObservationFormComponent(
      service,
      {
        snapshot: {
          data: { mode: 'edit' },
          paramMap: {
            get: (key: string) => (key === 'observationId' ? id : null),
          },
        },
      } as unknown as ActivatedRoute,
      router,
      { success: () => undefined } as unknown as NotificationService,
      { translate: (key: string) => key } as unknown as TranslocoService,
      { markForCheck: () => undefined } as unknown as ChangeDetectorRef
    );
    component.ngOnInit();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj<RefereeObservationService>(
      'RefereeObservationService',
      ['getObservableGames', 'getMyObservations', 'submit', 'update']
    );
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    service.getMyObservations.and.returnValue(of([observation]));
    service.update.and.returnValue(of(observation));
    build();
  });

  it('belegt das Formular mit dem abgegebenen Bogen vor', () => {
    expect(component.isEdit).toBeTrue();
    expect(component.notAllowed).toBeFalse();
    expect(service.getObservableGames).not.toHaveBeenCalled();
    expect(component.candidate?.referees.map((r) => r.referee_id)).toEqual([
      11, 22,
    ]);
    expect(component.finalComments).toBe('Kommunikation ausbauen.');
    expect(component.comments['penaltyLine']).toBe('Strafen.');
    expect(component.pairRatings['penaltyLine']).toBe(4);
    expect(component.refereeRatings[22]['overall']).toBe(3);
    expect(component.canSubmit()).toBeTrue();
  });

  it('speichert ueber update statt ueber submit, mit den geaenderten Werten', () => {
    component.finalComments = '  Korrigiert.  ';
    component.setRefereeRating(22, component.dimensions[4], 4);
    component.submit();

    expect(service.submit).not.toHaveBeenCalled();
    const [id, payload] = service.update.calls.mostRecent().args;
    expect(id).toBe(5);
    expect(payload.final_comments).toBe('Korrigiert.');
    expect(
      payload.ratings.find((r) => r.referee_id === 22)?.overall_rating
    ).toBe(4);
    expect(
      payload.ratings.find((r) => r.referee_id === 11)?.overall_rating
    ).toBe(6);
    expect(router.navigate).toHaveBeenCalledWith([
      '/schiedsrichter/meine-beobachtungen',
    ]);
  });

  it('weist einen Bogen ab, der nicht zu den eigenen gehoert', () => {
    build('999');

    expect(component.notAllowed).toBeTrue();
    expect(component.candidate).toBeNull();
  });

  it('nennt beim Bearbeiten die sofortige Sichtbarkeit', () => {
    expect(component.hintKey).toBe('refereeObservation.form.editHint');
  });

  it('weist bei einem zurueckgenommenen Bogen auf die Unsichtbarkeit hin', () => {
    service.getMyObservations.and.returnValue(
      of([{ ...observation, status: 'hidden' as const }])
    );
    build();

    expect(component.notAllowed).toBeFalse();
    expect(component.hintKey).toBe('refereeObservation.form.editHiddenHint');
  });

  it('merkt sich den Vermerk einer frueheren Bearbeitung', () => {
    service.getMyObservations.and.returnValue(
      of([{ ...observation, edited_at: '2026-10-06T18:30:00Z' }])
    );
    build();

    expect(component.editedAtLabel).toContain('06.10.2026');
  });
});
