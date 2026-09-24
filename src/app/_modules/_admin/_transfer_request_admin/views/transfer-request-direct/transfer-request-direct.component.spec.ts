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
  function setupWithFoundPlayer() {
    const fixture = TestBed.createComponent(TransferRequestDirectComponent);
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.urlWithParams.includes('admin/clubs/all.json'))
      .flush([]);
    const component = fixture.componentInstance;
    component.selectedClubId = 9;
    component.foundPlayer = {
      id: 42,
      first_name: 'Max',
      last_name: 'Mustermann',
      birthdate: '1995-03-15',
    } as never;
    return component;
  }

  it('schickt ohne Wunschdatum kein effective_date mit (sofortiger Vollzug)', () => {
    const component = setupWithFoundPlayer();
    component.submit();

    const req = httpMock.expectOne((r) => r.url.includes('direct_assign'));
    expect(req.request.body).toEqual({ player_id: 42, requesting_club_id: 9 });
    req.flush({ id: 1, status: 'approved' });
  });

  it('schickt das Wunschdatum mit und meldet den geplanten Vollzug', () => {
    const component = setupWithFoundPlayer();
    component.effectiveDate = '2027-07-01';
    component.submit();

    const req = httpMock.expectOne((r) => r.url.includes('direct_assign'));
    expect(req.request.body).toEqual({
      player_id: 42,
      requesting_club_id: 9,
      effective_date: '2027-07-01',
    });
    req.flush({ id: 1, status: 'scheduled', effective_date: '2027-07-01' });
  });

  it('bietet als fruehestes Wunschdatum den lokalen heutigen Tag an', () => {
    const component = setupWithFoundPlayer();
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(component.minEffectiveDate).toBe(today);
  });
});
