import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { LeagueService } from '@floorball/core';
import { Game, GameAdditionalFields } from '@floorball/types';
import { tap } from 'rxjs';

@Component({
  selector: 'fb-match-public',
  templateUrl: './match-public.component.html',
})
export class MatchPublicComponent implements OnInit {
  fieldSize!: string;

  @Input()
  game!: Game;

  @Input()
  additionalFields?: GameAdditionalFields;

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
