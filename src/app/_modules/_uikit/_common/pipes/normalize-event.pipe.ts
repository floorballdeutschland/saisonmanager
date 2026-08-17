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
  standalone: false,
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
                game,
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
                game,
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
    game: Game,
    additionalFields?: GameAdditionalFields
  ): GamePlayerEntry | undefined {
    if (number === undefined) return undefined;

    if (number >= 2001 && number <= 2005) {
      return this.resolveCoach(number - 2000, team, game, additionalFields);
    }

    return players.find((p) => p.trikot_number === number);
  }

  // Betreuer tragen keine Trikotnummer; Strafen gegen sie speichert der
  // Spielbericht unter 2001 bis 2005, also 2000 plus Betreuerplatz.
  //
  // Zwei Quellen, in dieser Reihenfolge: die internen Felder, die nur die
  // Verwaltung, der eigene Verein und das Spielsekretariat laden, und die
  // öffentliche Betreuerliste am Spiel. Ohne die zweite blieb eine
  // Betreuerstrafe im öffentlichen Spielbericht ohne Namen.
  private resolveCoach(
    slot: number,
    team: 'home' | 'guest',
    game: Game,
    additionalFields?: GameAdditionalFields
  ): GamePlayerEntry | undefined {
    const internal =
      team === 'home'
        ? additionalFields?.home_team_coaches
        : additionalFields?.guest_team_coaches;
    type CoachKey = keyof NonNullable<typeof internal>;
    const firstName = (internal?.[`coach${slot}_first_name` as CoachKey] ??
      '') as string;
    const lastName = (internal?.[`coach${slot}_last_name` as CoachKey] ??
      '') as string;

    if (firstName || lastName) {
      return this.coachEntry(slot, firstName, lastName);
    }

    const published = (
      team === 'home' ? game.home_coaches : game.guest_coaches
    )?.find((coach) => coach.slot === slot);
    if (!published) return undefined;

    // Altdaten kennen nur den zusammengesetzten Namen; der steht dann als
    // Ganzes im Nachnamensfeld, statt die Zeile leer zu lassen.
    //
    // Nur dann, und nicht schon bei fehlendem Nachnamen: Die API setzt `name`
    // aus den vorhandenen Teilen zusammen, ein Platz mit bloss einem Vornamen
    // liefert also `name === first_name`. Die Anzeige stellt beide Felder
    // hintereinander und schriebe den Namen sonst doppelt hin.
    if (published.first_name || published.last_name) {
      return this.coachEntry(slot, published.first_name, published.last_name);
    }

    return this.coachEntry(slot, '', published.name);
  }

  private coachEntry(
    slot: number,
    firstName: string,
    lastName: string
  ): GamePlayerEntry {
    return {
      player_id: 0,
      goalkeeper: false,
      player_name: lastName,
      player_firstname: firstName,
      trikot_number: 2000 + slot,
    };
  }
}
