import { Pipe, PipeTransform } from '@angular/core';
import { AwardPlayer } from '@floorball/types';

@Pipe({
  name: 'completedAwards',
  standalone: false,
})
export class CompletedAwardsFilterPipe implements PipeTransform {
  /**
   * Auszeichnungen mit gesetztem Spieler.
   *
   * Nimmt bewusst auch `null` und `undefined` an. Eine Pipe steht mitten im
   * Rendern: Wirft sie, bricht nicht nur ihr eigener Eintrag weg, sondern der
   * ganze restliche Ansichtsbaum. Genau das ist passiert, als die API bei
   * Spielen ohne Aufstellung `awards: {}` lieferte und `game.awards.home`
   * damit undefined war – die öffentliche Spielansicht rendert nur noch zu
   * einem Drittel (Sentry SAISONMANAGER-2M/2N/2P).
   *
   * Die Ursache liegt in der API und ist dort behoben. Diese Absicherung bleibt
   * trotzdem: Der Aufwand ist ein Fallback, der Schaden bei der nächsten
   * fehlenden Liste wieder eine halb gerenderte Seite.
   */
  transform(awards: AwardPlayer[] | null | undefined): AwardPlayer[] {
    return (awards ?? []).filter((award) => award.player_id);
  }
}
