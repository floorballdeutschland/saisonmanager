import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ClubService, PlayerService, SessionService } from '@floorball/core';
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
  loading = true;

  private _destroy$ = new Subject<boolean>();
  private _pendingRequests = 0;

  constructor(
    private _playerService: PlayerService,
    private _clubService: ClubService,
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
            } else if (this.club_ids?.length > 0) {
              this.club_ids.forEach((cid) => this.getClub(cid));
            } else {
              // Admin/SBK: keine VM-Club-IDs → alle zugänglichen Clubs laden
              this._clubService.getAdminClubs().subscribe({
                next: (gos) => {
                  const ids = gos.flatMap((go) => go.clubs.map((c) => c.id));
                  if (ids.length === 0) {
                    this.loading = false;
                    this._cdr.markForCheck();
                    return;
                  }
                  ids.forEach((id) => this.getClub(id));
                },
                error: () => {
                  this.loading = false;
                  this._cdr.markForCheck();
                },
              });
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
    this._pendingRequests++;
    this._playerService.getClubPlayers(id).subscribe({
      next: (result) => {
        this.clubs.push(result);
        this._pendingRequests--;
        if (this._pendingRequests === 0) {
          this.loading = false;
        }
        this._cdr.markForCheck();
      },
      error: () => {
        this._pendingRequests--;
        if (this._pendingRequests === 0) {
          this.loading = false;
        }
        this._cdr.markForCheck();
      },
    });
  }

  public canEdit(): boolean {
    return this.permissions['update_player'] || false;
  }
}
