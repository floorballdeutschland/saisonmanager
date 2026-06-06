import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { RefereeService } from '@floorball/core';
import { RefereeEntry } from '@floorball/types';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  of,
  switchMap,
  takeUntil,
} from 'rxjs';

@Component({
  selector: 'fb-referee-autocomplete',
  templateUrl: './referee-autocomplete.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class RefereeAutocompleteComponent implements OnInit, OnDestroy {
  @Input() placeholder = 'Name oder Lizenznummer';
  @Input() selectedReferee: RefereeEntry | null = null;

  @Output() refereeSelected = new EventEmitter<RefereeEntry | null>();

  @ViewChild('input') inputEl!: ElementRef<HTMLInputElement>;

  query = '';
  suggestions: RefereeEntry[] = [];
  loading = false;
  showDropdown = false;

  private _search$ = new Subject<string>();
  private _destroy$ = new Subject<void>();

  constructor(
    private _refereeService: RefereeService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) =>
          this._refereeService.search(q).pipe(catchError(() => of([])))
        ),
        takeUntil(this._destroy$)
      )
      .subscribe((results) => {
        this.suggestions = results;
        this.showDropdown = results.length > 0;
        this.loading = false;
        this._cdr.markForCheck();
      });

    if (this.selectedReferee) {
      this.query = `${this.selectedReferee.nachname}, ${this.selectedReferee.vorname}`;
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  onInput(value: string): void {
    this.query = value;
    if (value.trim().length >= 1) {
      this.loading = true;
      this._search$.next(value.trim());
    } else {
      this.suggestions = [];
      this.showDropdown = false;
    }
  }

  select(referee: RefereeEntry): void {
    this.selectedReferee = referee;
    this.query = `${referee.nachname}, ${referee.vorname} (${referee.lizenznummer})`;
    this.showDropdown = false;
    this.suggestions = [];
    this.refereeSelected.emit(referee);
    this._cdr.markForCheck();
  }

  clear(): void {
    this.query = '';
    this.selectedReferee = null;
    this.suggestions = [];
    this.showDropdown = false;
    this.refereeSelected.emit(null);
    this._cdr.markForCheck();
  }

  onBlur(): void {
    // Delay to allow click on suggestion to fire first
    setTimeout(() => {
      this.showDropdown = false;
      // If nothing valid selected, restore display or clear
      if (!this.selectedReferee) {
        this.query = '';
      } else {
        this.query = `${this.selectedReferee.nachname}, ${this.selectedReferee.vorname} (${this.selectedReferee.lizenznummer})`;
      }
      this._cdr.markForCheck();
    }, 200);
  }
}
