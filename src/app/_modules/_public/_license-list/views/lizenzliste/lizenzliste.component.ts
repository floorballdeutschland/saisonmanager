import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { RefereeService } from '@floorball/core';
import { PublicLicenseList } from '@floorball/types';

@Component({
  templateUrl: './lizenzliste.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class LizenzlisteComponent implements OnInit {
  data?: PublicLicenseList;
  error?: string;
  loading = true;
  readonly today = new Date().toISOString().slice(0, 10);

  constructor(
    private _route: ActivatedRoute,
    private _refereeService: RefereeService,
    private _cdr: ChangeDetectorRef,
    private _title: Title
  ) {
    this._title.setTitle('Lizenzlisten | Floorball Saisonmanager');
  }

  ngOnInit(): void {
    const token = this._route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.error = 'Kein Token angegeben.';
      this.loading = false;
      this._cdr.markForCheck();
      return;
    }

    this._refereeService.getPublicLicenseList(token).subscribe({
      next: (data) => {
        this.data = data;
        this.loading = false;
        this._cdr.markForCheck();
      },
      error: (err) => {
        this.error =
          err?.error?.message ?? 'Der Link ist ungültig oder abgelaufen.';
        this.loading = false;
        this._cdr.markForCheck();
      },
    });
  }

  // Die Bezeichnungen kommen aus License::NAMES, also klein geschrieben:
  // „erteilt", „beantragt", „gesperrt". Verglichen wurde hier mit
  // „Genehmigt"/„Beantragt" -- Schreibweisen, die die API nie geschickt hat,
  // weshalb jede Zeile in der grauen Sammelfarbe landete und der Status
  // ungeprueft durchlief.
  statusLabel(status: string): string {
    if (status === 'erteilt') return 'Lizenziert';
    if (status === 'beantragt') return 'Beantragt';
    if (status === 'gesperrt') return 'Gesperrt';
    return status;
  }

  statusClass(status: string): string {
    if (status === 'erteilt') return 'text-green-700';
    if (status === 'beantragt') return 'text-yellow-700';
    if (status === 'gesperrt') return 'text-red-700 font-semibold';
    return 'text-fb-gray-400';
  }

  expiresAt(): Date | null {
    if (!this.data?.expires_at) return null;
    return new Date(this.data.expires_at);
  }
}
