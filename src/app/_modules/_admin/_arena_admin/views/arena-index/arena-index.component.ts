import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { ArenaService } from '@floorball/core';
import { Arena } from '@floorball/types';

@Component({
  templateUrl: './arena-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArenaIndexComponent implements OnInit, OnDestroy {
  arenas: Arena[] = [];
  loading = false;

  private _destroy$ = new Subject<void>();

  constructor(
    private _arenaService: ArenaService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
