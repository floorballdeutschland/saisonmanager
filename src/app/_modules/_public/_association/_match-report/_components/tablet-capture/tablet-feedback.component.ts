import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';

import { GameShotService } from '@floorball/core';

export const TABLET_FEEDBACK_MAX_LENGTH = 4000;

/**
 * Rückmeldung zur Beta des Tabletmodus (fe#560). Ein eingeklappter Kasten
 * unter der Erfassung; der Freitext geht per Mail an die Administration
 * (api: `games/:id/tablet_feedback`) und wird nirgends gespeichert.
 *
 * Die Antwortadresse ist freiwillig. Angemeldet nimmt die API ohne Angabe die
 * des Kontos; mit dem Sekretariats-Link gibt es keine, die Rückmeldung kommt
 * dann anonym an.
 *
 * Die Spiel-ID kommt als Eingabe und wird beim Wechsel des Spiels neu gesetzt
 * (die Spielseite wird über Spiele wiederverwendet, CLAUDE.md).
 */
@Component({
  selector: 'fb-tablet-feedback',
  templateUrl: './tablet-feedback.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TabletFeedbackComponent implements OnChanges {
  @Input()
  gameId!: number;

  public readonly maxLength = TABLET_FEEDBACK_MAX_LENGTH;

  public open = false;
  public message = '';
  public replyTo = '';
  public sending = false;
  public sent = false;
  public error = false;

  constructor(
    private _gameShotService: GameShotService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['gameId'];
    if (
      change &&
      !change.firstChange &&
      change.previousValue !== change.currentValue
    ) {
      this._reset();
    }
  }

  public get canSend(): boolean {
    const text = this.message.trim();
    return (
      !this.sending &&
      text.length > 0 &&
      text.length <= this.maxLength &&
      this.replyToValid
    );
  }

  public get replyToValid(): boolean {
    const address = this.replyTo.trim();
    return address === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
  }

  public toggle(): void {
    this.open = !this.open;
    this.sent = false;
  }

  public send(): void {
    if (!this.canSend) {
      return;
    }
    const gameId = this.gameId;
    this.sending = true;
    this.error = false;
    this._gameShotService
      .sendTabletFeedback(gameId, {
        message: this.message.trim(),
        reply_to: this.replyTo.trim() || null,
        device: this._device(),
      })
      .subscribe({
        next: () => {
          if (gameId !== this.gameId) {
            return;
          }
          this.sending = false;
          this.sent = true;
          this.open = false;
          this.message = '';
          this._cdr.markForCheck();
        },
        error: () => {
          if (gameId !== this.gameId) {
            return;
          }
          this.sending = false;
          this.error = true;
          this._cdr.markForCheck();
        },
      });
  }

  // Browserkennung und Fenstergröße, damit sich Darstellungsprobleme einem
  // Gerät zuordnen lassen. Nur hier im Browser, nie beim Vorrendern.
  private _device(): string {
    if (typeof window === 'undefined') {
      return '';
    }
    return `${window.navigator.userAgent} · ${window.innerWidth}x${window.innerHeight}`;
  }

  private _reset(): void {
    this.open = false;
    this.message = '';
    this.sending = false;
    this.sent = false;
    this.error = false;
  }
}
