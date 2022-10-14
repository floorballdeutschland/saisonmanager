import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { Game, GameAdditionalFields } from '@floorball/types';
import { LeagueService } from '@floorball/core';

@Component({
  selector: 'fb-match-report-step-three',
  templateUrl: './match-report-step-three.component.html',
})
export class MatchReportStepThreeComponent {
  @ViewChild('sbbNavigation')
  sbbNavigation!: ElementRef<HTMLElement>;

  @Input()
  game!: Game;

  @Input()
  additionalFields!: GameAdditionalFields;

  @Input()
  nextStatusOption!: any;

  @Output()
  handleReload = new EventEmitter<void>();

  @Output()
  updatePeriod: EventEmitter<string> = new EventEmitter<string>();

  @Output()
  closeMatchRecord: EventEmitter<void> = new EventEmitter<void>();

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef
  ) {}

  scrollToSbbNavigation() {
    this.sbbNavigation.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }

  reloadGame() {
    this.handleReload.emit();
  }

  handleFinalize() {
    this.closeMatchRecord.emit();
  }
}
