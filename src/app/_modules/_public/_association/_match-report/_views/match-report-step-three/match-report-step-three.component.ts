import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import * as Sentry from '@sentry/angular';
import { Game, GameAdditionalFields, GameStatusOption } from '@floorball/types';
import { LeagueService } from '@floorball/core';
import {
  ResultTileFormat,
  downloadBlob,
  looksLikeYouthLeague,
  renderResultTile,
} from 'src/app/_helpers/_utils/result-tile';
import {
  missingSignatureLabels,
  missingSignatures,
} from 'src/app/_helpers/_utils/missing-signatures';

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

  // Darf die SBK des Spielbetriebs (oder ein Admin) den Bericht abschließen?
  // Dann übergeht die API die fehlenden Unterschriften, und der Knopf warnt
  // nur, statt zu sperren (MatchReportComponent#canCheckGame).
  @Input()
  canOverrideSignatures = false;

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
   * Voreingestellt AN, auch in Jugendligen, und das ist eine bewusste
   * Entscheidung des Verbandes (13.08.2026): Bei einer Jugendliga steht ein
   * Warnhinweis darunter, gesperrt wird nichts. Es ist dieselbe Linie wie bei
   * der Scorerliste, wo der Verband für U13 und jünger ebenfalls mit einer
   * Empfehlung arbeitet und nicht mit einer technischen Sperre.
   *
   * Ob Namen Minderjähriger auf ein Bild für die sozialen Netze dürfen, ist
   * keine technische Frage. Die Erkennung könnte sie auch gar nicht
   * beantworten: Sie hängt am Liganamen, weil der Spielabruf die Altersklasse
   * nicht mitliefert (`leagues.age_group` ist durch einen Backfill von 2026
   * flächendeckend auf Herren/Damen gesetzt und damit unbrauchbar). Eine
   * umbenannte Liga rutscht also durch. Ein Automatismus auf dieser Grundlage
   * wäre eine Sicherheit, die es nicht gibt.
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
    if (!this.signaturesComplete && !this.canOverrideSignatures) return;
    this.closeMatchRecord.emit();
  }

  // ── Unterschriften als Pflicht ───────────────────────────────────────────
  //
  // Welche Haken fehlen, sagt die API (siehe `missing-signatures.ts`). Der
  // Verein kann ohne sie nicht abschließen, die SBK wird nur gewarnt und
  // bestätigt den Abschluss ausdrücklich.

  public isSignatureMissing(field: string): boolean {
    return missingSignatures(this.additionalFields).includes(field);
  }

  public get signaturesComplete(): boolean {
    return missingSignatures(this.additionalFields).length === 0;
  }

  public get missingSignatureLabels(): string[] {
    return missingSignatureLabels(this.additionalFields);
  }

  public get overrideConfirmationContent(): string {
    return (
      `Auf dem Spielbericht fehlen Unterschriften: ${this.missingSignatureLabels.join(', ')}. ` +
      'Als SBK kannst du den Bericht trotzdem abschließen; die Haken bleiben ' +
      'dabei leer. Möchtest du wirklich fortfahren?'
    );
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
    } catch (error) {
      // Dieser catch nimmt den Fehler aus dem Lauf, damit die Bedienung eine
      // Meldung sieht statt einer toten Schaltflaeche. Angular's ErrorHandler
      // sieht nur UNBEHANDELTE Fehler, Sentry bekaeme davon also nichts mit --
      // und ein SecurityError aus `toBlob` oder ein fehlendes `roundRect` auf
      // aelterem Safari waere dauerhaft unsichtbar. Deshalb hier ausdruecklich
      // melden.
      Sentry.captureException(error);
      this.tileError = 'Die Kachel konnte nicht erzeugt werden.';
    }

    this.tileBusy = null;
    this._cdr.markForCheck();
  }
}
