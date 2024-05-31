import { Pipe, PipeTransform } from '@angular/core';
import { PlayerWithLicense } from '@floorball/types';

@Pipe({
  name: 'currentAge',
})
export class CurrentAgePipe implements PipeTransform {
  transform(player: PlayerWithLicense, gamedayDate = ''): number {
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
