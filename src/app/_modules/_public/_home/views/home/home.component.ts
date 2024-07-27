import { Component, ViewEncapsulation } from '@angular/core';
import { AssociationService } from '@floorball/core';
import { GameOperation } from 'src/app/_models';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';

@Component({
  templateUrl: './home.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class HomeComponent {
  associations$: Observable<GameOperation[]>;

  archiveMode = environment.archiveMode;
  archiveTitle = environment.archiveTitle;

  constructor(
    private _associationService: AssociationService,
    private _metaTitle: Title
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }
}
