import { TestBed } from '@angular/core/testing';

import { LoginComponent } from './login.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { getTranslocoTestingModule, SessionService } from '@floorball/core';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { LoginAnswer } from '@floorball/types';

describe('LoginComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [LoginComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  function loginWithPermissions(permissions: {
    [key: string]: boolean;
  }): jasmine.Spy {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const sessionService = TestBed.inject(SessionService);
    const router = TestBed.inject(Router);
    spyOn(sessionService, 'login').and.returnValue(
      of({ success: true, user: { permissions } } as unknown as LoginAnswer)
    );
    const navigateSpy = spyOn(router, 'navigate');

    component.loginForm.setValue({ username: 'user', password: 'secret' });
    component.loginSubmit(component.loginForm.value);
    return navigateSpy;
  }

  it('should redirect referees to their profile after login', () => {
    const navigateSpy = loginWithPermissions({
      menu_item_referee_profile: true,
      show_page_referee_profile: true,
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/', 'schiedsrichter', 'profil']);
  });

  it('should redirect admins to the league index after login', () => {
    const navigateSpy = loginWithPermissions({
      show_league_index_admin: true,
    });
    expect(navigateSpy).toHaveBeenCalledWith(['verwaltung', 'ligen']);
  });

  it('should redirect users without special permissions to the home page', () => {
    const navigateSpy = loginWithPermissions({});
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });
});
