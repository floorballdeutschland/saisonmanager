import { Pipe, PipeTransform } from '@angular/core';
import { Game, GameEvent, GamePlayerEntry } from '@floorball/types';

interface Side {
  scorer?: GamePlayerEntry;
  assist?: GamePlayerEntry;
  goals: number;
}

interface NormalizedEvent {
  time: string;
  period: number;
  home: Side;
  guest: Side;
  penalty_id?: string;
  penalty_code_id?: string;
}

@Pipe({
  name: 'normalizeEvent',
})
export class NormalizeEventPipe implements PipeTransform {
  transform(
    gameEvent: GameEvent | null | undefined,
    game: Game
  ): NormalizedEvent | null {
    if (!gameEvent) {
      return null;
    }

    let home: Side = { goals: gameEvent.home_goals };
    let guest: Side = { goals: gameEvent.guest_goals };

    if (gameEvent.home_number) {
      home = {
        ...home,
        scorer: game.players.home.find(
          (player) => player.trikot_number === gameEvent.home_number
        ),
        assist: game.players.home.find(
          (player) => player.trikot_number === gameEvent.home_assist
        ),
      };
    }

    if (gameEvent.guest_number) {
      guest = {
        ...guest,
        scorer: game.players.guest.find(
          (player) => player.trikot_number === gameEvent.guest_number
        ),
        assist: game.players.guest.find(
          (player) => player.trikot_number === gameEvent.guest_assist
        ),
      };
    }

    const normalizedEvent = {
      time: gameEvent.time,
      period: gameEvent.period,
      penalty_code_id: gameEvent.penalty_code_id,
      penalty_id: gameEvent.penalty_id,
      guest: guest,
      home: home,
    };

    console.log(normalizedEvent);

    return normalizedEvent;
  }
}
