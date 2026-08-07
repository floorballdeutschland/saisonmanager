import { TestBed } from '@angular/core/testing';

import { ClubEditComponent } from './club-edit.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  getTranslocoTestingModule,
  NotificationService,
} from '@floorball/core';
import { RouterTestingModule } from '@angular/router/testing';
import { Club } from '@floorball/types';
import { environment } from 'src/environments/environment';

// Ein Datei-Input laesst sich nicht befuellen, deshalb ein Stub mit den beiden
// Feldern, die onLogoSelected liest und schreibt. PNG, damit die clientseitige
// Format- und Groessenpruefung passiert und der Upload wirklich rausgeht.
function pngInput(): HTMLInputElement {
  const file = new File(['x'], 'logo.png', { type: 'image/png' });
  return { files: [file], value: 'logo.png' } as unknown as HTMLInputElement;
}

describe('ClubEditComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [ClubEditComponent],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('onLogoSelected adds no own notification when the upload is rejected', () => {
    const fixture = TestBed.createComponent(ClubEditComponent);
    const component = fixture.componentInstance;
    const notificationService = TestBed.inject(NotificationService);
    const errorSpy = spyOn(notificationService, 'error');

    const input = pngInput();
    component.onLogoSelected({ id: 42, name: 'Testverein' } as Club, input);

    const req = httpMock.expectOne(
      `${environment.apiURL}admin/clubs/42/upload_logo.json`
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
});
