import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { AssociationService } from '@floorball/core';
import { Association, GameOperation } from 'src/app/_models';
import { BehaviorSubject, Observable } from 'rxjs';

@Component({
  templateUrl: './home.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class HomeComponent implements OnInit {
  associations$: Observable<GameOperation[]>;

  constructor(private _associationService: AssociationService) {
    this.associations$ = this._associationService.associations$;
  }

  ngOnInit(): void {}
}
