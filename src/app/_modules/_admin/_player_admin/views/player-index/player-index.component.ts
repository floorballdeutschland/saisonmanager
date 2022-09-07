import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { PlayerService, SessionService } from '@floorball/core';
import { Club } from '@floorball/models';
import { Subject } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

@Component({
  templateUrl: './player-index.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class PlayerIndexComponent implements OnInit, OnDestroy {
  permissions: { [key: string]: any } = {};
  clubs: Club[] = [];

  private _destroy$ = new Subject<boolean>();

  constructor(
    private _playerService: PlayerService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _sessionService: SessionService,
    private _metaTitle: Title
  ) {
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._route.params.subscribe((params) => {
      if (params['clubId']) {
        this.getClub(params['clubId']);
      }
    });

    this._sessionService.currentUser$.subscribe({
      next: (user) => {
        this.permissions = user?.permissions || {};
      },
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  public getClub(id: string): void {
    this._playerService.getClubPlayers(parseInt(id)).subscribe({
      next: (result) => {
        this.clubs.push(result);

        this._cdr.markForCheck();
      },
    });
  }

  public canEdit(): boolean {
    return this.permissions['update_player'] || false;
  }
}
