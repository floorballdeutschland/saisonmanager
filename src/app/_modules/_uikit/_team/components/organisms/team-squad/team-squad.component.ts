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
import { ClubService, LeagueService } from '@floorball/core';
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
  @Input() team!: string;
  @Input() teamId!: number;
  @Output() handleClose: EventEmitter<void> = new EventEmitter<void>();

  licenseHash!: LicenseHash;
  captainPlayerId: number | null = null;

  public filter: 'all' | 'selected' | 'not-selected' = 'all';
  public filterTypes: SquatFilterType[] = [
    { type: 'all', title: 'Alle' },
    { type: 'selected', title: 'Ausgewählt' },
    { type: 'not-selected', title: 'Nicht ausgewählt' },
  ];

  licenseList: { playerId: number; trikotNumber: number }[] = [];

  constructor(
    private _clubService: ClubService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title
  ) {
    this._metaTitle.setTitle('Floorball Saisonmanager Lizenzverwaltung');
  }

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

  setCaptainPlayerId(id: number | null) {
    this.captainPlayerId = id;
  }

  updateLineup(lineup: GamePlayerEntry[]) {
    this.players = lineup;

    const captain = lineup.find((player) => player.captain);
    if (captain) {
      this.captainPlayerId = captain.player_id;
    }
  }

  onClose(): void {
    this.handleClose.emit();
  }
}
