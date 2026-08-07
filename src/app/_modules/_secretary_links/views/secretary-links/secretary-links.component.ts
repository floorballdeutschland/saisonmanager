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
import { SecretaryHallDay } from '@floorball/types';

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

  /** Zuletzt erzeugte URL je Gruppe – der Rohtoken kommt nur genau einmal. */
  urlByKey: Record<string, string> = {};
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

  /** Halle + Tag identifizieren eine Gruppe; ohne Halle der erste Spieltag. */
  key(hallDay: SecretaryHallDay): string {
    return `${hallDay.arena_id ?? 'ohne'}:${hallDay.date}:${
      hallDay.game_days[0]?.id ?? 0
    }`;
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

  gamesCount(hallDay: SecretaryHallDay): number {
    return hallDay.game_days.reduce((sum, gd) => sum + gd.games_count, 0);
  }

  /**
   * Der Link wird immer für den ersten Spieltag der Gruppe angefordert; welche
   * weiteren Spieltage er abdeckt, entscheidet der Server anhand von Halle,
   * Datum und Berechtigung.
   */
  generate(hallDay: SecretaryHallDay): void {
    const gameDayId = hallDay.game_days[0]?.id;
    if (!gameDayId) return;

    const key = this.key(hallDay);
    this.generatingKey = key;
    this._gameService
      .createSecretaryLink(gameDayId)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (result) => {
          this.urlByKey[key] = result.url;
          hallDay.link = {
            expires_at: result.expires_at,
            created_by: result.created_by,
            game_day_ids: result.game_day_ids,
          };
          this.generatingKey = null;
          this._cdr.markForCheck();
        },
        error: () => {
          this.generatingKey = null;
          this._notificationService.error(
            'Der Link konnte nicht erzeugt werden.'
          );
          this._cdr.markForCheck();
        },
      });
  }

  copy(hallDay: SecretaryHallDay): void {
    const key = this.key(hallDay);
    const url = this.urlByKey[key];
    if (!url) return;

    navigator.clipboard?.writeText(url);
    this.copiedKey = key;
    this._cdr.markForCheck();
  }

  private _load(): void {
    this._gameService
      .getSecretaryGameDays()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (hallDays) => {
          this.hallDays = hallDays;
          this.loading = false;
          this._cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this._notificationService.error(
            'Die Spieltage konnten nicht geladen werden.'
          );
          this._cdr.markForCheck();
        },
      });
  }
}
