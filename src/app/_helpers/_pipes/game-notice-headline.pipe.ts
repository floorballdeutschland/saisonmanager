import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'gameNoticeHeadline',
  standalone: false,
})
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
