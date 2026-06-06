import { Pipe, PipeTransform } from '@angular/core';
import { Referee } from 'src/app/_models/game.interface';

@Pipe({
  name: 'normalizeReferee',
  standalone: false,
})
export class NormalizeRefereePipe implements PipeTransform {
  transform(
    referees: Referee[] | null | undefined,
    nominatedReferee: string | null
  ): string | null {
    return (
      this.formatReferee(referees) ??
      this.formatNominated(nominatedReferee) ??
      'keine Angaben'
    );
  }

  formatReferee(referees: Referee[] | null | undefined): string | null {
    if (!referees || referees.length === 0) return null;
    const names = referees
      .map((ref) => [ref.first_name, ref.last_name].filter(Boolean).join(' '))
      .filter(Boolean);
    return names.length > 0 ? names.join(' / ') : null;
  }

  private formatNominated(raw: string | null): string | null {
    if (!raw?.trim()) return null;
    const names = raw
      .split(' / ')
      .map((seg) => {
        const match = seg.trim().match(/^\d+\s+([^,]+),\s*(.+)$/);
        return match ? `${match[2].trim()} ${match[1].trim()}` : seg.trim();
      })
      .filter(Boolean);
    return names.length > 0 ? names.join(' / ') : null;
  }
}
