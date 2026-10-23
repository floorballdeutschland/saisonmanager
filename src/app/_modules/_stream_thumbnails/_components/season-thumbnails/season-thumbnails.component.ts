import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { GameService } from '@floorball/core';
import {
  SeasonThumbnailGameDay,
  SeasonThumbnailPayload,
} from '@floorball/types';
import { filenameSlug } from 'src/app/_helpers/_utils/stream-thumbnail';
import {
  ThumbnailBatchItem,
  highlightReady,
} from 'src/app/_helpers/_utils/thumbnail-batch';

/**
 * Thumbnail-Stapel einer ganzen Saison für den ausrichtenden Verein
 * (feedback#77), auf der Seite „Spielsekretariat".
 *
 * WARUM HIER UND NICHT HINTER DEM OVERLAY-TOKEN: Highlightvideos werden oft
 * Tage nach dem Spiel geschnitten, dann ist der Zugang des Spieltags
 * abgelaufen. Diese Seite hängt am Benutzerkonto, und der Server liefert genau
 * die Spieltage, für die man auch die Zugänge vergeben darf.
 *
 * Ein Abruf für die Saison, nicht einer je Spieltag: Ein Verein mit mehreren
 * Mannschaften richtet leicht zwanzig Spieltage aus. Gezeichnet wird mit
 * `fb-thumbnail-batch`, also derselben Schleife wie im Spielplan.
 */
@Component({
  selector: 'fb-season-thumbnails',
  templateUrl: './season-thumbnails.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class SeasonThumbnailsComponent implements OnInit, OnDestroy {
  public loading = true;
  public loadFailed = false;
  /**
   * Die zuletzt geladene Antwort. Bleibt bei einem Ladefehler stehen: Sie
   * trägt die Saisonliste, und ohne sie verschwände nach einem gescheiterten
   * Saisonwechsel die Auswahl, mit der man es noch einmal versuchen könnte.
   */
  public payload: SeasonThumbnailPayload | null = null;
  /** Die gewählte Saison, auch wenn ihr Abruf gerade gescheitert ist. */
  public seasonId: number | null = null;
  /** 0 heißt alle Ligen. */
  public leagueId = 0;

  public leagues: { id: number; name: string }[] = [];
  /**
   * Fest gehaltene Listen statt Getter: `fb-thumbnail-batch` fragt bei jeder
   * Änderungsprüfung nach der Länge, ein Getter baute dafür jedes Mal neue
   * Listen.
   */
  public livestreamItems: ThumbnailBatchItem[] = [];
  public highlightItems: ThumbnailBatchItem[] = [];
  public gameDayCount = 0;

  private _request?: Subscription;
  /** Spieltage der zuletzt ERFOLGREICH geladenen Saison, leer nach einem Fehler. */
  private _gameDays: SeasonThumbnailGameDay[] = [];

  constructor(
    private _gameService: GameService,
    private _cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this._load(null);
  }

  public ngOnDestroy(): void {
    this._request?.unsubscribe();
  }

  public selectSeason(value: string | number): void {
    const id = Number(value);
    if (!Number.isFinite(id) || (id === this.seasonId && !this.loadFailed)) {
      return;
    }

    this.leagueId = 0;
    this._load(id);
  }

  /** Nach einem Ladefehler dieselbe Saison noch einmal. */
  public retry(): void {
    this._load(this.seasonId);
  }

  public selectLeague(value: string | number): void {
    this.leagueId = Number(value) || 0;
    this._rebuild();
  }

  public get seasonName(): string {
    return (
      this.payload?.seasons.find((season) => season.id === this.seasonId)
        ?.name ?? String(this.seasonId ?? '')
    );
  }

  /** Archivname ohne Endung, etwa `thumbnails-highlights-2026-2027`. */
  public zipName(variant: 'livestream' | 'highlights'): string {
    const league = this.leagues.find((entry) => entry.id === this.leagueId);

    return ['thumbnails', variant, filenameSlug(this.seasonName)]
      .concat(league ? [filenameSlug(league.name)] : [])
      .filter(Boolean)
      .join('-');
  }

  private _load(seasonId: number | null): void {
    this._request?.unsubscribe();
    this.seasonId = seasonId;
    this.loading = true;
    this.loadFailed = false;
    this._gameDays = [];
    this._cdr.markForCheck();

    this._request = this._gameService
      .getSeasonThumbnailGameDays(seasonId)
      .subscribe({
        next: (payload) => {
          this.payload = payload;
          this.seasonId = payload.season_id;
          this._gameDays = payload.game_days;
          this.leagues = this._leaguesOf(payload.game_days);
          this.loading = false;
          this._rebuild();
        },
        // Den Toast übernimmt der ErrorInterceptor; hier nur der Zustand, damit
        // die Karte nicht „keine Spieltage" behauptet. Die Saisonliste der
        // letzten Antwort bleibt, geleert werden nur die Spieltage.
        error: () => {
          this._gameDays = [];
          this.leagues = [];
          this.loading = false;
          this.loadFailed = true;
          this._rebuild();
        },
      });
  }

  private _leaguesOf(
    gameDays: SeasonThumbnailGameDay[]
  ): { id: number; name: string }[] {
    const byId = new Map<number, string>();
    for (const gameDay of gameDays) {
      if (!byId.has(gameDay.league_id)) {
        byId.set(gameDay.league_id, gameDay.league || `#${gameDay.league_id}`);
      }
    }

    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  private _rebuild(): void {
    const gameDays = this._gameDays.filter(
      (gameDay) => !this.leagueId || gameDay.league_id === this.leagueId
    );

    const items: ThumbnailBatchItem[] = gameDays.flatMap((gameDay) =>
      gameDay.games.map((game) => ({ game, gameDay }))
    );

    this.gameDayCount = gameDays.length;
    this.livestreamItems = items.map((item) => ({
      ...item,
      variant: 'livestream',
    }));
    this.highlightItems = items
      .filter((item) => highlightReady(item.game))
      .map((item) => ({ ...item, variant: 'highlights' }));
    this._cdr.markForCheck();
  }
}
