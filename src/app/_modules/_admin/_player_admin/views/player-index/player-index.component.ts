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
  permissions: { [key: string]: boolean } = {};
  clubs: Club[] = [];
  club_ids: number[] = [];

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
      this._sessionService.currentUser$.subscribe({
        next: (user) => {
          if (user) {
            this.permissions = user.permissions;
            this.club_ids = user.club_ids;

            if (params['clubId']) {
              this.getClub(parseInt(params['clubId']));
            } else {
              // get user clubs
              this.club_ids.forEach((cid) => this.getClub(cid));
            }
          }
        },
      });
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  public getClub(id: number): void {
    console.log(id);
    this._playerService.getClubPlayers(id).subscribe({
      next: (result) => {
        this.clubs.push(result);

        this._cdr.markForCheck();
      },
    });
  }

  public canEdit(): boolean {
    return this.permissions['player_update'] || false;
  }
}
