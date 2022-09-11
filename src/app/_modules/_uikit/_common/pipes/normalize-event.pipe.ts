import { Pipe, PipeTransform } from '@angular/core';
import { Game, GameEvent, NormalizedEvent, Side } from '@floorball/types';

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

    let home: Side = {};
    let guest: Side = {};

    if (gameEvent.event_type) {
      home = {
        ...home,
        scorer:
          gameEvent.event_team === 'home'
            ? game.players.home.find(
                (player) => player.trikot_number === gameEvent.number
              )
            : undefined,
        assist:
          gameEvent.event_team === 'home'
            ? game.players.home.find(
                (player) => player.trikot_number === gameEvent.assist
              )
            : undefined,
        goals: gameEvent.home_goals,
      };
    }

    if (gameEvent.event_type) {
      guest = {
        ...guest,
        scorer:
          gameEvent.event_team === 'guest'
            ? game.players.guest.find(
                (player) => player.trikot_number === gameEvent.number
              )
            : undefined,
        assist:
          gameEvent.event_team === 'guest'
            ? game.players.guest.find(
                (player) => player.trikot_number === gameEvent.assist
              )
            : undefined,
        goals: gameEvent.guest_goals,
      };
    }

    return {
      event_id: gameEvent.event_id,
      event_type: gameEvent.event_type,
      event_team: gameEvent.event_team,
      time: gameEvent.time,
      period: gameEvent.period,
      penalty_type: gameEvent.penalty_type,
      penalty_reason: gameEvent.penalty_reason,
      penalty_reason_string: gameEvent.penalty_reason_string,
      penalty_type_string: gameEvent.penalty_type_string,
      goal_type_string: gameEvent.goal_type_string,
      guest: guest,
      home: home,
    };
  }
}
