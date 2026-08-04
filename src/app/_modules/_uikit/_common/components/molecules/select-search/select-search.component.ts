import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  ViewChild,
  ViewEncapsulation,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type SelectSearchValue = string | number | null;

/**
 * Durchsuchbares Auswahlfeld als Ersatz für lange `<select>`-Listen.
 *
 * Bedienung wie ein Dropdown: Klick öffnet die vollständige Liste, jedes
 * getippte Zeichen filtert weiter. Implementiert ControlValueAccessor, ist also
 * ein Drop-in für `[(ngModel)]="…"` samt `(ngModelChange)`.
 *
 * Die Einträge werden unverändert in der übergebenen Reihenfolge angezeigt —
 * die aufrufende Komponente bleibt für die Sortierung zuständig.
 */
@Component({
  selector: 'fb-select-search',
  templateUrl: './select-search.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectSearchComponent),
      multi: true,
    },
  ],
})
export class SelectSearchComponent implements ControlValueAccessor, OnChanges {
  /**
   * Auswahlliste. Absichtlich `unknown[]`: so lassen sich `Club[]`,
   * `League[]` usw. ohne Mapping am Aufrufort übergeben. Der Zugriff auf
   * Label/Wert läuft über `labelKey`/`valueKey`.
   */
  @Input() items: unknown[] = [];
  @Input() labelKey = 'name';
  @Input() valueKey = 'id';
  /** Optionaler Zusatztext rechts neben dem Label, z. B. eine Nummer. */
  @Input() hintKey: string | null = null;
  /** Text im leeren Feld, entspricht dem alten „bitte wählen“-Eintrag. */
  @Input() placeholder = '';
  /** Ist er gesetzt, kann die Auswahl über diesen Listeneintrag geleert werden. */
  @Input() resetLabel: string | null = null;
  /**
   * Wert, den der Reset-Eintrag schreibt. Standard ist `null`; Felder, deren
   * „nicht gewählt“ historisch die 0 ist (Team am Spiel, Zielverein im
   * Transfer), übergeben hier eine 0, damit sich am gespeicherten Wert nichts
   * ändert.
   */
  @Input() resetValue: SelectSearchValue = null;
  @Input() disabled = false;
  @Input() inputId: string | null = null;
  /** Grüner Rahmen bei getroffener Auswahl, wie im Ansetzungs-Filter. */
  @Input() highlightSelection = false;

  @ViewChild('input') inputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('list') listEl?: ElementRef<HTMLElement>;

  query = '';
  open = false;
  highlighted = -1;
  /** Aktuell sichtbare Einträge; wird nur bei Änderungen neu berechnet. */
  filteredItems: unknown[] = [];
  readonly listboxId = `fb-select-search-${++SelectSearchComponent._instances}`;

  private static _instances = 0;

  private _value: SelectSearchValue = null;
  private _onChange: (value: SelectSearchValue) => void = () => undefined;
  private _onTouched: () => void = () => undefined;

  constructor(private _cdr: ChangeDetectorRef) {}

  // Die Liste kommt in der Regel asynchron nach dem Wert an; dann müssen
  // Label und Trefferliste neu berechnet werden.
  ngOnChanges(): void {
    this._applyFilter();
    this._cdr.markForCheck();
  }

  get value(): SelectSearchValue {
    return this._value;
  }

  /** Angezeigter Text des gewählten Eintrags, leer wenn nichts gewählt ist. */
  get selectedLabel(): string {
    const selected = this.items.find((item) => this._sameValue(item));
    return selected ? this._label(selected) : '';
  }

  get hasSelection(): boolean {
    return this.selectedLabel !== '';
  }

  /**
   * Der Reset-Eintrag steht nur bei leerer Sucheingabe in der Liste und trägt
   * den Index -1, damit er sich wie ein normaler Eintrag markieren und mit
   * Enter auswählen lässt.
   */
  get resetVisible(): boolean {
    return this.resetLabel !== null && !this.query;
  }

  writeValue(value: SelectSearchValue): void {
    this._value = value ?? null;
    this.query = '';
    this._applyFilter();
    this._cdr.markForCheck();
  }

  registerOnChange(fn: (value: SelectSearchValue) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this._cdr.markForCheck();
  }

  label(item: unknown): string {
    return this._label(item);
  }

