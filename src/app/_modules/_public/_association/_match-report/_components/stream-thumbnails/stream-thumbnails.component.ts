import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import * as Sentry from '@sentry/angular';
import { LeagueService } from '@floorball/core';
import { Game, League } from '@floorball/types';
import {
  CompetitionKey,
  competitionKey,
  leagueMarkUrl,
} from 'src/app/_helpers/_utils/competition-theme';
import {
  ThumbnailInput,
  ThumbnailVariant,
  downloadThumbnail,
  renderStreamThumbnail,
  thumbnailFilename,
} from 'src/app/_helpers/_utils/stream-thumbnail';

const WEEKDAYS = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];

/**
 * Thumbnails für YouTube, im Bild des Wettbewerbs.
 *
 * Steht neben den Overlay-Adressen im Spielbericht UND in der öffentlichen
 * Spielansicht. Das zweite ist kein Beiwerk: Der Zugang zu den Overlays hängt
 * am Spieltags-Token und läuft nach 36 Stunden ab, ein Highlightvideo entsteht
 * aber oft Tage nach dem Spiel. Ein Thumbnail braucht nur öffentliche Daten,
 * also darf es nicht an dieser Frist hängen.
 *
 * Der Abruf der Liga ist der einzige, den diese Komponente macht, und er ist
 * öffentlich. Wichtig für das Spielsekretariat: Es führt den Spielbericht mit
 * einem Einmal-Token und ohne Sitzung, ein Aufruf mit Anmeldepflicht flöge dort
 * als 401 auf und der ErrorInterceptor meldete es mitten im Spiel ab.
 */
