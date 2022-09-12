import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { AssociationService, LeagueService } from '@floorball/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

@Component({
  templateUrl: './schedule-index.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class ScheduleIndexComponent implements OnInit {
  gameDays: any[] = [];

  loading = true;

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._route.params.subscribe((params) => {
      if (params['leagueId']) {
        this._leagueService.getAdminGameSchedule(params['leagueId']).subscribe({
          next: (result) => {
            console.log('getAdminGameSchedule', result);
            this.gameDays = result;
            this.loading = false;

            this._cdr.markForCheck();
          },
          error: (error) => {
            console.error(error);
          },
        });
      }
    });
  }
}
