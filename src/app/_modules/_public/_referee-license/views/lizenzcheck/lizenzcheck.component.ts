import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { RefereePublicLicense } from '@floorball/types';
import { RefereeService } from '@floorball/core';

@Component({
  templateUrl: './lizenzcheck.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LizenzcheckComponent implements OnInit {
  lizenznummer = '';
  result?: RefereePublicLicense;
  notFound = false;
  loading = false;

  constructor(
    private _refereeService: RefereeService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _title: Title
  ) {
    this._title.setTitle('Lizenzcheck | Floorball Saisonmanager');
  }

  ngOnInit(): void {
    // Der QR-Code auf dem Schiedsrichterausweis verlinkt auf /lizenzcheck?q=<Nr>.
    // Ist die Lizenznummer als Query-Parameter vorhanden, das Feld vorbefüllen
    // und die Prüfung direkt ausführen.
    const q = this._route.snapshot.queryParamMap.get('q');
    if (q) {
      this.lizenznummer = q;
      this.search();
    }
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
