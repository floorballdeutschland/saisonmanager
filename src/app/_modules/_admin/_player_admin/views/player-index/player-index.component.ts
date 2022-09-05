import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { AssociationService, PlayerService } from '@floorball/core';
import { Club, GameOperation } from 'src/app/_models';
import { Observable, share, Subject, take, takeUntil, tap } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

@Component({
  templateUrl: './player-index.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class PlayerIndexComponent implements OnInit {
  associations$: Observable<GameOperation[]>;

  club$?: Observable<Club>;

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _associationService: AssociationService,
    private _playerService: PlayerService,
    private _route: ActivatedRoute,
    private _metaTitle: Title
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._route.params.subscribe((params) => {
      if (params['clubId']) {
        this.getClub(params['clubId']);
      }
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  public getClub(id: string): void {
    this.club$ = this._playerService.getClubPlayers(parseInt(id)).pipe(share());

    this.club$
      .pipe(
        tap((league) => {
          if (!league) {
            return;
          }
        }),
        take(1),
        takeUntil(this._destroy$)
      )
      .subscribe();
  }
}
