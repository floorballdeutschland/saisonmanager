import { StartingPlayer } from '@floorball/types';
import { HasStartingPlayerPipe } from './has-starting-player.pipe';

describe('HasStartingPlayerPipe', () => {
  let pipe: HasStartingPlayerPipe;

  beforeEach(() => {
    pipe = new HasStartingPlayerPipe();
  });

  it('erkennt eine besetzte Aufstellung', () => {
    const players = [
      { player_id: null },
      { player_id: 4711 },
    ] as unknown as StartingPlayer[];

    expect(pipe.transform(players)).toBeTrue();
  });

  it('meldet eine unbesetzte Aufstellung als leer', () => {
    const players = [{ player_id: null }] as unknown as StartingPlayer[];

    expect(pipe.transform(players)).toBeFalse();
  });

  it('verträgt fehlende Aufstellungen, statt zu werfen', () => {
    expect(pipe.transform(null)).toBeFalse();
    expect(pipe.transform(undefined)).toBeFalse();
    expect(pipe.transform([])).toBeFalse();
  });
});
