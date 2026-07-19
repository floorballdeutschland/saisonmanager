import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SessionService } from '@floorball/core';

// Öffentliche Zielseite des Bestätigungslinks aus der E-Mail-Änderungs-Mail
// (/email-bestaetigen?token=…): löst das Token direkt gegen die API ein und
// zeigt Erfolg bzw. ungültigen/abgelaufenen Link an.
@Component({
  templateUrl: './email-confirmation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EmailConfirmationComponent implements OnInit {
  state: 'loading' | 'success' | 'error' = 'loading';
  confirmedEmail: string | null = null;

  constructor(
    private _route: ActivatedRoute,
    private _sessionService: SessionService,
    private _cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const token = this._route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.state = 'error';
      return;
    }

    this._sessionService.confirmEmailChange(token).subscribe({
      next: (answer) => {
        this.state = answer.success ? 'success' : 'error';
        this.confirmedEmail = answer.email ?? null;
        this._cdr.markForCheck();
      },
      // Der ErrorInterceptor lässt diesen Endpoint bewusst durch (keine
      // globalen Toasts) – ungültige/abgelaufene Links landen hier.
      error: () => {
        this.state = 'error';
        this._cdr.markForCheck();
      },
    });
  }
}
