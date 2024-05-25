import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'awardTitle' })
export class AwardTitlePipe implements PipeTransform {
  transform(award: string): string {
    switch (award) {
      case 'mvp':
        return 'Wertvollste:r Spieler:in';
      default:
        return '';
    }
  }
}
