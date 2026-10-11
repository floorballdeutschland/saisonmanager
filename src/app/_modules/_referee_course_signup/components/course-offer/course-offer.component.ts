import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { RefereeCourseOffer } from '@floorball/types';

/** Ein Kursangebot als Karte; Aktionen kommen über Content Projection. */
@Component({
  selector: 'fb-course-offer',
  templateUrl: './course-offer.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CourseOfferComponent {
  @Input({ required: true }) offer!: RefereeCourseOffer;

  euro(cents: number | null): string {
    return cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
  }

  get differentPrices(): boolean {
    return (
      this.offer.fee_non_member_cents !== null &&
      this.offer.fee_non_member_cents !== this.offer.fee_member_cents
    );
  }
}
