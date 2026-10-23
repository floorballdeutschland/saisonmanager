import {
  FIELD_GEOMETRY,
  fieldGeometry,
  fieldMarkings,
  fieldSizeOf,
  leagueFieldSize,
} from './field-geometry';

describe('field-geometry', () => {
  it('nimmt die geerbte Feldgröße vor der eigenen', () => {
    expect(
      leagueFieldSize({ field_size: null, effective_field_size: 'KF' })
    ).toBe('KF');
    expect(leagueFieldSize({ field_size: 'KF' })).toBe('KF');
    expect(
      leagueFieldSize({ field_size: '', effective_field_size: null })
    ).toBe('');
    expect(leagueFieldSize(null)).toBeNull();
  });

  it('fällt ohne bekannte Feldgröße auf Großfeld zurück', () => {
    expect(fieldSizeOf('KF')).toBe('KF');
    expect(fieldSizeOf('GF')).toBe('GF');
    expect(fieldSizeOf(null)).toBe('GF');
    expect(fieldSizeOf(undefined)).toBe('GF');
    expect(fieldSizeOf('')).toBe('GF');
    expect(fieldGeometry('KF')).toBe(FIELD_GEOMETRY.KF);
  });

  it('hat die Seitenverhältnisse 2 : 1 (GF) und 1,75 : 1 (KF)', () => {
    expect(FIELD_GEOMETRY.GF.length / FIELD_GEOMETRY.GF.width).toBe(2);
    expect(FIELD_GEOMETRY.KF.length / FIELD_GEOMETRY.KF.width).toBe(1.75);
  });

  describe('Großfeld', () => {
    const marks = fieldMarkings(FIELD_GEOMETRY.GF);

    it('zeichnet den Torraum 4 x 5 m, 7,5 m von der Seitenbande', () => {
      expect(marks.goalAreas[0]).toEqual({
        x: 2.85,
        y: 7.5,
        width: 4,
        height: 5,
      });
      // Rechte Seite gespiegelt, hintere Kante 2,85 m vor der Stirnbande.
      expect(marks.goalAreas[1].x + marks.goalAreas[1].width).toBeCloseTo(
        40 - 2.85,
        5
      );
    });

    it('legt Schutzraum und Tor an die Torlinie', () => {
      expect(marks.goalkeeperAreas[0]).toEqual({
        x: 3.5,
        y: 8.75,
        width: 1,
        height: 2.5,
      });
      expect(marks.goals[0].x).toBeCloseTo(2.85, 5);
      expect(marks.goals[0].y).toBeCloseTo(9.2, 5);
      // Seitlich 1,70 m zwischen Tor und Torraumkante.
      expect(marks.goals[0].y - marks.goalAreas[0].y).toBeCloseTo(1.7, 5);
    });

    it('setzt Mittelpunkt und sechs Bullypunkte, kein Mittelkreis', () => {
      expect(marks.center).toEqual({ x: 20, y: 10 });
      expect(marks.faceoffSpots).toEqual([
        { x: 3.5, y: 1.5 },
        { x: 3.5, y: 18.5 },
        { x: 20, y: 1.5 },
        { x: 20, y: 18.5 },
        { x: 36.5, y: 1.5 },
        { x: 36.5, y: 18.5 },
      ]);
    });
  });

  describe('Kleinfeld', () => {
    const marks = fieldMarkings(FIELD_GEOMETRY.KF);

    it('zeichnet den Torraum 3 x 4,5 m, 5,75 m von der Seitenbande', () => {
      expect(marks.goalAreas[0]).toEqual({
        x: 2.35,
        y: 5.75,
        width: 3,
        height: 4.5,
      });
      // Vorderkante: Schutzraum 1 m plus 1,35 m bis zum Torraumende.
      expect(
        marks.goalAreas[0].x +
          marks.goalAreas[0].width -
          (marks.goalkeeperAreas[0].x + marks.goalkeeperAreas[0].width)
      ).toBeCloseTo(1.35, 5);
      expect(marks.goalAreas[1].x).toBeCloseTo(28 - 2.35 - 3, 5);
    });

    it('legt Tor 1,45 m neben die Torraumkante', () => {
      expect(marks.goals[0].x).toBeCloseTo(2.35, 5);
      expect(marks.goals[0].y - marks.goalAreas[0].y).toBeCloseTo(1.45, 5);
    });

    it('setzt Bullypunkte 1 m von der Seitenbande', () => {
      expect(marks.center).toEqual({ x: 14, y: 8 });
      expect(marks.faceoffSpots.map((spot) => spot.x)).toEqual([
        3, 3, 14, 14, 25, 25,
      ]);
      expect(marks.faceoffSpots[1]).toEqual({ x: 3, y: 15 });
    });
  });
});
