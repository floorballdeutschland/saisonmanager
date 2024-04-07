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

    console.log(scrollWidth, clientWidth);

    if (clientWidth < scrollWidth) {
      this.isScrolled = scrollableDiv.scrollLeft > 0;
      this.isScrollable = scrollWidth - scrollableDiv.scrollLeft > clientWidth;
    } else {
      this.isScrolled = false;
      this.isScrollable = false;
    }
  }
}
