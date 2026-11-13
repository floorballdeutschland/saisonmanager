import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  Club,
  League,
  PlayerWithLicense,
  TeamWithPlayers,
} from '@floorball/types';
import { CurrentAgePipe } from '../../../../_uikit/_player/pipes';
import { ClubService, LeagueService, StorageService } from '@floorball/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';
import { licenseStatusBadgeClass } from 'src/app/_helpers/_utils/license-status';

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

  // Dieselbe Farbregel wie in der Lizenzverwaltung des Verbands, damit
  // `gesperrt` in jeder Lizenzliste dasselbe Bild ergibt (api#605).
  public statusBadgeClass = licenseStatusBadgeClass;

  // Rückfall für die alte API ohne adult_on, siehe isMinor.
  private readonly _currentAge = new CurrentAgePipe();

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

  /**
   * Brillensymbol: minderjährig am gewählten Spieltag (ohne Wahl: heute).
   *
   * Die Liga-Lizenzliste liefert seit api#906 kein Geburtsdatum mehr, sondern
   * `adult_on`, den 18. Geburtstag, solange der höchstens ein Jahr zurückliegt
   * (auch vergangene Spieltage der Saison stimmen so). `null` heißt seit über
   * einem Jahr volljährig oder Geburtsdatum unbekannt, beides ohne Symbol wie
   * bisher. Fehlt das Feld ganz, antwortet
   * noch die alte API; dann rechnet die currentAge-Pipe wie bisher aus dem
   * Geburtsdatum. Der Rückfall kann weg, sobald api#906 überall live ist.
   */
  public isMinor(player: PlayerWithLicense): boolean {
    if (player.adult_on === undefined) {
      return this._currentAge.transform(player, this.gamedayDate ?? '') < 18;
    }
    if (!player.adult_on) {
      return false;
    }
    // Beide im Format YYYY-MM-DD, daher genügt der Textvergleich.
    return (this.gamedayDate || this.localDate(new Date())) < player.adult_on;
  }

  private localDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return [date.getFullYear(), month, day].join('-');
  }

  public setGamedayDate(daysFromToday: number) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + daysFromToday);

    this.gamedayDate = this.localDate(tomorrow);
  }
}
