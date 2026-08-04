import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Game, GameAdditionalFields, GameStatusOption } from '@floorball/types';
import { LeagueService } from '@floorball/core';

@Component({
  selector: 'fb-match-report-step-three',
  templateUrl: './match-report-step-three.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MatchReportStepThreeComponent {
  @Input()
  game!: Game;

  @Input()
  additionalFields!: GameAdditionalFields;

  @Input()
  nextStatusOption!: GameStatusOption;

  @Output()
  handleReload = new EventEmitter<void>();

  @Output()
  handleSbbScroll = new EventEmitter<void>();

  @Output()
  updatePeriod: EventEmitter<string> = new EventEmitter<string>();

  @Output()
  closeMatchRecord: EventEmitter<void> = new EventEmitter<void>();

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef
  ) {}

  scrollToSbbNavigation() {
    this.handleSbbScroll.emit();
  }

  reloadGame() {
    this.handleReload.emit();
  }

  handleFinalize() {
    this.closeMatchRecord.emit();
  }
}
