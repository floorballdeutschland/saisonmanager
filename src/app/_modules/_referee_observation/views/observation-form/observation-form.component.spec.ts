import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { NotificationService, RefereeObservationService } from '@floorball/core';
import {
  RefereeObservation,
  RefereeObservationCandidate,
} from '@floorball/types';
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
    service.getObservableGames.and.returnValue(of([{ ...candidate, done: true }]));
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
