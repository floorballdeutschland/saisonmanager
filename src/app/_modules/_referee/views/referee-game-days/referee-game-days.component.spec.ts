import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NotificationService, RefereeService } from '@floorball/core';
import { RefereeGameDay, RefereeProfile } from '@floorball/types';
import { UikitCommonModule } from '@floorball/uikit/common';
import { getTranslocoTestingModule } from 'src/app/_modules/_core/_i18n/transloco-testing';

import { RefereeGameDaysComponent } from './referee-game-days.component';

function spieltag(overrides: Partial<RefereeGameDay> = {}): RefereeGameDay {
  return {
    id: 1,
    date: '2026-09-12',
    auto_confirmed: false,
    checklist_required: true,
    checklist_items: [],
    my_checklist_answers: [],
    games: [],
    ...overrides,
  } as RefereeGameDay;
}

describe('RefereeGameDaysComponent (Bestätigungsstatus)', () => {
  let component: RefereeGameDaysComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule()],
      declarations: [RefereeGameDaysComponent],
      providers: [
        {
          provide: RefereeService,
          useValue: {
            getGameDays: jasmine.createSpy().and.returnValue(of([])),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: jasmine.createSpy(),
            error: jasmine.createSpy(),
          },
        },
      ],
    })
      .overrideTemplate(RefereeGameDaysComponent, '')
      .compileComponents();

    component = TestBed.createComponent(
      RefereeGameDaysComponent
    ).componentInstance;
  });

  it('meldet vor dem Freischaltzeitpunkt "not_yet" statt "pending"', () => {
    const inEinerWoche = new Date(Date.now() + 7 * 86400000).toISOString();

    expect(
      component.confirmationStatus(spieltag({ confirmable_from: inEinerWoche }))
    ).toBe('not_yet');
  });

  it('meldet ab dem Freischaltzeitpunkt "pending"', () => {
    const gestern = new Date(Date.now() - 86400000).toISOString();

    expect(
      component.confirmationStatus(spieltag({ confirmable_from: gestern }))
    ).toBe('pending');
  });

  // Der einzige Fall, an dem das Vorzeichen des Vergleichs zählt: genau am
  // Freischaltzeitpunkt. Die API sperrt mit `Time.current < threshold`, ist
  // also in derselben Sekunde offen – ein `>=` hier statt `>` würde die Maske
  // eine Sekunde lang „Noch nicht offen" sagen lassen, obwohl die Bestätigung
  // durchgeht.
  it('meldet genau am Freischaltzeitpunkt "pending"', () => {
    const jetzt = new Date('2026-09-12T18:00:00Z').getTime();
    spyOn(Date, 'now').and.returnValue(jetzt);

    expect(
      component.confirmationStatus(
        spieltag({ confirmable_from: new Date(jetzt).toISOString() })
      )
    ).toBe('pending');
  });

  it('meldet ohne Freischaltzeitpunkt "pending"', () => {
    expect(component.confirmationStatus(spieltag())).toBe('pending');
  });

  it('lässt bestätigte und automatisch bestätigte Spieltage unberührt', () => {
    const inEinerWoche = new Date(Date.now() + 7 * 86400000).toISOString();

    expect(
      component.confirmationStatus(
        spieltag({
          confirmable_from: inEinerWoche,
          my_confirmed_at: '2026-09-12T20:00:00Z',
        })
      )
    ).toBe('confirmed');
    expect(
      component.confirmationStatus(
        spieltag({
          confirmable_from: inEinerWoche,
          my_confirmed_at: '2026-09-12T20:00:00Z',
          properly_conducted: false,
        })
      )
    ).toBe('not_ok');
    expect(
      component.confirmationStatus(
        spieltag({ confirmable_from: inEinerWoche, auto_confirmed: true })
      )
    ).toBe('auto');
  });
});

describe('RefereeGameDaysComponent (Mit-Angesetzte und Kontaktfreigabe)', () => {
  let refereeService: jasmine.SpyObj<RefereeService>;

  function render(
    days: RefereeGameDay[],
    share: boolean | null
  ): ComponentFixture<RefereeGameDaysComponent> {
    refereeService.getGameDays.and.returnValue(of(days));
    refereeService.getProfile.and.returnValue(
      of({ share_contact_with_officials: share } as RefereeProfile)
    );
    const fixture = TestBed.createComponent(RefereeGameDaysComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    refereeService = jasmine.createSpyObj('RefereeService', [
      'getGameDays',
      'getProfile',
      'updateProfile',
    ]);
    await TestBed.configureTestingModule({
      imports: [getTranslocoTestingModule(), UikitCommonModule],
      declarations: [RefereeGameDaysComponent],
      providers: [
        provideRouter([]),
        { provide: RefereeService, useValue: refereeService },
        {
          provide: NotificationService,
          useValue: {
            success: jasmine.createSpy(),
            error: jasmine.createSpy(),
          },
        },
      ],
    }).compileComponents();
  });

  const tagMitGespann = spieltag({
    games: [
      {
        id: 7,
        home_team: 'A',
        guest_team: 'B',
        officials: [
          {
            role: 'referee2',
            name: 'Paula Partner',
            contact_shared: true,
            telefonnummer: '0170 1234567',
            email: 'paula@example.com',
          },
          { role: 'coach', name: 'Carl Coach', contact_shared: false },
        ],
      },
    ],
  });

  it('verlinkt Telefon und E-Mail freigegebener Mit-Angesetzter', () => {
    const el: HTMLElement = render([tagMitGespann], true).nativeElement;

    const rows = el.querySelectorAll('[data-testid="official"]');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('a[href="tel:0170 1234567"]')).not.toBeNull();
    expect(
      rows[0].querySelector('a[href="mailto:paula@example.com"]')
    ).not.toBeNull();
    expect(rows[1].textContent).toContain('Carl Coach');
    expect(rows[1].querySelector('a')).toBeNull();
  });

  it('fragt einmal nach, solange die Freigabe nie beantwortet wurde', () => {
    refereeService.updateProfile.and.returnValue(of({} as RefereeProfile));
    const fixture = render([], null);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="share-prompt"]')).not.toBeNull();

    (el.querySelector('[data-testid="share-no"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(refereeService.updateProfile).toHaveBeenCalledWith({
      share_contact_with_officials: false,
    });
    expect(el.querySelector('[data-testid="share-prompt"]')).toBeNull();
  });

  it('erklärt fehlende Kontaktdaten, solange man selbst nicht teilt', () => {
    const ohneDaten = spieltag({
      games: [
        {
          id: 7,
          officials: [
            { role: 'referee2', name: 'Paula Partner', contact_shared: true },
          ],
        },
      ],
    });
    const el: HTMLElement = render([ohneDaten], false).nativeElement;

    const row = el.querySelector('[data-testid="official"]')!;
    expect(row.textContent).toContain(
      'refereeSelf.gameDays.contactNeedsOwnShare'
    );
  });

  it('lädt die Spieltage nach einer Zustimmung neu', () => {
    refereeService.updateProfile.and.returnValue(of({} as RefereeProfile));
    const fixture = render([], null);
    refereeService.getGameDays.calls.reset();

    (
      fixture.nativeElement.querySelector(
        '[data-testid="share-yes"]'
      ) as HTMLElement
    ).click();

    expect(refereeService.getGameDays).toHaveBeenCalledTimes(1);
  });

  it('fragt nicht erneut nach einer Ablehnung', () => {
    const el: HTMLElement = render([], false).nativeElement;
    expect(el.querySelector('[data-testid="share-prompt"]')).toBeNull();
  });
});
