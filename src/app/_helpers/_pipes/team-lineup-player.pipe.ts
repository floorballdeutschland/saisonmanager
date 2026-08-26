import { Pipe, PipeTransform } from '@angular/core';
import { GamePlayerEntry, PlayerWithLicense } from '@floorball/types';

// License::APPROVED / License::REQUESTED in der API. Erteilt darf immer
// aufgestellt werden; ob der offene Antrag mitzählt, entscheidet der
// Landesverband der Liga (Game#requested_license_playable).
const LICENSE_STATUS_APPROVED = 1;
const LICENSE_STATUS_REQUESTED = 2;

@Pipe({
  name: 'teamLineupPlayer',
  standalone: false,
})
export class TeamLineupPlayerPipe implements PipeTransform {
  /**
   * `requestedLicensePlayable`: Der Landesverband der Liga lässt Personen mit
   * dem Lizenzstatus „beantragt" aufstellen. Standard ist false, damit ein
   * Frontend-Deploy vor dem API-Deploy (dort fehlt das Feld am Spiel noch) wie
   * bisher allein auf „erteilt" filtert.
   *
   * Bewusst nur der offene Antrag: „abgelehnt", „zurückgezogen" und „gesperrt"
   * bleiben draußen, auch wenn der Verband den Schalter gesetzt hat. Dieselbe
   * Regel wie in Game#license_status_playable? auf der Serverseite.
   */
  transform(
    allPlayers: PlayerWithLicense[],
    lineupPlayers: GamePlayerEntry[],
    status: 'all' | 'selected' | 'not-selected',
    requestedLicensePlayable = false
  ): {
    player: PlayerWithLicense;
    gamePlayerEntry: GamePlayerEntry | null;
  }[] {
    const items: {
      player: PlayerWithLicense;
      gamePlayerEntry: GamePlayerEntry | null;
    }[] = [];

    const isInLineup = (playerId: number) =>
      !!lineupPlayers?.find((lp) => lp.player_id === playerId);

    // Bereits Aufgestellte bleiben unabhängig vom Status in der Liste: Sonst
    // verschwänden sie aus dem Dialog, in dem man sie wieder herausnimmt.
    const isEligible = (statusId?: number) =>
      statusId === LICENSE_STATUS_APPROVED ||
      (requestedLicensePlayable && statusId === LICENSE_STATUS_REQUESTED);

    const eligiblePlayers = allPlayers.filter(
      (p) => isEligible(p.current_status?.license_status_id) || isInLineup(p.id)
    );

    eligiblePlayers.map((player) => {
      let lineupPlayer = null;
      switch (status) {
        case 'not-selected':
          if (
            !lineupPlayers?.find(
              (lineupPlayer) => lineupPlayer.player_id === player.id
            )
          ) {
            items.push({
              player,
              gamePlayerEntry: lineupPlayer,
            });
          }
          break;
        case 'selected':
          lineupPlayer = lineupPlayers?.find(
            (lineupPlayer) => lineupPlayer.player_id === player.id
          );
          if (lineupPlayer) {
            items.push({
              player,
              gamePlayerEntry: lineupPlayer,
            });
          }
          break;
        default:
          lineupPlayer = lineupPlayers?.find(
            (lineupPlayer) => lineupPlayer.player_id === player.id
          );
          items.push({
            player,
            gamePlayerEntry: lineupPlayer ?? null,
          });
          break;
      }
    });

    return items.sort(
      (a, b) =>
        a.player.last_name.localeCompare(b.player.last_name) ||
        a.player.first_name.localeCompare(b.player.first_name)
    );
  }
}
