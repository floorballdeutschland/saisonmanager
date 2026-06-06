import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import {
  GameEvent,
  GamePlayerEntry,
  PlayerWithLicense,
} from '@floorball/types';
import { GameService, NotificationService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'fb-team-squad-player',
  templateUrl: './team-squad-player.component.html',
  styleUrls: ['./team-squad-player.component.scss'],
  standalone: false,
})
export class TeamSquadPlayerComponent implements OnInit, AfterViewInit {
  @ViewChild('trikotNumberInput')
  trikotNumberInputElement!: ElementRef<HTMLInputElement>;

  @Input() playerFocus?: number;
  @Input() side!: string;
  @Input() lineup!: GamePlayerEntry[];
  @Input() player!: PlayerWithLicense;
  @Input() gamePlayerEntry!: GamePlayerEntry | null;
  @Input() captainPlayerId!: number | null;
  @Input() events: GameEvent[] = [];
  @Output() updateLineup: EventEmitter<GamePlayerEntry[]> = new EventEmitter<
    GamePlayerEntry[]
  >();
  @Output() setCaptainPlayerId: EventEmitter<number | null> = new EventEmitter<
    number | null
  >();
  @Output() setPlayerFocus: EventEmitter<number> = new EventEmitter<number>();

  hasError = false;
  gameId?: number;
  trikotNumber?: string;
  checked = false;
  changed = false;
  goalkeeper = false;

  constructor(
    private _gameService: GameService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (this.gamePlayerEntry) {
      this.trikotNumber = this.gamePlayerEntry.trikot_number
        ? this.gamePlayerEntry.trikot_number.toString()
        : '';
      this.goalkeeper = this.gamePlayerEntry.goalkeeper || false;
      this.checked = true;
    }

    this._route.params.subscribe({
      next: (value) => {
        this.gameId = value['matchId'];
      },
    });
  }

  ngAfterViewInit() {
    if (this.player.id === this.playerFocus) {
      this.trikotNumberInputElement.nativeElement.focus();
    }
  }

  handleFocusChange() {
    this.setPlayerFocus.emit(this.player.id);
  }

  handleButtonClick() {
    if (!this.gamePlayerEntry) {
      this.addLinupPlayer();
    } else if (this.changed) {
      this.updateLinupPlayer(true);
    } else {
      this.removeLinupPlayer();
    }
  }

  public addLinupPlayer(checkDuplicateNumbers = true) {
    if (
      checkDuplicateNumbers &&
      this.lineup &&
      this.lineup.findIndex(
        (p) => p.trikot_number === parseInt(this.trikotNumber || '', 10)
      ) >= 0
    ) {
      this._notificationService.error('Trikotnummer bereits vergeben', {
        autoClose: true,
        keepAfterRouteChange: true,
      });

      this.hasError = true;

      return;
    }

    this.hasError = false;

    if (this.trikotNumber && this.gameId) {
      this._gameService
        .addLineupPlayerToGame(
          this.gameId,
          this.side,
          this.player.id,
          this.trikotNumber,
          this.goalkeeper
        )
        .subscribe({
          next: (result) => {
            this._notificationService.success(
              'Spieler/in im Lineup gespeichert',
              {
                autoClose: true,
                keepAfterRouteChange: false,
              }
            );
            if (result.warning) {
              this._notificationService.warning(result.warning, {
                autoClose: false,
                keepAfterRouteChange: false,
              });
            }
            this.updateLineup.emit(result.players);
          },
        });
    } else {
      this._notificationService.error('Bitte gib eine Trikotnummer an', {
        autoClose: true,
        keepAfterRouteChange: false,
      });
    }
  }

  public updateLinupPlayer(checkDuplicateNumbers: boolean) {
    if (this.gamePlayerEntry?.trikot_number && this.gameId) {
      this._gameService
        .removeLineupPlayerToGame(
          this.gameId,
          this.side,
          this.gamePlayerEntry?.trikot_number.toString()
        )
        .subscribe(() => this.addLinupPlayer(checkDuplicateNumbers));
    } else {
      this._notificationService.error('Bitte gib eine Trikotnummer an', {
        autoClose: true,
        keepAfterRouteChange: false,
      });
    }
  }

  public removeLinupPlayer() {
    if (this.trikotNumber && this.gameId) {
      this._gameService
        .removeLineupPlayerToGame(this.gameId, this.side, this.trikotNumber)
        .subscribe({
          next: (result) => {
            this._notificationService.success(
              'Spieler/in aus Lineup entfernt',
              {
                autoClose: true,
                keepAfterRouteChange: false,
              }
            );
            this.updateLineup.emit(result);
          },
        });
    } else {
      this._notificationService.error('Bitte gib eine Trikotnummer an', {
        autoClose: true,
        keepAfterRouteChange: false,
      });
    }
  }

  handleTrikotNumberChange() {
    if (
      this.gamePlayerEntry &&
      this.gamePlayerEntry.trikot_number.toString() !== this.trikotNumber
    ) {
      this.updateLinupPlayer(true);
    } else {
      this.addLinupPlayer();
    }
  }

  toggleGoalkeeper() {
    this.goalkeeper = !this.goalkeeper;

    if (this.gamePlayerEntry) {
      if (this.gamePlayerEntry.goalkeeper !== this.goalkeeper) {
        this.updateLinupPlayer(false);
      } else {
        this.checked = true;
        this.changed = false;
      }
    }
  }

  toggleCaptain() {
    const value =
      this.captainPlayerId === this.player.id ? null : this.player.id;
    this.setCaptainPlayerId.emit(value);
  }

  hasGameEvents(): boolean {
    if (!this.gamePlayerEntry) return false;
    const trikot = this.gamePlayerEntry.trikot_number;
    return this.events.some(
      (e) =>
        e.event_team === this.side &&
        (e.number === trikot || e.assist === trikot)
    );
  }
}
