import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { PlayerService } from '@floorball/core';
import { PlayerSearchResult } from '@floorball/models';
import { Subject, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
} from 'rxjs/operators';
import { Title } from '@angular/platform-browser';

@Component({
  templateUrl: './player-search.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class PlayerSearchComponent implements OnDestroy {
  query = '';
  results: PlayerSearchResult[] = [];
  loading = false;
  searched = false;
  /** Der Abruf ist gescheitert – von „keine Treffer" zu unterscheiden. */
  searchFailed = false;

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
            this.searchFailed = false;
            this._cdr.markForCheck();
            return [];
          }
          this.loading = true;
          this.searchFailed = false;
          this._cdr.markForCheck();
          // Der Fehler wird INNERHALB des switchMap abgefangen: Ein Fehler der
          // inneren Observable laeuft sonst bis zum aeusseren Subscriber durch
          // und beendet dessen Subscription. `_query$` ist ein langlebiges
          // Subject, das Suchfeld nahm nach einem einzigen Fehlschlag also
          // weiter Eingaben an, ohne je wieder etwas zu tun -- bis zum
          // Neuladen der Seite, und ohne jeden Hinweis darauf.
          return this._playerService.globalSearch(q).pipe(
            catchError(() => {
              this.searchFailed = true;
              return of([] as PlayerSearchResult[]);
            })
          );
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
