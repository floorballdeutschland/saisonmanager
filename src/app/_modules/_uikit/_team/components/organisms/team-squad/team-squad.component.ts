import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import {
  GamePlayerEntry,
  LicenseHash,
  SquatFilterType,
} from '@floorball/models';
import { ClubService, GameService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'fb-team-squad',
  templateUrl: './team-squad.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class TeamSquadComponent implements OnInit {
  @Input() players!: GamePlayerEntry[];
  @Input() side!: string;
  @Input() team!: string;
  @Input() teamId!: number;
  @Output() handleClose: EventEmitter<void> = new EventEmitter<void>();

  licenseHash!: LicenseHash;
  captainPlayerId: number | null = null;
  gameId?: number;
  playerFocus?: number;

  public filter: 'all' | 'selected' | 'not-selected' = 'all';
  public filterTypes: SquatFilterType[] = [
    { type: 'all', title: 'Alle' },
    { type: 'selected', title: 'Ausgewählt' },
    { type: 'not-selected', title: 'Nicht ausgewählt' },
  ];

  constructor(
    private _clubService: ClubService,
    private _gameService: GameService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {}

  ngOnInit(): void {
    this.loadUserLicenses();
    this.updateLineup(this.players);

    this._route.params.subscribe({
      next: (value) => {
        this.gameId = value['matchId'];
      },
    });
  }

  public loadUserLicenses() {
    this._clubService.userGetTeamLicenses(this.teamId).subscribe({
      next: (result) => {
        this.licenseHash = result;

        this._cdr.markForCheck();
      },
    });
  }

  setFilter(filterType: 'all' | 'selected' | 'not-selected') {
    this.filter = filterType;
  }

  setCaptainPlayerId(playerId: number | null) {
    const trikotNumber = this.players.find(
      (p) => p.player_id === playerId
    )?.trikot_number;
    if (this.gameId && trikotNumber) {
      this._gameService
        .setLineupCaptain(this.gameId, this.side, trikotNumber.toString())
        .subscribe({
          next: (result) => {
            this.updateLineup(result);
          },
        });
    }
  }

  updateLineup(lineup: GamePlayerEntry[]) {
    if (lineup) {
      this.players = lineup;

      const captain = lineup.find((player) => player.captain);
      if (captain) {
        this.captainPlayerId = captain.player_id;
      }

      this._cdr.markForCheck();
    }
  }

  onClose(): void {
    this.handleClose.emit();
  }

  setPlayerFocus(playerId: number) {
    this.playerFocus = playerId;
  }
}
