import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { RefereeService } from '@floorball/core';
import { RefereeEntry } from '@floorball/types';
import {
  Subject,
  catchError,
  debounceTime,
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
export class RefereeAutocompleteComponent
  implements OnInit, OnChanges, OnDestroy
{
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
        // Bewusst ohne distinctUntilChanged: Wer denselben Namen erneut eintippt,
        // will die Suche wiederholen -- etwa nachdem das Speichern gescheitert
        // ist. Vorher verwarf der Vergleich diese Eingabe, es kam nie eine
        // Antwort, und `loading` blieb dauerhaft stehen. Damit verschwand auch
        // das Kreuz zum Leeren (Vorlage: `@if (query && !loading)`) und das Feld
        // war ohne Neuladen der Seite nicht mehr zu bedienen. Die Entprellung
        // haelt die Zahl der Anfragen weiter in Grenzen.
        debounceTime(250),
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

    this._syncQueryFromSelection();
  }

  // Die Anzeige folgt dem Input, nicht nur dem Klick in der Vorschlagsliste.
  // Vorher wurde `selectedReferee` ausschliesslich in ngOnInit gelesen: Nahm die
  // Elternkomponente die Auswahl zurueck -- etwa weil das Speichern gescheitert
  // war --, blieb der Name samt gruenem Rahmen stehen und behauptete einen
  // Schiedsrichter, den das Spiel nicht hat.
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['selectedReferee']) {
      return;
    }

    this._syncQueryFromSelection();
    this._cdr.markForCheck();
  }

  private _syncQueryFromSelection(): void {
    this.query = this.selectedReferee ? this._label(this.selectedReferee) : '';
    this.suggestions = [];
    this.showDropdown = false;
    this.loading = false;
  }

  // Eine Schreibweise fuer die Anzeige. Vorher zeigte ngOnInit den Namen ohne
  // Lizenznummer und onBlur mit -- der Text sprang also beim ersten Verlassen
  // des Feldes.
  private _label(referee: RefereeEntry): string {
    return `${referee.nachname}, ${referee.vorname} (${referee.lizenznummer})`;
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
    this.query = this._label(referee);
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
        this.query = this._label(this.selectedReferee);
      }
      this._cdr.markForCheck();
    }, 200);
  }
}
