import {
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';
import { TableEntry } from '@floorball/types';
import { Subject } from 'rxjs';

@Component({
  selector: 'fb-team-ranking-table-overlay',
  templateUrl: './team-ranking-table-overlay.component.html',
  standalone: false,
})
export class TeamRankingTableOverlayComponent {
  @Output()
  closeDialog: EventEmitter<boolean> = new EventEmitter<boolean>();

  @ViewChild('closeButton')
  closeButton!: ElementRef<HTMLButtonElement>;

  onClose$ = new Subject<boolean>();

  public data: TableEntry[] = [];

  close() {
    this.onClose$.next(true);
  }
}
