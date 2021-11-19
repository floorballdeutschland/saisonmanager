import {
  Component,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AssociationService } from '@floorball/core';
import { GameOperation } from '@floorball/types';
import { Observable } from 'rxjs';

@Component({
  templateUrl: './overview.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewComponent implements OnInit {
  selectedAssociation$?: Observable<GameOperation | null>;

  constructor(
    private _associationService: AssociationService,
    private _route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.selectedAssociation$ = this._associationService.selectedAssociation$;
    this._associationService.selectAssociation(this._route);
  }
}
