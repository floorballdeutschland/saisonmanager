import { AwardPlayer } from '@floorball/types';
import { CompletedAwardsFilterPipe } from './completed-awards-filter.pipe';

describe('CompletedAwardsFilterPipe', () => {
  const pipe = new CompletedAwardsFilterPipe();

  const award = (playerId: number | string): AwardPlayer =>
    ({ award: 'mvp', team: 'Team', player_id: playerId }) as AwardPlayer;

  it('behält nur Auszeichnungen mit gesetztem Spieler', () => {
    const result = pipe.transform([award(7), award(''), award(9)]);

    expect(result.map((a) => a.player_id)).toEqual([7, 9]);
  });

  // Der eigentliche Fehlerfall: Die API lieferte bei Spielen ohne Aufstellung
  // `awards: {}`, damit war `game.awards.home` undefined. Eine werfende Pipe
  // reißt den restlichen Ansichtsbaum mit – die öffentliche Spielansicht
  // rendert dann nur zu einem Drittel (SAISONMANAGER-2M/2N/2P).
  it('verträgt undefined statt die Ansicht zu kippen', () => {
    expect(() => pipe.transform(undefined)).not.toThrow();
    expect(pipe.transform(undefined)).toEqual([]);
  });

  it('verträgt null', () => {
    expect(() => pipe.transform(null)).not.toThrow();
    expect(pipe.transform(null)).toEqual([]);
  });

  it('gibt bei einer leeren Liste eine leere Liste zurück', () => {
    expect(pipe.transform([])).toEqual([]);
  });
});
