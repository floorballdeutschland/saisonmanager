import {
  Component,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  AssociationService,
  ClubService,
  NotificationService,
  SessionService,
} from '@floorball/core';
import { GameOperation, StateAssociationWithClubs } from '@floorball/types';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';

@Component({
  templateUrl: './club-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ClubIndexComponent implements OnInit {
  associations$: Observable<GameOperation[]>;
  // Gruppen der Vereinsverwaltung – je Landesverband, nicht je Spielbetrieb.
  lvClubItems$?: Observable<StateAssociationWithClubs[]>;
  includeDeactivated = false;
  canDeleteClubs = false;
  canCreateClubs = false;

  constructor(
    private _associationService: AssociationService,
    private _clubService: ClubService,
    private _sessionService: SessionService,
    private _notificationService: NotificationService,
    private _metaTitle: Title,
    private _transloco: TranslocoService
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._sessionService.currentUser$.pipe(take(1)).subscribe((user) => {
      this.canDeleteClubs = !!(
        user?.permissions['club_deactivate'] || user?.permissions['admin']
      );
      // Vereinsanlage bleibt beim Verband: Der Heimat-Spielbetrieb entscheidet,
      // wer den Verein verwaltet, und den kann ein Vereinsmanager nicht setzen.
      this.canCreateClubs = !!(
        user?.permissions['club_create'] || user?.permissions['admin']
      );
    });
    this.loadClubs();
  }

  public loadClubs(): void {
    this.lvClubItems$ = this._clubService.getAdminClubs(
      this.includeDeactivated
    );
  }

  public deleteClub(clubId: number): void {
    this._clubService
      .adminDeleteClub(clubId)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._notificationService.success(
            this._transloco.translate('clubAdmin.notifications.deleteSuccess')
          );
          this.loadClubs();
        },
        error: () => {
          this._notificationService.error(
            this._transloco.translate('clubAdmin.notifications.deleteError')
          );
        },
      });
  }
}
