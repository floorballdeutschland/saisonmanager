import { Pipe, PipeTransform } from '@angular/core';
import { GameOperation } from '@floorball/types';
import associationJson from '../../../../associations.json';

@Pipe({
  name: 'color',
})
export class ColorPipe implements PipeTransform {
  associations = associationJson;

  transform(association: GameOperation | null | undefined): string {
    if (association) {
      const associationWithColor = this.associations.find(
        (a) => a.path === association.path
      );

      return associationWithColor ? associationWithColor.color : '#000000';
    }

    return '#000000';
  }
}
