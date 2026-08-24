import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

type ResultVariant = 'success' | 'info' | 'error';

interface ResultView {
  variant: ResultVariant;
  title: string;
  message: string;
}

@Component({
  templateUrl: './transfer-confirmation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TransferConfirmationComponent implements OnInit {
  view: ResultView = TransferConfirmationComponent.VIEWS['error'];

  // Ergebnis-Codes, die der API-Endpunkt (player_approve/player_reject) als
  // ?result=… an diese Seite weiterleitet.
  private static readonly VIEWS: Record<string, ResultView> = {
    approved: {
      variant: 'success',
      title: 'Vielen Dank – Zustimmung gespeichert',
      message:
        'Du hast dem Vorgang zugestimmt. Der Antrag wird nun vom Landesverband geprüft. Du musst nichts weiter tun.',
    },
    rejected: {
      variant: 'info',
      title: 'Ablehnung gespeichert',
      message:
        'Du hast den Vorgang abgelehnt. Die beteiligten Vereine wurden informiert.',
    },
    already_approved: {
      variant: 'info',
      title: 'Bereits bestätigt',
      message:
        'Dieser Vorgang wurde bereits bestätigt. Es ist nichts weiter zu tun.',
    },
    already_rejected: {
      variant: 'info',
      title: 'Bereits abgelehnt',
      message: 'Dieser Vorgang wurde bereits abgelehnt.',
    },
    // Sammelfall, und er trifft mehr als einen kaputten Link: Sobald ein Antrag
    // beendet ist, wird sein Bestätigungs-Token geleert (Rückzug, Annullierung,
    // Fristablauf, und seit api#529 auch die Deaktivierung des aufnehmenden
    // Vereins). Der alte Link aus der Zustimmungs-Mail findet den Antrag dann
    // nicht mehr und landet hier. „Link ungültig" war deshalb irreführend, und
    // der Rat, sich an „deinen Verein" zu wenden, führte im
    // Deaktivierungsfall an einen Verein, den es nicht mehr gibt. Über einen
    // beendeten Antrag informiert eine eigene E-Mail.
    error: {
      variant: 'error',
      title: 'Link nicht mehr gültig',
      message:
        'Dieser Bestätigungslink lässt sich nicht mehr verwenden. Entweder wurde er bereits benutzt, oder der Vorgang ist inzwischen beendet – dann hast du dazu eine E-Mail bekommen. Bei Fragen hilft dir der Verein weiter, der den Antrag gestellt hat, oder dein Landesverband.',
    },
  };

  constructor(private _route: ActivatedRoute) {}

  ngOnInit(): void {
    const result = this._route.snapshot.queryParamMap.get('result') ?? 'error';
    this.view =
      TransferConfirmationComponent.VIEWS[result] ??
      TransferConfirmationComponent.VIEWS['error'];
  }
}
