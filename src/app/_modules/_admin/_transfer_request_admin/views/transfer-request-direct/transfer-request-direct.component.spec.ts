import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { TransferRequestDirectComponent } from './transfer-request-direct.component';

describe('TransferRequestDirectComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        getTranslocoTestingModule(),
      ],
      declarations: [TransferRequestDirectComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // Der aufnehmende Verein darf in jedem Landesverband liegen; zustimmen muss
  // allein der abgebende. Zog die Auswahl ihre Liste aus admin/clubs.json, war
  // sie auf den eigenen Zustaendigkeitsbereich eingegrenzt und ein SBK konnte
  // verbandsuebergreifend nicht zuweisen, obwohl die API es erlaubt.
  it('laedt die Vereinsauswahl verbandsuebergreifend und nur mit aktiven Vereinen', () => {
    const fixture = TestBed.createComponent(TransferRequestDirectComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) =>
      r.urlWithParams.includes('admin/clubs/all.json')
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.urlWithParams).toContain('active_only=true');

    req.flush([
      { id: 7, name: 'Zebras', state_association_id: 3 },
      { id: 9, name: 'Adler', state_association_id: 11 },
    ]);

    expect(fixture.componentInstance.clubs).toEqual([
      { id: 9, name: 'Adler' },
      { id: 7, name: 'Zebras' },
    ]);
  });
});
