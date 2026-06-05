import { Pipe, PipeTransform } from '@angular/core';
import { GameOperation } from '@floorball/types';
import associationJson from '../../../../associations.json';

@Pipe({
  name: 'gradient',
  standalone: false,
})
export class GradientPipe implements PipeTransform {
  associations = associationJson;

  transform(association: GameOperation | null | undefined): string {
    if (association) {
      const associationWithColor = this.associations.find(
        (a) => a.path === association.path
      );

      return associationWithColor
        ? associationWithColor.gradient
        : '90deg, #000000, #000000';
    }

    return '90deg, #000000, #000000';
  }
}
