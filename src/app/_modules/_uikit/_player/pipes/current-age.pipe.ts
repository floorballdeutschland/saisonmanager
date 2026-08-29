import { Pipe, PipeTransform } from '@angular/core';
import { PlayerWithLicense } from '@floorball/types';

@Pipe({
  name: 'currentAge',
  standalone: false,
})
export class CurrentAgePipe implements PipeTransform {
  transform(player: PlayerWithLicense, gamedayDate = ''): number {
    // Ohne Geburtsdatum gibt es kein Alter. Vorher lief das in `new Date(null)`
    // und damit auf den 01.01.1970, also ein Alter von ueber 50 Jahren. NaN
    // scheitert an jedem Vergleich und laesst die Minderjaehrigkeits-Hinweise
    // damit genauso aus wie bisher, ohne eine Zahl zu erfinden.
    if (!player.birthdate) return NaN;

    const today = gamedayDate === '' ? new Date() : new Date(gamedayDate);
    const birthDate = new Date(player.birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }
}
