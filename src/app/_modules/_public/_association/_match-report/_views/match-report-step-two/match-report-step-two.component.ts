import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import {
  Game,
  GameAdditionalFields,
  Penalty,
  PenaltyCode,
  PeriodTitles,
} from '@floorball/types';
import { map, Observable } from 'rxjs';
import {
  GameService,
  LeagueService,
  NotificationService,
  StorageService,
} from '@floorball/core';

// Schalter je Gerät, nicht je Spiel oder Konto: Das Sekretariat bleibt in der
// gewohnten Eingabe, ein zweites Tablet erfasst die Schüsse (fe#344).
export const TABLET_MODE_STORAGE_KEY = 'match_report_tablet_mode';

// Ob die normale Eingabe im Tabletmodus aufgeklappt ist, ebenfalls je Gerät.
// Ohne Eintrag bleibt sie eingeklappt: Am zweiten Gerät soll niemand ein Tor
// eintragen, das das Sekretariat schon eingetragen hat.
export const TABLET_NORMAL_INPUT_STORAGE_KEY =
  'match_report_tablet_normal_input';

@Component({
  selector: 'fb-match-report-step-two',
  templateUrl: './match-report-step-two.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MatchReportStepTwoComponent implements OnInit {
  @Input()
  game!: Game;

  @Input()
  additionalFields!: GameAdditionalFields;

  @Input()
  currentPeriod!: string;

  @Output()
  handleSbbScroll = new EventEmitter<void>();

  @Output()
  handleReload = new EventEmitter<void>();

  @Output()
  updatePeriod: EventEmitter<string> = new EventEmitter<string>();

  // match report properties
  public game_period = '2';
  public event = '';
  public penalties: Penalty[] = [];
  public penaltyCodes: PenaltyCode[] = [];

  // Tabletmodus (Beta). Der Schalter allein ändert nichts am Spiel; erst ein
  // erfasster Schuss markiert es in der API als Tablet-Spiel.
  public tabletMode = false;
  // Feldgröße der Liga für das Spielfeld der Tablet-Erfassung (fe#591).
  public fieldSize$!: Observable<string | null>;

  // Normale Eingabe im Tabletmodus aufgeklappt? Ohne Tabletmodus ohne Wirkung.
  public normalInputExpanded = false;

  public regularTimeSummary: PeriodTitles = {
    period: 100,
    short_title: 'REG',
    title: 'Reguläre Spielzeit',
    status_id: 'reg',
    running: false,
    can_end_game: false,
    optional: false,
  };

  public overtimeSummary: PeriodTitles = {
    period: 200,
    short_title: 'V',
    title: 'Verlängerung',
    status_id: 'ot',
    running: false,
    can_end_game: false,
    optional: true,
  };

  constructor(
    private _leagueService: LeagueService,
    private _gameService: GameService,
    private _notificationService: NotificationService,
    private _storage: StorageService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.tabletMode = this._storage.getItem(TABLET_MODE_STORAGE_KEY) === '1';
    this.fieldSize$ = this._leagueService.selectedLeague$.pipe(
      map((league) => league?.field_size ?? null)
    );
    this.normalInputExpanded =
      this._storage.getItem(TABLET_NORMAL_INPUT_STORAGE_KEY) === '1';

    this._leagueService.getPenalties().subscribe({
      next: (penalties) => {
        this.penalties = penalties;
      },
    });

    this._leagueService.getPenaltyCodes().subscribe({
      next: (penalties) => {
        this.penaltyCodes = penalties;
      },
    });
  }

  public setTabletMode(enabled: boolean): void {
    this.tabletMode = enabled;
    if (enabled) {
      this._storage.setItem(TABLET_MODE_STORAGE_KEY, '1');
    } else {
      this._storage.removeItem(TABLET_MODE_STORAGE_KEY);
    }
    this._cdr.markForCheck();
  }

  /**
   * Normale Ereigniseingabe sichtbar? Ohne Tabletmodus immer, im Tabletmodus
   * nur, wenn sie auf diesem Gerät ausdrücklich aufgeklappt wurde.
   */
  public get showNormalInput(): boolean {
    return !this.tabletMode || this.normalInputExpanded;
  }

  public setNormalInputExpanded(expanded: boolean): void {
    this.normalInputExpanded = expanded;
    if (expanded) {
      this._storage.setItem(TABLET_NORMAL_INPUT_STORAGE_KEY, '1');
    } else {
      this._storage.removeItem(TABLET_NORMAL_INPUT_STORAGE_KEY);
      // Ein offenes Formular wird geschlossen, damit es beim nächsten
      // Aufklappen nicht unbemerkt offen steht.
      this.event = '';
    }
    this._cdr.markForCheck();
  }

  public setCurrentPeriod(period: string) {
    this.currentPeriod = period;
  }

  public setEvent(eventName: string): void {
    if (this.event === eventName) {
      this.event = '';
    } else {
      this.event = eventName;
      if (!this.game?.started && eventName === 'next') {
        setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 150);
      }
    }
    this._cdr.markForCheck();
  }

  scrollToSbbNavigation() {
    this.handleSbbScroll.emit();
  }

  reloadGame() {
    this.handleReload.emit();
    this.event = '';
  }

  public bothLineupsPresent(): boolean {
    return (
      (this.game?.players?.home?.length ?? 0) > 0 &&
      (this.game?.players?.guest?.length ?? 0) > 0
    );
  }

  // Dieselbe Bedingung, die die API beim Spielstart prüft (set_flag). Sie wurde
  // bisher erst am Klick sichtbar, und die Absage lag unter einer generischen
  // Meldung: Am 30.08.2026 drückte das Spielsekretariat der U13 KF RL Ost in
  // Wernigerode deshalb 88 Minuten lang 23-mal auf "Spiel starten", ohne zu
  // erfahren, dass Platz 1 des Gespanns leer war. Deshalb hier vorab, mit
  // demselben Muster wie bothLineupsPresent().
  //
  // `!== false` und nicht `=== true`: Fehlt das Feld (älterer API-Stand), bleibt
  // der Knopf sichtbar und die API entscheidet wie bisher allein.
  public referee1Present(): boolean {
    return this.game?.referee1_present !== false;
  }

  // Trennt "gar kein Schiedsrichter" von "im falschen Feld". Der zweite Fall ist
  // der, der in Wernigerode passierte, und er braucht einen anderen Satz: In der
  // Maske steht dann ein Schiedsrichter, nur eben auf Platz 2.
  //
  // `referees.length` allein reicht dafür nicht: Ein geleertes Feld hinterlässt
  // den Platzhalter "0 , ", der in der Liste als Eintrag mit Lizenz "0" und
  // leerem Namen mitläuft. Gezählt wird deshalb nur, was einen Namen oder eine
  // echte Lizenz trägt.
  public onlyReferee2Present(): boolean {
    if (this.referee1Present()) return false;

    return (this.game?.referees ?? []).some(
      (referee) =>
        !!referee?.last_name?.trim() ||
        !!referee?.first_name?.trim() ||
        parseInt(referee?.license_id ?? '0', 10) > 0
    );
  }

  // Befindet sich das Spiel aktuell im Penalty-Schießen?
  public isShootout(): boolean {
    return this.game?.current_period_title?.status_id === 'penalty_shots';
  }

  public removeTimeout(team: 'home' | 'guest'): void {
    this._gameService.clearTimeout(this.game.id, team).subscribe({
      next: () => {
        this._notificationService.success('Time-Out entfernt', {
          autoClose: true,
          keepAfterRouteChange: true,
        });
        this.reloadGame();
      },
    });
  }

  public isGamePeriodActive(index: number) {
    const currentlyOptional = this.game.current_period_title?.optional;
    const statusIndex = this.game.period_titles
      .filter((period) => period.optional === currentlyOptional)
      .findIndex((item) => item.status_id === this.game.ingame_status);

    if (statusIndex < 0) {
      return 1;
    } else if (statusIndex === index) {
      return 0;
    } else if (statusIndex < index) {
      return 1;
    } else {
      return -1;
    }
  }
}
