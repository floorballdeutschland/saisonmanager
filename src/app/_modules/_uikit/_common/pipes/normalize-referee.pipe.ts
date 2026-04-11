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
    if (!referees || referees.length === 0) return null;
    const names = referees
      .map((ref) => [ref.first_name, ref.last_name].filter(Boolean).join(' '))
      .filter(Boolean);
    return names.length > 0 ? names.join(' / ') : null;
  }
}
