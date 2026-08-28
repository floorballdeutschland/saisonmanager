import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { RefereeObservationService } from '@floorball/core';
import { RefereeObservation, RefereeObservationCandidate } from '@floorball/types';

/**
 * Einstieg für Schiedsrichtercoaches: offene Spiele zur Beobachtung und die
 * eigenen bereits abgegebenen Bögen.
 *
 * Welche Spiele hier stehen, entscheidet die API (angesetzt als Coach, oder –
 * in Spielbetrieben ohne personenscharfe Ansetzung – Spiele des eigenen
 * Spielbetriebs). Die Ansicht filtert nicht selbst nach, sondern trennt nur
 * offen von erledigt.
 */
@Component({
  templateUrl: './observation-coach-index.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ObservationCoachIndexComponent implements OnInit {
  candidates: RefereeObservationCandidate[] = [];
  observations: RefereeObservation[] = [];
  loading = true;
  failed = false;

  constructor(
    private _service: RefereeObservationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._service.getObservableGames().subscribe({
      next: (candidates) => {
        this.candidates = candidates;
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.failed = true;
        this.loading = false;
        this._cdr.markForCheck();
      },
    });

    this._service.getMyObservations().subscribe({
      next: (observations) => {
        this.observations = observations;
        this._cdr.markForCheck();
      },
      // Die eigenen Bögen sind der zweite Abschnitt der Seite; scheitert er,
      // bleibt die Spielauswahl oben trotzdem nutzbar.
      error: () => this._cdr.markForCheck(),
    });
  }

  get openCandidates(): RefereeObservationCandidate[] {
    return this.candidates.filter((c) => !c.done);
  }

  formatDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
