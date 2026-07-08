import {
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FinalRound, GameScheduleEntry } from '@floorball/types';
import { Observable, Subject, takeUntil, tap } from 'rxjs';

@Component({
  selector: 'fb-tournament-matches-final',
  templateUrl: './tournament-matches-final.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TournamentMatchesFinalComponent implements OnInit, OnDestroy {
  private _destroy$ = new Subject<boolean>();

  @Input() matches$?: Observable<GameScheduleEntry[]>;

  groupedMatches: FinalRound[] = [];
  loaded = false;

  constructor(private _cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.matches$
      ?.pipe(
        tap((matches) => {
          this._buildGroupedList(matches);
          this.loaded = true;
          this._cdr.markForCheck();
        }),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  private _buildGroupedList(matches: GameScheduleEntry[]): void {
    const finalMatches = matches.filter((m) => !m.group_identifier);
    const grouped = finalMatches.reduce<{
      result: FinalRound[];
      current: FinalRound | null;
    }>(
      (acc, game, index, array) => {
        const title = (game.series_title || '').trim();
        const prevTitle = (array[index - 1]?.series_title || '').trim();
        if (index === 0 || title === prevTitle) {
          if (!acc.current) acc.current = { round_title: title, matches: [] };
          acc.current.matches.push(game);
        } else {
          if (acc.current) acc.result.push(acc.current);
          acc.current = { round_title: title, matches: [game] };
        }
        if (index === array.length - 1 && acc.current) {
          acc.result.push(acc.current);
        }
        return acc;
      },
      { result: [], current: null }
    ).result;

    this.groupedMatches = grouped.map((group) => ({
      ...group,
      round_title:
        group.matches.length > 1
          ? group.round_title.replace(/\d/g, '').trim()
          : group.round_title,
    }));
  }
}
