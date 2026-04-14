import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ClubService, PlayerService, SessionService } from '@floorball/core';
import { Club } from '@floorball/models';
import {
  filter,
  forkJoin,
  of,
  Subject,
  switchMap,
  take,
  takeUntil,
} from 'rxjs';
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
    this._route.params
      .pipe(
        switchMap((params) => {
          this.clubs = [];
          this.loading = true;
          this._cdr.markForCheck();

          return this._sessionService.currentUser$.pipe(
            filter((user) => !!user),
            take(1),
            switchMap((user) => {
              this.permissions = user!.permissions;
              this.club_ids = user!.club_ids;

              if (params['clubId']) {
                return forkJoin([
                  this._playerService.getClubPlayers(
                    parseInt(params['clubId'], 10)
                  ),
                ]);
              }

              if (this.club_ids?.length > 0) {
                return forkJoin(
                  this.club_ids.map((cid) =>
                    this._playerService.getClubPlayers(cid)
                  )
                );
              }

              // Admin/SBK: keine VM-Club-IDs → alle zugänglichen Clubs laden
              return this._clubService.getAdminClubs().pipe(
                switchMap((gos) => {
                  const ids = gos.flatMap((go) => go.clubs.map((c) => c.id));
                  if (ids.length === 0) return of([] as Club[]);
                  return forkJoin(
                    ids.map((id) => this._playerService.getClubPlayers(id))
                  );
                })
              );
            })
          );
        }),
        takeUntil(this._destroy$)
      )
      .subscribe({
        next: (clubs) => {
          this.clubs = clubs;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }

  public canEdit(): boolean {
    return this.permissions['update_player'] || false;
  }
}
