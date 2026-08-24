import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { NotificationService, RefereeService } from '@floorball/core';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';
import { RefereeChangeRequest, RefereeProfile } from '@floorball/types';

import { RefereeProfileComponent } from './referee-profile.component';

const OPEN_REQUEST: RefereeChangeRequest = {
  id: 3,
  referee_id: 5,
  correction_type: 'vorname',
  label: 'Vorname',
  new_value: 'Anne',
  current_value: 'Anna',
  requested_value: 'Anne',
  status: 'pending',
};

const DECIDED_REQUEST: RefereeChangeRequest = {
  ...OPEN_REQUEST,
  id: 4,
  correction_type: 'nachname',
  label: 'Nachname',
  status: 'rejected',
  decision_note: 'Nachweis fehlt',
};

const PROFILE: RefereeProfile = {
  id: 5,
  lizenznummer: 4711,
  lizenznummer_display: '4711',
  vorname: 'Anna',
  nachname: 'Beispiel',
  verein: 'Eigener Verein',
  club_id: 1,
  change_requests: [OPEN_REQUEST, DECIDED_REQUEST],
  qualifications: [
    { qualification_type_name: 'Beobachter', valid_until: '31.12.2099' },
    { qualification_type_name: 'Ohne Ablauf', valid_until: null },
  ],
};

