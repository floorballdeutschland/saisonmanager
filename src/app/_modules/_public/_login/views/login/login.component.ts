import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { ControlsOf, FormControl, FormGroup } from '@ngneat/reactive-forms';
import { Validators } from '@angular/forms';
import { SessionService } from '@floorball/core';
import { Subscription } from 'rxjs';

export interface LoginFormValue {
  username: string;
  password: string;
}

@Component({
  templateUrl: './login.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class LoginComponent implements OnInit, OnDestroy {
  public loginForm!: FormGroup<ControlsOf<LoginFormValue>>;
  public error = '';

  private subscriptions: Subscription[] = [];

  constructor(private _sessionService: SessionService) {}

  public ngOnInit(): void {
    this.loginForm = new FormGroup({
      username: new FormControl('', [Validators.required]),
      password: new FormControl('', [Validators.required]),
    });
  }

  public ngOnDestroy() {
    if (this.subscriptions) {
      this.subscriptions.forEach((sub) => {
        if (sub && typeof sub.unsubscribe === 'function') {
          sub.unsubscribe();
        }
      });
    }
  }

  public loginSubmit(data: LoginFormValue) {
    if (!this.loginForm.valid) {
      return;
    }

    this.subscriptions.push(
      this._sessionService.login(data.username, data.password).subscribe({
        next: (data) => {
          console.log(data);
          // this.router.navigate([this.returnUrl])
        },
        error: (err) => {
          console.error(err);
          this.error = err;
        },
      })
    );

    console.log(data);
  }
}
