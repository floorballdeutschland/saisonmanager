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
  CopyLineupResponse,
  GameEvent,
  GamePlayerEntry,
  LicenseHash,
  SquatFilterType,
} from '@floorball/models';
import { ClubService, GameService } from '@floorball/core';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'fb-team-squad',
  templateUrl: './team-squad.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class TeamSquadComponent implements OnInit {
  @Input() players!: GamePlayerEntry[];
  @Input() side!: string;
  @Input() team!: string;
  @Input() teamId!: number;
  // Aus dem Spiel statt aus der Adresse, Begründung an
  // TeamSquadPlayerComponent#gameId.
  @Input() gameId?: number;
  @Input() events: GameEvent[] = [];
  /**
   * Der Landesverband der Liga dieses Spiels lässt Personen mit dem
   * Lizenzstatus „beantragt" aufstellen (Game#requested_license_playable).
   *
   * Kommt vom Spiel und nicht von der Mannschaft: Zuständig für den
   * Spielbetrieb einer Liga ist allein deren Verband, und eine Mannschaft kann
   * daneben im Pokal eines anderen Verbands antreten. Standard false, damit
   * ein Frontend-Deploy vor dem API-Deploy wie bisher nur „erteilt" zulässt.
   */
  @Input() requestedLicensePlayable = false;
  @Output() handleClose: EventEmitter<void> = new EventEmitter<void>();

  licenseHash!: LicenseHash;
  captainPlayerId: number | null = null;
  playerFocus?: number;
  copyingLastGame = false;
  copyResult?: CopyLineupResponse;

  public filter: 'all' | 'selected' | 'not-selected' = 'all';
  public filterTypes: SquatFilterType[] = [
    { type: 'all', title: 'Alle' },
    { type: 'selected', title: 'Ausgewählt' },
    { type: 'not-selected', title: 'Nicht ausgewählt' },
  ];

  constructor(
    private _clubService: ClubService,
    private _gameService: GameService,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {}

  ngOnInit(): void {
    this.loadUserLicenses();
    this.updateLineup(this.players);
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

  /**
   * Aufstellung aus dem letzten Spiel der Mannschaft übernehmen (feedback#69).
   * Danach trägt man die Abwesenden über die Häkchen wieder aus. Angeboten nur
   * bei leerer Aufstellung, siehe Vorlage. Fehler meldet der ErrorInterceptor.
   */
  copyFromLastGame() {
    if (!this.gameId || this.copyingLastGame) return;

    this.copyingLastGame = true;
    this._gameService.copyLineupFromLastGame(this.gameId, this.side).subscribe({
      next: (result) => {
        this.copyingLastGame = false;
        this.copyResult = result;
        this.updateLineup(result.players);
      },
      error: () => {
        this.copyingLastGame = false;
        this._cdr.markForCheck();
      },
    });
  }

  /**
   * `game_days.date` ist in der API Text, im Altbestand stehen auch Werte wie
   * „11.08.2026". Nur ein ISO-Datum wird umgestellt, alles andere bleibt, wie
   * es ist, statt über die DatePipe zu werfen.
   */
  formatSourceDate(date: string | null): string {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
    return iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : (date ?? '');
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

  isGoalieSet() {
    return this.players.reduce((hasGoalie, player) => {
      return hasGoalie || player.goalkeeper;
    }, false);
  }
}
