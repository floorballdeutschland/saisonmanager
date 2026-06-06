import { Component, ViewEncapsulation } from '@angular/core';
import { AssociationService } from '@floorball/core';
import { GameOperation } from 'src/app/_models';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser';

@Component({
  templateUrl: './home.component.html',
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class HomeComponent {
  associations$: Observable<GameOperation[]>;

  constructor(
    private _associationService: AssociationService,
    private _metaTitle: Title
  ) {
    this.associations$ = this._associationService.associations$;
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }
}
