import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { GameService, NotificationService } from '@floorball/core';
import { SecretaryHallDay, SecretaryLinkInfo } from '@floorball/types';

/**
 * „Spielsekretariat“ für Vereins- und Teammanager:innen: der Einmal-Link für
 * den Tisch, den bisher nur die Spielbetriebskommission ausgeben konnte.
 *
 * Gelistet wird pro Halle und Tag, nicht pro Liga – so sitzt das Sekretariat
 * auch am Tisch. Laufen dort mehrere Ligen nacheinander, deckt ein Link sie
 * alle ab.
 */
@Component({
  templateUrl: './secretary-links.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SecretaryLinksComponent implements OnInit, OnDestroy {
  hallDays: SecretaryHallDay[] = [];
  loading = true;
  loadFailed = false;

  /** Zuletzt erzeugte URL je Gruppe – der Rohtoken kommt nur genau einmal. */
  urlByKey: Record<string, string> = {};
  /**
   * Gerade erzeugte Links. Getrennt von `hallDay.link` gehalten, damit die
   * Serverantwort unverändert bleibt und lokale Optimismen davon unterscheidbar
   * sind.
   */
  linkByKey: Record<string, SecretaryLinkInfo> = {};
  generatingKey: string | null = null;
  copiedKey: string | null = null;

  private _destroy$ = new Subject<void>();

  constructor(
    private _gameService: GameService,
    private _notificationService: NotificationService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this._load();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  /**
   * Halle und Tag identifizieren eine Gruppe. Ohne Halle lässt sich nichts
   * zusammenfassen, dann steht der Spieltag selbst für die Gruppe – zwei
   * hallenlose Spieltage am selben Tag bekämen sonst denselben Schlüssel.
   */
  key(hallDay: SecretaryHallDay): string {
    return hallDay.arena_id === null
      ? `ohne:${hallDay.date}:${hallDay.game_days[0].id}`
      : `${hallDay.arena_id}:${hallDay.date}`;
  }

  formatDate(date: string): string {
    if (!date) return '';
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  leagueNames(hallDay: SecretaryHallDay): string {
    return hallDay.game_days
      .map((gd) => gd.league)
      .filter((name): name is string => !!name)
      .join(' · ');
  }

  /** Ligen derselben Halle, für die die Berechtigung fehlt. */
  otherLeagueNames(hallDay: SecretaryHallDay): string {
    return hallDay.other_game_days_in_hall
      .map((gd) => gd.league)
      .filter((name): name is string => !!name)
      .join(', ');
  }

  gamesCount(hallDay: SecretaryHallDay): number {
    return hallDay.game_days.reduce((sum, gd) => sum + gd.games_count, 0);
  }

  /**
   * Der Link wird immer für den ersten Spieltag der Gruppe angefordert; welche
   * weiteren Spieltage er abdeckt, entscheidet der Server anhand von Halle,
   * Datum und Berechtigung.
   */
  generate(hallDay: SecretaryHallDay): void {
    const key = this.key(hallDay);
    this.generatingKey = key;
    // Ein neuer Link entwertet den alten; die Erfolgsmeldung von vorhin darf
    // nicht stehen bleiben und auf die inzwischen veraltete URL zeigen.
    this.copiedKey = null;
    this._gameService
      .createSecretaryLink(hallDay.game_days[0].id)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.urlByKey[key] = result.url;
          this.linkByKey[key] = {
            expires_at: result.expires_at,
            created_by: result.created_by,
            game_day_ids: result.game_day_ids,
          };
          this.generatingKey = null;
          this._warnOnCoverageMismatch(hallDay, result.game_day_ids);
          this._cdr.markForCheck();
        },
        // Die Fehlermeldung kommt vom ErrorInterceptor, der die Servernachricht
        // bereits ausliest. Ein eigener Toast hätte dieselbe ID und würde die
        // genauere Meldung nur verdecken (fe#229).
        error: () => {
          this.generatingKey = null;
          this._cdr.markForCheck();
        },
      });
  }

  /** Serverstand, überlagert vom gerade erzeugten Link. */
  linkFor(hallDay: SecretaryHallDay): SecretaryLinkInfo | null {
    return this.linkByKey[this.key(hallDay)] ?? hallDay.link;
  }

  /**
   * „Kopiert" wird erst gemeldet, wenn die Zwischenablage den Text angenommen
   * hat. Ohne HTTPS gibt es `navigator.clipboard` gar nicht, und auch mit kann
   * der Browser die Freigabe verweigern – eine Erfolgsmeldung auf Verdacht
   * hieße, dass jemand einen leeren Einfügen-Versuch macht und den Link für
   * verschickt hält.
   */
  async copy(hallDay: SecretaryHallDay): Promise<void> {
    const key = this.key(hallDay);
    const url = this.urlByKey[key];
    if (!url) return;

    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      this.copiedKey = key;
    } catch {
      this.copiedKey = null;
      this._notificationService.error(
        'Kopieren war nicht möglich. Bitte markiere den Link und kopiere ihn von Hand.'
      );
    }
    this._cdr.markForCheck();
  }

  /**
   * Die Liste kann veraltet sein: Wurde ein Spieltag inzwischen in eine andere
   * Halle verlegt, deckt der Link weniger ab, als hier steht. Ohne Hinweis ginge
   * der Link so hinaus und am Tisch fehlten Spiele.
   */
  private _warnOnCoverageMismatch(
    hallDay: SecretaryHallDay,
    issuedIds: number[]
  ): void {
    const shown = hallDay.game_days.map((gd) => gd.id);
    const missing = shown.filter((id) => !issuedIds.includes(id));
    if (missing.length === 0) return;

    this._notificationService.warning(
      'Der Link deckt weniger Spieltage ab als hier angezeigt. ' +
        'Bitte lade die Seite neu und prüfe, welche Spiele enthalten sind.'
    );
  }

  private _load(): void {
    this._gameService
      .getSecretaryGameDays()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (hallDays) => {
          this.hallDays = hallDays;
          this.loadFailed = false;
          this.loading = false;
          this._cdr.markForCheck();
        },
        // Den Toast übernimmt der ErrorInterceptor. Hier wird nur der Zustand
        // festgehalten: ohne ihn zeigte die Seite „Keine Spieltage gefunden" und
        // behauptete damit als Tatsache, was sie gar nicht wissen kann.
        error: () => {
          this.loadFailed = true;
          this.loading = false;
          this._cdr.markForCheck();
        },
      });
  }
}
