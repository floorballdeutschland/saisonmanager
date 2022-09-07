import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { AssociationService, ClubService } from '@floorball/core';
import { ClubWithTeams, GameOperation } from 'src/app/_models';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { GameOperationWithClubs } from 'src/app/_models/game-operation.interface';

@Component({
  templateUrl: './license-club-index.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class LicenseClubIndexComponent implements OnInit {
  associations$: Observable<GameOperation[]>;

  goClubItems$?: Observable<GameOperationWithClubs[]>;

  clubAndTeams: ClubWithTeams[] = [];

  constructor(
    private _associationService: AssociationService,
    private _clubService: ClubService,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle(
      'Floorball Saisonmanager Lizenzverwaltung (Verein)'
    );
  }

  public ngOnInit(): void {
    this._clubService.adminGetClubAndTeams().subscribe({
      next: (result) => {
        this.clubAndTeams = result;

        this._cdr.markForCheck();
      },
    });
  }
}
