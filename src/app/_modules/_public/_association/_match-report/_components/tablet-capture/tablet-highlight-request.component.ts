import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { GameShotService, SessionService } from '@floorball/core';

// Dasselbe Muster wie die API (URI::MailTo::EMAIL_REGEXP), siehe
// TabletFeedbackComponent.
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Link zur Kalibrierung und Highlight-Auswahl per Mail anfordern (api#838).
 *
 * Das Videobild läuft der Halle je nach Übertragung 10 bis 30 s hinterher.
 * Messen lässt sich das erst an der fertigen Aufzeichnung, also nach dem
 * Spiel: Wer hier eine Adresse hinterlegt, bekommt den Link, sobald der
 * Bericht abgeschlossen und die Aufzeichnung veröffentlicht ist.
 *
 * Angemeldet geht die Mail ohne Angabe an die Adresse des Kontos, eine andere
 * ist möglich. Mit dem Sekretariats-Link gibt es kein Konto, die Adresse ist
 * dann Pflicht. Die API löscht eine eingegebene Adresse nach dem Versand.
 *
 * Bewusst kein Teil des Abschlussdialogs: Im Betrieb mit zwei Geräten schließt
 * das Sekretariat den Bericht ab, nicht das Tablet.
 */
@Component({
  selector: 'fb-tablet-highlight-request',
  templateUrl: './tablet-highlight-request.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TabletHighlightRequestComponent implements OnChanges {
  @Input()
  gameId!: number;

  public open = false;
  public useOtherAddress = false;
  public email = '';
  public sending = false;
  public sent = false;
  public error = false;

  constructor(
    private _gameShotService: GameShotService,
    private _sessionService: SessionService,
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

  /** Adresse des angemeldeten Kontos, sonst `null` (Sekretariats-Link). */
  public get accountEmail(): string | null {
    return this._sessionService.currentUserValue?.email || null;
  }

  /** Ohne Konto oder auf Wunsch eine eigene Adresse. */
  public get needsEmail(): boolean {
    return !this.accountEmail || this.useOtherAddress;
  }

  public get emailValid(): boolean {
    return EMAIL_PATTERN.test(this.email.trim());
  }

  public get canSend(): boolean {
    return !this.sending && (!this.needsEmail || this.emailValid);
  }

  public toggle(): void {
    this.open = !this.open;
    this.error = false;
  }

  public send(): void {
    if (!this.canSend) return;
    const gameId = this.gameId;
    this.sending = true;
    this.error = false;
    this._gameShotService
      .requestHighlightLink(gameId, {
        email: this.needsEmail ? this.email.trim() : null,
      })
      .subscribe({
        next: () => {
          if (gameId !== this.gameId) return;
          this.sending = false;
          this.sent = true;
          this.open = false;
          this._cdr.markForCheck();
        },
        // 422 (ungültige Adresse, zu viele Anfragen) meldet der Interceptor
        // mit dem Text der API, 403/404 nicht.
        error: (err: HttpErrorResponse) => {
          if (gameId !== this.gameId) return;
          this.sending = false;
          this.error = err.status === 403 || err.status === 404;
          this._cdr.markForCheck();
        },
      });
  }

  private _reset(): void {
    this.open = false;
    this.useOtherAddress = false;
    this.email = '';
    this.sending = false;
    this.sent = false;
    this.error = false;
  }
}
