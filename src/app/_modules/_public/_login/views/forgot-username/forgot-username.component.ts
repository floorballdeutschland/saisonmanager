import {
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ControlsOf, FormControl, FormGroup } from '@ngneat/reactive-forms';
import { Validators } from '@angular/forms';
import { NotificationService, SessionService } from '@floorball/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

export interface ForgotUsernameFormValue {
  email: string;
}

@Component({
  templateUrl: './forgot-username.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class ForgotUsernameComponent implements OnInit, OnDestroy {
  public forgotUsernameForm!: FormGroup<ControlsOf<ForgotUsernameFormValue>>;
  public submitting = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private _sessionService: SessionService,
    private _router: Router,
    private _notificationService: NotificationService
  ) {}

  public ngOnInit(): void {
    this.forgotUsernameForm = new FormGroup({
      email: new FormControl('', [Validators.required]),
    });
  }

  public ngOnDestroy() {
    this.subscriptions.forEach((sub) => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
  }

  public submit(data: ForgotUsernameFormValue) {
    const email = data.email?.trim() ?? '';

    if (!email.includes('@')) {
      this._notificationService.error(
        'Bitte gib deine E-Mail-Adresse ein, nicht deinen Benutzernamen.',
        { autoClose: false, keepAfterRouteChange: true }
      );
      return;
    }

    this.submitting = true;
    this.subscriptions.push(
      this._sessionService.forgotUsername(email).subscribe({
        next: () => {
          this.submitting = false;
          // Bewusst im Konjunktiv: Der Server antwortet auch bei unbekannter
          // Adresse mit success, damit sich hier nicht ablesen lässt, welche
          // Adressen hinterlegt sind. „In den nächsten Minuten" deckt zugleich
          // die serverseitige Wartezeit zwischen zwei Erinnerungen ab.
          this._notificationService.success(
            'Wenn zu dieser Adresse ein Benutzerkonto gehört, schicken wir die Benutzernamen in den nächsten Minuten per E-Mail.',
            { autoClose: false, keepAfterRouteChange: true }
          );
          this._router.navigate(['/', 'login']);
        },
        // Die Server-Meldung (422 bei ungültiger Adresse) zeigt bereits der
        // ErrorInterceptor, hier nur den Button wieder freigeben.
        error: () => {
          this.submitting = false;
        },
      })
    );
  }
}
