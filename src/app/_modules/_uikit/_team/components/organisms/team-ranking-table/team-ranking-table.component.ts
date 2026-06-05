import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import { OverlayService } from '@floorball/core';
import { TableEntry, TablePointCorrections } from '@floorball/models';
import { take, tap } from 'rxjs';
import { TeamRankingTableOverlayComponent } from '../team-ranking-table-overlay/team-ranking-table-overlay.component';
import { TeamRankingTableDatasoure } from './team-ranking-table.datasource';

@Component({
  selector: 'fb-team-ranking-table',
  templateUrl: './team-ranking-table.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TeamRankingTableComponent implements OnChanges, AfterViewInit {
  isScrolled = false;
  isScrollable = false;

  @Input()
  data!: TableEntry[];

  @Input()
  type: 'small' | 'medium' | 'default' = 'default';

  @Input()
  routerPrefix: string[] = ['./', 'team'];

  @Input()
  hideExpandButton = false;

  dataSource = new TeamRankingTableDatasoure();

  point_corrections: TablePointCorrections[] = [];
  has_direct_encounter_games = false;

  overlayComponentRef?: ComponentRef<TeamRankingTableOverlayComponent>;

  constructor(
    private elementRef: ElementRef,
    private _overlayService: OverlayService,
    private _cdr: ChangeDetectorRef
  ) {}

  handleOpen() {
    this.overlayComponentRef = this._overlayService.showScrollBlockingOverlay(
      TeamRankingTableOverlayComponent
    );

    this.overlayComponentRef?.instance.onClose$
      .pipe(
        tap(() => {
          this._cdr.markForCheck();
        }),
        take(1)
      )
      .subscribe();

    this.overlayComponentRef.instance.data = this.data;

    this._cdr.markForCheck();
  }

  closeDialog() {
    this.overlayComponentRef?.instance.onClose$.next(true);
  }

  readonly qualificationColors: Record<string, string> = {
    promotion: '#22c55e',
    playoff: '#60a5fa',
    playdown: '#f97316',
    relegation: '#ef4444',
    championship: '#8b5cf6',
    cup: '#a855f7',
  };

  readonly qualificationDefaultLabels: Record<string, string> = {
    promotion: 'Aufstieg',
    playoff: 'Playoffs',
    playdown: 'Playdowns',
    relegation: 'Abstieg',
    championship: 'Deutsche Meisterschaft',
    cup: 'Pokal',
  };

  get qualificationLegend(): { type: string; label: string; color: string }[] {
    if (!this.data) return [];
    const seen = new Set<string>();
    const legend: { type: string; label: string; color: string }[] = [];
    for (const row of this.data) {
      if (row.qualification_type && !seen.has(row.qualification_type)) {
        seen.add(row.qualification_type);
        legend.push({
          type: row.qualification_type,
          label:
            row.qualification_label ||
            this.qualificationDefaultLabels[row.qualification_type] ||
            row.qualification_type,
          color: this.qualificationColors[row.qualification_type] || '#6b7280',
        });
      }
    }
    return legend;
  }

  getQualificationStyle(row: TableEntry): Record<string, string> {
    const color = row.qualification_type
      ? this.qualificationColors[row.qualification_type]
      : null;
    return color ? { 'border-left': `4px solid ${color}` } : {};
  }

  public setCorrections(table: TableEntry[]) {
    const corrections = table
      .map((entry) => entry.point_corrections)
      .filter((x): x is TablePointCorrections => x !== null);
    this.point_corrections = corrections;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']?.currentValue) {
      this.dataSource.data.next(changes['data'].currentValue);

      this.setCorrections(changes['data']?.currentValue);
      this.has_direct_encounter_games = changes['data'].currentValue.some(
        (e: TableEntry) => e.has_direct_encounter_games
      );
    }
  }

  ngAfterViewInit() {
    this.checkScrollPosition();
    this._cdr.detectChanges();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScrollPosition();
    this._cdr.detectChanges();
  }

  @HostListener('scroll', ['$event'])
  onScroll() {
    this.checkScrollPosition();
  }

  private checkScrollPosition() {
    const scrollableDiv =
      this.elementRef.nativeElement.querySelector('.ranking-table');

    const scrollWidth = scrollableDiv.scrollWidth;
    const clientWidth = scrollableDiv.clientWidth;

    if (clientWidth < scrollWidth) {
      this.isScrolled = scrollableDiv.scrollLeft > 0;
      this.isScrollable = scrollWidth - scrollableDiv.scrollLeft > clientWidth;
    } else {
      this.isScrolled = false;
      this.isScrollable = false;
    }
  }
}
