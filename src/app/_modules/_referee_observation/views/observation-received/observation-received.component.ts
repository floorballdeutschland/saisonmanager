import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { RefereeObservationService } from '@floorball/core';
import { RefereeObservation } from '@floorball/types';

/**
 * „Meine Beobachtungen" aus Sicht der beobachteten Person: die Rückmeldungen der
 * Schiedsrichtercoaches zum eigenen Einsatz.
 *
 * Anders als beim Vereins-Feedback, das die Mannschaften abgeben und das die
 * beobachtete Person bewusst nicht sieht, ist genau das hier der Zweck.
 * Zurückgenommene Bögen liefert die API nicht aus.
 */
@Component({
  templateUrl: './observation-received.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ObservationReceivedComponent implements OnInit {
  observations: RefereeObservation[] = [];
  loading = true;
  failed = false;

  constructor(
    private _service: RefereeObservationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._service.getReceived().subscribe({
      next: (observations) => {
        this.observations = observations;
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.failed = true;
        this.loading = false;
        this._cdr.markForCheck();
      },
    });
  }
}
