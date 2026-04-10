import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { RefereeService } from '@floorball/core';
import { RefereeAdmin } from '@floorball/types';

@Component({
  templateUrl: './referee-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefereeIndexComponent implements OnInit {
  referees: RefereeAdmin[] = [];
  loading = false;

  searchQuery = '';
  filterLandesverband = '';
  filterLizenzstufe = '';
  filterActive = false;

  constructor(
    private _refereeService: RefereeService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this._refereeService
      .adminGetAll({
        q: this.searchQuery || undefined,
        landesverband: this.filterLandesverband || undefined,
        lizenzstufe: this.filterLizenzstufe || undefined,
        active: this.filterActive || undefined,
      })
      .subscribe({
        next: (result) => {
          this.referees = result;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  onSearch(): void {
    this.load();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.filterLandesverband = '';
    this.filterLizenzstufe = '';
    this.filterActive = false;
    this.load();
  }
}
