import { Component, ViewEncapsulation } from '@angular/core';
import { AssociationService } from '@floorball/core';
import { GameOperation } from 'src/app/_models';
import { Observable } from 'rxjs';

@Component({
  templateUrl: './home.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class HomeComponent {
  associations$: Observable<GameOperation[]>;

  constructor(private _associationService: AssociationService) {
    this.associations$ = this._associationService.associations$;
  }
}
