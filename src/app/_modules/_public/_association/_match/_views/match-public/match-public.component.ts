import {
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { LeagueService } from '@floorball/core';
import { Game, GameAdditionalFields } from '@floorball/types';
import { tap } from 'rxjs';

@Component({
  selector: 'fb-match-public',
  templateUrl: './match-public.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MatchPublicComponent implements OnInit {
  fieldSize!: string;

  @Input()
  game!: Game;

  @Input()
  additionalFields?: GameAdditionalFields;

  get startingPlayersTitle(): string {
    return this.fieldSize === 'GF' ? 'Starting six' : 'Starting four';
  }

  // Für die Zwischenüberschriften der Handy-Ansicht. Der volle Mannschaftsname
  // als Rückfall ist länger, aber nicht falsch, und bleibt auch nach dem
  // API-Deploy nötig: Zu einer noch nicht ausgelosten Paarung gehört keine
  // Mannschaft und damit auch kein Kürzel.
  get homeShortName(): string {
    return this.game.home_team_short_name || this.game.home_team_name;
  }

  get guestShortName(): string {
    return this.game.guest_team_short_name || this.game.guest_team_name;
  }

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this.fieldSize = league.field_size;

            this._cdr.markForCheck();
          }
        })
      )
      .subscribe();
  }
}
