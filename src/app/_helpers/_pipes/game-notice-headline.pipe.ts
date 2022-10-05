import { Pipe, PipeTransform } from '@angular/core';
import { Player } from '@floorball/types';

@Pipe({ name: 'gameNoticeHeadline' })
export class GameNoticeHeadlinePipe implements PipeTransform {
  transform(noticeType: string): string {
    switch (noticeType) {
      case 'Postponed':
        return 'Spiel verschoben';
      case 'Canceled':
        return 'Spiel abgesagt';
      case 'NoDateAndTime':
        return 'Noch nicht terminiert';
      default:
        return 'Sonstiges';
    }
  }
}
