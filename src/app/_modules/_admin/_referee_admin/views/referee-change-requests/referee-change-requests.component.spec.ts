import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { NotificationService, RefereeService } from '@floorball/core';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { RefereeChangeRequest } from '@floorball/types';

import { RefereeChangeRequestsComponent } from './referee-change-requests.component';

const REQUEST: RefereeChangeRequest = {
  id: 12,
  referee_id: 5,
  correction_type: 'nachname',
  label: 'Nachname',
  new_value: 'Musterfrau',
  current_value: 'Beispiel',
  requested_value: 'Musterfrau',
  status: 'pending',
  referee: {
    id: 5,
    lizenznummer_display: '4711',
    vorname: 'Anna',
    nachname: 'Beispiel',
    club_name: 'Eigener Verein',
  },
};

describe('RefereeChangeRequestsComponent', () => {
  let fixture: ComponentFixture<RefereeChangeRequestsComponent>;
  let component: RefereeChangeRequestsComponent;
  let refereeService: {
    adminGetChangeRequests: jasmine.Spy;
    adminApproveChangeRequest: jasmine.Spy;
    adminRejectChangeRequest: jasmine.Spy;
  };
  let notify: { success: jasmine.Spy; error: jasmine.Spy };

  async function setUp() {
    refereeService = {
      adminGetChangeRequests: jasmine
        .createSpy('adminGetChangeRequests')
        .and.returnValue(of([REQUEST])),
      adminApproveChangeRequest: jasmine
        .createSpy('adminApproveChangeRequest')
        .and.returnValue(of(REQUEST)),
      adminRejectChangeRequest: jasmine
        .createSpy('adminRejectChangeRequest')
        .and.returnValue(of(REQUEST)),
    };
    notify = {
      success: jasmine.createSpy('success'),
      error: jasmine.createSpy('error'),
    };

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, getTranslocoTestingModule()],
      declarations: [RefereeChangeRequestsComponent],
      providers: [
        { provide: RefereeService, useValue: refereeService },
        { provide: NotificationService, useValue: notify },
      ],
    })
      .overrideTemplate(RefereeChangeRequestsComponent, '')
      .compileComponents();

    fixture = TestBed.createComponent(RefereeChangeRequestsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('laedt beim Oeffnen die offenen Antraege', async () => {
    await setUp();

    expect(refereeService.adminGetChangeRequests).toHaveBeenCalledWith(
      'pending'
    );
    expect(component.requests.length).toBe(1);
  });

  it('laedt nach einem Statuswechsel neu', async () => {
    await setUp();

    component.changeStatus('approved');

    expect(refereeService.adminGetChangeRequests).toHaveBeenCalledWith(
      'approved'
    );
  });

  // Ohne Begruendung darf die Ablehnung nicht rausgehen: Die API weist sie ab,
  // und der Schiri stuende sonst vor einer Ablehnung ohne Grund.
  it('lehnt ohne Begruendung nicht ab, sondern meldet den fehlenden Grund', async () => {
    await setUp();

    component.reject(REQUEST);

    expect(refereeService.adminRejectChangeRequest).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });

  it('reicht die Begruendung an die Ablehnung durch', async () => {
    await setUp();

    component.setNote(REQUEST.id, '  Nachweis fehlt  ');
    component.reject(REQUEST);

    expect(refereeService.adminRejectChangeRequest).toHaveBeenCalledWith(
      REQUEST.id,
      'Nachweis fehlt'
    );
  });

  it('genehmigt mit optionaler Notiz und laedt die Liste neu', async () => {
    await setUp();
    refereeService.adminGetChangeRequests.calls.reset();

    component.setNote(REQUEST.id, 'Urkunde lag vor');
    component.approve(REQUEST);

    expect(refereeService.adminApproveChangeRequest).toHaveBeenCalledWith(
      REQUEST.id,
      'Urkunde lag vor'
    );
    expect(notify.success).toHaveBeenCalled();
    expect(refereeService.adminGetChangeRequests).toHaveBeenCalled();
  });

  it('verlinkt den Schiri ueber die Lizenznummer', async () => {
    await setUp();

    expect(component.refereeLink(REQUEST)).toEqual([
      '/',
      'verwaltung',
      'schiedsrichter',
      '4711',
    ]);
  });
});
