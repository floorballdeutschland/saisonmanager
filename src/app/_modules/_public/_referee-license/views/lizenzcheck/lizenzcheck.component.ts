import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RefereePublicLicense } from '@floorball/types';
import { RefereeService } from '@floorball/core';

@Component({
  templateUrl: './lizenzcheck.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LizenzcheckComponent {
  lizenznummer = '';
  result?: RefereePublicLicense;
  notFound = false;
  loading = false;

  constructor(
    private _refereeService: RefereeService,
    private _cdr: ChangeDetectorRef,
    private _title: Title
  ) {
    this._title.setTitle('Lizenzcheck | Floorball Saisonmanager');
  }

  search(): void {
    const nr = parseInt(this.lizenznummer, 10);
    if (!nr) return;

    this.loading = true;
    this.result = undefined;
    this.notFound = false;

    this._refereeService.getLicense(nr).subscribe({
      next: (data) => {
        this.result = data;
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.notFound = true;
        this.loading = false;
        this._cdr.markForCheck();
      },
    });
  }

  isExpired(dateString?: string): boolean {
    if (!dateString) return true;
    const [day, month, year] = dateString.split('.');
    return new Date(+year, +month - 1, +day) < new Date();
  }
}