  hint(item: unknown): string {
    if (!this.hintKey) return '';
    const raw = this._read(item, this.hintKey);
    return raw == null ? '' : String(raw);
  }

  isSelected(item: unknown): boolean {
    return this._sameValue(item);
  }

  openList(): void {
    if (this.disabled || this.open) return;
    this.open = true;
    this.query = '';
    this._applyFilter();
    this.highlighted = this.items.findIndex((item) => this._sameValue(item));
    this._cdr.markForCheck();
    this._scrollHighlightedIntoView();
  }

  toggleList(): void {
    if (this.open) {
      this.close();
    } else {
      this.openList();
      this.inputEl?.nativeElement.focus();
    }
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.query = '';
    this.highlighted = -1;
    this._cdr.markForCheck();
  }

  onInput(value: string): void {
    this.query = value;
    this.open = true;
    this._applyFilter();
    // Nach dem Filtern zeigt der alte Index auf einen anderen Eintrag, daher
    // auf den ersten Treffer setzen.
    this.highlighted = this.filteredItems.length > 0 ? 0 : -1;
    this._cdr.markForCheck();
    this._scrollHighlightedIntoView();
  }

  onBlur(): void {
    this._onTouched();
    this.close();
  }

  select(item: unknown): void {
    this._commit(this._read(item, this.valueKey) as SelectSearchValue);
  }

  reset(): void {
    this._commit(this.resetValue);
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open) {
          this.openList();
        } else {
          this._move(1);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (this.open) this._move(-1);
        break;
      case 'Enter': {
        if (!this.open) return;
        // Nur bei offener Liste abfangen, sonst ließe sich das umgebende
        // Formular nicht mehr per Enter abschicken.
        event.preventDefault();
        const items = this.filteredItems;
        if (this.highlighted === -1) {
          if (this.resetVisible) this.reset();
        } else if (this.highlighted < items.length) {
          this.select(items[this.highlighted]);
        }
        break;
      }
      case 'Escape':
        if (this.open) {
          event.preventDefault();
          this.close();
        }
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  private _commit(value: SelectSearchValue): void {
    this._value = value;
    this.open = false;
    this.query = '';
    this.highlighted = -1;
    this._applyFilter();
    this._onChange(value);
    this._cdr.markForCheck();
  }

  private _applyFilter(): void {
    const needle = this._normalize(this.query);
    this.filteredItems = needle
      ? this.items.filter((item) =>
          this._normalize(this._label(item)).includes(needle)
        )
      : this.items;
  }

  private _move(offset: number): void {
    const max = this.filteredItems.length - 1;
    // Untergrenze -1: das ist der Reset-Eintrag, solange er sichtbar ist.
    const min = this.resetVisible ? -1 : 0;
    if (max < 0) {
      this.highlighted = min;
      return;
    }
    const next = this.highlighted + offset;
    this.highlighted = Math.min(Math.max(next, min), max);
    this._cdr.markForCheck();
    this._scrollHighlightedIntoView();
  }

  // Ohne das läuft die Markierung bei langen Listen (Vereine, Ligen) aus dem
  // sichtbaren Bereich heraus.
  private _scrollHighlightedIntoView(): void {
    if (this.highlighted < 0 && !this.resetVisible) return;
    setTimeout(() => {
      const option = this.listEl?.nativeElement.querySelector(
        `[data-index="${this.highlighted}"]`
      );
      option?.scrollIntoView({ block: 'nearest' });
    });
  }

  private _label(item: unknown): string {
    const raw = this._read(item, this.labelKey);
    return raw == null ? '' : String(raw);
  }

  private _read(item: unknown, key: string): unknown {
    if (item == null || typeof item !== 'object') return undefined;
    return (item as Record<string, unknown>)[key];
  }

  // Locker über String vergleichen: manche Quellen liefern IDs als String
  // (z. B. club_id aus dem permissions-JSONB), das Dropdown soll den Eintrag
  // trotzdem als gewählt erkennen.
  private _sameValue(item: unknown): boolean {
    if (this._value == null) return false;
    const raw = this._read(item, this.valueKey);
    if (raw == null) return false;
    return String(raw) === String(this._value);
  }

  private _normalize(value: string): string {
    return value.trim().toLocaleLowerCase('de');
  }
}
