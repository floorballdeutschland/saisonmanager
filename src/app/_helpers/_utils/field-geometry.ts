/**
 * Spielfeld nach den Spielregeln (SPRGK 2022-05-20, Skizzen S. 77 bis 80) in
 * Metern, für Großfeld und Kleinfeld (fe#591). Einzige Quelle für die
 * Feldgrafik der Tablet-Erfassung und das Schussbild der Statistik.
 *
 * Gezeichnet werden die Sollmaße. Reale Hallen dürfen bis zu den Mindestmaßen
 * kleiner sein; die Zeichnung ist eine Orientierung, keine Vermessung.
 *
 * Koordinaten der Darstellung: x von der linken Stirnbande, y von der oberen
 * Seitenbande, beide in Metern.
 */
export type FieldSize = 'GF' | 'KF';

export interface FieldGeometry {
  size: FieldSize;
  /** Bande zu Bande, längs. */
  length: number;
  /** Bande zu Bande, quer. */
  width: number;
  /** Torlinie ab Stirnbande. */
  goalLine: number;
  /** Torraum, hintere Kante ab Stirnbande. */
  goalAreaBack: number;
  goalAreaDepth: number;
  goalAreaWidth: number;
  /** Torhüterraum (Schutzraum), ab Torlinie nach vorn. */
  goalkeeperAreaDepth: number;
  goalkeeperAreaWidth: number;
  goalWidth: number;
  /** Tor hinter der Torlinie, bis zur hinteren Torraumkante. */
  goalDepth: number;
  /** Bullypunkte auf verlängerter Torlinie und Mittellinie, ab Seitenbande. */
  faceoffInset: number;
  /** Die Regeln schreiben abgerundete Ecken vor, aber keinen Radius. */
  cornerRadius: number;
}

export const FIELD_GEOMETRY: Readonly<Record<FieldSize, FieldGeometry>> = {
  GF: {
    size: 'GF',
    length: 40,
    width: 20,
    goalLine: 3.5,
    goalAreaBack: 2.85,
    goalAreaDepth: 4,
    goalAreaWidth: 5,
    goalkeeperAreaDepth: 1,
    goalkeeperAreaWidth: 2.5,
    goalWidth: 1.6,
    goalDepth: 0.65,
    faceoffInset: 1.5,
    cornerRadius: 1,
  },
  KF: {
    size: 'KF',
    length: 28,
    width: 16,
    goalLine: 3,
    goalAreaBack: 2.35,
    goalAreaDepth: 3,
    goalAreaWidth: 4.5,
    goalkeeperAreaDepth: 1,
    goalkeeperAreaWidth: 2.5,
    goalWidth: 1.6,
    goalDepth: 0.65,
    faceoffInset: 1,
    cornerRadius: 1,
  },
};

/** Feldgröße einer Liga (`league.field_size`); unbekannt fällt auf Großfeld. */
export function fieldSizeOf(value: string | null | undefined): FieldSize {
  return value === 'KF' ? 'KF' : 'GF';
}

export function fieldGeometry(value: string | null | undefined): FieldGeometry {
  return FIELD_GEOMETRY[fieldSizeOf(value)];
}

export interface FieldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FieldSpot {
  x: number;
  y: number;
}

/** Linien und Punkte eines Feldes, beide Seiten, in Metern. */
export interface FieldMarkings {
  center: FieldSpot;
  goalAreas: FieldRect[];
  goalkeeperAreas: FieldRect[];
  goals: FieldRect[];
  faceoffSpots: FieldSpot[];
}

/** Rechteck der linken Seite, an der Mittelachse gespiegelt für die rechte. */
function bothSides(geometry: FieldGeometry, left: FieldRect): FieldRect[] {
  return [left, { ...left, x: geometry.length - left.x - left.width }];
}

export function fieldMarkings(geometry: FieldGeometry): FieldMarkings {
  const { length, width } = geometry;
  const middle = width / 2;
  const goalLines = [geometry.goalLine, length / 2, length - geometry.goalLine];

  return {
    center: { x: length / 2, y: middle },
    goalAreas: bothSides(geometry, {
      x: geometry.goalAreaBack,
      y: middle - geometry.goalAreaWidth / 2,
      width: geometry.goalAreaDepth,
      height: geometry.goalAreaWidth,
    }),
    goalkeeperAreas: bothSides(geometry, {
      x: geometry.goalLine,
      y: middle - geometry.goalkeeperAreaWidth / 2,
      width: geometry.goalkeeperAreaDepth,
      height: geometry.goalkeeperAreaWidth,
    }),
    goals: bothSides(geometry, {
      x: geometry.goalLine - geometry.goalDepth,
      y: middle - geometry.goalWidth / 2,
      width: geometry.goalDepth,
      height: geometry.goalWidth,
    }),
    faceoffSpots: goalLines.flatMap((x) => [
      { x, y: geometry.faceoffInset },
      { x, y: width - geometry.faceoffInset },
    ]),
  };
}
