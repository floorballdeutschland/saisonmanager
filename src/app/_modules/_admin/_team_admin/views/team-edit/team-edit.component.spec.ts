import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import {
  getTranslocoTestingModule,
  NotificationService,
} from '@floorball/core';
import { environment } from 'src/environments/environment';
import { Team } from 'src/app/_models';
import { TeamEditComponent } from './team-edit.component';

// Ein Datei-Input laesst sich nicht befuellen, deshalb ein Stub mit den beiden
// Feldern, die onLogoSelected liest und schreibt. PNG, damit die clientseitige
// Format- und Groessenpruefung passiert und der Upload wirklich rausgeht.
function squarePngInput(): HTMLInputElement {
  const file = new File(['x'], 'logo.png', { type: 'image/png' });
  return { files: [file], value: 'logo.png' } as unknown as HTMLInputElement;
}

describe('TeamEditComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [TeamEditComponent],
    })
      .overrideTemplate(TeamEditComponent, '')
      .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(TeamEditComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('canDelete reflects the team_delete permission of the current user', () => {
    const fixture = TestBed.createComponent(TeamEditComponent);
    const component = fixture.componentInstance;

    expect(component.canDelete).toBeFalse();

    component.currentUser = {
      id: 1,
      username: 'admin',
      permissions: { team_delete: true },
    } as never;

    expect(component.canDelete).toBeTrue();
  });

  it('deleteTeam sends a DELETE request and navigates back to the team list on success', () => {
    const fixture = TestBed.createComponent(TeamEditComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');

    component.currentUser = {
      id: 1,
      username: 'admin',
      permissions: { team_delete: true },
    } as never;

    const team = { id: 42, name: 'Testteam', league_id: 7 } as Team;
    component.deleteTeam(team);

    const req = httpMock.expectOne(`${environment.apiURL}admin/teams/42.json`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(navigateSpy).toHaveBeenCalledWith([
      'verwaltung',
      'ligen',
      7,
      'teams',
    ]);
    expect(component.deleting).toBeFalse();
  });

  it('deleteTeam resets deleting and shows an error notification when the backend rejects', () => {
    const fixture = TestBed.createComponent(TeamEditComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    const notificationService = TestBed.inject(NotificationService);
    const errorSpy = spyOn(notificationService, 'error');

    component.currentUser = {
      id: 1,
      username: 'admin',
      permissions: { team_delete: true },
    } as never;

    const team = { id: 42, name: 'Testteam', league_id: 7 } as Team;
    component.deleteTeam(team);

    const req = httpMock.expectOne(`${environment.apiURL}admin/teams/42.json`);
    req.flush(
      {
        message:
          'Team kann nicht gelöscht werden: Es sind noch Spiele zugeordnet.',
      },
      { status: 422, statusText: 'Unprocessable Entity' }
    );

    expect(component.deleting).toBeFalse();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Team kann nicht gelöscht werden: Es sind noch Spiele zugeordnet.',
      { autoClose: false }
    );
  });

  it('onLogoSelected adds no own notification when the upload is rejected', () => {
    const fixture = TestBed.createComponent(TeamEditComponent);
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    const errorSpy = spyOn(notificationService, 'error');

    const team = { id: 42, name: 'Testteam', league_id: 7 } as Team;
    const input = squarePngInput();
    component.onLogoSelected(team, input);

    const req = httpMock.expectOne(
      `${environment.apiURL}admin/teams/42/upload_logo.json`
    );
    expect(req.request.method).toBe('POST');
    req.flush(
      { message: 'Das Logo muss quadratisch sein (gleiche Breite und Höhe).' },
      { status: 422, statusText: 'Unprocessable Entity' }
    );

    // Die Servermeldung kommt vom ErrorInterceptor. Ein zusaetzlicher Toast der
    // Komponente hat sie ueberdeckt (#228) und darf nicht zurueckkommen.
    expect(errorSpy).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('onLogoSelected rejects a non-image before any request goes out', () => {
    const fixture = TestBed.createComponent(TeamEditComponent);
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    const errorSpy = spyOn(notificationService, 'error');

    const file = new File(['x'], 'logo.gif', { type: 'image/gif' });
    const input = {
      files: [file],
      value: 'logo.gif',
    } as unknown as HTMLInputElement;

    component.onLogoSelected(
      { id: 42, name: 'Testteam', league_id: 7 } as Team,
      input
    );

    httpMock.expectNone(`${environment.apiURL}admin/teams/42/upload_logo.json`);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('deleteTeam does nothing when the user lacks permission', () => {
    const fixture = TestBed.createComponent(TeamEditComponent);
    const component = fixture.componentInstance;

    component.currentUser = {
      id: 1,
      username: 'admin',
      permissions: {},
    } as never;

    component.deleteTeam({ id: 42, name: 'Testteam', league_id: 7 } as Team);

    httpMock.expectNone(`${environment.apiURL}admin/teams/42.json`);
  });
});
