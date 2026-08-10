import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Game, GameAdditionalFields, GameStatusOption } from '@floorball/types';
import { LeagueService } from '@floorball/core';
import {
  ResultTileFormat,
  downloadBlob,
  looksLikeYouthLeague,
  renderResultTile,
} from 'src/app/_helpers/_utils/result-tile';

@Component({
  selector: 'fb-match-report-step-three',
  templateUrl: './match-report-step-three.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MatchReportStepThreeComponent {
  @Input()
  game!: Game;

  @Input()
  additionalFields!: GameAdditionalFields;

  @Input()
  nextStatusOption!: GameStatusOption;

  @Output()
  handleReload = new EventEmitter<void>();

  @Output()
  handleSbbScroll = new EventEmitter<void>();

  @Output()
  updatePeriod: EventEmitter<string> = new EventEmitter<string>();

  @Output()
  closeMatchRecord: EventEmitter<void> = new EventEmitter<void>();

  // ── Ergebniskachel für die sozialen Netze ────────────────────────────────
  //
  // Bisher bauen Vereine das Ergebnisbild nach dem Spiel von Hand nach, oft in
  // Canva. Die Daten liegen hier vollständig vor.

  public tileBusy: ResultTileFormat | null = null;
  public tileError = '';

  /**
   * Namen der Torschützinnen und Torschützen auf der Kachel.
   *
   * Voreingestellt aus, sobald der Liganame auf eine Jugendliga hindeutet. Bei
   * den Overlays war das unkritisch, weil in der Bundesliga Erwachsene spielen;
   * eine Ergebniskachel ist aber für jede Liga verlockend. Ob Namen
   * Minderjähriger dort erscheinen dürfen, ist keine technische Frage, deshalb
   * ist es ein Schalter und keine Automatik — die Voreinstellung nimmt nur die
   * vorsichtige Seite.
   */
  public tileShowScorers = true;

  constructor(
    private _leagueService: LeagueService,
    private _cdr: ChangeDetectorRef
  ) {}

  scrollToSbbNavigation() {
    this.handleSbbScroll.emit();
  }

  reloadGame() {
    this.handleReload.emit();
  }

  handleFinalize() {
    this.closeMatchRecord.emit();
  }
  public get youthLeagueWarning(): boolean {
    return looksLikeYouthLeague(this.game?.league_name);
  }

  public async downloadResultTile(format: ResultTileFormat): Promise<void> {
    if (this.tileBusy) return;

    this.tileBusy = format;
    this.tileError = '';
    this._cdr.markForCheck();

    try {
      const blob = await renderResultTile({
        game: this.game,
        format,
        showScorers: this.tileShowScorers,
      });

      if (!blob) {
        this.tileError = 'Die Kachel konnte nicht erzeugt werden.';
      } else {
        const label = this.game?.game_number || this.game?.id || 'spiel';
        downloadBlob(blob, `ergebnis-${label}-${format}.png`);
      }
    } catch {
      this.tileError = 'Die Kachel konnte nicht erzeugt werden.';
    }

    this.tileBusy = null;
    this._cdr.markForCheck();
  }
}
