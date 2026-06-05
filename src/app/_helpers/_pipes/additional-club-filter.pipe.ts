import { Pipe, PipeTransform } from '@angular/core';
import { ClubMembership } from '@floorball/types';

@Pipe({
  name: 'additionalClubFilter',
  standalone: false,
})
export class AdditionalClubFilterPipe implements PipeTransform {
  transform(allClasses: ClubMembership[], current: boolean): ClubMembership[] {
    return allClasses.filter((club) => {
      const validUntil = new Date(club.valid_until || '');
      const now = new Date(Date.now());

      return !club.home_club && (!current || validUntil >= now);
    });
  }
}
