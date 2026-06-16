import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { ArenaService } from '@floorball/core';
import { Arena } from '@floorball/types';

@Component({
  templateUrl: './arena-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ArenaIndexComponent implements OnInit, OnDestroy {
  arenas: Arena[] = [];
  searchTerm = '';
  loading = false;
  deleteError: string | null = null;

  get filteredArenas(): Arena[] {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) return this.arenas;
    return this.arenas.filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        (a.city ?? '').toLowerCase().includes(term)
    );
  }

  private _destroy$ = new Subject<void>();

  constructor(
    private _arenaService: ArenaService,
    private _transloco: TranslocoService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public load(): void {
    this.loading = true;
    this._arenaService
      .getAdminArenas()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (arenas) => {
          this.arenas = arenas;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }

  public deleteArena(arena: Arena): void {
    if (
      !confirm(
        this._transloco.translate('arena.notifications.deleteConfirm', {
          name: arena.name,
        })
      )
    )
      return;
    this.deleteError = null;
    this._arenaService
      .deleteArena(arena.id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: () => {
          this.arenas = this.arenas.filter((a) => a.id !== arena.id);
          this._cdr.markForCheck();
        },
        error: (err) => {
          this.deleteError =
            err.error?.error ||
            this._transloco.translate('arena.notifications.deleteError');
          this._cdr.markForCheck();
        },
      });
  }
}
