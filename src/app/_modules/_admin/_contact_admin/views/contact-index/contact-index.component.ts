import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import {
  AssociationService,
  ContactService,
  NotificationService,
} from '@floorball/core';
import { ContactClub, ContactManager, Season } from '@floorball/types';
import { CsvCell, downloadCsv } from 'src/app/_helpers/_utils/csv-export';

// Kopfzeile des CSV-Exports. Eine Zeile je Mannschaft und je Ansprechperson,
// damit die Datei ohne Nacharbeit als Serienmail-Quelle taugt.
export const CONTACT_CSV_HEADERS = [
  'Verein',
  'Landesverband',
  'Vereins-E-Mail',
  'Mannschaft',
  'Liga',
  'Spielbetrieb',
  'Mannschafts-Kontaktperson',
  'Mannschafts-E-Mail',
  'Rolle',
  'Name',
  'E-Mail',
  'Benutzername',
];

@Component({
  templateUrl: './contact-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ContactIndexComponent implements OnInit, OnDestroy {
  clubs: ContactClub[] = [];
  seasons: Season[] = [];
  seasonId: string | null = null;
  loading = false;
  search = '';

  private _destroy$ = new Subject<void>();

  constructor(
    private _contactService: ContactService,
    private _associationService: AssociationService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._associationService.seasons$
      .pipe(takeUntil(this._destroy$))
      .subscribe((seasons) => {
        this.seasons = [...seasons].sort((a, b) => b.id - a.id);
        this._cdr.markForCheck();
      });

    this._associationService.currentSeasonId$
      .pipe(takeUntil(this._destroy$))
      .subscribe((id) => {
        // Nur vorbelegen, nicht überschreiben: Wer die Saison schon gewechselt
        // hat, soll durch eine spätere Meldung nicht zurückgeworfen werden.
        if (this.seasonId === null && id) {
          this.seasonId = String(id);
          this.load();
        }
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this._cdr.markForCheck();

    this._contactService
      .getContacts(this.seasonId ?? undefined)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.clubs = result.clubs;
          this.seasonId = result.season_id;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._cdr.markForCheck();
          this._notificationService.error(
            'Die Kontakte konnten nicht geladen werden.'
          );
        },
      });
  }

  onSeasonChange(seasonId: string): void {
    this.seasonId = seasonId;
    this.load();
  }

  // Sucht über Vereins-, Mannschafts- und Personennamen sowie Adressen, damit
  // sich eine gemeldete Adresse auch rückwärts zuordnen lässt.
  get filteredClubs(): ContactClub[] {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      return this.clubs;
    }

    return this.clubs.filter((club) => this._clubHaystack(club).includes(term));
  }

  get clubsWithoutManager(): number {
    return this.clubs.filter((club) => club.managers.length === 0).length;
  }

  get teamsWithoutContact(): number {
    return this.clubs.reduce(
      (sum, club) =>
        sum +
        club.teams.filter(
          (team) => team.managers.length === 0 && !team.contact_email
        ).length,
      0
    );
  }

  get teamCount(): number {
    return this.clubs.reduce((sum, club) => sum + club.teams.length, 0);
  }

  exportCsv(): void {
    downloadCsv('kontakte', CONTACT_CSV_HEADERS, this.csvRows());
  }

  private _clubHaystack(club: ContactClub): string {
    return [
      club.name,
      club.state_association_name,
      club.contact_email,
      ...club.managers.flatMap((m) => [m.name, m.email]),
      ...club.teams.flatMap((team) => [
        team.name,
        team.league_name,
        team.contact_person,
        team.contact_email,
        ...team.managers.flatMap((m) => [m.name, m.email]),
      ]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  // Eine Zeile je Ansprechperson. Vereine und Mannschaften ohne Konto bekommen
  // trotzdem eine Zeile mit leeren Personenspalten: Diese Lücken sind der
  // eigentliche Grund für den Export.
  csvRows(): CsvCell[][] {
    const rows: CsvCell[][] = [];

    for (const club of this.filteredClubs) {
      const clubCells = [
        club.name,
        club.state_association_name,
        club.contact_email,
      ];

      rows.push(
        ...this._managerRows(
          club.managers,
          [...clubCells, '', '', '', '', ''],
          'Vereinsmanager'
        )
      );

      for (const team of club.teams) {
        const teamCells = [
          ...clubCells,
          team.name,
          team.league_name,
          team.game_operation_name,
          team.contact_person,
          team.contact_email,
        ];

        rows.push(
          ...this._managerRows(team.managers, teamCells, 'Teammanager')
        );
      }
    }

    return rows;
  }

  private _managerRows(
    managers: ContactManager[],
    prefix: CsvCell[],
    role: string
  ): CsvCell[][] {
    if (managers.length === 0) {
      return [[...prefix, role, '', '', '']];
    }

    return managers.map((manager) => [
      ...prefix,
      role,
      manager.name,
      manager.email,
      manager.username,
    ]);
  }
}
