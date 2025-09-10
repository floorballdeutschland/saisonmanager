import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Location } from '@angular/common';
import { AssociationService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  templateUrl: './team.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamComponent implements OnInit, OnDestroy {
  public teamId: string | null = null;

  constructor(
    private _associationService: AssociationService,
    private _location: Location,
    private _route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this._associationService.displayAssociationHeader$.next(false);
    this._route.paramMap.subscribe((params) => {
      this.teamId = params.get('teamSlug');
    });
  }

  ngOnDestroy(): void {
    this._associationService.displayAssociationHeader$.next(true);
  }

  navigateBack() {
    this._location.back();
  }
}
