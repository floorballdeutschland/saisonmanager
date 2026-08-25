import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Club, League, TeamWithPlayers } from '@floorball/types';
import { ClubService, LeagueService, StorageService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';

// Schreibweise wie die Nachbarschlüssel des Moduls (license_admin_page_size).
const SHOW_DATES_STORAGE_KEY = 'license_list_show_dates';

@Component({
  selector: 'fb-license-user-league-detail',
  templateUrl: './license-user-league-detail.component.html',
  styleUrls: ['./license-user-league-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class LicenseUserLeagueDetailComponent implements OnInit {
  league?: League;
  teams: TeamWithPlayers[] = [];
  allClubs: Club[] = [];
  gamedayDate?: string;

  handledPlayerIds: number[] = [];

  // Beantragungs-, Erteilungs- und Freigabedatum in der Liste. An, weil die
  // Fristen aus Lizenzordnung (Freigabe) und SPO (Beantragung) genau dafür
  // nachgeschlagen werden; abwählbar für einen schlanken Spieltagsbeleg. Die
  // Wahl gilt auch für den Ausdruck.
  showDates = true;

  constructor(
    private _leagueService: LeagueService,
    private _clubService: ClubService,
    private _storageService: StorageService,
    private _route: ActivatedRoute,
    private _cdr: ChangeDetectorRef,
    private _metaTitle: Title,
    private _transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    // Titel erst setzen, wenn der lazy geladene Scope 'admin/license' verfügbar
    // ist – im Konstruktor liefert translate() sonst nur den rohen Key-Pfad.
    // selectTranslate() lädt scope-korrekt und emittiert erst nach dem Laden;
    // selectTranslation('admin/license') fehlinterpretiert den zweistufigen Pfad.
    this._transloco
      .selectTranslate('userLeagueDetail.metaTitle', {}, 'admin/license')
      .pipe(take(1))
      .subscribe(() =>
        this._metaTitle.setTitle(
          this._transloco.translate('licenseAdmin.userLeagueDetail.metaTitle')
        )
      );

    this.showDates = this.readShowDates();

    this.getGameOperations();
    this.getAllClubs();
  }

  public toggleDates(show: boolean): void {
    this.showDates = show;
    this._storageService.setItem(SHOW_DATES_STORAGE_KEY, String(show));
  }

  // Nur das ausdrücklich geschriebene 'false' blendet aus; jeder andere Inhalt
  // (Rest einer früheren Fassung, von Hand gesetzter Wert) fällt auf die
  // Vorgabe zurück. Sonst versteckt ein unbrauchbarer Wert genau die Angaben,
  // für die diese Liste gelesen wird. Gleiches Muster wie die Seitengröße in
  // der Verbandsübersicht, die ihren Wert ebenfalls gegen die erlaubten prüft.
  // StorageService liefert für einen fehlenden Schlüssel '' statt null.
  private readShowDates(): boolean {
    return this._storageService.getItem(SHOW_DATES_STORAGE_KEY) !== 'false';
  }

  public getGameOperations(): void {
    this._route.params.subscribe((params) => {
      this._leagueService.getSingleLeague(params['leagueId']).subscribe({
        next: (league) => {
          this.league = league;
          this._cdr.markForCheck();
        },
      });
      this._leagueService.getUserLeagueLicenses(params['leagueId']).subscribe({
        next: (teams) => {
          this.teams = teams;

          this._cdr.markForCheck();
        },
      });
    });
  }

  public getAllClubs(): void {
    this._clubService.getAdminClubAll().subscribe({
      next: (result) => {
        this.allClubs = result;
        this._cdr.markForCheck();
      },
    });
  }

  public handledPlayer(playerId: number) {
    this.handledPlayerIds.push(playerId);
    this.getGameOperations();
  }

  public currentTime() {
    return new Date();
  }

  public calculateAge(dateString: string): number {
    if (!this.gamedayDate) {
      return 0;
    }

    const parseLocalDate = (s: string) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    const today = parseLocalDate(this.gamedayDate);
    const birthDate = parseLocalDate(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  public setGamedayDate(daysFromToday: number) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + daysFromToday);

    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const joined = [year, month, day].join('-');

    this.gamedayDate = joined;
  }
}
