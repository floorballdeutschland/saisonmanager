import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { AssociationService, ClubService } from '@floorball/core';
import { GameOperation } from 'src/app/_models';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { GameOperationWithClubs } from 'src/app/_models/game-operation.interface';

@Component({
  templateUrl: './club-index.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class ClubIndexComponent implements OnInit {
  associations$: Observable<GameOperation[]>;

  goClubItems$?: Observable<GameOperationWithClubs[]>;

  constructor(
    private _associationService: AssociationService,
    private _clubService: ClubService,
    private _metaTitle: Title
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this.goClubItems$ = this._clubService.getAdminClubs();
  }
}
