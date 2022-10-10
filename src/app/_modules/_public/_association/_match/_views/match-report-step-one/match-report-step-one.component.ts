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
  selector: 'fb-match-report-step-one',
  templateUrl: './match-report-step-one.component.html',
})
export class MatchReportStepOneComponent {
  @ViewChild('sbbNavigation')
  sbbNavigation!: ElementRef<HTMLElement>;

  @Input()
  game!: Game;

  @Input()
  additionalFields!: GameAdditionalFields;

  @Output()
  handleReload = new EventEmitter<void>();

  @Output()
  updatePeriod: EventEmitter<string> = new EventEmitter<string>();

  // lineup properties
  public squadHistoryDialogOpen = '';
  public addDialogOpen = '';

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef
  ) {}

  reloadGame() {
    this.handleReload.emit();
  }

  public openSquadHistoryHomeDialog() {
    this.squadHistoryDialogOpen =
      this.squadHistoryDialogOpen !== '' ? '' : 'home';
  }

  public openSquadHistoryGuestDialog() {
    this.squadHistoryDialogOpen =
      this.squadHistoryDialogOpen !== '' ? '' : 'guest';
  }

  public openAddHomeDialog() {
    this.addDialogOpen = this.addDialogOpen !== '' ? '' : 'home';
  }

  public openAddGuestDialog() {
    this.addDialogOpen = this.addDialogOpen !== '' ? '' : 'guest';
  }

  public closeAddDialog() {
    this.addDialogOpen = '';
    this.reloadGame();
  }

  public closeSquadHistoryDialog() {
    this.squadHistoryDialogOpen = '';
  }
}
