import {
  Component,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { AssociationService } from '@floorball/core';

@Component({
  templateUrl: './team.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamComponent implements OnInit, OnDestroy {
  constructor(private _associationService: AssociationService) {}

  ngOnInit(): void {
    this._associationService.displayAssociationHeader$.next(false);
  }

  ngOnDestroy(): void {
    this._associationService.displayAssociationHeader$.next(true);
  }
}
