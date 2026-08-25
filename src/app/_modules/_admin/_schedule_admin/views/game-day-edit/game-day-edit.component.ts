import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  ArenaService,
  AssociationService,
  ClubService,
  LeagueService,
  NotificationService,
} from '@floorball/core';
import { Arena, Club, GamedayInput } from '@floorball/types';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

@Component({
  templateUrl: './game-day-edit.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class GameDayEditComponent implements OnInit {
  public gameday!: GamedayInput;
  public leagueId?: number;
  public editMode = true;

  public areans: Arena[] = [];
  public clubs: Club[] = [];

  // Hallen tragen ihren Anzeigenamen in schedule_item oder name; für das
  // Suchfeld werden beide zu einem Label verschmolzen. Einmal beim Laden
  // gefüllt, nicht als Getter: ein neues Array pro Change-Detection würde die
  // Trefferliste des Suchfelds bei jedem Durchlauf neu aufbauen.
  public arenaOptions: { id: number; label: string }[] = [];

  public useAllClubs = false;
  public allClubs: Club[] = [];
  public allClubsLoading = false;
  public clubQuery = '';
  public filteredClubs: Club[] = [];
  public showClubDropdown = false;

  constructor(
    private _associationService: AssociationService,
    private _leagueService: LeagueService,
    private _arenaService: ArenaService,
    private _clubService: ClubService,
    private _router: Router,
    private _notificationService: NotificationService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    private _transloco: TranslocoService
  ) {
    // this._metaTitle.setTitle('Floorball Saisonmanager');
  }

  public ngOnInit(): void {
    this._route.params.subscribe((params) => {
      if (params['leagueId']) {
        this.leagueId = params['leagueId'];
        this._leagueService
          .getAdminLeagueAdditionalReferences(params['leagueId'])
          .subscribe({
            next: (result) => {
              this.clubs = [...result.clubs].sort((a, b) =>
                a.name.localeCompare(b.name, 'de')
              );
              this.areans = result.arenas;
              // `?? ''` ist Pflicht, nicht Kosmetik: Altbestand ohne Namen und
              // ohne schedule_item hätte hier ein null-Label erzeugt und den
              // localeCompare-Vergleich geworfen – damit wäre die komplette
              // Spielort-Auswahl leer geblieben.
              this.arenaOptions = result.arenas
                .map((arena) => ({
                  id: arena.id,
                  label: arena.schedule_item || arena.name || '',
                }))
                .sort((a, b) => a.label.localeCompare(b.label, 'de'));
              if (this.clubs.length === 0) {
                this.enableAllClubs();
              } else {
                this._maybeAutoEnableAllClubs();
              }
              this._cdr.markForCheck();
            },
          });
      }

      if (params['gameDayId']) {
        this._leagueService.getAdminGameDay(params['gameDayId']).subscribe({
          next: (gameDay) => {
            this.gameday = gameDay;
            this._maybeAutoEnableAllClubs();
            this._cdr.markForCheck();
          },
        });
      } else {
        this.editMode = false;
        this.newGameday();
      }
    });
  }

  public newGameday() {
    this.gameday = {
      id: 0,
      number: 0,
      date: '',
      arena_id: 0,
      club_id: 0,
      league_id: 0,
    };

    this._cdr.markForCheck();
  }

  public enableAllClubs(): void {
    this.useAllClubs = true;
    this._loadAllClubs(() => {
      this.clubQuery = this._clubNameForCurrentSelection();
      this._cdr.markForCheck();
    });
  }

  public disableAllClubs(): void {
    this.useAllClubs = false;
    this.showClubDropdown = false;
    this.clubQuery = '';
    this.filteredClubs = [];

    // Der eingetragene Ausrichter muss die Rückkehr zur Ligaliste überleben.
    // Früher wurde er hier auf 0 gesetzt, wenn er nicht in der Liste steht,
    // also genau bei einem Verein aus einem anderen Spielbetrieb. Das Speichern
    // scheiterte danach an der Fremdschlüsselprüfung, was den Datensatz
    // unbeabsichtigt geschützt hat; seit die API die 0 als leere Auswahl liest,
    // wäre der Ausrichter stattdessen still verschwunden. Statt die Auswahl zu
    // verwerfen, wird der Verein in die Liste aufgenommen, damit er sichtbar
    // bleibt und bewusst geändert werden muss.
    const eingetragen = this.gameday.club_id;
    if (eingetragen > 0 && !this.clubs.find((c) => c.id === eingetragen)) {
      const ausGesamtliste = this.allClubs.find((c) => c.id === eingetragen);
      if (ausGesamtliste) {
        this.clubs = [...this.clubs, ausGesamtliste].sort((a, b) =>
          a.name.localeCompare(b.name, 'de')
        );
      }
    }

    this._cdr.markForCheck();
  }

  public onClubInput(value: string): void {
    this.clubQuery = value;
    this._filterClubs();
    this.showClubDropdown = true;
    this._cdr.markForCheck();
  }

  public onClubFocus(): void {
    this._filterClubs();
    this.showClubDropdown = true;
    this._cdr.markForCheck();
  }

  public onClubBlur(): void {
    setTimeout(() => {
      this.showClubDropdown = false;
      this.clubQuery = this._clubNameForCurrentSelection();
      this._cdr.markForCheck();
    }, 200);
  }

  public selectClub(club: Club): void {
    this.gameday.club_id = club.id;
    this.clubQuery = club.name;
    this.showClubDropdown = false;
    this._cdr.markForCheck();
  }

  public submit() {
    if (!this.leagueId) {
      return;
    }

    if (this.editMode) {
      const gameday = { ...this.gameday, league_id: this.leagueId };
      this._leagueService.adminUpdateGameDay(gameday).subscribe({
        next: () => {
          this._notificationService.success(
            this._transloco.translate(
              'scheduleAdmin.notifications.gameDaySaved'
            ),
            {
              autoClose: true,
              keepAfterRouteChange: true,
            }
          );

          this._router.navigate([
            '/',
            'verwaltung',
            'ligen',
            this.leagueId,
            'spielplan',
          ]);
        },
      });
    } else {
      const gameday = { ...this.gameday, league_id: this.leagueId };
      delete gameday['id'];
      this._leagueService.adminCreateGameDay(gameday).subscribe({
        next: () => {
          this._notificationService.success(
            this._transloco.translate(
              'scheduleAdmin.notifications.gameDayCreated'
            ),
            {
              autoClose: true,
              keepAfterRouteChange: true,
            }
          );

          this._router.navigate([
            '/',
            'verwaltung',
            'ligen',
            this.leagueId,
            'spielplan',
          ]);
        },
      });
    }
  }

  public destroy() {
    this._leagueService.adminDestroyGameDay(this.gameday.id || 0).subscribe({
      next: () => {
        this._notificationService.success(
          this._transloco.translate(
            'scheduleAdmin.notifications.gameDayDeleted'
          ),
          {
            autoClose: true,
            keepAfterRouteChange: true,
          }
        );

        this._router.navigate([
          '/',
          'verwaltung',
          'ligen',
          this.leagueId,
          'spielplan',
        ]);
      },
    });
  }

  private _maybeAutoEnableAllClubs(): void {
    if (
      this.gameday &&
      this.gameday.club_id > 0 &&
      this.clubs.length > 0 &&
      !this.clubs.find((c) => c.id === this.gameday.club_id)
    ) {
      this.enableAllClubs();
    }
  }

  private _loadAllClubs(onDone?: () => void): void {
    if (this.allClubs.length > 0 || this.allClubsLoading) {
      onDone?.();
      return;
    }
    this.allClubsLoading = true;
    this._clubService.getAdminClubAll().subscribe({
      next: (clubs) => {
        this.allClubs = [...clubs].sort((a, b) => a.name.localeCompare(b.name));
        this.allClubsLoading = false;
        onDone?.();
      },
      error: () => {
        this.allClubsLoading = false;
        this._cdr.markForCheck();
      },
    });
  }

  private _filterClubs(): void {
    const q = this.clubQuery.trim().toLowerCase();
    // Ein deaktivierter Verein richtet keinen Spieltag mehr aus und steht
    // deshalb nicht zur Wahl (fe#318). Der bereits eingetragene Ausrichter
    // bleibt drin, damit ein Bestands-Spieltag seinen Verein behält, und sein
    // Name kommt ohnehin aus der vollen Liste (_clubNameForCurrentSelection).
    const source = this.allClubs.filter(
      (c) => !c.deactivated || c.id === this.gameday?.club_id
    );
    this.filteredClubs =
      q.length === 0
        ? source.slice(0, 50)
        : source.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 50);
  }

  private _clubNameForCurrentSelection(): string {
    const id = this.gameday?.club_id;
    if (!id) return '';
    return (
      this.allClubs.find((c) => c.id === id)?.name ||
      this.clubs.find((c) => c.id === id)?.name ||
      ''
    );
  }
}
