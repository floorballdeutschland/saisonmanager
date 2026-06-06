import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import {
  AssociationService,
  ClubService,
  NotificationService,
  SessionService,
} from '@floorball/core';
import { GameOperation, GameOperationWithClubs } from '@floorball/types';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { Title } from '@angular/platform-browser';

@Component({
  templateUrl: './club-index.component.html',
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class ClubIndexComponent implements OnInit {
  associations$: Observable<GameOperation[]>;
  goClubItems$?: Observable<GameOperationWithClubs[]>;
  includeDeactivated = false;
  canDeleteClubs = false;

  constructor(
    private _associationService: AssociationService,
    private _clubService: ClubService,
    private _sessionService: SessionService,
    private _notificationService: NotificationService,
    private _metaTitle: Title
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._sessionService.currentUser$.pipe(take(1)).subscribe((user) => {
      this.canDeleteClubs = !!(
        user?.permissions['club_deactivate'] || user?.permissions['admin']
      );
    });
    this.loadClubs();
  }

  public loadClubs(): void {
    this.goClubItems$ = this._clubService.getAdminClubs(
      this.includeDeactivated
    );
  }

  public deleteClub(clubId: number): void {
    this._clubService
      .adminDeleteClub(clubId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._notificationService.success('Verein wurde dauerhaft gelöscht.');
          this.loadClubs();
        },
        error: () => {
          this._notificationService.error(
            'Verein konnte nicht gelöscht werden.'
          );
        },
      });
  }
}