describe('RefereeProfileComponent (Stammdaten-Korrekturen)', () => {
  let fixture: ComponentFixture<RefereeProfileComponent>;
  let component: RefereeProfileComponent;
  let refereeService: {
    getProfile: jasmine.Spy;
    updateProfile: jasmine.Spy;
    getExclusionClubs: jasmine.Spy;
    createChangeRequest: jasmine.Spy;
    withdrawChangeRequest: jasmine.Spy;
  };
  let notify: { success: jasmine.Spy; error: jasmine.Spy };

  async function setUp(profile: RefereeProfile = PROFILE) {
    refereeService = {
      getProfile: jasmine.createSpy('getProfile').and.returnValue(of(profile)),
      updateProfile: jasmine
        .createSpy('updateProfile')
        .and.returnValue(of(PROFILE)),
      getExclusionClubs: jasmine.createSpy('getExclusionClubs').and.returnValue(
        of([
          { id: 1, name: 'Eigener Verein' },
          { id: 2, name: 'Neuer Verein' },
          // Gleicher Name, anderer Verein: darf nicht mit ausgeblendet werden.
          { id: 3, name: 'Eigener Verein' },
        ])
      ),
      createChangeRequest: jasmine
        .createSpy('createChangeRequest')
        .and.returnValue(of({ change_requests: [OPEN_REQUEST] })),
      withdrawChangeRequest: jasmine
        .createSpy('withdrawChangeRequest')
        .and.returnValue(of({ change_requests: [] })),
    };
    notify = {
      success: jasmine.createSpy('success'),
      error: jasmine.createSpy('error'),
    };

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, getTranslocoTestingModule()],
      declarations: [RefereeProfileComponent],
      providers: [
        { provide: RefereeService, useValue: refereeService },
        { provide: NotificationService, useValue: notify },
      ],
    })
      .overrideTemplate(RefereeProfileComponent, '')
      .compileComponents();

    fixture = TestBed.createComponent(RefereeProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // Die Zusatzqualifikationen stehen im Profil nur zur Anzeige: Gepflegt werden
  // sie von der RSK, die API nimmt sie im Update nicht an.
  it('fuehrt die Zusatzqualifikationen und bewertet ihre Gueltigkeit', async () => {
    await setUp();

    expect(component.qualifications.map((q) => q.qualification_type_name)).toEqual([
      'Beobachter',
      'Ohne Ablauf',
    ]);
    expect(component.qualificationExpired('31.01.2020')).toBeTrue();
    expect(component.qualificationExpired('31.12.2099')).toBeFalse();
    // Ohne hinterlegten Ablauf gibt es keine Aussage, also nicht rot zeichnen.
    expect(component.qualificationExpired(null)).toBeFalse();
  });

  it('kennt ohne Qualifikationen eine leere Liste', async () => {
    await setUp({ ...PROFILE, qualifications: undefined });

    expect(component.qualifications).toEqual([]);
  });

  it('trennt offene Antraege vom Verlauf', async () => {
    await setUp();

    expect(component.openChangeRequests.map((r) => r.id)).toEqual([3]);
    expect(component.decidedChangeRequests.map((r) => r.id)).toEqual([4]);
    expect(component.pendingCorrectionFor('vorname')).toBeTrue();
    expect(component.pendingCorrectionFor('nachname')).toBeFalse();
  });

  it('schickt einen Textwert getrimmt und ohne Verein', async () => {
    await setUp();

    component.startCorrection('nachname');
    component.correctionForm!.new_value = '  Musterfrau  ';
    component.correctionForm!.reason = ' Heirat ';
    component.submitCorrection();

    expect(refereeService.createChangeRequest).toHaveBeenCalledWith({
      correction_type: 'nachname',
      new_value: 'Musterfrau',
      new_club_id: undefined,
      reason: 'Heirat',
    });
    expect(component.correctionForm).toBeNull();
    expect(notify.success).toHaveBeenCalled();
  });

  it('schickt beim Verein die Vereins-ID statt eines Textwerts', async () => {
    await setUp();

    component.startCorrection('verein');
    component.correctionForm!.new_club_id = 2;
    component.submitCorrection();

    expect(refereeService.createChangeRequest).toHaveBeenCalledWith({
      correction_type: 'verein',
      new_value: undefined,
      new_club_id: 2,
      reason: undefined,
    });
  });

  // Der eigene Verein wuerde nichts aendern, die API weist ihn ab. Verglichen
  // wird die ID: Bei zwei gleichnamigen Vereinen fiele sonst der falsche raus.
  it('bietet den eigenen Verein nicht zur Auswahl an', async () => {
    await setUp();

    component.startCorrection('verein');

    expect(refereeService.getExclusionClubs).toHaveBeenCalled();
    expect(component.correctionClubs.map((c) => c.id)).toEqual([2, 3]);
  });

  it('zeigt nur die Felder ohne offenen Antrag zur Auswahl', async () => {
    await setUp();

    expect(component.correctableFields).toEqual([
      'nachname',
      'geburtsdatum',
      'verein',
    ]);
  });

  it('zeigt Geburtsdaten deutsch, andere Werte unveraendert', async () => {
    await setUp();

    const geburtstag = {
      ...OPEN_REQUEST,
      correction_type: 'geburtsdatum' as const,
    };
    expect(component.correctionValueDisplay(geburtstag, '1991-02-03')).toBe(
      '03.02.1991'
    );
    expect(component.correctionValueDisplay(OPEN_REQUEST, 'Anne')).toBe('Anne');
  });

  // Enter im Antragsfeld darf nicht das umgebende Profil-Formular abschicken.
  it('faengt Enter im Antragsfeld ab und stellt den Antrag', async () => {
    await setUp();

    component.startCorrection('nachname');
    component.correctionForm!.new_value = 'Musterfrau';
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    spyOn(event, 'preventDefault');
    component.submitCorrectionFromKey(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(refereeService.createChangeRequest).toHaveBeenCalled();
    expect(refereeService.updateProfile).not.toHaveBeenCalled();
  });

  it('schickt keinen leeren Antrag ab', async () => {
    await setUp();

    component.startCorrection('nachname');
    component.correctionForm!.new_value = '   ';

    expect(component.canSubmitCorrection()).toBeFalse();
    component.submitCorrection();
    expect(refereeService.createChangeRequest).not.toHaveBeenCalled();
  });

  it('uebernimmt die Antragsliste nach dem Zurueckziehen', async () => {
    await setUp();

    component.withdrawCorrection(3);

    expect(refereeService.withdrawChangeRequest).toHaveBeenCalledWith(3);
    expect(component.openChangeRequests).toEqual([]);
  });

  // Die Antraege laufen ueber eigene Endpunkte; im Profil-PUT haben sie nichts
  // verloren.
  it('schickt die Antragsliste nicht im Profil-PUT mit', async () => {
    await setUp();

    component.submit();

    const payload = refereeService.updateProfile.calls.mostRecent().args[0];
    expect(payload.change_requests).toBeUndefined();
  });
});
