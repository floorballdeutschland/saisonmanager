import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

/**
 * Einklappbarer Bereich für Seltenes: weitere Filter, Historien, erweiterte
 * Einstellungen, „Weitere Aktionen". Zu Beginn zu, sofern `open` nichts
 * anderes sagt.
 *
 * Der projizierte Inhalt wird auch im zugeklappten Zustand erzeugt. Soll ein
 * Abruf erst beim Aufklappen laufen, bindet die Seite `[(open)]` und setzt
 * ein `@if (open)` um den Inhalt.
 */
@Component({
  selector: 'fb-collapsible',
  templateUrl: './collapsible.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CollapsibleComponent {
  @Input({ required: true })
  label = '';

  /** Zahl hinter der Beschriftung, z. B. aktive Filter. 0 blendet sie aus. */
  @Input()
  count?: number | null;

  @Input()
  open = false;

  @Output()
  openChange = new EventEmitter<boolean>();

  onToggle(event: Event): void {
    const open = (event.target as HTMLDetailsElement).open;
    if (open === this.open) return;
    this.open = open;
    this.openChange.emit(open);
  }
}
