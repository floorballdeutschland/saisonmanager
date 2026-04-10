import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RefereeService } from '@floorball/core';
import { RefereeAdmin, RefereeAdminGame } from '@floorball/types';

@Component({
  templateUrl: './referee-detail.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefereeDetailComponent implements OnInit {
  referee?: RefereeAdmin;
  games: RefereeAdminGame[] = [];
  loading = false;
  gamesLoading = false;
  selectedSeasonId?: number;

  constructor(
    private _refereeService: RefereeService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const lizenznummer = parseInt(
      this._route.snapshot.params['lizenznummer'],
      10
    );
    this.loading = true;

    this._refereeService.adminGetAll({ q: String(lizenznummer) }).subscribe({
      next: (results) => {
        const match = results.find((r) => r.lizenznummer === lizenznummer);
        if (match) {
          this._refereeService.adminGetById(match.id).subscribe({
            next: (r) => {
              this.referee = r;
              this.loading = false;
              this._cdr.markForCheck();
              this.loadGames(r.id);
            },
          });
        } else {
          this.loading = false;
          this._cdr.markForCheck();
        }
      },
    });
  }

  loadGames(id: number): void {
    this.gamesLoading = true;
    this._refereeService.adminGetGames(id, this.selectedSeasonId).subscribe({
      next: (result) => {
        this.games = result;
        this.gamesLoading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.gamesLoading = false;
        this._cdr.markForCheck();
      },
    });
  }

  get isActive(): boolean {
    if (!this.referee?.gueltigkeit) return false;
    const parts = this.referee.gueltigkeit.split('.');
    if (parts.length !== 3) return false;
    const date = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    return date >= new Date();
  }
}
