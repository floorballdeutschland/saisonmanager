import { Pipe, PipeTransform } from '@angular/core';
import {
  Game,
  GameAdditionalFields,
  GameEvent,
  GamePlayerEntry,
  NormalizedEvent,
  Side,
} from '@floorball/types';

@Pipe({
  name: 'normalizeEvent',
})
export class NormalizeEventPipe implements PipeTransform {
  transform(
    gameEvent: GameEvent | null | undefined,
    game: Game,
    additionalFields?: GameAdditionalFields
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
            ? this.resolvePlayer(
                gameEvent.number,
                game.players.home || [],
                'home',
                additionalFields
              )
            : undefined,
        assist:
          gameEvent.event_team === 'home'
            ? (game.players.home || []).find(
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
            ? this.resolvePlayer(
                gameEvent.number,
                game.players.guest || [],
                'guest',
                additionalFields
              )
            : undefined,
        assist:
          gameEvent.event_team === 'guest'
            ? (game.players.guest || []).find(
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
      goal_type: gameEvent.goal_type,
      guest: guest,
      home: home,
    };
  }

  private resolvePlayer(
    number: number | undefined,
    players: GamePlayerEntry[],
    team: 'home' | 'guest',
    additionalFields?: GameAdditionalFields
  ): GamePlayerEntry | undefined {
    if (number === undefined) return undefined;

    if (number >= 2001 && number <= 2005) {
      const index = number - 2000;
      const coaches =
        team === 'home'
          ? additionalFields?.home_team_coaches
          : additionalFields?.guest_team_coaches;
      type CoachKey = keyof NonNullable<typeof coaches>;
      const fn = coaches?.[`coach${index}_first_name` as CoachKey] ?? '';
      const ln = coaches?.[`coach${index}_last_name` as CoachKey] ?? '';
      if (!fn && !ln) return undefined;
      return {
        player_id: 0,
        goalkeeper: false,
        player_name: ln as string,
        player_firstname: fn as string,
        trikot_number: number,
      };
    }

    return players.find((p) => p.trikot_number === number);
  }
}
