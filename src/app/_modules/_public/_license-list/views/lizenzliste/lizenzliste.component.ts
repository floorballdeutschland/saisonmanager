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

  statusLabel(status: string): string {
    if (status === 'Genehmigt') return 'Lizenziert';
    if (status === 'Beantragt') return 'Beantragt';
    return status;
  }

  statusClass(status: string): string {
    if (status === 'Genehmigt') return 'text-green-700';
    if (status === 'Beantragt') return 'text-yellow-700';
    return 'text-fb-gray-400';
  }

  expiresAt(): Date | null {
    if (!this.data?.expires_at) return null;
    return new Date(this.data.expires_at);
  }
}
