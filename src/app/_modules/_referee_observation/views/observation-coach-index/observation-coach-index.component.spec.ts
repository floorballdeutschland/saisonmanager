import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { RefereeObservationService } from '@floorball/core';
import { RefereeObservationCandidate } from '@floorball/types';
import { ObservationCoachIndexComponent } from './observation-coach-index.component';

describe('ObservationCoachIndexComponent', () => {
  let component: ObservationCoachIndexComponent;
  let service: jasmine.SpyObj<RefereeObservationService>;

  function candidate(
    overrides: Partial<RefereeObservationCandidate>
  ): RefereeObservationCandidate {
    return {
      game_id: 1,
      game_number: null,
      date: '2026-08-01',
      start_time: null,
      home_team: 'Heim',
      guest_team: 'Gast',
      league: null,
      league_id: null,
      league_level: null,
      game_operation_slug: null,
      assigned_as_coach: true,
      referees: [],
      done: false,
      observation_id: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    service = jasmine.createSpyObj<RefereeObservationService>(
      'RefereeObservationService',
      ['getObservableGames', 'getMyObservations']
    );
    component = new ObservationCoachIndexComponent(service, {
      markForCheck: () => undefined,
    } as unknown as ChangeDetectorRef);
  });

  /**
   * Angesetzte Spiele stehen oben: Sie sind der Regelfall und die einzigen, zu
   * denen eine Erinnerungsmail kommt. Innerhalb beider Gruppen bleibt die
   * Reihenfolge der API (Datum absteigend) erhalten.
   */
  it('sortiert angesetzte Spiele nach oben, ohne die Datumsfolge zu brechen', () => {
    service.getObservableGames.and.returnValue(
      of([
        candidate({ game_id: 1, assigned_as_coach: false }),
        candidate({ game_id: 2, assigned_as_coach: true }),
        candidate({ game_id: 3, assigned_as_coach: false }),
        candidate({ game_id: 4, assigned_as_coach: true }),
      ])
    );
    service.getMyObservations.and.returnValue(of([]));
    component.ngOnInit();

    expect(component.openCandidates.map((c) => c.game_id)).toEqual([2, 4, 1, 3]);
  });

  it('trennt offene Spiele von bereits abgegebenen', () => {
    service.getObservableGames.and.returnValue(
      of([
        candidate({ game_id: 1, done: false }),
        candidate({ game_id: 2, done: true }),
      ])
    );
    service.getMyObservations.and.returnValue(of([]));
    component.ngOnInit();

    expect(component.openCandidates.map((c) => c.game_id)).toEqual([1]);
  });

  /**
   * Die eigenen Bögen sind der zweite Abschnitt der Seite. Scheitert er, muss
   * die Spielauswahl oben trotzdem bedienbar bleiben -- sonst kostet ein Fehler
   * im Nebenteil die eigentliche Funktion der Seite.
   */
  it('haelt die Spielauswahl bedienbar, wenn die eigenen Boegen nicht laden', () => {
    service.getObservableGames.and.returnValue(
      of([candidate({ game_id: 1 })])
    );
    service.getMyObservations.and.returnValue(
      throwError(() => new Error('kaputt'))
    );
    component.ngOnInit();

    expect(component.failed).toBeFalse();
    expect(component.openCandidates.length).toBe(1);
    expect(component.observations).toEqual([]);
  });

  it('meldet einen Fehler, wenn die Spielauswahl nicht laedt', () => {
    service.getObservableGames.and.returnValue(
      throwError(() => new Error('kaputt'))
    );
    service.getMyObservations.and.returnValue(of([]));
    component.ngOnInit();

    expect(component.failed).toBeTrue();
    expect(component.loading).toBeFalse();
  });

  it('gibt ein unbrauchbares Datum unveraendert zurueck, statt Invalid Date zu zeigen', () => {
    expect(component.formatDate(null)).toBe('');
    expect(component.formatDate('kein Datum')).toBe('kein Datum');
  });
});
