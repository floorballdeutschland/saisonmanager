import { Component } from '@angular/core';
import { AssociationService } from '@floorball/core';

@Component({
  selector: 'fb-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'saisonmanager';

  isLoading$;

  constructor(private _associationService: AssociationService) {
    this.isLoading$ = this._associationService.associationsIsLoading$;
  }
}
