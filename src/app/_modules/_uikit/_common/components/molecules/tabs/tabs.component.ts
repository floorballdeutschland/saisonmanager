import {
  AfterContentInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  QueryList,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TabDirective } from './tab.directive';

let nextTabsId = 0;

/**
 * Reiterleiste, deren aktiver Reiter im Query-Parameter steht
 * (`?reiter=mannschaften`). Neuladen, Zurück-Knopf und Links aus Handbuch
 * oder Mails landen so im selben Reiter. Der erste Reiter ist der Standard
 * und steht nicht in der URL; eine unbekannte Kennung fällt auf ihn zurück.
 *
 * ```html
 * <fb-tabs>
 *   <ng-template fbTab="allgemein" [fbTabLabel]="'…' | transloco">…</ng-template>
 *   @if (isAdmin) {
 *     <ng-template fbTab="status" [fbTabLabel]="'…' | transloco">…</ng-template>
 *   }
 * </fb-tabs>
 * ```
 *
 * `activeChange` feuert auch beim ersten Auflösen. Es ist für Nebenwirkungen
 * wie Nachladen gedacht, nicht für Bindings über der Reiterleiste: die sind
 * zu dem Zeitpunkt schon geprüft (NG0100).
 */
@Component({
  selector: 'fb-tabs',
  templateUrl: './tabs.component.html',
  // Eager: Beschriftung und Markierung kommen über die Inputs der
  // TabDirective, deren Änderung diese View nicht als dirty markiert.
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TabsComponent implements AfterContentInit, OnDestroy {
  /** Name des Query-Parameters; nur ändern, wenn eine Seite zwei Leisten hat. */
  @Input()
  param = 'reiter';

  /** Zugänglicher Name der Reiterleiste. */
  @Input()
  label?: string;

  @Output()
  activeChange = new EventEmitter<string>();

  @ContentChildren(TabDirective)
  tabQuery!: QueryList<TabDirective>;

  tabs: TabDirective[] = [];
  activeId: string | null = null;
  readonly idPrefix = `fb-tabs-${nextTabsId++}`;

  private requested: string | null = null;
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngAfterContentInit(): void {
    this.tabs = this.tabQuery.toArray();
    this.subscriptions.add(
      this.tabQuery.changes.subscribe(() => {
        this.tabs = this.tabQuery.toArray();
        this.resolve();
      })
    );
    this.subscriptions.add(
      this.route.queryParamMap.subscribe((params) => {
        this.requested = params.get(this.param);
        this.resolve();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  select(id: string): void {
    if (id === this.activeId) return;
    this.requested = id;
    this.resolve();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [this.param]: id === this.tabs[0]?.id ? null : id },
      queryParamsHandling: 'merge',
      // Reiterwechsel sind keine eigenen Verlaufsschritte: „Zurück" soll die
      // Seite verlassen, nicht durch die Reiter blättern.
      replaceUrl: true,
    });
  }

  /** Pfeiltasten wandern durch die Leiste, wie bei einer WAI-ARIA-Tablist. */
  onKeydown(event: KeyboardEvent, index: number): void {
    const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    let target: number | null = null;
    if (event.key in offsets) {
      target =
        (index + offsets[event.key] + this.tabs.length) % this.tabs.length;
    } else if (event.key === 'Home') {
      target = 0;
    } else if (event.key === 'End') {
      target = this.tabs.length - 1;
    }
    if (target === null) return;
    event.preventDefault();
    const tab = this.tabs[target];
    this.select(tab.id);
    document.getElementById(this.buttonId(tab.id))?.focus();
  }

  buttonId(id: string): string {
    return `${this.idPrefix}-tab-${id}`;
  }

  panelId(id: string): string {
    return `${this.idPrefix}-panel-${id}`;
  }

  private resolve(): void {
    const known = this.tabs.some((t) => t.id === this.requested);
    const id = known ? this.requested : (this.tabs[0]?.id ?? null);
    if (id === this.activeId) return;
    this.activeId = id;
    this.cdr.markForCheck();
    if (id !== null) this.activeChange.emit(id);
  }
}
