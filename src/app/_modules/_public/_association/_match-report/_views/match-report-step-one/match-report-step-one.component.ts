import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { LeagueService } from '@floorball/core';
import { Game, GameAdditionalFields } from '@floorball/types';
import { tap } from 'rxjs';

@Component({
  selector: 'fb-match-report-step-one',
  templateUrl: './match-report-step-one.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MatchReportStepOneComponent implements OnInit, OnChanges {
  fieldSize!: string;

  homeCoachNums: number[] = [1];
  guestCoachNums: number[] = [1];

  @Input()
  game!: Game;

  @Input()
  additionalFields!: GameAdditionalFields;

  @Output()
  handleReload = new EventEmitter<void>();

  @Output()
  updatePeriod: EventEmitter<string> = new EventEmitter<string>();

  @Output()
  handleGameStatusChange = new EventEmitter<void>();

  // lineup properties
  public squadHistoryDialogOpen = '';
  public addDialogOpen = '';

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['additionalFields']) {
      const homeCount = this.initCoachCount(
        this.additionalFields?.home_team_coaches
      );
      const guestCount = this.initCoachCount(
        this.additionalFields?.guest_team_coaches
      );
      if (homeCount > this.homeCoachNums.length) {
        this.homeCoachNums = Array.from({ length: homeCount }, (_, i) => i + 1);
      }
      if (guestCount > this.guestCoachNums.length) {
        this.guestCoachNums = Array.from(
          { length: guestCount },
          (_, i) => i + 1
        );
      }
    }
  }

  private initCoachCount(
    coaches: GameAdditionalFields['home_team_coaches'] | undefined
  ): number {
    if (!coaches) return 1;
    type CoachKey = keyof GameAdditionalFields['home_team_coaches'];
    for (let i = 5; i >= 2; i--) {
      const fn = coaches[`coach${i}_first_name` as CoachKey];
      const ln = coaches[`coach${i}_last_name` as CoachKey];
      const str = coaches[`coach${i}_string` as CoachKey];
      if (fn || ln || str) return i;
    }
    return 1;
  }

  addCoach(team: 'home' | 'guest'): void {
    if (team === 'home' && this.homeCoachNums.length < 5) {
      this.homeCoachNums = [
        ...this.homeCoachNums,
        this.homeCoachNums.length + 1,
      ];
    } else if (team === 'guest' && this.guestCoachNums.length < 5) {
      this.guestCoachNums = [
        ...this.guestCoachNums,
        this.guestCoachNums.length + 1,
      ];
    }
  }

  ngOnInit(): void {
    this._leagueService.selectedLeague$
      .pipe(
        tap((league) => {
          if (league?.id) {
            this.fieldSize = league.field_size;

            this._cdr.markForCheck();
          }
        })
      )
      .subscribe();
  }

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

  public startEvents() {
    this.handleGameStatusChange.emit();
  }
}
