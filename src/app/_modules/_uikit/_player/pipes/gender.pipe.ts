// full-name.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { GenderKey, PLAYER_GENDERS } from '@floorball/types';

@Pipe({
  name: 'gender',
  standalone: false,
})
export class GenderPipe implements PipeTransform {
  transform(genderKey: GenderKey): string {
    if (genderKey) {
      return PLAYER_GENDERS[genderKey];
    }
    return '';
  }
}
