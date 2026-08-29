import { RefereeObservation } from '@floorball/types';
import { ObservationDetailComponent } from './observation-detail.component';

describe('ObservationDetailComponent', () => {
  let component: ObservationDetailComponent;

  function observation(
    overrides: Partial<RefereeObservation> = {}
  ): RefereeObservation {
    return {
      id: 1,
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
      assigned_as_coach: true,
      match_description: 'Kopf-an-Kopf.',
      stick_play_comment: 'Einheitlich.',
      physical_play_comment: 'Frueh eingefangen.',
      penalty_line_comment: 'Nachvollziehbar.',
      game_management_comment: 'Ruhig.',
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
      ...overrides,
    };
  }

  beforeEach(() => {
    component = new ObservationDetailComponent();
    component.observation = observation();
  });

  /**
   * Die Spalten des Rasters folgen der Gespann-Position und nicht der
   * Reihenfolge, in der die API die Zeilen liefert -- sonst stuenden die Noten
   * unter dem falschen Namen.
   */
  it('sortiert die Spalten nach der Position im Gespann', () => {
    expect(component.ratedReferees.map((r) => r.referee_id)).toEqual([11, 22]);
  });

  it('liest die Note zur Spalte und zur Dimension', () => {
    const overall = component.dimensions[4];

    expect(component.ratingFor(0, overall)).toBe(6);
    expect(component.ratingFor(1, overall)).toBe(3);
    expect(component.pairRating(overall)).toBe(5);
  });

  it('hat fuer die Gesamtspielbewertung kein eigenes Kommentarfeld', () => {
    expect(component.comment(component.dimensions[4])).toBeNull();
    expect(component.comment(component.dimensions[0])).toBe('Einheitlich.');
  });

  it('verlinkt das Spiel nur mit vollstaendigen Angaben', () => {
    expect(component.matchLink()).toEqual(['/', 'fd', 7, 'spiel', 42]);

    component.observation = observation({ league_id: null });
    expect(component.matchLink()).toBeNull();

    component.observation = observation({ game_operation_slug: null });
    expect(component.matchLink()).toBeNull();
  });

  it('gibt ein unbrauchbares Datum unveraendert zurueck', () => {
    expect(component.formatDate(null)).toBe('');
    expect(component.formatDate('kein Datum')).toBe('kein Datum');
  });

  it('kommt mit einer einzigen bewerteten Person zurecht', () => {
    component.observation = observation({
      ratings: [observation().ratings[1]],
    });

    expect(component.ratedReferees.length).toBe(1);
    expect(component.ratingFor(1, component.dimensions[0])).toBeNull();
  });
});
