import { Pipe, PipeTransform } from '@angular/core';
import { Player } from '@floorball/types';

@Pipe({ name: 'gameNoticeVisibility' })
export class GameNoticeVisibilityPipe implements PipeTransform {
  transform(
    noticeType: string | undefined,
    visibilityType: 'time' | 'date' | 'arena'
  ): boolean {
    switch (noticeType) {
      case 'Postponed':
        return ['arena'].includes(visibilityType);
      case 'Canceled':
        return false;
      case 'NoDateAndTime':
        return ['arena'].includes(visibilityType);
      default:
        return true;
    }
  }
}
