import { Pipe, PipeTransform } from '@angular/core';
import { Referee } from 'src/app/_models/game.interface';

@Pipe({
  name: 'normalizeReferee',
})
export class NormalizeRefereePipe implements PipeTransform {
  transform(
    referees: Referee[] | null | undefined,
    nominatedReferee: string | null
  ): string | null {
    return this.formatReferee(referees) ?? nominatedReferee ?? 'keine Angaben';
  }

  formatReferee(referees: Referee[] | null | undefined): string | null {
    return referees && referees.length > 0
      ? referees.map((ref) => `${ref.first_name} ${ref.last_name}`).join(' / ')
      : null;
  }
}
