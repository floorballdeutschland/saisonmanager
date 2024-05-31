import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'startingPlayerPositionTitle' })
export class StartingPlayerPositionTitlePipe implements PipeTransform {
  transform(position: string): string {
    switch (position) {
      case 'defender1':
      case 'defender2':
        return 'Verteidigung';
      case 'forward1':
      case 'forward2':
        return 'Angriff';
      case 'center':
        return 'Center';
      case 'goal':
        return 'Tor';
      default:
        return '';
    }
  }
}
