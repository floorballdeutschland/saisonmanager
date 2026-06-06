import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  ViewEncapsulation,
} from '@angular/core';
import { PlayerService } from '@floorball/core';
import { PlayerSearchResult } from '@floorball/models';
import { Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { Title } from '@angular/platform-browser';

@Component({
  templateUrl: './player-search.component.html',
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class PlayerSearchComponent implements OnDestroy {
  query = '';
  results: PlayerSearchResult[] = [];
  loading = false;
  searched = false;

  private _query$ = new Subject<string>();
  private _destroy$ = new Subject<boolean>();

  constructor(
    private _playerService: PlayerService,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    this._metaTitle.setTitle('Spielersuche – Floorball Saisonmanager');

    this._query$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < 2) {
            this.results = [];
            this.loading = false;
            this.searched = false;
            this._cdr.markForCheck();
            return [];
          }
          this.loading = true;
          this._cdr.markForCheck();
          return this._playerService.globalSearch(q);
        }),
        takeUntil(this._destroy$)
      )
      .subscribe({
        next: (res) => {
          this.results = res;
          this.loading = false;
          this.searched = true;
          this._cdr.markForCheck();
        },
        error: () => {
          this.results = [];
          this.loading = false;
          this.searched = true;
          this._cdr.markForCheck();
        },
      });
  }

  onQueryChange(value: string): void {
    this.query = value;
    this._query$.next(value);
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.complete();
  }
}
