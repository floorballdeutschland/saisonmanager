import { TestBed } from '@angular/core/testing';

import { ForgotUsernameComponent } from './forgot-username.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import {
  getTranslocoTestingModule,
  NotificationService,
  SessionService,
} from '@floorball/core';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

describe('ForgotUsernameComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [ForgotUsernameComponent],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(ForgotUsernameComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    return component;
  }

  it('should create', () => {
    expect(createComponent()).toBeTruthy();
  });

  it('should send the request and return to the login page', () => {
    const component = createComponent();
    const sessionService = TestBed.inject(SessionService);
    const router = TestBed.inject(Router);
    const forgotSpy = spyOn(sessionService, 'forgotUsername').and.returnValue(
      of({ success: true })
    );
    const navigateSpy = spyOn(router, 'navigate');

    component.submit({ email: '  Verein@example.com  ' });

    expect(forgotSpy).toHaveBeenCalledWith('Verein@example.com');
    expect(navigateSpy).toHaveBeenCalledWith(['/', 'login']);
  });

  // Die Meldung darf nicht verraten, ob die Adresse hinterlegt ist – der Server
  // antwortet in beiden Fällen mit success.
  it('should phrase the confirmation without revealing whether the address exists', () => {
    const component = createComponent();
    const sessionService = TestBed.inject(SessionService);
    const notificationService = TestBed.inject(NotificationService);
    spyOn(sessionService, 'forgotUsername').and.returnValue(
      of({ success: true })
    );
    const successSpy = spyOn(notificationService, 'success');

    component.submit({ email: 'verein@example.com' });

    expect(successSpy.calls.mostRecent().args[0]).toContain('Wenn zu dieser');
  });

  it('should reject a username instead of an email address', () => {
    const component = createComponent();
    const sessionService = TestBed.inject(SessionService);
    const notificationService = TestBed.inject(NotificationService);
    const forgotSpy = spyOn(sessionService, 'forgotUsername');
    const errorSpy = spyOn(notificationService, 'error');

    component.submit({ email: 'vm.berlin' });

    expect(forgotSpy).not.toHaveBeenCalled();
    expect(errorSpy.calls.mostRecent().args[0]).toContain('E-Mail-Adresse');
  });
});
