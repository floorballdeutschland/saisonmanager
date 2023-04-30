import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { GameScheduleEntry } from '@floorball/types';
import { Observable, tap } from 'rxjs';
import { FinalRound } from '../../../../../../_models/game-schedule-entry.interface';

@Component({
  selector: 'fb-tournament-matches-final',
  templateUrl: './tournament-matches-final.component.html',
})
export class TournamentMatchesFinalComponent implements OnInit {
  groupedMatches: FinalRound[] = [];

  @Input()
  matches$?: Observable<GameScheduleEntry[]>;

  constructor(private _cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (this.matches$) {
      this.matches$
        .pipe(
          tap((matches) => {
            this.groupFinalMatches(matches);
            this._cdr.markForCheck();
          })
        )
        .subscribe();
    }
  }

  groupFinalMatches(matches: GameScheduleEntry[]) {
    const finalMatches = matches.filter((match) => !match.group_identifier);
    finalMatches.forEach((match: GameScheduleEntry) => {
      const identifier = Math.floor(match.game_number / 10);
      this.groupedMatches[identifier] = {
        round_title:
          this.groupedMatches[identifier]?.round_title ||
          match.series_title ||
          '',
        matches: [...(this.groupedMatches[identifier]?.matches || []), match],
      };
    });

    this.groupedMatches = Object.keys(this.groupedMatches).map((identifier) => {
      if (this.groupedMatches[parseInt(identifier, 10)]?.matches.length > 1) {
        return {
          ...this.groupedMatches[parseInt(identifier, 10)],
          round_title: this.groupedMatches[
            parseInt(identifier, 10)
          ]?.round_title
            .replace(/\d/g, '')
            .trim(),
        };
      }

      return this.groupedMatches[parseInt(identifier, 10)];
    });
  }
}
