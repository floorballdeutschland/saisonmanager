import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ArenaService, NotificationService } from '@floorball/core';
import { Arena } from '@floorball/types';

@Component({
  templateUrl: './arena-merge.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ArenaMergeComponent implements OnInit, OnDestroy {
  master?: Arena;
  secondary?: Arena;
  arenas: Arena[] = [];
  searchTerm = '';
  step: 1 | 2 = 1;
  loading = false;
  error: string | null = null;

  private _destroy$ = new Subject<void>();

  constructor(
    private _route: ActivatedRoute,
    private _router: Router,
    private _arenaService: ArenaService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = Number(this._route.snapshot.paramMap.get('arenaId'));
    if (!Number.isFinite(id) || id <= 0) {
      this._router.navigate(['/', 'verwaltung', 'spielorte']);
      return;
    }

    this._arenaService
      .getAdminArenas()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (arenas) => {
          this.arenas = arenas;
          this.master = arenas.find((a) => a.id === id);
          if (!this.master) {
            this._router.navigate(['/', 'verwaltung', 'spielorte']);
            return;
          }
          this._cdr.markForCheck();
        },
        error: () => this._router.navigate(['/', 'verwaltung', 'spielorte']),
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  get candidates(): Arena[] {
    const term = this.searchTerm.toLowerCase().trim();
    return this.arenas
      .filter((a) => a.id !== this.master?.id)
      .filter(
        (a) =>
          !term ||
          a.name.toLowerCase().includes(term) ||
          (a.city ?? '').toLowerCase().includes(term)
      );
  }

  selectSecondary(arena: Arena): void {
    this.secondary = arena;
    this.step = 2;
  }

  back(): void {
    this.step = 1;
    this.secondary = undefined;
  }

  merge(): void {
    if (!this.master || !this.secondary) return;
    this.loading = true;
    this.error = null;
    this._arenaService
      .mergeArena(this.master.id, this.secondary.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (res) => {
          this._notificationService.success(
            `Spielorte zusammengeführt (${res.moved_game_days} Spieltag(e) umgehängt).`,
            { autoClose: true, keepAfterRouteChange: true }
          );
          this._router.navigate(['/', 'verwaltung', 'spielorte']);
        },
        error: (err) => {
          this.loading = false;
          this.error =
            err?.error?.error ||
            'Spielorte konnten nicht zusammengeführt werden.';
          this._cdr.markForCheck();
        },
      });
  }
}