@Component({
  selector: 'fb-stream-thumbnails',
  templateUrl: './stream-thumbnails.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class StreamThumbnailsComponent implements OnInit, AfterViewInit {
  @Input()
  game!: Game;

  @ViewChild('preview')
  previewRef?: ElementRef<HTMLCanvasElement>;

  // Ohne Recht am Spielbericht bleibt der Abschnitt leer. Das Ausblenden gehört
  // an die Komponente selbst, damit sie in einem Raster kein leeres Feld
  // hinterlässt -- dieselbe Überlegung wie bei den Overlay-Adressen.
  @HostBinding('class.hidden')
  public get hidden(): boolean {
    return !this.canCreate;
  }

  public variant: ThumbnailVariant = 'livestream';
  public busy = false;
  public error = '';
  public hint = '';

  private _league: League | null = null;
  private _leagueLoaded = false;

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef
  ) {}

  /**
   * Wer den Spielbericht führen darf, darf auch die Grafiken erzeugen. Dieselbe
   * Gruppe erzeugt die Overlay-Adressen, und der Serverfilter dort ist derselbe
   * Gedanke: Admin, SBK, Vereinsmanager und Teammanager der beteiligten Vereine.
   */
  public get canCreate(): boolean {
    return Boolean(this.game?.permission?.includes('edit_game_report'));
  }

  /**
   * Das Highlight-Bild trägt den Endstand. Vor dem Schlusspfiff stünde dort ein
   * Zwischenstand oder 0:0, also wird es erst danach angeboten.
   */
  public get resultAvailable(): boolean {
    return Boolean(this.game?.ended && this.game?.result);
  }

  public get variants(): {
    value: ThumbnailVariant;
    label: string;
    disabled: boolean;
  }[] {
    return [
      { value: 'livestream', label: 'Livestream', disabled: false },
      {
        value: 'highlights',
        label: 'Highlights',
        disabled: !this.resultAvailable,
      },
    ];
  }

  public selectVariant(variant: ThumbnailVariant): void {
    if (this.variant === variant) return;
    if (variant === 'highlights' && !this.resultAvailable) return;

    this.variant = variant;
    void this.render();
  }

  public async download(): Promise<void> {
    const canvas = this.previewRef?.nativeElement;
    if (!canvas || this.busy) return;

    try {
      await downloadThumbnail(canvas, thumbnailFilename(this.input()));
    } catch (error) {
      Sentry.captureException(error);
      this.error =
        'Das Bild konnte nicht gespeichert werden. Als Ausweg lässt es sich mit der rechten Maustaste aus der Vorschau sichern.';
      this._cdr.markForCheck();
    }
  }

  public async render(): Promise<void> {
    const canvas = this.previewRef?.nativeElement;
    if (!canvas || !this.canCreate || !this._leagueLoaded) return;

    this.busy = true;
    this.error = '';
    this._cdr.markForCheck();

    try {
      const result = await renderStreamThumbnail(canvas, this.input());
      this.hint = this.buildHint(result.missing);
    } catch (error) {
      Sentry.captureException(error);
      this.error = 'Die Vorschau konnte nicht gezeichnet werden.';
    }

    this.busy = false;
    this._cdr.markForCheck();
  }

  ngOnInit(): void {
    if (!this.canCreate) return;

    // Nach dem Spiel ist das Highlight-Bild das gefragte, vorher das
    // Livestream-Bild.
    if (this.resultAvailable) this.variant = 'highlights';

    // Das Bild trägt Ligazeichen und Ligafarbe, und beides steht nicht im
    // Spielabruf: Der öffentliche Spielhash nennt nur Name und Kürzel der Liga,
    // nicht ihre Klasse, ihr Geschlecht und ihr Logo.
    this._leagueService.getSingleLeague(this.game.league_id).subscribe({
      next: (league) => {
        this._league = league;
        this._leagueLoaded = true;
        void this.render();
      },
      // Kein Abbruch: Ohne Liga fehlen Zeichen und Farbwelt, die Paarung steht
      // aber trotzdem. Das Bild sieht dann neutral aus, und genau das muss
      // dabeistehen -- sonst lädt jemand ein Bundesliga-Spiel im Standardbild
      // hoch, ohne den Unterschied zu bemerken.
      error: () => {
        this._league = null;
        this._leagueLoaded = true;
        void this.render();
      },
    });
  }

  ngAfterViewInit(): void {
    void this.render();
  }

  private input(): ThumbnailInput {
    const key: CompetitionKey = competitionKey(this._league);
    const result = this.game.result;

    return {
      variant: this.variant,
      competition: key,
      leagueName: this._league?.name || this.game.league_name || '',
      markUrl: leagueMarkUrl(this._league, key),
      home: {
        name: this.game.home_team_name,
        logoUrl: this.game.home_team_logo || this.game.home_team_small_logo,
      },
      guest: {
        name: this.game.guest_team_name,
        logoUrl: this.game.guest_team_logo || this.game.guest_team_small_logo,
      },
      score:
        this.variant === 'highlights' && this.resultAvailable
          ? {
              home: result.home_goals,
              guest: result.guest_goals,
              postfix: result.postfix?.short || null,
            }
          : null,
      dateLine: this.dateLine(),
      venue: this.game.arena_name || null,
    };
  }

  /**
   * „Sa. 12.10.2026 · 18:00 Uhr". Von Hand gesetzt und nicht über die
   * DatePipe: Die Anstoßzeit ist in der API eine Zeichenkette ohne Datum, und
   * das Datum kommt als reiner Tag (`YYYY-MM-DD`). Über `new Date` gelesen wäre
   * das Mitternacht UTC, und in einer westlichen Zeitzone stünde der Vortag im
   * Bild.
   */
  private dateLine(): string {
    const raw = this.game?.date ? String(this.game.date) : '';
    const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    const time = this.game?.start_time;

    if (!parts) return time ? `${time} Uhr` : '';

    const date = new Date(
      Number(parts[1]),
      Number(parts[2]) - 1,
      Number(parts[3])
    );
    const line = `${WEEKDAYS[date.getDay()]} ${parts[3]}.${parts[2]}.${parts[1]}`;

    return this.variant === 'livestream' && time
      ? `${line} · ${time} Uhr`
      : line;
  }

  private buildHint(missing: string[]): string {
    const notes: string[] = [];

    if (!this._league) {
      notes.push(
        'Die Ligadaten ließen sich nicht laden, das Bild trägt deshalb weder Ligazeichen noch Ligafarben.'
      );
    }

    const crests = missing.filter((entry) => entry !== 'mark');
    if (crests.length) {
      notes.push(
        'Ein Vereinswappen ließ sich nicht laden, an seiner Stelle steht das Kürzel.'
      );
    }

    if (missing.includes('mark')) {
      notes.push('Das Ligazeichen ließ sich nicht laden.');
    }

    return notes.join(' ');
  }
}
