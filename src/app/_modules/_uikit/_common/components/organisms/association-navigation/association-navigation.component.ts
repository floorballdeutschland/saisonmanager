import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { GameOperation } from '@floorball/types';
import { AssociationService } from '@floorball/core';

@Component({
  selector: 'fb-association-navigation',
  templateUrl: './association-navigation.component.html',
  styleUrls: ['./association-navigation.component.scss'],
})
export class AssociationNavigationComponent implements OnInit {
  associations$!: Observable<GameOperation[]>;

  constructor(private _associationService: AssociationService) {}

  ngOnInit(): void {
    this.associations$ = this._associationService.associations$;
  }
}
