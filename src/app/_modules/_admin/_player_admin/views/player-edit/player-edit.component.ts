import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { AssociationService, PlayerService } from '@floorball/core';
import { GameOperation, Player } from 'src/app/_models';
import { Observable, share, Subject, take, takeUntil, tap } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

@Component({
  templateUrl: './player-edit.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class PlayerEditComponent implements OnInit, OnDestroy {
  associations$: Observable<GameOperation[]>;

  player$?: Observable<Player>;

  editMode = true;

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
      if (params['playerId']) {
        this.getPlayer(params['playerId']);
      }
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  public getPlayer(id: string): void {
    this.player$ = this._playerService.getPlayer(parseInt(id)).pipe(share());

    this.player$
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
