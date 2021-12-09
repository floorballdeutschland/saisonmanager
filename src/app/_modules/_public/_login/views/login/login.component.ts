import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ControlsOf, FormControl, FormGroup } from '@ngneat/reactive-forms';
import { Validators } from '@angular/forms';

export interface LoginFormValue {
  username: string;
  password: string;
}

@Component({
  templateUrl: './login.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup<ControlsOf<LoginFormValue>>;

  ngOnInit(): void {
    this.loginForm = new FormGroup({
      username: new FormControl('', [Validators.required]),
      password: new FormControl('', [Validators.required]),
    });
  }

  loginSubmit(data: LoginFormValue) {
    if (!this.loginForm.valid) {
      return;
    }

    console.log(data);
  }
}
