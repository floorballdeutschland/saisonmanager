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

    const groupedFinalMatches = finalMatches.reduce<{
      result: { round_title: string; matches: GameScheduleEntry[] }[];
      currentGroup: {
        round_title: string;
        matches: GameScheduleEntry[];
      } | null;
    }>(
      (acc, game, index, array) => {
        const { series_title } = game;
        const trimmedSeriesTitle = (series_title || '').trim();

        // If it's the first element or the series_title matches the previous one
        if (
          index === 0 ||
          trimmedSeriesTitle === array[index - 1].series_title
        ) {
          if (!acc.currentGroup) {
            acc.currentGroup = { round_title: trimmedSeriesTitle, matches: [] };
          }
          acc.currentGroup.matches.push(game);
        } else {
          // Push the current group to the result and start a new group
          if (acc.currentGroup) {
            acc.result.push(acc.currentGroup);
          }
          acc.currentGroup = {
            round_title: trimmedSeriesTitle,
            matches: [game],
          };
        }

        // If it's the last element, push the current group to the result
        if (index === array.length - 1 && acc.currentGroup) {
          acc.result.push(acc.currentGroup);
        }

        return acc;
      },
      { result: [], currentGroup: null }
    ).result;

    // remove
    this.groupedMatches = groupedFinalMatches.map((group) => {
      return {
        ...group,
        round_title:
          group.matches.length > 1
            ? group.round_title.replace(/\d/g, '').trim()
            : group.round_title,
      };
    });
  }
}
