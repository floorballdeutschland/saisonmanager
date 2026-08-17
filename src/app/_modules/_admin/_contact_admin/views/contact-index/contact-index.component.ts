import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { ContactService, NotificationService } from '@floorball/core';
import { ContactClub, ContactManager } from '@floorball/types';
import { CsvCell, downloadCsv } from 'src/app/_helpers/_utils/csv-export';

// Kopfzeile des CSV-Exports. Eine Zeile je Empfänger, damit die Datei ohne
// Nacharbeit als Serienmail-Quelle taugt: Die Spalte „E-Mail" trägt immer die
// Adresse, an die geschrieben wird, Verein und Mannschaft stehen als Kontext
// daneben. Die Liga der Mannschaft hat eine eigene Spalte.
export const CONTACT_CSV_HEADERS = [
  'Verein',
  'Landesverband',
  'Mannschaft',
  'Liga',
  'Spielbetrieb',
  'Rolle',
  'Name',
  'E-Mail',
];

const ROLE_CLUB_CONTACT = 'Vereins-Kontaktadresse';
const ROLE_CLUB_MANAGER = 'Vereinsmanager (Vereinspost)';
const ROLE_TEAM_CONTACT = 'Mannschafts-Kontaktperson';
const ROLE_TEAM_MANAGER = 'Teammanager';

@Component({
  templateUrl: './contact-index.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class ContactIndexComponent implements OnInit, OnDestroy {
  clubs: ContactClub[] = [];
  loading = false;
  search = '';

  private _destroy$ = new Subject<void>();

  constructor(
    private _contactService: ContactService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this._cdr.markForCheck();

    this._contactService
      .getContacts()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.clubs = result.clubs;
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

  // Sucht über Vereins-, Mannschafts- und Personennamen sowie Adressen, damit
  // sich eine gemeldete Adresse auch rückwärts zuordnen lässt.
  get filteredClubs(): ContactClub[] {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      return this.clubs;
    }

    return this.clubs.filter((club) => this._clubHaystack(club).includes(term));
  }

  // Ein Verein ist nicht erreichbar, wenn weder eine Kontaktadresse hinterlegt
  // ist noch ein markierter Vereinsmanager mit Adresse dahintersteht.
  get clubsWithoutContact(): number {
    return this.clubs.filter(
      (club) =>
        !club.contact_email &&
        !club.notify_managers.some((manager) => manager.email)
    ).length;
  }

  get teamsWithoutContact(): number {
    return this.clubs.reduce(
      (sum, club) =>
        sum +
        club.teams.filter(
          (team) =>
            !team.contact_email &&
            !team.managers.some((manager) => manager.email)
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
      ...club.notify_managers.flatMap((m) => [m.name, m.email]),
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

  // Eine Zeile je Empfänger: die Kontaktadresse des Vereins, jeder markierte
  // Vereinsmanager, je Mannschaft die hinterlegte Kontaktperson und jeder
  // Teammanager. Eine Mannschaft ohne jeden Kontakt bekommt trotzdem eine
  // Zeile mit leeren Personenspalten, genau diese Lücken sind der Grund für
  // den Export.
  csvRows(): CsvCell[][] {
    const rows: CsvCell[][] = [];

    for (const club of this.filteredClubs) {
      const clubCells = [club.name, club.state_association_name, '', '', ''];

      if (club.contact_email) {
        rows.push([...clubCells, ROLE_CLUB_CONTACT, '', club.contact_email]);
      }

      for (const manager of club.notify_managers) {
        rows.push(this._managerRow(clubCells, ROLE_CLUB_MANAGER, manager));
      }

      for (const team of club.teams) {
        const teamCells = [
          club.name,
          club.state_association_name,
          team.name,
          team.league_name,
          team.game_operation_name,
        ];

        if (team.contact_person || team.contact_email) {
          rows.push([
            ...teamCells,
            ROLE_TEAM_CONTACT,
            team.contact_person,
            team.contact_email,
          ]);
        }

        for (const manager of team.managers) {
          rows.push(this._managerRow(teamCells, ROLE_TEAM_MANAGER, manager));
        }

        if (
          !team.contact_person &&
          !team.contact_email &&
          team.managers.length === 0
        ) {
          rows.push([...teamCells, ROLE_TEAM_MANAGER, '', '']);
        }
      }
    }

    return rows;
  }

  private _managerRow(
    prefix: CsvCell[],
    role: string,
    manager: ContactManager
  ): CsvCell[] {
    return [...prefix, role, manager.name, manager.email];
  }
}
